import type { Agenda, Job } from 'agenda';
import { JOB_NAMES } from './agenda';
import { runCrawlHandler, type CrawlJobData } from './handlers/crawl';
import { runAuditHandler, type AuditJobData } from './handlers/audit';
import { runAIAnalysisHandler, type AIAnalysisJobData } from './handlers/ai-analysis';
import { runGenerateReportHandler, type ReportJobData } from './handlers/report';
import { runSyncGSCHandler, runSyncGA4Handler, runSyncCWVHandler } from './handlers/sync';
import {
  runMonitorWeeklyHandler,
  runMonitorMonthlyHandler,
  runVerifyFixesHandler,
} from './handlers/monitor';
import { runRenderHandler, type RenderJobData } from './handlers/render';
import {
  runScheduleCrawlHandler,
  runScheduleAuditHandler,
  runScheduleReportHandler,
  runScheduleSyncHandler,
} from './handlers/schedule';

const wrap = <T>(fn: (job: Job<T>) => Promise<void>) => (job: Job<unknown>) => fn(job as Job<T>);

export function registerJobs(agenda: Agenda): void {
  agenda.define(JOB_NAMES.runFirstCrawl, wrap<CrawlJobData>(runCrawlHandler), {
    concurrency: 1,
    priority: 'high',
  });
  agenda.define(JOB_NAMES.runCrawl, wrap<CrawlJobData>(runCrawlHandler), { concurrency: 2 });
  agenda.define(JOB_NAMES.runAudit, wrap<AuditJobData>(runAuditHandler), { concurrency: 2 });
  agenda.define(JOB_NAMES.runAIAnalysis, wrap<AIAnalysisJobData>(runAIAnalysisHandler), { concurrency: 1 });
  agenda.define(JOB_NAMES.generateReport, wrap<ReportJobData>(runGenerateReportHandler), {
    concurrency: 2,
  });
  agenda.define(JOB_NAMES.syncGSC, wrap<{ projectId: string }>(runSyncGSCHandler), { concurrency: 3 });
  agenda.define(JOB_NAMES.syncGA4, wrap<{ projectId: string }>(runSyncGA4Handler), { concurrency: 3 });
  agenda.define(JOB_NAMES.syncCWV, wrap<{ projectId: string; maxUrls?: number }>(runSyncCWVHandler), {
    concurrency: 3,
  });
  agenda.define(JOB_NAMES.verifyFixes, wrap<{ projectId: string }>(runVerifyFixesHandler), {
    concurrency: 1,
  });
  agenda.define(JOB_NAMES.monitorWeekly, wrap<{ projectId: string }>(runMonitorWeeklyHandler), {
    concurrency: 2,
  });
  agenda.define(JOB_NAMES.monitorMonthly, wrap<{ projectId: string }>(runMonitorMonthlyHandler), {
    concurrency: 2,
  });
  agenda.define(JOB_NAMES.renderRecrawl, wrap<RenderJobData>(runRenderHandler), {
    concurrency: 1,
  });
  // Schedule wrappers (per type) — explicit Agenda jobs registered with friendly names so the
  // monitor + cancel queries always have a concrete target.
  type ScheduleTickData = { projectId: string; scheduleId: string; provider?: 'gsc' | 'ga4' | 'cwv' | 'all' };
  agenda.define(
    JOB_NAMES.scheduleCrawl,
    wrap<ScheduleTickData>(runScheduleCrawlHandler),
    { concurrency: 1 },
  );
  agenda.define(
    JOB_NAMES.scheduleAudit,
    wrap<ScheduleTickData>(runScheduleAuditHandler),
    { concurrency: 1 },
  );
  agenda.define(
    JOB_NAMES.scheduleReport,
    wrap<ScheduleTickData>(runScheduleReportHandler),
    { concurrency: 1 },
  );
  agenda.define(
    JOB_NAMES.scheduleSync,
    wrap<ScheduleTickData>(runScheduleSyncHandler),
    { concurrency: 1 },
  );
}
