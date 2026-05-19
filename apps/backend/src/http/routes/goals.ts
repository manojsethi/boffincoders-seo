import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ProjectModel } from '../../db';
import { GoalSchema } from '@boffin/schemas';

export const goalsRouter = Router();

const GoalCreate = GoalSchema.omit({ id: true, createdAt: true, updatedAt: true });
const GoalUpdate = GoalCreate.partial();

goalsRouter.get('/projects/:id/goals', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const project = await ProjectModel.findById(req.params.id).select({ goals: 1 }).lean();
    res.json(project?.goals ?? []);
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/projects/:id/goals', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = GoalCreate.parse(req.body);
    const now = new Date().toISOString();
    const goal = { id: randomUUID(), createdAt: now, updatedAt: now, ...body };
    await ProjectModel.updateOne({ _id: req.params.id }, { $push: { goals: goal } });
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch('/projects/:id/goals/:goalId', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = GoalUpdate.parse(req.body);
    const project = await ProjectModel.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    const goals = ((project.goals as Array<Record<string, unknown>> | undefined) ?? []).map((g) =>
      g.id === req.params.goalId
        ? { ...g, ...body, updatedAt: new Date().toISOString() }
        : g,
    );
    await ProjectModel.updateOne({ _id: req.params.id }, { $set: { goals } });
    const updated = goals.find((g) => g.id === req.params.goalId) ?? null;
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/projects/:id/goals/:goalId', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    await ProjectModel.updateOne(
      { _id: req.params.id },
      { $pull: { goals: { id: req.params.goalId } } },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

void z;
