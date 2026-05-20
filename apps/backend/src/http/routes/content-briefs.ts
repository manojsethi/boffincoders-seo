import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ContentBriefModel } from '../../db';
import { generateContentBrief } from '../../content-briefs/generate';
import { runTask } from '../../ai';

export const contentBriefsRouter = Router();

function shape(b: Record<string, unknown>): Record<string, unknown> {
  const get = <T>(k: string): T | undefined => b[k] as T | undefined;
  return {
    id: String(b._id),
    keywordId: String(get<Types.ObjectId>('keywordId')),
    pageId: get<Types.ObjectId>('pageId') ? String(get<Types.ObjectId>('pageId')) : null,
    version: get('version') ?? 1,
    title: get('title'),
    objective: get('objective'),
    audience: get('audience'),
    searchIntent: get('searchIntent'),
    funnelStage: get('funnelStage'),
    targetKeyword: get('targetKeyword'),
    secondaryKeywords: get('secondaryKeywords') ?? [],
    currentPageSummary: get('currentPageSummary'),
    pageGoal: get('pageGoal'),
    titleSuggestions: get('titleSuggestions') ?? [],
    metaSuggestions: get('metaSuggestions') ?? [],
    h1Suggestion: get('h1Suggestion'),
    recommendedOutline: get('recommendedOutline') ?? [],
    requiredSections: get('requiredSections') ?? [],
    faqSuggestions: get('faqSuggestions') ?? [],
    internalLinksToAdd: get('internalLinksToAdd') ?? [],
    internalLinksFrom: get('internalLinksFrom') ?? [],
    schemaSuggestions: get('schemaSuggestions') ?? [],
    ctaRecommendation: get('ctaRecommendation'),
    trustProofNeeded: get('trustProofNeeded') ?? [],
    whatToAvoid: get('whatToAvoid') ?? [],
    seoChecklist: get('seoChecklist') ?? [],
    validationChecklist: get('validationChecklist') ?? [],
    contentGaps: get('contentGaps') ?? [],
    dataGaps: get('dataGaps') ?? [],
    evidenceRefs: get('evidenceRefs') ?? [],
    aiTaskRunIds: (get<Types.ObjectId[]>('aiTaskRunIds') ?? []).map(String),
    status: get('status'),
    rejectedReason: get('rejectedReason') ?? null,
    approvedAt: get('approvedAt') ?? null,
    implementedAt: get('implementedAt') ?? null,
    ownerType: get('ownerType'),
    notes: get('notes') ?? '',
    lastGeneratedAt: get('lastGeneratedAt') ?? null,
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
  };
}

contentBriefsRouter.get('/projects/:id/content-briefs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    if (req.query.keywordId && Types.ObjectId.isValid(String(req.query.keywordId))) {
      q.keywordId = new Types.ObjectId(String(req.query.keywordId));
    }
    if (req.query.pageId && Types.ObjectId.isValid(String(req.query.pageId))) {
      q.pageId = new Types.ObjectId(String(req.query.pageId));
    }
    const limit = Math.min(500, Number(req.query.limit ?? 200));
    const rows = await ContentBriefModel.find(q).sort({ updatedAt: -1 }).limit(limit).lean();
    res.json(rows.map((b) => shape(b as Record<string, unknown>)));
  } catch (err) {
    next(err);
  }
});

contentBriefsRouter.get('/projects/:id/content-briefs/summary', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const rows = await ContentBriefModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      statuses: string[];
      latestStatus: string;
      latestId: Types.ObjectId;
      latestUpdatedAt: Date;
    }>([
      { $match: { projectId: pid } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: '$keywordId',
          count: { $sum: 1 },
          statuses: { $addToSet: '$status' },
          latestStatus: { $first: '$status' },
          latestId: { $first: '$_id' },
          latestUpdatedAt: { $first: '$updatedAt' },
        },
      },
    ]);
    res.json(
      rows.map((r) => ({
        keywordId: String(r._id),
        count: r.count,
        statuses: r.statuses,
        latestStatus: r.latestStatus,
        latestId: String(r.latestId),
        latestUpdatedAt: r.latestUpdatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

contentBriefsRouter.get('/projects/:id/content-briefs/:briefId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.briefId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const b = await ContentBriefModel.findOne({
      _id: req.params.briefId,
      projectId: req.params.id,
    }).lean();
    if (!b) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shape(b as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

const CreateSchema = z.object({
  keywordId: z.string(),
  pageId: z.string().optional(),
  useAI: z.boolean().optional().default(true),
  preferredProvider: z.enum(['openrouter', 'openai', 'groq', 'anthropic', 'local']).optional(),
  newVersion: z.boolean().optional().default(false),
});
contentBriefsRouter.post('/projects/:id/content-briefs', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = CreateSchema.parse(req.body);
    let version: number | undefined;
    if (body.newVersion) {
      // Highest existing version for this keyword across any page-target. Lets analyst create a
      // distinct brief without colliding on the upsert key.
      const latest = await ContentBriefModel.findOne({
        projectId: new Types.ObjectId(req.params.id),
        keywordId: new Types.ObjectId(body.keywordId),
      })
        .sort({ version: -1 })
        .select({ version: 1 })
        .lean();
      version = (latest?.version ?? 0) + 1;
    }
    const result = await generateContentBrief({
      projectId: req.params.id,
      keywordId: body.keywordId,
      pageId: body.pageId,
      useAI: body.useAI,
      preferredProvider: body.preferredProvider,
      version,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const PatchSchema = z.object({
  status: z.enum(['draft', 'analyst-review', 'approved', 'rejected', 'implemented']).optional(),
  ownerType: z.enum(['analyst', 'content', 'seo', 'client']).optional(),
  notes: z.string().max(4000).optional(),
  title: z.string().max(300).optional(),
  objective: z.string().max(2000).optional(),
  audience: z.string().max(1500).optional(),
  searchIntent: z.string().optional(),
  funnelStage: z.string().optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  currentPageSummary: z.string().max(2000).optional(),
  pageGoal: z.string().max(500).optional(),
  titleSuggestions: z.array(z.string().max(80)).optional(),
  metaSuggestions: z.array(z.string().max(180)).optional(),
  h1Suggestion: z.string().max(200).optional(),
  recommendedOutline: z
    .array(
      z.object({
        heading: z.string().max(200),
        level: z.number().int().min(2).max(4),
        points: z.array(z.string().max(280)).optional(),
      }),
    )
    .optional(),
  requiredSections: z.array(z.object({ name: z.string(), why: z.string() })).optional(),
  faqSuggestions: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  internalLinksToAdd: z
    .array(z.object({ targetUrl: z.string(), anchorIdea: z.string(), rationale: z.string() }))
    .optional(),
  schemaSuggestions: z.array(z.string()).optional(),
  ctaRecommendation: z.string().max(500).optional(),
  trustProofNeeded: z.array(z.string()).optional(),
  whatToAvoid: z.array(z.string()).optional(),
  seoChecklist: z.array(z.string()).optional(),
  validationChecklist: z.array(z.string()).optional(),
  rejectedReason: z.string().max(2000).optional(),
});
contentBriefsRouter.patch('/projects/:id/content-briefs/:briefId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.briefId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = PatchSchema.parse(req.body);
    const set: Record<string, unknown> = { ...body };
    if (body.status === 'approved') set.approvedAt = new Date();
    if (body.status === 'implemented') set.implementedAt = new Date();
    const r = await ContentBriefModel.findOneAndUpdate(
      { _id: req.params.briefId, projectId: req.params.id },
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

const RegenSchema = z.object({
  useAI: z.boolean().optional().default(true),
  preferredProvider: z.enum(['openrouter', 'openai', 'groq', 'anthropic', 'local']).optional(),
});
contentBriefsRouter.post('/projects/:id/content-briefs/:briefId/regenerate', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.briefId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = RegenSchema.parse(req.body ?? {});
    const existing = await ContentBriefModel.findOne({
      _id: req.params.briefId,
      projectId: req.params.id,
    }).lean();
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const result = await generateContentBrief({
      projectId: req.params.id,
      keywordId: String(existing.keywordId),
      pageId: existing.pageId ? String(existing.pageId) : undefined,
      useAI: body.useAI,
      preferredProvider: body.preferredProvider,
      version: existing.version,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const RewriteSchema = z.object({
  sectionKey: z.enum([
    'objective',
    'audience',
    'h1Suggestion',
    'ctaRecommendation',
    'currentPageSummary',
  ]),
  audience: z.enum(['analyst', 'client']).default('analyst'),
});
contentBriefsRouter.post('/projects/:id/content-briefs/:briefId/rewrite-section', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.briefId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = RewriteSchema.parse(req.body);
    const brief = await ContentBriefModel.findOne({
      _id: req.params.briefId,
      projectId: req.params.id,
    }).lean();
    if (!brief) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const currentValue = (brief as unknown as Record<string, unknown>)[body.sectionKey] as
      | string
      | undefined;
    if (typeof currentValue !== 'string' || !currentValue) {
      res.status(400).json({ error: 'section is empty — nothing to rewrite' });
      return;
    }
    const briefContext = JSON.stringify({
      keyword: brief.targetKeyword,
      searchIntent: brief.searchIntent,
      audience: brief.audience,
      objective: brief.objective,
    });
    const result = await runTask('rewrite-brief-section', {
      projectId: req.params.id,
      params: {
        sectionKey: body.sectionKey,
        audience: body.audience,
        currentValue,
        briefContext,
      },
      sourceIds: { briefId: req.params.briefId },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
