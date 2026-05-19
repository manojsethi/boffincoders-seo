// Agenda Job Monitor — Doc 12 §"Level 2 / Level 3".
// Single source for project + workspace job views. Reads Agenda directly + cross-references
// run models for accurate status. Never exposes raw `data` payloads, tokens, or secrets.

import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { loadEnv } from '../../config/env';
import {
  ProjectModel,
  CrawlRunModel,
  AuditRunModel,
  RenderRunModel,
  ReportModel,
} from '../../db';
import { getAgenda, JOB_NAMES } from '../../jobs';

export const jobsRouter = Router();

/** Analyst-facing labels per Agenda job name. */
const JOB_LABEL: Record<string, { label: string; type: string; provider?: string; relatedRunType?: string }> = {
  [JOB_NAMES.runFirstCrawl]: { label: 'First crawl', type: 'crawl', relatedRunType: 'crawl' },
  [JOB_NAMES.runCrawl]: { label: 'Crawl', type: 'crawl', relatedRunType: 'crawl' },
  [JOB_NAMES.runAudit]: { label: 'Audit', type: 'audit', relatedRunType: 'audit' },
  [JOB_NAMES.runAIAnalysis]: { label: 'AI analysis', type: 'ai' },
  [JOB_NAMES.generateReport]: { label: 'Report generation', type: 'report', relatedRunType: 'report' },
  [JOB_NAMES.syncGSC]: { label: 'GSC sync', type: 'sync', provider: 'gsc' },
  [JOB_NAMES.syncGA4]: { label: 'GA4 sync', type: 'sync', provider: 'ga4' },
  [JOB_NAMES.syncCWV]: { label: 'CWV sync', type: 'sync', provider: 'cwv' },
  [JOB_NAMES.verifyFixes]: { label: 'Fix verification', type: 'verification' },
  [JOB_NAMES.monitorWeekly]: { label: 'Weekly monitor', type: 'monitor' },
  [JOB_NAMES.monitorMonthly]: { label: 'Monthly monitor', type: 'monitor' },
  [JOB_NAMES.renderRecrawl]: { label: 'Rendered recrawl', type: 'render', relatedRunType: 'render' },
  [JOB_NAMES.scheduleCrawl]: { label: 'Scheduled crawl', type: 'schedule' },
  [JOB_NAMES.scheduleAudit]: { label: 'Scheduled audit', type: 'schedule' },
  [JOB_NAMES.scheduleReport]: { label: 'Scheduled report', type: 'schedule' },
  [JOB_NAMES.scheduleSync]: { label: 'Scheduled sync', type: 'schedule' },
};

type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled' | 'stale';
type AgendaDoc = {
  _id: unknown;
  name?: string;
  data?: Record<string, unknown>;
  type?: string; // agenda: 'normal' (one-off) | 'single' (scheduled/repeating)
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastFinishedAt?: Date;
  failedAt?: Date;
  failReason?: string;
  failCount?: number;
  lockedAt?: Date;
  repeatInterval?: string;
};

/**
 * Derive analyst-facing status. Doc 12 §"Required Status Logic".
 *
 * Agenda subtlety: on failure it sets BOTH `lastFinishedAt` and `failedAt` to the same timestamp.
 * So `failedAt > lastFinishedAt` always returns false on the latest attempt. The reliable signal
 * is whether `failedAt` is at-or-after `lastRunAt` (the start of the most recent execution).
 */
function deriveStatus(d: AgendaDoc, now: number = Date.now()): JobStatus {
  const data = (d.data as Record<string, unknown> | undefined) ?? {};
  const cancelled = data.cancelledAt;
  const lastRun = d.lastRunAt ? new Date(d.lastRunAt).getTime() : 0;
  const failedAt = d.failedAt ? new Date(d.failedAt).getTime() : 0;

  // Cancelled flag only respected when it's newer than the latest run — otherwise a fresh re-queue
  // shouldn't appear cancelled.
  if (cancelled) {
    const cancelTs = new Date(cancelled as string | Date).getTime();
    if (cancelTs >= lastRun) return 'cancelled';
  }

  // Running: lock active and no finish since lock started.
  if (d.lockedAt) {
    const lockAgeMs = now - new Date(d.lockedAt).getTime();
    const finishedAfterLock =
      d.lastFinishedAt && new Date(d.lastFinishedAt).getTime() >= new Date(d.lockedAt).getTime();
    if (!finishedAfterLock) {
      if (lockAgeMs > 30 * 60_000) return 'stale';
      return 'running';
    }
  }

  // Failed if the latest execution attempt failed.
  if (failedAt && failedAt >= lastRun) return 'failed';

  // Recurring schedule — when a repeating job is currently between runs.
  if (d.repeatInterval && d.nextRunAt) {
    if (d.lastFinishedAt) return 'scheduled';
  }

  if (d.lastFinishedAt) return 'completed';
  if (d.nextRunAt) return 'queued';
  return 'queued';
}

function shapeJob(d: AgendaDoc, projectName?: string): Record<string, unknown> {
  const meta = JOB_LABEL[d.name ?? ''] ?? { label: d.name ?? 'job', type: 'other' };
  const data = (d.data as Record<string, unknown> | undefined) ?? {};
  const status = deriveStatus(d);
  const startedAt = d.lastRunAt ?? null;
  const finishedAt = d.lastFinishedAt ?? null;
  const durationMs =
    startedAt && finishedAt
      ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
      : status === 'running' && startedAt
        ? Date.now() - new Date(startedAt).getTime()
        : null;
  // Whitelist data fields — never echo raw payload (may contain tokens, secrets).
  const safeData = {
    projectId: data.projectId ? String(data.projectId) : null,
    crawlRunId: data.crawlRunId ? String(data.crawlRunId) : null,
    auditRunId: data.auditRunId ? String(data.auditRunId) : null,
    renderRunId: data.renderRunId ? String(data.renderRunId) : null,
    reportId: data.reportId ? String(data.reportId) : null,
    trigger: typeof data.trigger === 'string' ? (data.trigger as string) : 'manual',
  };
  return {
    id: String(d._id),
    agendaName: d.name,
    label: meta.label,
    type: meta.type,
    provider: meta.provider ?? null,
    relatedRunType: meta.relatedRunType ?? null,
    relatedRunId:
      safeData.crawlRunId ??
      safeData.auditRunId ??
      safeData.renderRunId ??
      safeData.reportId ??
      null,
    projectId: safeData.projectId,
    projectName: projectName ?? null,
    trigger: safeData.trigger,
    status,
    startedAt,
    finishedAt,
    nextRunAt: d.nextRunAt ?? null,
    durationMs,
    repeatInterval: d.repeatInterval ?? null,
    failReason: d.failReason ?? null,
    failCount: d.failCount ?? 0,
    lockedAt: d.lockedAt ?? null,
  };
}

function agendaCollection(): ReturnType<NonNullable<typeof mongoose.connection.db>['collection']> | null {
  const env = loadEnv();
  return mongoose.connection.db?.collection(env.AGENDA_COLLECTION) ?? null;
}

const JobFilter = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  provider: z.string().optional(),
  trigger: z.string().optional(),
  failedOnly: z.string().optional(),
  runningOnly: z.string().optional(),
  startedSince: z.string().optional(),
  startedUntil: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.string().optional(),
});

async function listJobs(filterRaw: unknown, scope?: { projectId?: Types.ObjectId }): Promise<unknown[]> {
  const filter = JobFilter.parse(filterRaw);
  const coll = agendaCollection();
  if (!coll) return [];

  const query: Record<string, unknown> = {};
  // Restrict to known job names — keeps surface area safe and prevents accidentally listing
  // internal/admin Agenda jobs.
  query.name = { $in: Object.keys(JOB_LABEL) };
  if (scope?.projectId) query['data.projectId'] = String(scope.projectId);
  if (filter.projectId && !scope?.projectId) query['data.projectId'] = String(filter.projectId);
  if (filter.startedSince || filter.startedUntil) {
    const lr: Record<string, Date> = {};
    if (filter.startedSince) lr.$gte = new Date(filter.startedSince);
    if (filter.startedUntil) lr.$lte = new Date(filter.startedUntil);
    query.lastRunAt = lr;
  }

  const limit = Math.min(500, Number(filter.limit ?? 200));
  const docs = (await coll
    .find(query)
    .project({
      name: 1,
      type: 1,
      'data.projectId': 1,
      'data.crawlRunId': 1,
      'data.auditRunId': 1,
      'data.renderRunId': 1,
      'data.reportId': 1,
      'data.trigger': 1,
      'data.cancelledAt': 1,
      nextRunAt: 1,
      lastRunAt: 1,
      lastFinishedAt: 1,
      failedAt: 1,
      failReason: 1,
      failCount: 1,
      lockedAt: 1,
      repeatInterval: 1,
    })
    .sort({ lastRunAt: -1, nextRunAt: -1 })
    .limit(limit)
    .toArray()) as AgendaDoc[];

  // Resolve project names in bulk (workspace view).
  const projectIds = [
    ...new Set(
      docs.map((d) => (d.data as { projectId?: string } | undefined)?.projectId).filter(Boolean) as string[],
    ),
  ];
  const projects = projectIds.length
    ? await ProjectModel.find({ _id: { $in: projectIds.filter((p) => Types.ObjectId.isValid(p)) } })
        .select({ siteName: 1, clientName: 1 })
        .lean()
    : [];
  const projectName = new Map(
    projects.map((p) => [String(p._id), `${p.siteName ?? ''}${p.clientName ? ` (${p.clientName})` : ''}`.trim()]),
  );

  const shaped = docs.map((d) => shapeJob(d, projectName.get(String((d.data as { projectId?: string } | undefined)?.projectId ?? ''))));
  return shaped.filter((j) => {
    const job = j as ReturnType<typeof shapeJob>;
    if (filter.status && job.status !== filter.status) return false;
    if (filter.type && job.type !== filter.type) return false;
    if (filter.provider && job.provider !== filter.provider) return false;
    if (filter.trigger && job.trigger !== filter.trigger) return false;
    if (filter.failedOnly === '1' && job.status !== 'failed') return false;
    if (filter.runningOnly === '1' && job.status !== 'running') return false;
    return true;
  });
}

// -------- Project-scoped --------

jobsRouter.get('/projects/:id/jobs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const jobs = await listJobs(req.query, { projectId: new Types.ObjectId(req.params.id) });
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

// -------- Workspace-scoped --------

jobsRouter.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await listJobs(req.query);
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * Summary cards for the agency operations dashboard. Doc 12 §"Required Widgets".
 */
jobsRouter.get('/jobs/summary', async (_req, res, next) => {
  try {
    const coll = agendaCollection();
    if (!coll) {
      res.json({ running: 0, failed24h: 0, failed7d: 0, longRunning: 0, stuck: 0, scheduledToday: 0 });
      return;
    }
    const now = new Date();
    const day = 86_400_000;
    const since24 = new Date(now.getTime() - day);
    const since7d = new Date(now.getTime() - 7 * day);
    const tomorrow = new Date(now.getTime() + day);
    // "Running" = locked AND most recent finish predates the lock (so current attempt is in flight).
    const runningQuery = {
      name: { $in: Object.keys(JOB_LABEL) },
      lockedAt: { $ne: null },
      $expr: {
        $or: [
          { $eq: ['$lastFinishedAt', null] },
          { $lt: ['$lastFinishedAt', '$lockedAt'] },
        ],
      },
    };
    // "Failed" = latest attempt failed (failedAt >= lastRunAt) within the window.
    const failedWindow = (since: Date): Record<string, unknown> => ({
      name: { $in: Object.keys(JOB_LABEL) },
      failedAt: { $gte: since },
      $expr: {
        $or: [{ $eq: ['$lastRunAt', null] }, { $gte: ['$failedAt', '$lastRunAt'] }],
      },
    });
    const [running, failed24h, failed7d, locked, scheduledToday] = await Promise.all([
      coll.countDocuments(runningQuery),
      coll.countDocuments(failedWindow(since24)),
      coll.countDocuments(failedWindow(since7d)),
      coll.find(runningQuery).project({ lockedAt: 1, lastRunAt: 1 }).toArray(),
      coll.countDocuments({
        name: { $in: Object.keys(JOB_LABEL) },
        nextRunAt: { $gte: now, $lte: tomorrow },
      }),
    ]);
    const lockedDocs = locked as Array<{ lockedAt?: Date; lastRunAt?: Date }>;
    const longRunning = lockedDocs.filter((d) => {
      const start = d.lastRunAt ?? d.lockedAt;
      return start && now.getTime() - new Date(start).getTime() > 10 * 60_000;
    }).length;
    const stuck = lockedDocs.filter((d) => {
      const start = d.lockedAt;
      return start && now.getTime() - new Date(start).getTime() > 30 * 60_000;
    }).length;
    res.json({
      running,
      failed24h,
      failed7d,
      longRunning,
      stuck,
      scheduledToday,
    });
  } catch (err) {
    next(err);
  }
});

// -------- Detail (drawer) --------

jobsRouter.get('/jobs/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid job id' });
      return;
    }
    const coll = agendaCollection();
    if (!coll) return void res.status(404).json({ error: 'not found' });
    const doc = (await coll.findOne({ _id: new Types.ObjectId(req.params.id) })) as AgendaDoc | null;
    if (!doc) return void res.status(404).json({ error: 'not found' });
    const data = (doc.data as Record<string, unknown> | undefined) ?? {};
    const projectId = typeof data.projectId === 'string' ? data.projectId : null;
    const project =
      projectId && Types.ObjectId.isValid(projectId)
        ? await ProjectModel.findById(projectId).select({ siteName: 1, clientName: 1 }).lean()
        : null;
    const shaped = shapeJob(
      doc,
      project ? `${project.siteName ?? ''}${project.clientName ? ` (${project.clientName})` : ''}`.trim() : undefined,
    ) as Record<string, unknown>;

    // Optional: enrich with related run status
    let relatedRun: Record<string, unknown> | null = null;
    const meta = JOB_LABEL[doc.name ?? ''];
    const relId = shaped.relatedRunId as string | null;
    if (relId && Types.ObjectId.isValid(relId)) {
      if (meta?.relatedRunType === 'crawl') {
        const r = await CrawlRunModel.findById(relId).select({ status: 1, progressPercent: 1, currentStep: 1 }).lean();
        if (r) relatedRun = { type: 'crawl', id: String(r._id), status: r.status, progressPercent: r.progressPercent, currentStep: r.currentStep };
      } else if (meta?.relatedRunType === 'audit') {
        const r = await AuditRunModel.findById(relId).select({ status: 1, progressPercent: 1, currentStep: 1 }).lean();
        if (r) relatedRun = { type: 'audit', id: String(r._id), status: r.status, progressPercent: r.progressPercent, currentStep: r.currentStep };
      } else if (meta?.relatedRunType === 'render') {
        const r = await RenderRunModel.findById(relId).select({ status: 1 }).lean();
        if (r) relatedRun = { type: 'render', id: String(r._id), status: r.status };
      } else if (meta?.relatedRunType === 'report') {
        const r = await ReportModel.findById(relId).select({ status: 1, type: 1 }).lean();
        if (r) relatedRun = { type: 'report', id: String(r._id), status: r.status, reportType: r.type };
      }
    }
    res.json({ ...shaped, relatedRun });
  } catch (err) {
    next(err);
  }
});

// -------- Actions --------

/** Cancellable job types — handlers tolerate interruption without corrupting state. */
const CANCEL_SAFE_RUNNING = new Set<string>([JOB_NAMES.syncCWV]); // partial CWV rows are stamped
const CANCEL_SAFE_QUEUED_ALWAYS = true;
const RETRY_SAFE_TYPES = new Set<string>([JOB_NAMES.syncGSC, JOB_NAMES.syncGA4, JOB_NAMES.syncCWV]);

jobsRouter.post('/jobs/:id/retry', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid job id' });
      return;
    }
    const coll = agendaCollection();
    if (!coll) return void res.status(404).json({ error: 'not found' });
    const doc = (await coll.findOne({ _id: new Types.ObjectId(req.params.id) })) as AgendaDoc | null;
    if (!doc) return void res.status(404).json({ error: 'not found' });
    if (!doc.name || !RETRY_SAFE_TYPES.has(doc.name)) {
      res.status(400).json({ error: 'retry not supported for this job type' });
      return;
    }
    const data = (doc.data as Record<string, unknown> | undefined) ?? {};
    // Re-schedule a fresh `now()` for the same job, copying only whitelisted fields.
    const projectId = data.projectId;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'job missing projectId' });
      return;
    }
    await getAgenda().now(doc.name as string, { projectId, trigger: 'retry' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

jobsRouter.post('/jobs/:id/cancel', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid job id' });
      return;
    }
    const coll = agendaCollection();
    if (!coll) return void res.status(404).json({ error: 'not found' });
    const doc = (await coll.findOne({ _id: new Types.ObjectId(req.params.id) })) as AgendaDoc | null;
    if (!doc) return void res.status(404).json({ error: 'not found' });
    const status = deriveStatus(doc);
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      res.status(400).json({ error: `cannot cancel a job that is already ${status}` });
      return;
    }
    if (status === 'running' && !(doc.name && CANCEL_SAFE_RUNNING.has(doc.name))) {
      res
        .status(400)
        .json({ error: 'running cancel not allowed for this job type — handler does not support safe interruption' });
      return;
    }
    // Both queued and scheduled are safe to cancel by stopping future execution.
    const isScheduledLike = status === 'queued' || status === 'scheduled';
    const nowDate = new Date();
    const set: Record<string, unknown> = { 'data.cancelledAt': nowDate };
    const unset: Record<string, ''> = {};
    if (isScheduledLike) {
      // Clear next-run + repeat so Agenda won't pick it up again.
      set.nextRunAt = null;
      unset.repeatInterval = '';
      unset.repeatAt = '';
    }
    if (status === 'running') {
      set.failedAt = nowDate;
      set.failReason = 'cancelled by user';
      unset.lockedAt = '';
    }
    await coll.updateOne(
      { _id: new Types.ObjectId(req.params.id) },
      Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
