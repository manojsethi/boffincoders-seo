import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { listTasks, runTask, getTask, availableProviders } from '../../ai';
import { AiTaskRunModel } from '../../db';

export const aiRouter = Router();

// Lists registered tasks + which providers are configured. UI uses this to gray out AI buttons
// when no provider is available.
aiRouter.get('/ai/tasks', (_req, res) => {
  res.json({
    tasks: listTasks(),
    providers: availableProviders(),
  });
});

const RunSchema = z.object({
  taskKey: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).default({}),
  sourceIds: z.record(z.string(), z.string()).optional(),
  preferredProvider: z
    .enum(['openrouter', 'openai', 'groq', 'anthropic', 'local'])
    .optional(),
});

aiRouter.post('/projects/:id/ai/run', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = RunSchema.parse(req.body);
    if (!getTask(body.taskKey)) {
      res.status(404).json({ error: `unknown task: ${body.taskKey}` });
      return;
    }
    const result = await runTask(body.taskKey, {
      projectId: req.params.id,
      params: body.params,
      sourceIds: body.sourceIds,
      preferredProvider: body.preferredProvider,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// History — analyst can see every AI call made for a project, with provider/model/confidence/cost.
aiRouter.get('/projects/:id/ai/runs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.taskKey) q.taskKey = req.query.taskKey;
    if (req.query.pageId) q['sourceIds.pageId'] = req.query.pageId;
    if (req.query.recommendationId) q['sourceIds.recommendationId'] = req.query.recommendationId;
    if (req.query.briefId) q['sourceIds.briefId'] = req.query.briefId;
    // Batch fetch by id list — brief detail uses this to render metadata for each task that
    // contributed to the brief. Whitelist to valid ObjectIds only.
    if (typeof req.query.ids === 'string' && req.query.ids.length > 0) {
      const ids = req.query.ids
        .split(',')
        .map((s) => s.trim())
        .filter((s) => Types.ObjectId.isValid(s))
        .map((s) => new Types.ObjectId(s));
      if (ids.length > 0) q._id = { $in: ids };
    }
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await AiTaskRunModel.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        taskKey: r.taskKey,
        provider: r.provider,
        model: r.model,
        promptTemplateVersion: r.promptTemplateVersion,
        status: r.status,
        schemaValidationStatus: (r as { schemaValidationStatus?: string | null }).schemaValidationStatus ?? null,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        durationMs: r.durationMs,
        output: r.output,
        confidence: r.confidence,
        confidenceLevel: r.confidenceLevel,
        warnings: r.warnings,
        needsAnalystReview: r.needsAnalystReview,
        acceptedBy: r.acceptedBy,
        acceptedAt: r.acceptedAt,
        rejectedReason: r.rejectedReason,
        costEstimateUsd: r.costEstimateUsd,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        sourceIds: r.sourceIds,
        error: r.error,
      })),
    );
  } catch (err) {
    next(err);
  }
});

const AcceptSchema = z.object({
  reason: z.string().max(1000).optional(),
});
aiRouter.post('/projects/:id/ai/runs/:runId/accept', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.runId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    AcceptSchema.parse(req.body ?? {});
    await AiTaskRunModel.updateOne(
      { _id: req.params.runId, projectId: req.params.id },
      { $set: { acceptedBy: 'analyst', acceptedAt: new Date(), needsAnalystReview: false } },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/projects/:id/ai/runs/:runId/reject', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.runId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = AcceptSchema.parse(req.body ?? {});
    await AiTaskRunModel.updateOne(
      { _id: req.params.runId, projectId: req.params.id },
      {
        $set: {
          rejectedReason: body.reason ?? '',
          needsAnalystReview: false,
        },
      },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
