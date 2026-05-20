import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { FixPlanModel } from '../../db';
import { buildItemFromSource, validateFixPlanItem } from '../../fix-plans/validate';
import { generateWeeklyPlanDraft } from '../../fix-plans/weekly';

export const fixPlansRouter = Router();

/**
 * Fix plan + fix plan item routes. Phase 6.
 *
 * `clientVisible` on each item drives whether the item appears in client-facing reports;
 * `internalNotes` is always stripped from client output. Validation status comes from
 * fix-plans/validate.ts which reads evidence (audit findings / CWV / GSC trends / page crawl)
 * rather than asking AI.
 */

interface ItemDoc {
  _id?: Types.ObjectId;
  sourceType: string;
  sourceId?: string;
  recommendationId?: Types.ObjectId;
  issueId?: Types.ObjectId;
  opportunityId?: Types.ObjectId;
  contentBriefId?: Types.ObjectId;
  pageId?: Types.ObjectId;
  keywordId?: Types.ObjectId;
  title: string;
  description?: string;
  ownerType?: string;
  assignedToUserId?: string;
  priority?: string;
  impact?: string;
  effort?: string;
  status?: string;
  expectedOutcome?: string;
  validationMethod?: string;
  validationStatus?: string;
  validationEvidence?: Record<string, unknown>;
  validationCheckedAt?: Date;
  validationDataSource?: string;
  targetDate?: Date;
  completedAt?: Date | null;
  validatedAt?: Date | null;
  notes?: string;
  internalNotes?: string;
  clientVisible?: boolean;
  addedAt?: Date;
}

interface PlanDoc {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  periodStart?: Date;
  periodEnd?: Date;
  status?: string;
  ownerType?: string;
  priority?: string;
  expectedImpactSummary?: string;
  items?: ItemDoc[];
  createdAt?: Date;
  updatedAt?: Date;
}

function shapeItem(it: ItemDoc): Record<string, unknown> {
  return {
    id: String(it._id),
    sourceType: it.sourceType,
    sourceId: it.sourceId ?? null,
    recommendationId: it.recommendationId ? String(it.recommendationId) : null,
    issueId: it.issueId ? String(it.issueId) : null,
    opportunityId: it.opportunityId ? String(it.opportunityId) : null,
    contentBriefId: it.contentBriefId ? String(it.contentBriefId) : null,
    pageId: it.pageId ? String(it.pageId) : null,
    keywordId: it.keywordId ? String(it.keywordId) : null,
    title: it.title,
    description: it.description ?? '',
    ownerType: it.ownerType ?? 'analyst',
    assignedToUserId: it.assignedToUserId ?? null,
    priority: it.priority ?? 'P2',
    impact: it.impact ?? 'unknown',
    effort: it.effort ?? 'unknown',
    status: it.status ?? 'planned',
    expectedOutcome: it.expectedOutcome ?? '',
    validationMethod: it.validationMethod ?? '',
    validationStatus: it.validationStatus ?? 'not-started',
    validationEvidence: it.validationEvidence ?? {},
    validationCheckedAt: it.validationCheckedAt ?? null,
    validationDataSource: it.validationDataSource ?? null,
    targetDate: it.targetDate ?? null,
    completedAt: it.completedAt ?? null,
    validatedAt: it.validatedAt ?? null,
    notes: it.notes ?? '',
    internalNotes: it.internalNotes ?? '',
    clientVisible: it.clientVisible ?? true,
    addedAt: it.addedAt ?? null,
  };
}

function shapePlan(p: PlanDoc): Record<string, unknown> {
  return {
    id: String(p._id),
    projectId: String(p.projectId),
    title: p.title,
    description: p.description ?? '',
    periodStart: p.periodStart ?? null,
    periodEnd: p.periodEnd ?? null,
    status: p.status ?? 'draft',
    ownerType: p.ownerType ?? 'analyst',
    priority: p.priority ?? 'P1',
    expectedImpactSummary: p.expectedImpactSummary ?? '',
    itemCount: (p.items ?? []).length,
    items: (p.items ?? []).map(shapeItem),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// List
fixPlansRouter.get('/projects/:id/fix-plans', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    const plans = await FixPlanModel.find(q)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean<PlanDoc[]>();
    res.json(plans.map(shapePlan));
  } catch (err) {
    next(err);
  }
});

// Detail
fixPlansRouter.get('/projects/:id/fix-plans/:planId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.planId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const plan = await FixPlanModel.findOne({
      _id: req.params.planId,
      projectId: req.params.id,
    }).lean<PlanDoc | null>();
    if (!plan) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shapePlan(plan));
  } catch (err) {
    next(err);
  }
});

// Create
const CreatePlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  ownerType: z.enum(['analyst', 'seo', 'content', 'developer', 'client']).optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  expectedImpactSummary: z.string().max(2000).optional(),
});
fixPlansRouter.post('/projects/:id/fix-plans', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = CreatePlanSchema.parse(req.body);
    const created = await FixPlanModel.create({
      projectId: new Types.ObjectId(req.params.id),
      title: body.title,
      description: body.description ?? '',
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
      status: body.status ?? 'draft',
      ownerType: body.ownerType ?? 'analyst',
      priority: body.priority ?? 'P1',
      expectedImpactSummary: body.expectedImpactSummary ?? '',
      items: [],
    });
    res.status(201).json(shapePlan(created.toObject() as unknown as PlanDoc));
  } catch (err) {
    next(err);
  }
});

// Update plan metadata (title/desc/status/period/etc.)
const UpdatePlanSchema = CreatePlanSchema.partial();
fixPlansRouter.patch('/projects/:id/fix-plans/:planId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.planId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = UpdatePlanSchema.parse(req.body);
    const set: Record<string, unknown> = { ...body };
    if (body.periodStart) set.periodStart = new Date(body.periodStart);
    if (body.periodEnd) set.periodEnd = new Date(body.periodEnd);
    const r = await FixPlanModel.findOneAndUpdate(
      { _id: req.params.planId, projectId: req.params.id },
      { $set: set },
      { new: true },
    ).lean<PlanDoc | null>();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shapePlan(r));
  } catch (err) {
    next(err);
  }
});

// Delete plan. Audit-trail safety: only empty drafts may be hard-deleted. Plans with items (or
// any non-draft plan) are archived so the agency keeps an execution history.
fixPlansRouter.delete('/projects/:id/fix-plans/:planId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.planId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const existing = await FixPlanModel.findOne({
      _id: req.params.planId,
      projectId: req.params.id,
    }).lean<PlanDoc | null>();
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const itemCount = (existing.items ?? []).length;
    const isEmptyDraft = existing.status === 'draft' && itemCount === 0;
    if (isEmptyDraft) {
      await FixPlanModel.deleteOne({
        _id: req.params.planId,
        projectId: req.params.id,
      });
      res.json({ ok: true, deleted: true, archived: false });
      return;
    }
    const archived = await FixPlanModel.findOneAndUpdate(
      { _id: req.params.planId, projectId: req.params.id },
      { $set: { status: 'archived' } },
      { new: true },
    ).lean<PlanDoc | null>();
    res.json({ ok: true, deleted: false, archived: true, plan: shapePlan(archived as PlanDoc) });
  } catch (err) {
    next(err);
  }
});

// Add item from source (recommendation/issue/opportunity/content-brief)
const AddItemSchema = z.object({
  sourceType: z.enum(['recommendation', 'issue', 'opportunity', 'content-brief']),
  sourceId: z.string().min(1),
});
fixPlansRouter.post(
  '/projects/:id/fix-plans/:planId/items',
  async (req, res, next) => {
    try {
      if (
        !Types.ObjectId.isValid(req.params.id) ||
        !Types.ObjectId.isValid(req.params.planId)
      ) {
        res.status(400).json({ error: 'invalid id' });
        return;
      }
      const body = AddItemSchema.parse(req.body);
      const draft = await buildItemFromSource(req.params.id, body);
      // De-dupe: don't double-add the same source into the same plan.
      const existing = await FixPlanModel.findOne({
        _id: req.params.planId,
        projectId: req.params.id,
        'items.sourceType': body.sourceType,
        'items.sourceId': body.sourceId,
      }).lean<PlanDoc | null>();
      if (existing) {
        res
          .status(409)
          .json({ error: 'Item from this source is already in the plan.' });
        return;
      }
      const r = await FixPlanModel.findOneAndUpdate(
        { _id: req.params.planId, projectId: req.params.id },
        { $push: { items: { ...draft, addedAt: new Date() } } },
        { new: true },
      ).lean<PlanDoc | null>();
      if (!r) {
        res.status(404).json({ error: 'plan not found' });
        return;
      }
      res.status(201).json(shapePlan(r));
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

// Add manual item (no source linkage)
const AddManualItemSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  ownerType: z.enum(['analyst', 'seo', 'content', 'developer', 'client']).optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  impact: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
  effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
  expectedOutcome: z.string().max(2000).optional(),
  validationMethod: z.string().max(2000).optional(),
  targetDate: z.string().datetime().optional(),
  clientVisible: z.boolean().optional(),
  pageId: z.string().optional(),
  keywordId: z.string().optional(),
});
fixPlansRouter.post(
  '/projects/:id/fix-plans/:planId/items/manual',
  async (req, res, next) => {
    try {
      const body = AddManualItemSchema.parse(req.body);
      const item: Record<string, unknown> = {
        sourceType: 'manual',
        title: body.title,
        description: body.description ?? '',
        ownerType: body.ownerType ?? 'analyst',
        priority: body.priority ?? 'P2',
        impact: body.impact ?? 'unknown',
        effort: body.effort ?? 'unknown',
        expectedOutcome: body.expectedOutcome ?? '',
        validationMethod: body.validationMethod ?? '',
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
        clientVisible: body.clientVisible ?? true,
        addedAt: new Date(),
      };
      if (body.pageId && Types.ObjectId.isValid(body.pageId)) {
        item.pageId = new Types.ObjectId(body.pageId);
      }
      if (body.keywordId && Types.ObjectId.isValid(body.keywordId)) {
        item.keywordId = new Types.ObjectId(body.keywordId);
      }
      const r = await FixPlanModel.findOneAndUpdate(
        { _id: req.params.planId, projectId: req.params.id },
        { $push: { items: item } },
        { new: true },
      ).lean<PlanDoc | null>();
      if (!r) {
        res.status(404).json({ error: 'plan not found' });
        return;
      }
      res.status(201).json(shapePlan(r));
    } catch (err) {
      next(err);
    }
  },
);

// Update an item (status / owner / priority / notes / dates)
const UpdateItemSchema = z.object({
  status: z
    .enum([
      'planned',
      'in-progress',
      'fixed',
      'ready-for-validation',
      'validated',
      'failed-validation',
      'deferred',
    ])
    .optional(),
  ownerType: z.enum(['analyst', 'seo', 'content', 'developer', 'client']).optional(),
  assignedToUserId: z.string().max(120).optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  impact: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
  effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  expectedOutcome: z.string().max(2000).optional(),
  validationMethod: z.string().max(2000).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).optional(),
  internalNotes: z.string().max(4000).optional(),
  clientVisible: z.boolean().optional(),
});
fixPlansRouter.patch(
  '/projects/:id/fix-plans/:planId/items/:itemId',
  async (req, res, next) => {
    try {
      const body = UpdateItemSchema.parse(req.body);
      const set: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined) continue;
        if (k === 'targetDate') set[`items.$.${k}`] = v === null ? null : new Date(v as string);
        else set[`items.$.${k}`] = v;
      }
      if (body.status === 'fixed' || body.status === 'ready-for-validation') {
        set['items.$.completedAt'] = new Date();
      }
      if (body.status === 'validated') {
        set['items.$.validatedAt'] = new Date();
      }
      const r = await FixPlanModel.findOneAndUpdate(
        {
          _id: req.params.planId,
          projectId: req.params.id,
          'items._id': new Types.ObjectId(req.params.itemId),
        },
        { $set: set },
        { new: true },
      ).lean<PlanDoc | null>();
      if (!r) {
        res.status(404).json({ error: 'item not found' });
        return;
      }
      res.json(shapePlan(r));
    } catch (err) {
      next(err);
    }
  },
);

// Remove an item
fixPlansRouter.delete(
  '/projects/:id/fix-plans/:planId/items/:itemId',
  async (req, res, next) => {
    try {
      const r = await FixPlanModel.findOneAndUpdate(
        { _id: req.params.planId, projectId: req.params.id },
        { $pull: { items: { _id: new Types.ObjectId(req.params.itemId) } } },
        { new: true },
      ).lean<PlanDoc | null>();
      if (!r) {
        res.status(404).json({ error: 'plan not found' });
        return;
      }
      res.json(shapePlan(r));
    } catch (err) {
      next(err);
    }
  },
);

// Run validation against latest evidence
fixPlansRouter.post(
  '/projects/:id/fix-plans/:planId/items/:itemId/validate',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.itemId)) {
        res.status(400).json({ error: 'invalid item id' });
        return;
      }
      const plan = await FixPlanModel.findOne({
        _id: req.params.planId,
        projectId: req.params.id,
      }).lean<PlanDoc | null>();
      if (!plan) {
        res.status(404).json({ error: 'plan not found' });
        return;
      }
      const item = (plan.items ?? []).find(
        (it) => String(it._id) === req.params.itemId,
      );
      if (!item) {
        res.status(404).json({ error: 'item not found' });
        return;
      }
      const result = await validateFixPlanItem(req.params.id, {
        sourceType: item.sourceType as
          | 'recommendation'
          | 'issue'
          | 'opportunity'
          | 'content-brief'
          | 'manual',
        recommendationId: item.recommendationId ?? null,
        issueId: item.issueId ?? null,
        opportunityId: item.opportunityId ?? null,
        contentBriefId: item.contentBriefId ?? null,
        pageId: item.pageId ?? null,
        keywordId: item.keywordId ?? null,
        addedAt: item.addedAt,
        completedAt: item.completedAt ?? null,
        validationMethod: item.validationMethod,
      });
      const itemUpdates: Record<string, unknown> = {
        'items.$.validationStatus': result.status,
        'items.$.validationEvidence': { ...result.evidence, reason: result.reason },
        'items.$.validationCheckedAt': new Date(),
        'items.$.validationDataSource': result.dataSource,
      };
      // Translate the validation verdict to the item's lifecycle status so the kanban view shows
      // the right column without analyst intervention. Analyst can still override.
      if (result.status === 'passed') {
        itemUpdates['items.$.status'] = 'validated';
        itemUpdates['items.$.validatedAt'] = new Date();
      } else if (result.status === 'failed') {
        itemUpdates['items.$.status'] = 'failed-validation';
      }
      const r = await FixPlanModel.findOneAndUpdate(
        {
          _id: req.params.planId,
          projectId: req.params.id,
          'items._id': new Types.ObjectId(req.params.itemId),
        },
        { $set: itemUpdates },
        { new: true },
      ).lean<PlanDoc | null>();
      res.json({
        plan: shapePlan(r as PlanDoc),
        validation: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Generate a weekly plan draft. Persisted as status=draft so the analyst reviews before activating.
fixPlansRouter.post(
  '/projects/:id/fix-plans/generate-weekly',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const draft = await generateWeeklyPlanDraft({ projectId: req.params.id });
      const created = await FixPlanModel.create({
        projectId: new Types.ObjectId(req.params.id),
        title: draft.title,
        description: draft.description,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        status: 'draft',
        items: draft.items,
      });
      res.status(201).json(shapePlan(created.toObject() as unknown as PlanDoc));
    } catch (err) {
      next(err);
    }
  },
);

// Summary: counts for the project (used by overview tile + integration CTAs)
fixPlansRouter.get('/projects/:id/fix-plans-summary', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const [active, draft, totals] = await Promise.all([
      FixPlanModel.findOne({ projectId: pid, status: 'active' })
        .sort({ updatedAt: -1 })
        .lean<PlanDoc | null>(),
      FixPlanModel.find({ projectId: pid, status: 'draft' }).select({ _id: 1, title: 1 }).lean(),
      FixPlanModel.aggregate<{
        _id: null;
        plans: number;
        items: number;
        validated: number;
        failed: number;
      }>([
        { $match: { projectId: pid } },
        {
          $project: {
            items: { $ifNull: ['$items', []] },
          },
        },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            plans: { $addToSet: '$_id' },
            items: { $sum: { $cond: [{ $ifNull: ['$items._id', false] }, 1, 0] } },
            validated: {
              $sum: { $cond: [{ $eq: ['$items.status', 'validated'] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$items.status', 'failed-validation'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 1,
            plans: { $size: '$plans' },
            items: 1,
            validated: 1,
            failed: 1,
          },
        },
      ]),
    ]);
    const t = totals[0] ?? { plans: 0, items: 0, validated: 0, failed: 0 };
    res.json({
      activePlan: active ? shapePlan(active) : null,
      drafts: draft.map((d) => ({ id: String(d._id), title: d.title })),
      totals: { plans: t.plans, items: t.items, validated: t.validated, failed: t.failed },
    });
  } catch (err) {
    next(err);
  }
});
