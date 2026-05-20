// Recommendation routes. Doc continuation §"Phase 2".
// Strict whitelist: never echo raw evidence blobs to internal-only fields uncontrolled, but
// evidence object is analyst-facing structured data so it stays in the response.

import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { RecommendationModel } from '../../db';
import { generateRecommendations } from '../../recommendations/generate';
import { generateRecommendationsFromKeywordFit } from '../../recommendations/from-keyword-fit';
import { analyzeKeywordFits } from '../../keyword-fit/analyze';

export const recommendationsRouter = Router();

const StatusSchema = z.enum([
  'draft',
  'proposed',
  'approved',
  'planned',
  'in_progress',
  'implemented',
  'verified',
  'rejected',
]);
const VerdictSchema = z.enum(['must_change', 'should_improve', 'consider', 'monitor', 'no_action']);
const OwnerSchema = z.enum(['seo', 'content', 'developer', 'client', 'analyst']);
const ReportVisibilitySchema = z.enum(['internal', 'client', 'both', 'hidden']);

const PatchSchema = z.object({
  status: StatusSchema.optional(),
  verdict: VerdictSchema.optional(),
  ownerType: OwnerSchema.optional(),
  assignedToUserId: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  reportVisibility: ReportVisibilitySchema.optional(),
  title: z.string().min(1).max(300).optional(),
  rootCauseSummary: z.string().max(2000).optional(),
  recommendedAction: z.string().max(4000).optional(),
  whyItMatters: z.string().max(2000).optional(),
  validationMethod: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  rejectedReason: z.string().max(1000).optional(),
});

function shape(r: Record<string, unknown>): Record<string, unknown> {
  const get = <T>(k: string): T | undefined => r[k] as T | undefined;
  return {
    id: String(r._id),
    sourceKey: get('sourceKey'),
    type: get('type'),
    status: get('status'),
    verdict: get('verdict'),
    title: get('title'),
    rootCauseSummary: get('rootCauseSummary'),
    rootCause: get('rootCause'),
    recommendedAction: get('recommendedAction'),
    whyItMatters: get('whyItMatters'),
    validationMethod: get('validationMethod'),
    evidence: get('evidence') ?? {},
    expectedImpact: get('expectedImpact'),
    effort: get('effort'),
    priorityScore: get('priorityScore'),
    confidence: get('confidence'),
    confidenceLevel: get('confidenceLevel'),
    ownerType: get('ownerType'),
    assignedToUserId: get('assignedToUserId') ?? null,
    dueDate: get('dueDate') ?? null,
    source: get('source'),
    sourceIssueIds: (get<Types.ObjectId[]>('sourceIssueIds') ?? []).map(String),
    sourceFindingIds: (get<Types.ObjectId[]>('sourceFindingIds') ?? []).map(String),
    sourceOpportunityIds: (get<Types.ObjectId[]>('sourceOpportunityIds') ?? []).map(String),
    pageIds: (get<Types.ObjectId[]>('pageIds') ?? []).map(String),
    keywordIds: (get<Types.ObjectId[]>('keywordIds') ?? []).map(String),
    goalIds: get<string[]>('goalIds') ?? [],
    reportVisibility: get('reportVisibility'),
    notes: get('notes') ?? '',
    rejectedReason: get('rejectedReason') ?? null,
    lastGeneratedAt: get('lastGeneratedAt') ?? null,
    evidenceStaleReason: get('evidenceStaleReason') ?? null,
    evidenceStaleAt: get('evidenceStaleAt') ?? null,
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
  };
}

recommendationsRouter.get('/projects/:id/recommendations', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    else if (req.query.activeOnly === '1' || req.query.activeOnly === 'true') {
      // Active = anything an analyst still has work to do on. Audit feedback 2026-05-20.
      q.status = { $in: ['draft', 'proposed', 'approved', 'planned', 'in_progress', 'implemented'] };
    }
    if (req.query.type) q.type = req.query.type;
    if (req.query.verdict) q.verdict = req.query.verdict;
    if (req.query.ownerType) q.ownerType = req.query.ownerType;
    if (req.query.issueId && Types.ObjectId.isValid(String(req.query.issueId))) {
      q.sourceIssueIds = new Types.ObjectId(String(req.query.issueId));
    }
    if (req.query.pageId && Types.ObjectId.isValid(String(req.query.pageId))) {
      q.pageIds = new Types.ObjectId(String(req.query.pageId));
    }
    const limit = Math.min(2000, Number(req.query.limit ?? 500));
    const rows = await RecommendationModel.find(q)
      .sort({ priorityScore: -1, updatedAt: -1 })
      .limit(limit)
      .lean();
    res.json(rows.map((r) => shape(r as Record<string, unknown>)));
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.get('/projects/:id/recommendations/summary', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const byStatus = await RecommendationModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: pid } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byOwner = await RecommendationModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: pid, status: { $in: ['draft', 'proposed', 'approved', 'planned', 'in_progress'] } } },
      { $group: { _id: '$ownerType', count: { $sum: 1 } } },
    ]);
    res.json({
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      byOwner: byOwner.map((o) => ({ ownerType: o._id, count: o.count })),
    });
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.get('/projects/:id/recommendations/:recId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.recId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const r = await RecommendationModel.findOne({
      _id: req.params.recId,
      projectId: req.params.id,
    }).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shape(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.post('/projects/:id/recommendations/regenerate', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    // Refresh keyword-fit verdicts first, then issue-based recs, then keyword-fit recs so the
    // analyst gets one coherent regeneration pass. All idempotent.
    const fitAnalysis = await analyzeKeywordFits({ projectId: req.params.id });
    const issueResult = await generateRecommendations({ projectId: req.params.id });
    const fitResult = await generateRecommendationsFromKeywordFit({ projectId: req.params.id });
    res.json({
      keywordFit: fitAnalysis,
      issueRecommendations: issueResult,
      keywordFitRecommendations: fitResult,
    });
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.patch('/projects/:id/recommendations/:recId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.recId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = PatchSchema.parse(req.body);
    const set: Record<string, unknown> = { ...body };
    if (body.dueDate === null) set.dueDate = null;
    else if (body.dueDate) set.dueDate = new Date(body.dueDate);
    if (body.status === 'verified') set.validatedAt = new Date();
    const r = await RecommendationModel.findOneAndUpdate(
      { _id: req.params.recId, projectId: req.params.id },
      { $set: set },
      { new: true },
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shape(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

const ApproveSchema = z.object({ ownerType: OwnerSchema.optional(), notes: z.string().max(2000).optional() });
recommendationsRouter.post('/projects/:id/recommendations/:recId/approve', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.recId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = ApproveSchema.parse(req.body ?? {});
    const set: Record<string, unknown> = { status: 'approved' };
    if (body.ownerType) set.ownerType = body.ownerType;
    if (body.notes) set.notes = body.notes;
    const r = await RecommendationModel.findOneAndUpdate(
      { _id: req.params.recId, projectId: req.params.id },
      { $set: set },
      { new: true },
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shape(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

const RejectSchema = z.object({ reason: z.string().max(1000).optional() });
recommendationsRouter.post('/projects/:id/recommendations/:recId/reject', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.recId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = RejectSchema.parse(req.body ?? {});
    const r = await RecommendationModel.findOneAndUpdate(
      { _id: req.params.recId, projectId: req.params.id },
      { $set: { status: 'rejected', rejectedReason: body.reason ?? '' } },
      { new: true },
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shape(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});
