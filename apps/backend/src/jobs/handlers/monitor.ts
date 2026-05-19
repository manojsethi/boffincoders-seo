import type { Job } from 'agenda';
import { getLogger } from '../../config/logger';
import { createCrawlRun, createAuditRun, createReportDraft } from '../../domain';
import { getAgenda, JOB_NAMES } from '../agenda';

const log = getLogger('jobs:monitor');

export async function runMonitorWeeklyHandler(job: Job<{ projectId: string }>): Promise<void> {
  const { projectId } = job.attrs.data;
  log.info({ projectId }, 'weekly monitor: queueing crawl');
  const agenda = getAgenda();
  const crawl = await createCrawlRun({ projectId, mode: 'full', triggeredBy: 'schedule' });
  await agenda.now(JOB_NAMES.runCrawl, { projectId, crawlRunId: crawl.id, triggeredBy: 'schedule' });
}

export async function runMonitorMonthlyHandler(job: Job<{ projectId: string }>): Promise<void> {
  const { projectId } = job.attrs.data;
  log.info({ projectId }, 'monthly monitor: queueing report');
  const agenda = getAgenda();
  const periodStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const periodEnd = new Date();
  const report = await createReportDraft({
    projectId,
    type: 'monthly-progress',
    view: 'client',
    periodStart,
    periodEnd,
  });
  await agenda.now(JOB_NAMES.generateReport, {
    projectId,
    reportId: report.id,
    type: 'monthly-progress',
    view: 'client',
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });
}

export async function runVerifyFixesHandler(job: Job<{ projectId: string }>): Promise<void> {
  const { projectId } = job.attrs.data;
  const agenda = getAgenda();
  const audit = await createAuditRun({ projectId, triggeredBy: 'system' });
  await agenda.now(JOB_NAMES.runAudit, {
    projectId,
    auditRunId: audit.id,
    crawlRunId: audit.crawlRunId,
  });
  log.info({ projectId, auditRunId: audit.id }, 'verify-fixes: audit queued');
}
