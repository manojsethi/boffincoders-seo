import { Types } from 'mongoose';
import {
  ProjectModel,
  CrawlRunModel,
  PageModel,
  PageContentModel,
  PageRawModel,
  PageSnapshotModel,
  InternalLinkModel,
  AuditRunModel,
  FindingModel,
  IssueModel,
  RecommendationModel,
  OpportunityModel,
  ContentBriefModel,
  FixPlanModel,
  KeywordModel,
  KeywordFitModel,
  GscRowModel,
  Ga4RowModel,
  CwvMetricModel,
  AIAnalysisModel,
  AiTaskRunModel,
  RenderRunModel,
  RobotsCacheModel,
  RunEventModel,
  WebsiteProfileModel,
  ScheduleModel,
  ReportModel,
  SiteConnectionModel,
} from '../db';
import { getAgenda, JOB_NAMES } from '../jobs';
import type { Model } from 'mongoose';

/**
 * Project reset + archive. Phase 10.
 *
 * Reset is scoped — see docs §"Reset Project Data". Each mode declares the collections it
 * touches; we never blanket-delete by projectId. The reset always returns a per-collection count
 * so the UI can show exactly what changed.
 *
 * Archive flips `status` to `archived`, pauses recurring schedules, and cancels their queued
 * Agenda jobs so monitoring runs don't continue while the project is shelved.
 */

export type ResetMode =
  | 'fresh-audit-baseline'
  | 'performance-data'
  | 'execution-data'
  | 'full';

export interface ResetOptions {
  keepGoals?: boolean;
  keepIntegrations?: boolean;
  keepCrawlSettings?: boolean;
  keepMonitoringSettings?: boolean;
}

export interface ResetResult {
  ok: true;
  mode: ResetMode;
  deleted: Record<string, number>;
  kept: string[];
  schedulesPaused: number;
  agendaJobsCancelled: number;
  nextAction: string;
}

const NEXT_ACTION: Record<ResetMode, string> = {
  'fresh-audit-baseline':
    'Run a new crawl to create a fresh baseline. Goals, integrations, and crawl settings are preserved.',
  'performance-data':
    'Reconnect or re-sync GSC / GA4 / CWV. Search, traffic, and Core Web Vitals dashboards will repopulate.',
  'execution-data':
    'Re-approve recommendations and rebuild your fix plan. Audit evidence + performance data are unchanged.',
  full:
    'Open Project → Setup to reconfigure profile, goals, integrations, and crawl settings, then run a first crawl.',
};

/**
 * Identify running crawl / audit / render runs that would conflict with a reset. Caller decides
 * whether to abort or cancel them.
 */
export async function getRunningProjectJobs(
  projectId: string,
): Promise<{
  crawlRuns: number;
  auditRuns: number;
  renderRuns: number;
  total: number;
}> {
  const pid = new Types.ObjectId(projectId);
  const [crawl, audit, render] = await Promise.all([
    CrawlRunModel.countDocuments({ projectId: pid, status: { $in: ['queued', 'running'] } }),
    AuditRunModel.countDocuments({ projectId: pid, status: { $in: ['queued', 'running'] } }),
    RenderRunModel.countDocuments({ projectId: pid, status: { $in: ['queued', 'running'] } }),
  ]);
  return {
    crawlRuns: crawl,
    auditRuns: audit,
    renderRuns: render,
    total: crawl + audit + render,
  };
}

/**
 * Cancel queued Agenda jobs for this project across every project.* job name. Uses dot-path
 * match because Agenda stores `data` as a nested object (doc 12 §"Cancellation").
 */
async function cancelProjectAgendaJobs(projectId: string): Promise<number> {
  const agenda = getAgenda();
  const names = Object.values(JOB_NAMES);
  const r = await agenda.cancel({
    name: { $in: names },
    'data.projectId': projectId,
  } as unknown as Record<string, unknown>);
  return typeof r === 'number' ? r : 0;
}

/**
 * Pause all schedules + cancel agenda jobs. Used by archive and by reset.
 */
async function pauseProjectSchedules(projectId: string): Promise<{ paused: number; cancelled: number }> {
  const pid = new Types.ObjectId(projectId);
  const schedules = await ScheduleModel.find({ projectId: pid, enabled: true }).lean();
  if (schedules.length === 0) {
    const cancelled = await cancelProjectAgendaJobs(projectId);
    return { paused: 0, cancelled };
  }
  await ScheduleModel.updateMany(
    { projectId: pid, enabled: true },
    { $set: { enabled: false, nextRunAt: null } },
  );
  const cancelled = await cancelProjectAgendaJobs(projectId);
  return { paused: schedules.length, cancelled };
}

/**
 * Models touched per mode. Pure data; doesn't run the delete itself.
 */
function modelsForMode(
  mode: ResetMode,
): Array<{ key: string; model: Model<unknown> }> {
  const audit = [
    { key: 'crawlRuns', model: CrawlRunModel },
    { key: 'pages', model: PageModel },
    { key: 'pageContent', model: PageContentModel },
    { key: 'pageRaw', model: PageRawModel },
    { key: 'pageSnapshots', model: PageSnapshotModel },
    { key: 'internalLinks', model: InternalLinkModel },
    { key: 'auditRuns', model: AuditRunModel },
    { key: 'findings', model: FindingModel },
    { key: 'issues', model: IssueModel },
    { key: 'recommendations', model: RecommendationModel },
    { key: 'keywordFits', model: KeywordFitModel },
    { key: 'renderRuns', model: RenderRunModel },
    { key: 'robotsCache', model: RobotsCacheModel },
    { key: 'aiAnalyses', model: AIAnalysisModel },
    { key: 'runEvents', model: RunEventModel },
  ] as Array<{ key: string; model: Model<unknown> }>;

  const performance = [
    { key: 'gscRows', model: GscRowModel },
    { key: 'ga4Rows', model: Ga4RowModel },
    { key: 'cwvMetrics', model: CwvMetricModel },
  ] as Array<{ key: string; model: Model<unknown> }>;

  const execution = [
    { key: 'recommendations', model: RecommendationModel },
    { key: 'contentBriefs', model: ContentBriefModel },
    { key: 'fixPlans', model: FixPlanModel },
    { key: 'opportunities', model: OpportunityModel },
  ] as Array<{ key: string; model: Model<unknown> }>;

  if (mode === 'fresh-audit-baseline') return audit;
  if (mode === 'performance-data') return performance;
  if (mode === 'execution-data') return execution;
  // full
  return [
    ...audit,
    ...performance,
    ...execution,
    { key: 'keywords', model: KeywordModel },
    { key: 'reports', model: ReportModel },
    { key: 'aiTaskRuns', model: AiTaskRunModel },
    { key: 'websiteProfile', model: WebsiteProfileModel },
    { key: 'schedules', model: ScheduleModel },
  ] as Array<{ key: string; model: Model<unknown> }>;
}

function keptKeysFor(mode: ResetMode, options: ResetOptions): string[] {
  const base = ['project'];
  if (mode === 'fresh-audit-baseline') {
    return [
      ...base,
      'profile',
      'goals',
      'integrations',
      'crawlSettings',
      'monitoringSettings (paused)',
      'keywords',
      'opportunities',
      'gsc/ga4/cwv data',
      'reports',
      'fix plans',
      'content briefs',
    ];
  }
  if (mode === 'performance-data') {
    return [...base, 'crawl/audit/findings/issues', 'recommendations', 'profile', 'goals', 'integrations', 'fix plans'];
  }
  if (mode === 'execution-data') {
    return [...base, 'pages/audits/findings/issues', 'gsc/ga4/cwv', 'goals', 'profile', 'integrations'];
  }
  // full: optional keeps via options
  const k = ['project (name/domain)'];
  if (options.keepGoals) k.push('goals');
  if (options.keepIntegrations) k.push('integrations');
  if (options.keepCrawlSettings) k.push('crawl settings');
  if (options.keepMonitoringSettings) k.push('monitoring settings (paused)');
  return k;
}

/**
 * Preview the reset without touching data. Used to render the confirmation modal.
 */
export async function previewReset(
  projectId: string,
  mode: ResetMode,
  options: ResetOptions = {},
): Promise<{
  mode: ResetMode;
  deletedPreview: Record<string, number>;
  kept: string[];
  runningJobs: Awaited<ReturnType<typeof getRunningProjectJobs>>;
  schedulesActive: number;
}> {
  const pid = new Types.ObjectId(projectId);
  const models = modelsForMode(mode);
  const counts: Record<string, number> = {};
  await Promise.all(
    models.map(async ({ key, model }) => {
      counts[key] = await model.countDocuments({ projectId: pid });
    }),
  );
  const runningJobs = await getRunningProjectJobs(projectId);
  const schedulesActive = await ScheduleModel.countDocuments({ projectId: pid, enabled: true });
  return {
    mode,
    deletedPreview: counts,
    kept: keptKeysFor(mode, options),
    runningJobs,
    schedulesActive,
  };
}

export async function performReset(
  projectId: string,
  mode: ResetMode,
  options: ResetOptions = {},
  cancelRunningJobs = false,
): Promise<ResetResult> {
  const pid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(pid).lean();
  if (!project) throw new Error('Project not found');

  const running = await getRunningProjectJobs(projectId);
  if (running.total > 0 && !cancelRunningJobs) {
    throw Object.assign(
      new Error(
        `${running.total} running job${running.total === 1 ? '' : 's'} would conflict with reset. Cancel them or wait for completion.`,
      ),
      { statusCode: 409 },
    );
  }

  // Pause all schedules + cancel queued Agenda jobs for this project. We always do this for any
  // reset — a fresh baseline must not race with an in-flight monitor run.
  const { paused, cancelled } = await pauseProjectSchedules(projectId);

  // Mark in-flight runs as cancelled rather than leaving them as 'running' forever. CrawlRun /
  // AuditRun / RenderRun schemas don't declare cancellation metadata so we set the status
  // string only; the document is going to be deleted in a moment anyway for audit-baseline /
  // full mode.
  if (cancelRunningJobs && running.total > 0) {
    await Promise.all([
      CrawlRunModel.updateMany(
        { projectId: pid, status: { $in: ['queued', 'running'] } },
        { $set: { status: 'cancelled' } },
      ),
      AuditRunModel.updateMany(
        { projectId: pid, status: { $in: ['queued', 'running'] } },
        { $set: { status: 'cancelled' } },
      ),
      RenderRunModel.updateMany(
        { projectId: pid, status: { $in: ['queued', 'running'] } },
        { $set: { status: 'cancelled' } },
      ),
    ]);
  }

  const models = modelsForMode(mode);
  const deleted: Record<string, number> = {};
  for (const { key, model } of models) {
    const r = await model.deleteMany({ projectId: pid });
    deleted[key] = r.deletedCount ?? 0;
  }

  // Full reset additionally clears project-level state on the project document, unless the
  // caller asked to keep specific buckets.
  if (mode === 'full') {
    const projUnset: Record<string, ''> = {};
    const projSet: Record<string, unknown> = {
      lifecycleState: 'needs-setup',
      lastCrawledAt: null,
      lastAuditedAt: null,
      lastReportedAt: null,
      nextScheduledRunAt: null,
    };
    if (!options.keepGoals) projUnset.goals = '';
    // crawlSettings/profile reset path: leave defaults (the schema default kicks back in next read)
    if (!options.keepCrawlSettings) projUnset.crawlSettings = '';
    await ProjectModel.updateOne(
      { _id: pid },
      Object.keys(projUnset).length > 0
        ? { $set: projSet, $unset: projUnset }
        : { $set: projSet },
    );
    if (!options.keepIntegrations) {
      const r = await SiteConnectionModel.deleteMany({ projectId: pid });
      deleted.siteConnections = r.deletedCount ?? 0;
    }
  }

  // Reset lifecycle so the Overview shows the right next action after audit-baseline reset.
  if (mode === 'fresh-audit-baseline') {
    await ProjectModel.updateOne(
      { _id: pid },
      {
        $set: {
          lifecycleState: 'ready-for-first-crawl',
          lastCrawledAt: null,
          lastAuditedAt: null,
        },
      },
    );
  }

  return {
    ok: true,
    mode,
    deleted,
    kept: keptKeysFor(mode, options),
    schedulesPaused: paused,
    agendaJobsCancelled: cancelled,
    nextAction: NEXT_ACTION[mode],
  };
}

export async function archiveProject(
  projectId: string,
  reason?: string,
): Promise<{ ok: true; schedulesPaused: number; agendaJobsCancelled: number }> {
  const pid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(pid).lean();
  if (!project) throw new Error('Project not found');
  if (project.status === 'archived') {
    return { ok: true, schedulesPaused: 0, agendaJobsCancelled: 0 };
  }
  const { paused, cancelled } = await pauseProjectSchedules(projectId);
  await ProjectModel.updateOne(
    { _id: pid },
    {
      $set: {
        status: 'archived',
        archivedAt: new Date(),
        archivedReason: reason ?? null,
      },
    },
  );
  return { ok: true, schedulesPaused: paused, agendaJobsCancelled: cancelled };
}

export async function restoreProject(projectId: string): Promise<{ ok: true }> {
  const pid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(pid).lean();
  if (!project) throw new Error('Project not found');
  await ProjectModel.updateOne(
    { _id: pid },
    {
      $set: { status: 'active' },
      $unset: { archivedAt: '', archivedReason: '', archivedBy: '' },
    },
  );
  // Schedules stay paused; analyst must re-enable on Monitoring tab so they confirm intent.
  return { ok: true };
}
