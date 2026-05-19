// Project schedules. Doc 12 §"Recurring Jobs And Schedules" + Doc 8 §"Agency Workspace".
// Each Schedule.type maps to a dedicated wrapper Agenda job — see JOB_NAMES.schedule*.

import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { loadEnv } from '../../config/env';
import { ScheduleModel } from '../../db';
import { getAgenda, JOB_NAMES } from '../../jobs';

const ScheduleTypeSchema = z.enum(['crawl', 'audit', 'report', 'integration-sync']);
const CadenceSchema = z.enum(['weekly', 'monthly', 'custom']);
const ProviderSchema = z.enum(['gsc', 'ga4', 'cwv', 'all']);

const CreateSchedule = z.object({
  type: ScheduleTypeSchema,
  cadence: CadenceSchema.default('weekly'),
  cronExpression: z.string().optional(),
  humanInterval: z.string().optional(),
  timezone: z.string().default('UTC'),
  provider: ProviderSchema.optional(), // only meaningful when type === 'integration-sync'
});

const PatchSchedule = z.object({
  enabled: z.boolean().optional(),
  provider: ProviderSchema.optional(),
});

/** Explicit, testable mapping. Each schedule.type → its own Agenda job name. */
const SCHEDULE_JOB_NAME: Record<z.infer<typeof ScheduleTypeSchema>, string> = {
  crawl: JOB_NAMES.scheduleCrawl,
  audit: JOB_NAMES.scheduleAudit,
  report: JOB_NAMES.scheduleReport,
  'integration-sync': JOB_NAMES.scheduleSync,
};

export const schedulesRouter = Router();

/** Read the Agenda doc for a schedule and pull the live next-run timestamp. */
async function fetchAgendaNextRunAt(
  jobName: string,
  scheduleId: string,
): Promise<Date | null> {
  const env = loadEnv();
  const coll = mongoose.connection.db?.collection(env.AGENDA_COLLECTION);
  if (!coll) return null;
  const doc = (await coll.findOne(
    { name: jobName, 'data.scheduleId': scheduleId },
    { projection: { nextRunAt: 1, lastFinishedAt: 1, lastRunAt: 1 } },
  )) as { nextRunAt?: Date; lastRunAt?: Date; lastFinishedAt?: Date } | null;
  return doc?.nextRunAt ?? null;
}

/**
 * Cancel Agenda jobs by schedule id. Agenda's typed `cancel()` doesn't allow Mongo dot-path
 * queries, but the underlying engine does — we go through the raw collection so the query is exact
 * even when `data` contains additional fields like `provider` and `trigger`.
 */
async function cancelScheduleAgendaJobs(jobName: string, scheduleId: string): Promise<number> {
  const env = loadEnv();
  const coll = mongoose.connection.db?.collection(env.AGENDA_COLLECTION);
  if (!coll) return 0;
  const r = await coll.deleteMany({ name: jobName, 'data.scheduleId': scheduleId });
  return r.deletedCount ?? 0;
}

schedulesRouter.get('/projects/:id/schedules', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const list = await ScheduleModel.find({ projectId: new Types.ObjectId(req.params.id) }).lean();
    // Refresh nextRunAt from Agenda for each enabled schedule. Cheap (one query per schedule);
    // small N per project. Doc 12 §"Required UI" — analyst must see the real next run.
    const out = await Promise.all(
      list.map(async (s) => {
        const liveNext = s.enabled
          ? await fetchAgendaNextRunAt(s.agendaJobName, String(s._id))
          : null;
        if (liveNext && (!s.nextRunAt || s.nextRunAt.getTime() !== liveNext.getTime())) {
          await ScheduleModel.updateOne({ _id: s._id }, { $set: { nextRunAt: liveNext } });
        }
        const agendaMissing = s.enabled && !liveNext;
        return {
          id: String(s._id),
          type: s.type,
          cadence: s.cadence,
          enabled: s.enabled,
          timezone: s.timezone,
          cronExpression: s.cronExpression,
          humanInterval: s.humanInterval,
          provider: s.provider ?? 'all',
          agendaJobName: s.agendaJobName,
          nextRunAt: liveNext ?? s.nextRunAt ?? null,
          lastRunAt: s.lastRunAt ?? null,
          agendaMissing,
        };
      }),
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
});

schedulesRouter.post('/projects/:id/schedules', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = CreateSchedule.parse(req.body);
    const projectId = new Types.ObjectId(req.params.id);
    const agendaJobName = SCHEDULE_JOB_NAME[body.type];
    // Schedule one row per (project, type, provider). Recreate if exists so analyst can re-bind.
    const existing = await ScheduleModel.findOne({
      projectId,
      type: body.type,
      provider: body.type === 'integration-sync' ? body.provider ?? 'all' : 'all',
    });
    if (existing) {
      await cancelScheduleAgendaJobs(existing.agendaJobName, String(existing._id));
      await ScheduleModel.deleteOne({ _id: existing._id });
    }

    const sched = await ScheduleModel.create({
      projectId,
      type: body.type,
      cadence: body.cadence,
      timezone: body.timezone,
      enabled: true,
      agendaJobName,
      cronExpression: body.cronExpression,
      humanInterval: body.humanInterval,
      provider: body.type === 'integration-sync' ? body.provider ?? 'all' : 'all',
    });
    const interval =
      body.cronExpression ??
      body.humanInterval ??
      (body.cadence === 'weekly' ? '1 week' : body.cadence === 'monthly' ? '1 month' : '1 day');
    const agenda = getAgenda();
    const job = await agenda.every(
      interval,
      agendaJobName,
      {
        projectId: String(projectId),
        scheduleId: String(sched._id),
        provider: sched.provider,
        trigger: 'scheduled',
      },
      { timezone: body.timezone },
    );
    // Agenda computes nextRunAt during every(); persist it so the UI doesn't show '—' until the
    // next read.
    const nextRunAt = (job?.attrs?.nextRunAt as Date | undefined) ?? null;
    if (nextRunAt) {
      await ScheduleModel.updateOne({ _id: sched._id }, { $set: { nextRunAt } });
    }

    res.status(201).json({
      id: String(sched._id),
      agendaJobName,
      nextRunAt,
      provider: sched.provider,
    });
  } catch (err) {
    next(err);
  }
});

schedulesRouter.patch('/projects/:id/schedules/:scheduleId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.scheduleId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = PatchSchedule.parse(req.body);
    const sched = await ScheduleModel.findById(req.params.scheduleId);
    if (!sched) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    if (typeof body.enabled === 'boolean') sched.enabled = body.enabled;
    if (body.provider && sched.type === 'integration-sync') sched.provider = body.provider;
    await sched.save();

    if (!sched.enabled) {
      // Use Mongo dot-path matching — Agenda stores `data` as a nested object so `data: {…}`
      // equality has different semantics than expected. Doc 12 §"Cancellation must be conservative".
      await cancelScheduleAgendaJobs(sched.agendaJobName, String(sched._id));
      await ScheduleModel.updateOne({ _id: sched._id }, { $set: { nextRunAt: null } });
    } else {
      // Re-enable: schedule fresh and refresh nextRunAt.
      const interval =
        sched.cronExpression ??
        sched.humanInterval ??
        (sched.cadence === 'weekly' ? '1 week' : sched.cadence === 'monthly' ? '1 month' : '1 day');
      const job = await getAgenda().every(
        interval,
        sched.agendaJobName,
        {
          projectId: String(sched.projectId),
          scheduleId: String(sched._id),
          provider: sched.provider,
          trigger: 'scheduled',
        },
        { timezone: sched.timezone },
      );
      const nextRunAt = (job?.attrs?.nextRunAt as Date | undefined) ?? null;
      if (nextRunAt) {
        await ScheduleModel.updateOne({ _id: sched._id }, { $set: { nextRunAt } });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

schedulesRouter.delete('/projects/:id/schedules/:scheduleId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.scheduleId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const sched = await ScheduleModel.findById(req.params.scheduleId);
    if (!sched) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await cancelScheduleAgendaJobs(sched.agendaJobName, String(sched._id));
    await ScheduleModel.deleteOne({ _id: sched._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
