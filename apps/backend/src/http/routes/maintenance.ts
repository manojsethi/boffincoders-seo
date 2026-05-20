import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { MaintenanceRunModel } from '../../db';
import { MAINTENANCE_TASKS, listTasks } from '../../maintenance/registry';
import { getLogger } from '../../config/logger';

const log = getLogger('maintenance');
export const maintenanceRouter = Router();

maintenanceRouter.get('/projects/:id/maintenance/tasks', (_req, res) => {
  res.json(listTasks());
});

maintenanceRouter.get('/projects/:id/maintenance/runs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await MaintenanceRunModel.find({ projectId: pid })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        taskKey: r.taskKey,
        label: r.label,
        description: r.description,
        dryRun: r.dryRun,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        durationMs: r.durationMs,
        result: r.result,
        error: r.error,
        triggeredBy: r.triggeredBy,
        params: r.params,
      })),
    );
  } catch (err) {
    next(err);
  }
});

const RunSchema = z.object({
  taskKey: z.string().min(1).max(100),
  dryRun: z.boolean().optional().default(false),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

maintenanceRouter.post('/projects/:id/maintenance/run', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = RunSchema.parse(req.body);
    const task = MAINTENANCE_TASKS[body.taskKey];
    if (!task) {
      res.status(404).json({ error: `unknown task: ${body.taskKey}` });
      return;
    }
    const startedAt = new Date();
    const run = await MaintenanceRunModel.create({
      projectId: new Types.ObjectId(req.params.id),
      taskKey: task.key,
      label: task.label,
      description: task.description,
      params: body.params,
      dryRun: body.dryRun,
      status: 'running',
      startedAt,
      triggeredBy: 'analyst',
    });
    try {
      const result = await task.run({
        projectId: req.params.id,
        params: body.params as never,
        dryRun: body.dryRun,
      });
      const finishedAt = new Date();
      await MaintenanceRunModel.updateOne(
        { _id: run._id },
        {
          $set: {
            status: 'completed',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            result,
          },
        },
      );
      log.info({ projectId: req.params.id, task: task.key, dryRun: body.dryRun }, 'maintenance run completed');
      res.json({ id: String(run._id), status: 'completed', dryRun: body.dryRun, result });
    } catch (err) {
      const finishedAt = new Date();
      const msg = err instanceof Error ? err.message : String(err);
      await MaintenanceRunModel.updateOne(
        { _id: run._id },
        {
          $set: {
            status: 'failed',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            error: msg,
          },
        },
      );
      log.error({ err, projectId: req.params.id, task: task.key }, 'maintenance run failed');
      res.status(500).json({ id: String(run._id), status: 'failed', error: msg });
    }
  } catch (err) {
    next(err);
  }
});
