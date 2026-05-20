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
  mappedPageId: z.string().optional().nullable(),
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
        rankingPageId: r.rankingPageId ? String(r.rankingPageId) : null,
        mappingSource: (r as { mappingSource?: string | null }).mappingSource ?? null,
        mappedAt: (r as { mappedAt?: Date | null }).mappedAt ?? null,
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
    // Manual create — provenance is always 'analyst' when mappedPageId is provided.
    const setMap: Record<string, unknown> = {
      intent: body.intent,
      funnelStage: body.funnelStage,
      mappedGoalId: body.mappedGoalId,
      preferredUrl: body.preferredUrl,
      priority: body.priority,
      notes: body.notes,
    };
    if (body.mappedPageId) {
      setMap.mappedPageId = new Types.ObjectId(body.mappedPageId);
      setMap.mappingSource = 'analyst';
      setMap.mappedAt = new Date();
    }
    const doc = await KeywordModel.findOneAndUpdate(
      { projectId: pid, keyword: body.keyword.trim() },
      {
        $setOnInsert: {
          projectId: pid,
          keyword: body.keyword.trim(),
          source: body.source,
          status: body.mappedPageId ? 'mapped' : 'candidate',
        },
        $set: setMap,
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
    // Explicit analyst action — stamp provenance whenever a mapping is set.
    if (body.mappedPageId) {
      set.mappedPageId = new Types.ObjectId(body.mappedPageId);
      set.mappingSource = 'analyst';
      set.mappedAt = new Date();
      if (!body.status) set.status = 'mapped';
    } else if (body.mappedPageId === '' || body.mappedPageId === null) {
      // Explicit unmap from analyst.
      set.mappedPageId = null;
      set.mappingSource = null;
      set.mappedAt = null;
      if (!body.status) set.status = 'unmapped';
    }
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

    const latest = await GscRowModel.findOne({ projectId: pid })
      .sort({ rangeEnd: -1 })
      .select({ rangeEnd: 1 })
      .lean();
    const latestRangeEnd = latest?.rangeEnd ?? null;

    const agg = await GscRowModel.aggregate<{
      _id: string;
      clicks: number;
      impressions: number;
      avgPosition: number;
      pageCount: number;
      topPage: string;
      topPageImpressions: number;
    }>([
      // Scope to the latest sync window. Audit feedback 2026-05-20 — importer + analyzer must
      // agree on what "current" GSC data means.
      { $match: { projectId: pid, ...(latestRangeEnd ? { rangeEnd: latestRangeEnd } : {}) } },
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
      // Audit feedback 2026-05-20: GSC import only tells us "this URL currently ranks", not
      // "this URL is the intended target". Never auto-set `mappedPageId`. Never overwrite an
      // analyst mapping. Refresh only what GSC actually owns: metrics + ranking page.
      const update: Record<string, unknown> = {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
        position: row.avgPosition ?? 0,
        pageCount: pageIds,
        rankingUrl: row.topPage,
        ...(rankingPageId ? { rankingPageId } : { rankingPageId: null }),
      };
      await KeywordModel.updateOne(
        { projectId: pid, keyword: row._id },
        {
          $setOnInsert: {
            projectId: pid,
            keyword: row._id,
            source: 'gsc',
            status: 'candidate',
          },
          $set: update,
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

// Legacy keyword mapping cleanup has moved to the controlled maintenance task system. See
// POST /projects/:id/maintenance/run with taskKey 'cleanup-legacy-keyword-mappings'.

void z;
