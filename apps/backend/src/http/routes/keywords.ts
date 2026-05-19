import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { KeywordModel, GscRowModel, PageModel } from '../../db';

export const keywordsRouter = Router();

const KeywordCreate = z.object({
  keyword: z.string().min(1).max(200),
  source: z.enum(['manual', 'gsc', 'ai', 'import', 'external']).default('manual'),
  intent: z
    .enum(['informational', 'commercial', 'transactional', 'navigational', 'local', 'support', 'unknown'])
    .default('unknown'),
  funnelStage: z.enum(['TOFU', 'MOFU', 'BOFU', 'retention', 'unknown']).default('unknown'),
  mappedPageId: z.string().optional(),
  mappedGoalId: z.string().optional(),
  preferredUrl: z.string().optional(),
  priority: z.enum(['P0', 'P1', 'P2']).default('P2'),
  notes: z.string().max(2000).optional(),
});

const KeywordUpdate = KeywordCreate.partial().extend({
  status: z
    .enum(['candidate', 'mapped', 'unmapped', 'wrong-page', 'cannibalised', 'no-target-page', 'ignored'])
    .optional(),
});

keywordsRouter.get('/projects/:id/keywords', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    if (req.query.source) q.source = req.query.source;
    if (req.query.intent) q.intent = req.query.intent;
    if (req.query.mappedPageId) q.mappedPageId = new Types.ObjectId(String(req.query.mappedPageId));
    const limit = Math.min(2000, Number(req.query.limit ?? 500));
    const rows = await KeywordModel.find(q).sort({ impressions: -1 }).limit(limit).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        keyword: r.keyword,
        source: r.source,
        intent: r.intent,
        funnelStage: r.funnelStage,
        mappedPageId: r.mappedPageId ? String(r.mappedPageId) : null,
        mappedGoalId: r.mappedGoalId ?? null,
        preferredUrl: r.preferredUrl ?? null,
        rankingUrl: r.rankingUrl ?? null,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        pageCount: r.pageCount,
        status: r.status,
        priority: r.priority,
        opportunityScore: r.opportunityScore,
        notes: r.notes,
        createdAt: (r as unknown as { createdAt?: Date }).createdAt,
        updatedAt: (r as unknown as { updatedAt?: Date }).updatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

keywordsRouter.post('/projects/:id/keywords', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const body = KeywordCreate.parse(req.body);
    const doc = await KeywordModel.findOneAndUpdate(
      { projectId: pid, keyword: body.keyword.trim() },
      {
        $setOnInsert: {
          projectId: pid,
          keyword: body.keyword.trim(),
          source: body.source,
          status: body.mappedPageId ? 'mapped' : 'candidate',
        },
        $set: {
          intent: body.intent,
          funnelStage: body.funnelStage,
          mappedPageId: body.mappedPageId
            ? new Types.ObjectId(body.mappedPageId)
            : undefined,
          mappedGoalId: body.mappedGoalId,
          preferredUrl: body.preferredUrl,
          priority: body.priority,
          notes: body.notes,
        },
      },
      { upsert: true, new: true },
    ).lean();
    res.status(201).json({ id: String(doc!._id) });
  } catch (err) {
    next(err);
  }
});

keywordsRouter.patch('/projects/:id/keywords/:keywordId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.keywordId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = KeywordUpdate.parse(req.body);
    const set: Record<string, unknown> = { ...body };
    if (body.mappedPageId) set.mappedPageId = new Types.ObjectId(body.mappedPageId);
    if (body.mappedPageId && !body.status) set.status = 'mapped';
    await KeywordModel.updateOne(
      { _id: req.params.keywordId, projectId: req.params.id },
      { $set: set },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

keywordsRouter.delete('/projects/:id/keywords/:keywordId', async (req, res, next) => {
  try {
    await KeywordModel.deleteOne({
      _id: req.params.keywordId,
      projectId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Import GSC queries as keyword candidates. Doc 6 §"GSC Query Import".
 * For each query: aggregate metrics across pages, pick highest-impression ranking page, upsert.
 */
const ImportBody = z.object({
  minImpressions: z.number().int().min(0).max(100000).default(50),
  limit: z.number().int().min(1).max(2000).default(500),
});

keywordsRouter.post('/projects/:id/keywords/import-gsc', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const body = ImportBody.parse(req.body ?? {});

    const agg = await GscRowModel.aggregate<{
      _id: string;
      clicks: number;
      impressions: number;
      avgPosition: number;
      pageCount: number;
      topPage: string;
      topPageImpressions: number;
    }>([
      { $match: { projectId: pid } },
      { $sort: { impressions: -1 } },
      {
        $group: {
          _id: '$query',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
          pageCount: { $addToSet: '$pageUrl' },
          topPage: { $first: '$pageUrl' },
          topPageImpressions: { $first: '$impressions' },
        },
      },
      { $match: { impressions: { $gte: body.minImpressions } } },
      { $sort: { impressions: -1 } },
      { $limit: body.limit },
    ]);

    // Map ranking URL -> page ID for the project (only when crawled).
    const pages = await PageModel.find({ projectId: pid }).select({ url: 1, normalizedUrl: 1 }).lean();
    const urlToPageId = new Map<string, Types.ObjectId>();
    for (const p of pages) {
      if (p.url) urlToPageId.set(p.url, p._id);
      if (p.normalizedUrl) urlToPageId.set(p.normalizedUrl, p._id);
    }

    // Filter junk queries before import. Doc 6 §"GSC Query Import" requires real organic queries.
    const isJunkQuery = (q: string): boolean => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      if (s === 'mock-query' || s === 'mock_query' || s === 'placeholder') return true;
      if (s.startsWith('site:')) return true; // operator query, not real organic intent
      if (/^\(\s*not\s+set\s*\)$/i.test(s)) return true;
      if (/^[0-9\-_.]+$/.test(s)) return true; // numeric-only noise
      return false;
    };

    let upserted = 0;
    let skipped = 0;
    for (const row of agg) {
      if (isJunkQuery(row._id)) {
        skipped += 1;
        continue;
      }
      const pageIds = Array.isArray((row as { pageCount: unknown }).pageCount)
        ? ((row as unknown as { pageCount: string[] }).pageCount).length
        : 1;
      const rankingPageId = urlToPageId.get(row.topPage);
      // If a ranking page exists in the crawl set we auto-promote to 'mapped' — the analyst can
      // override to 'wrong-page' or 'unmapped' afterwards. Otherwise leave as 'candidate'.
      await KeywordModel.updateOne(
        { projectId: pid, keyword: row._id },
        {
          $setOnInsert: {
            projectId: pid,
            keyword: row._id,
            source: 'gsc',
          },
          $set: {
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
            position: row.avgPosition ?? 0,
            pageCount: pageIds,
            rankingUrl: row.topPage,
            ...(rankingPageId
              ? { mappedPageId: rankingPageId, status: 'mapped' }
              : { status: 'candidate' }),
          },
        },
        { upsert: true },
      );
      upserted += 1;
    }
    res.json({ imported: upserted, skipped, totalCandidates: agg.length });
  } catch (err) {
    next(err);
  }
});

void z;
