import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { KeywordFitModel } from '../../db';
import { analyzeKeywordFits } from '../../keyword-fit/analyze';
import { analyzePageContent } from '../../keyword-fit/page-analysis';

export const keywordFitRouter = Router();

function shapeFit(r: Record<string, unknown>): Record<string, unknown> {
  const get = <T>(k: string): T | undefined => r[k] as T | undefined;
  return {
    id: String(r._id),
    keywordId: String(get<Types.ObjectId>('keywordId')),
    keyword: get('keyword'),
    mappedPageId: get<Types.ObjectId>('mappedPageId') ? String(get<Types.ObjectId>('mappedPageId')) : null,
    rankingPageId: get<Types.ObjectId>('rankingPageId') ? String(get<Types.ObjectId>('rankingPageId')) : null,
    rankingUrl: get('rankingUrl') ?? null,
    intent: get('intent'),
    funnelStage: get('funnelStage'),
    verdict: get('verdict'),
    confidence: get('confidence'),
    confidenceLevel: get('confidenceLevel'),
    rootCauseSummary: get('rootCauseSummary'),
    evidence: get('evidence') ?? {},
    recommendedActions: get('recommendedActions') ?? [],
    clicks: get('clicks'),
    impressions: get('impressions'),
    ctr: get('ctr'),
    position: get('position'),
    competingPageCount: get('competingPageCount'),
    analystNotes: get('analystNotes') ?? '',
    lastAnalyzedAt: get('lastAnalyzedAt') ?? null,
  };
}

keywordFitRouter.get('/projects/:id/keyword-fit', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.verdict) q.verdict = req.query.verdict;
    if (req.query.pageId && Types.ObjectId.isValid(String(req.query.pageId))) {
      const pgId = new Types.ObjectId(String(req.query.pageId));
      q.$or = [{ mappedPageId: pgId }, { rankingPageId: pgId }];
    }
    const limit = Math.min(2000, Number(req.query.limit ?? 500));
    const rows = await KeywordFitModel.find(q).sort({ impressions: -1 }).limit(limit).lean();
    res.json(rows.map((r) => shapeFit(r as Record<string, unknown>)));
  } catch (err) {
    next(err);
  }
});

keywordFitRouter.get('/projects/:id/keyword-fit/summary', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const byVerdict = await KeywordFitModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: pid } },
      { $group: { _id: '$verdict', count: { $sum: 1 } } },
    ]);
    res.json({ byVerdict: byVerdict.map((b) => ({ verdict: b._id, count: b.count })) });
  } catch (err) {
    next(err);
  }
});

keywordFitRouter.get('/projects/:id/keyword-fit/:fitId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.fitId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const r = await KeywordFitModel.findOne({
      _id: req.params.fitId,
      projectId: req.params.id,
    }).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shapeFit(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

const FitPatchSchema = z.object({
  analystNotes: z.string().max(4000).optional(),
  verdict: z
    .enum([
      'good_fit',
      'needs_minor_update',
      'must_improve',
      'wrong_page_ranking',
      'cannibalized',
      'create_new_page',
      'needs_target_mapping',
      'merge_or_redirect',
      'do_not_target',
      'monitor',
    ])
    .optional(),
});
keywordFitRouter.patch('/projects/:id/keyword-fit/:fitId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.fitId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = FitPatchSchema.parse(req.body);
    const r = await KeywordFitModel.findOneAndUpdate(
      { _id: req.params.fitId, projectId: req.params.id },
      { $set: body },
      { new: true },
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(shapeFit(r as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

keywordFitRouter.post('/projects/:id/keyword-fit/recompute', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const result = await analyzeKeywordFits({ projectId: req.params.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

keywordFitRouter.get('/projects/:id/pages/:pageId/content-analysis', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.pageId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const result = await analyzePageContent({
      projectId: req.params.id,
      pageId: req.params.pageId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
