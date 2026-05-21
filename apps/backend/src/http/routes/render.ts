import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { RenderRunModel } from '../../db';
import { getAgenda, JOB_NAMES } from '../../jobs/agenda';
import { requireActiveProject } from '../middleware/active-project';

const RenderBody = z.object({
  pageIds: z.array(z.string()).min(1).max(50),
  reason: z.string().max(120).optional(),
});

export const renderRouter = Router();

/**
 * Enqueue a rendered (Playwright) recrawl run. Doc 11 §"Rendered Verification Controls".
 * Returns a render run id immediately; the UI polls /render-runs/:id for progress.
 */
renderRouter.post('/projects/:id/render-recrawl', requireActiveProject, async (req, res, next) => {
  try {
    const pid = String(req.params.id ?? '');
    if (!Types.ObjectId.isValid(pid)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = RenderBody.parse(req.body);

    const run = await RenderRunModel.create({
      projectId: new Types.ObjectId(pid),
      pageIds: body.pageIds.map((p) => new Types.ObjectId(p)),
      reason: body.reason ?? 'analyst-triggered',
      status: 'queued',
      totalPages: body.pageIds.length,
    });

    const agenda = getAgenda();
    await agenda.now(JOB_NAMES.renderRecrawl, {
      projectId: pid,
      renderRunId: String(run._id),
    });

    res.status(202).json({ renderRunId: String(run._id), status: 'queued' });
  } catch (err) {
    next(err);
  }
});

renderRouter.get('/projects/:id/render-runs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const runs = await RenderRunModel.find({ projectId: new Types.ObjectId(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(runs.map(toRunDTO));
  } catch (err) {
    next(err);
  }
});

renderRouter.get('/projects/:id/render-runs/:runId', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.runId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const run = await RenderRunModel.findOne({
      _id: req.params.runId,
      projectId: new Types.ObjectId(req.params.id),
    }).lean();
    if (!run) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(toRunDTO(run));
  } catch (err) {
    next(err);
  }
});

function toRunDTO(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String((r as { _id: unknown })._id),
    status: r.status,
    reason: r.reason,
    progressPercent: r.progressPercent,
    currentStep: r.currentStep,
    totalPages: r.totalPages,
    completedPages: r.completedPages,
    successCount: r.successCount,
    failureCount: r.failureCount,
    results: r.results,
    rerun: r.rerun,
    error: r.error,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: (r as { createdAt?: Date }).createdAt,
  };
}
