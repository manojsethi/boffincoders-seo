import { Types } from 'mongoose';
import { ReportModel } from '../db';
import { buildInitialAuditReport } from './initial-audit';
import { buildProgressReport } from './progress';

export type GenerateReportOptions = {
  projectId: string;
  reportId: string;
  type: 'initial-audit' | 'weekly-progress' | 'monthly-progress' | 'verification' | 'internal';
  crawlRunId?: string;
  auditRunId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  view?: 'client' | 'internal';
};

export async function generateReport(opts: GenerateReportOptions): Promise<void> {
  const reportId = new Types.ObjectId(opts.reportId);
  const view = opts.view ?? 'client';
  let markdown = '';
  let sections: Array<{ key: string; title: string; body: string }> = [];
  let executiveSummary = '';
  let sourceAuditRunIds: Types.ObjectId[] = [];
  let sourceCrawlRunIds: Types.ObjectId[] = [];

  if (opts.type === 'initial-audit' || opts.type === 'verification') {
    if (!opts.crawlRunId || !opts.auditRunId) throw new Error('crawlRunId + auditRunId required');
    const built = await buildInitialAuditReport({
      projectId: opts.projectId,
      crawlRunId: opts.crawlRunId,
      auditRunId: opts.auditRunId,
      view,
    });
    markdown = built.markdown;
    sections = built.sections;
    executiveSummary = built.executiveSummary;
    sourceAuditRunIds = [new Types.ObjectId(opts.auditRunId)];
    sourceCrawlRunIds = [new Types.ObjectId(opts.crawlRunId)];
  } else if (opts.type === 'weekly-progress' || opts.type === 'monthly-progress') {
    const end = opts.periodEnd ?? new Date();
    const start =
      opts.periodStart ??
      new Date(end.getTime() - (opts.type === 'weekly-progress' ? 7 : 30) * 24 * 3600 * 1000);
    const built = await buildProgressReport({
      projectId: opts.projectId,
      type: opts.type,
      periodStart: start,
      periodEnd: end,
      view,
    });
    markdown = built.markdown;
    sections = built.sections;
    executiveSummary = built.executiveSummary;
    sourceAuditRunIds = built.sourceAuditRunIds;
  } else {
    markdown = '# Internal report\n\n_Custom internal report — populate as needed._';
    sections = [];
    executiveSummary = 'Internal report';
  }

  await ReportModel.updateOne(
    { _id: reportId },
    {
      $set: {
        type: opts.type,
        status: 'ready',
        view,
        markdown,
        sections,
        executiveSummary,
        sourceAuditRunIds,
        sourceCrawlRunIds,
        ...(opts.periodStart ? { periodStart: opts.periodStart } : {}),
        ...(opts.periodEnd ? { periodEnd: opts.periodEnd } : {}),
      },
    },
  );
}
