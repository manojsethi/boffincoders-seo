import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { ReportModel, ProjectModel } from '../../db';
import { getLogger } from '../../config/logger';
import { generateReport } from '../../reports';

const log = getLogger('jobs:report');

export type ReportJobData = {
  projectId: string;
  reportId: string;
  type: 'initial-audit' | 'weekly-progress' | 'monthly-progress' | 'verification' | 'internal';
  crawlRunId?: string;
  auditRunId?: string;
  view?: 'client' | 'internal';
  periodStart?: string;
  periodEnd?: string;
};

export async function runGenerateReportHandler(job: Job<ReportJobData>): Promise<void> {
  const data = job.attrs.data;
  try {
    await generateReport({
      projectId: data.projectId,
      reportId: data.reportId,
      type: data.type,
      crawlRunId: data.crawlRunId,
      auditRunId: data.auditRunId,
      view: data.view,
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
    });
    await ProjectModel.updateOne(
      { _id: new Types.ObjectId(data.projectId) },
      { $set: { lastReportedAt: new Date() } },
    );
    log.info({ projectId: data.projectId, reportId: data.reportId }, 'report generated');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, projectId: data.projectId, reportId: data.reportId }, 'report generation failed');
    await ReportModel.updateOne(
      { _id: new Types.ObjectId(data.reportId) },
      { $set: { status: 'draft', error: msg } },
    );
    throw err;
  }
}
