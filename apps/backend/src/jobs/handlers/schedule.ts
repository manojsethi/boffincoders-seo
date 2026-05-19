// Schedule-tick wrappers. Each Agenda job here corresponds 1:1 with a Schedule.type value and
// dispatches to the correct underlying action job. Doc 12 §"Recurring Jobs And Schedules" — the
// monitor must distinguish between schedules and their executions, so we update Schedule.lastRunAt
// + Schedule.nextRunAt every tick.

import type { Job } from 'agenda';
import { Types } from 'mongoose';
import { getLogger } from '../../config/logger';
import {
  ScheduleModel,
  SiteConnectionModel,
} from '../../db';
import { createCrawlRun, createAuditRun, createReportDraft } from '../../domain';
import { getAgenda, JOB_NAMES } from '../agenda';

const log = getLogger('jobs:schedule');

type ScheduleTickData = {
  projectId: string;
  scheduleId: string;
  provider?: 'gsc' | 'ga4' | 'cwv' | 'all';
};

async function markRun(job: Job<ScheduleTickData>): Promise<void> {
  const { scheduleId } = job.attrs.data;
  if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) return;
  const nextRunAt = (job.attrs.nextRunAt as Date | undefined) ?? undefined;
  await ScheduleModel.updateOne(
    { _id: new Types.ObjectId(scheduleId) },
    { $set: { lastRunAt: new Date(), ...(nextRunAt ? { nextRunAt } : {}) } },
  );
}

export async function runScheduleCrawlHandler(job: Job<ScheduleTickData>): Promise<void> {
  const { projectId } = job.attrs.data;
  await markRun(job);
  log.info({ projectId, scheduleId: job.attrs.data.scheduleId }, 'schedule crawl tick');
  const crawl = await createCrawlRun({ projectId, mode: 'full', triggeredBy: 'schedule' });
  await getAgenda().now(JOB_NAMES.runCrawl, {
    projectId,
    crawlRunId: crawl.id,
    triggeredBy: 'schedule',
    trigger: 'scheduled',
    scheduleId: job.attrs.data.scheduleId,
  });
}

export async function runScheduleAuditHandler(job: Job<ScheduleTickData>): Promise<void> {
  const { projectId } = job.attrs.data;
  await markRun(job);
  log.info({ projectId, scheduleId: job.attrs.data.scheduleId }, 'schedule audit tick');
  const audit = await createAuditRun({ projectId, triggeredBy: 'system' });
  await getAgenda().now(JOB_NAMES.runAudit, {
    projectId,
    auditRunId: audit.id,
    crawlRunId: audit.crawlRunId,
    trigger: 'scheduled',
    scheduleId: job.attrs.data.scheduleId,
  });
}

export async function runScheduleReportHandler(job: Job<ScheduleTickData>): Promise<void> {
  const { projectId } = job.attrs.data;
  await markRun(job);
  log.info({ projectId, scheduleId: job.attrs.data.scheduleId }, 'schedule report tick');
  // Cadence informs report window: derive from the schedule doc.
  const sched = await ScheduleModel.findById(job.attrs.data.scheduleId).lean();
  const type =
    sched?.cadence === 'monthly' ? 'monthly-progress' : ('weekly-progress' as const);
  const daySpan = type === 'monthly-progress' ? 30 : 7;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - daySpan * 86_400_000);
  const draft = await createReportDraft({
    projectId,
    type,
    view: 'internal',
    periodStart,
    periodEnd,
  });
  await getAgenda().now(JOB_NAMES.generateReport, {
    projectId,
    reportId: draft.id,
    type,
    view: 'internal',
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    trigger: 'scheduled',
    scheduleId: job.attrs.data.scheduleId,
  });
}

/**
 * Integration sync tick. When provider === 'all' (default), enqueues every connected provider so
 * the Monitoring UI's claim that the schedule will keep all integrations fresh holds true.
 */
export async function runScheduleSyncHandler(job: Job<ScheduleTickData>): Promise<void> {
  const { projectId, provider = 'all', scheduleId } = job.attrs.data;
  await markRun(job);
  log.info({ projectId, scheduleId, provider }, 'schedule sync tick');
  const agenda = getAgenda();
  const conns = await SiteConnectionModel.find({
    projectId: new Types.ObjectId(projectId),
    status: 'connected',
  })
    .select({ provider: 1 })
    .lean();
  const connected = new Set(conns.map((c) => c.provider));
  // CWV is not a SiteConnection-backed integration; it's API-key driven. Treat as always available.
  connected.add('cwv');

  const want = provider === 'all' ? ['gsc', 'ga4', 'cwv'] : [provider];
  const jobByProvider: Record<string, string> = {
    gsc: JOB_NAMES.syncGSC,
    ga4: JOB_NAMES.syncGA4,
    cwv: JOB_NAMES.syncCWV,
  };
  const dispatched: string[] = [];
  for (const p of want) {
    if (!connected.has(p)) continue;
    await agenda.now(jobByProvider[p]!, {
      projectId,
      trigger: 'scheduled',
      scheduleId,
    });
    dispatched.push(p);
  }
  log.info({ projectId, scheduleId, dispatched }, 'schedule sync dispatched');
}
