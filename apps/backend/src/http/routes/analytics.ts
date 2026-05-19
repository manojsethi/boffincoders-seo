// Analytics router. Doc 7 §"Analytics Endpoints Required".
// Reads raw GSC/GA4/CWV/Issue/Opportunity data and returns dashboard-ready aggregates.
// No data mutation — strictly read-only.

import { Router } from 'express';
import { Types } from 'mongoose';
import {
  ProjectModel,
  GscRowModel,
  Ga4RowModel,
  CwvMetricModel,
  IssueModel,
  OpportunityModel,
  PageModel,
  SiteConnectionModel,
} from '../../db';
import { isJunkQuery } from '../../audit/opportunities';

export const analyticsRouter = Router();

const ACTIVE_LIFECYCLE = ['open', 'planned', 'in-progress', 'needs_review'];

function pid(req: { params: { id: string } }): Types.ObjectId | null {
  return Types.ObjectId.isValid(req.params.id) ? new Types.ObjectId(req.params.id) : null;
}

/**
 * Returns the latest rangeEnd for a project's GSC/GA4 collection. All list endpoints scope to this
 * value so KPI cards and tables stay internally consistent — Doc 7 §"Chart Rules" requires every
 * chart to have a single, dated period.
 */
async function latestGscRangeEnd(p: Types.ObjectId): Promise<Date | null> {
  const row = await GscRowModel.findOne({ projectId: p }).sort({ rangeEnd: -1 }).select({ rangeEnd: 1 }).lean();
  return row?.rangeEnd ?? null;
}
async function latestGa4RangeEnd(p: Types.ObjectId): Promise<Date | null> {
  const row = await Ga4RowModel.findOne({ projectId: p }).sort({ rangeEnd: -1 }).select({ rangeEnd: 1 }).lean();
  return row?.rangeEnd ?? null;
}

function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
}

// -------- Data freshness --------

analyticsRouter.get('/projects/:id/analytics/freshness', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });

    const [gscLatest, ga4Latest, cwvLatest, issueLatest, oppLatest, project, conns] = await Promise.all([
      GscRowModel.findOne({ projectId: p }).sort({ rangeEnd: -1 }).select({ rangeStart: 1, rangeEnd: 1 }).lean(),
      Ga4RowModel.findOne({ projectId: p }).sort({ rangeEnd: -1 }).select({ rangeStart: 1, rangeEnd: 1 }).lean(),
      CwvMetricModel.findOne({ projectId: p }).sort({ capturedAt: -1 }).select({ capturedAt: 1 }).lean(),
      IssueModel.findOne({ projectId: p }).sort({ updatedAt: -1 }).select({ updatedAt: 1 }).lean() as Promise<{ updatedAt?: Date } | null>,
      OpportunityModel.findOne({ projectId: p }).sort({ lastSeenAt: -1 }).select({ lastSeenAt: 1 }).lean() as Promise<{ lastSeenAt?: Date } | null>,
      ProjectModel.findById(p).select({ goals: 1, primaryDomain: 1 }).lean(),
      SiteConnectionModel.find({ projectId: p, status: 'connected' }).select({ provider: 1, lastSyncedAt: 1 }).lean(),
    ]);

    res.json({
      gsc: {
        connected: conns.some((c) => c.provider === 'gsc'),
        lastSyncedAt: conns.find((c) => c.provider === 'gsc')?.lastSyncedAt ?? null,
        rangeStart: gscLatest?.rangeStart ?? null,
        rangeEnd: gscLatest?.rangeEnd ?? null,
      },
      ga4: {
        connected: conns.some((c) => c.provider === 'ga4'),
        lastSyncedAt: conns.find((c) => c.provider === 'ga4')?.lastSyncedAt ?? null,
        rangeStart: ga4Latest?.rangeStart ?? null,
        rangeEnd: ga4Latest?.rangeEnd ?? null,
      },
      cwv: {
        lastCapturedAt: cwvLatest?.capturedAt ?? null,
      },
      issues: { lastSeenAt: issueLatest?.updatedAt ?? null },
      opportunities: { lastSeenAt: oppLatest?.lastSeenAt ?? null },
      project: {
        goalsCount: ((project?.goals as unknown[]) ?? []).length,
        primaryDomain: project?.primaryDomain ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -------- GSC --------

/**
 * Period totals for the latest sync window + previous window if available. Returns current vs prev
 * deltas for clicks/impressions/ctr/position so the search dashboard can show a comparison strip.
 */
analyticsRouter.get('/projects/:id/analytics/gsc/summary', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });

    const ranges = await GscRowModel.aggregate<{ _id: Date; clicks: number; impressions: number; position: number; rows: number }>([
      { $match: { projectId: p } },
      {
        $group: {
          _id: '$rangeEnd',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          position: { $avg: '$position' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]);

    const fmt = (r?: typeof ranges[number]): unknown =>
      r
        ? {
            rangeEnd: r._id,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
            avgPosition: r.position,
            rows: r.rows,
          }
        : null;

    res.json({ current: fmt(ranges[0]), previous: fmt(ranges[1]) });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/gsc/top-queries', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const limit = Math.min(200, Number(req.query.limit ?? 25));
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      {
        $group: {
          _id: '$query',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
          pages: { $addToSet: '$pageUrl' },
        },
      },
      { $sort: { impressions: -1 } },
      { $limit: limit },
    ]);
    res.json(
      rows
        .filter((r) => !isJunkQuery(r._id))
        .map((r) => ({
          query: r._id,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
          avgPosition: r.avgPosition,
          pageCount: r.pages.length,
        })),
    );
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/gsc/top-pages', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const limit = Math.min(200, Number(req.query.limit ?? 25));
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      {
        $group: {
          _id: '$pageUrl',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: limit },
    ]);
    res.json(
      rows.map((r) => ({
        pageUrl: r._id,
        path: shortUrl(r._id),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        avgPosition: r.avgPosition,
      })),
    );
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/gsc/position-buckets', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const buckets = [
      { name: '1-3', min: 0, max: 3 },
      { name: '4-10', min: 3, max: 10 },
      { name: '11-20', min: 10, max: 20 },
      { name: '21-50', min: 20, max: 50 },
      { name: '51+', min: 50, max: 1000 },
    ];
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.find({ projectId: p, rangeEnd: re })
      .select({ position: 1, clicks: 1, impressions: 1 })
      .lean();
    const out = buckets.map((b) => {
      const inBucket = rows.filter((r) => (r.position ?? 0) > b.min && (r.position ?? 0) <= b.max);
      return {
        bucket: b.name,
        rowCount: inBucket.length,
        clicks: inBucket.reduce((s, r) => s + (r.clicks ?? 0), 0),
        impressions: inBucket.reduce((s, r) => s + (r.impressions ?? 0), 0),
      };
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * Position 11-20 quick-wins. Same heuristic as opportunity engine but exposed as a list so the
 * search dashboard can show the table alongside the trend chart.
 */
analyticsRouter.get('/projects/:id/analytics/gsc/quick-wins', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      { $sort: { impressions: -1 } },
      {
        $group: {
          _id: '$query',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
          topPage: { $first: '$pageUrl' },
        },
      },
      { $match: { avgPosition: { $gte: 4, $lte: 20 }, impressions: { $gte: 100 } } },
      { $sort: { impressions: -1 } },
      { $limit: limit },
    ]);
    res.json(
      rows
        .filter((r) => !isJunkQuery(r._id))
        .map((r) => ({
          query: r._id,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
          avgPosition: r.avgPosition,
          topPage: r.topPage,
        })),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * High impressions, below-expected CTR. Uses the same expected-CTR curve as the opp engine.
 */
analyticsRouter.get('/projects/:id/analytics/gsc/low-ctr', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      {
        $group: {
          _id: '$pageUrl',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
        },
      },
      { $match: { impressions: { $gte: 300 } } },
    ]);
    const expectedCtr = (pos: number): number => {
      if (pos < 1.5) return 0.28;
      if (pos < 2.5) return 0.16;
      if (pos < 3.5) return 0.11;
      if (pos < 4.5) return 0.08;
      if (pos < 6) return 0.06;
      if (pos < 8) return 0.045;
      if (pos < 10) return 0.035;
      if (pos < 12) return 0.025;
      return 0.015;
    };
    const out = rows
      .map((r) => {
        const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
        const expected = expectedCtr(r.avgPosition);
        return {
          pageUrl: r._id,
          path: shortUrl(r._id),
          clicks: r.clicks,
          impressions: r.impressions,
          avgPosition: r.avgPosition,
          ctr,
          expectedCtr: expected,
          gap: expected - ctr,
        };
      })
      .filter((r) => r.ctr < r.expectedCtr * 0.8)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 50);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/gsc/cannibalization', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const re = await latestGscRangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await GscRowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      { $sort: { impressions: -1 } },
      {
        $group: {
          _id: '$query',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          avgPosition: { $avg: '$position' },
          pages: { $addToSet: '$pageUrl' },
          topPage: { $first: '$pageUrl' },
        },
      },
      // Any query mapped to ≥2 ranking URLs is cannibalization. No upper cap — worst cases (many
      // competing URLs) are the most valuable to surface.
      { $match: { $expr: { $gte: [{ $size: '$pages' }, 2] } } },
      { $sort: { impressions: -1 } },
      { $limit: 50 },
    ]);
    res.json(
      rows
        .filter((r) => !isJunkQuery(r._id))
        .map((r) => ({
          query: r._id,
          impressions: r.impressions,
          clicks: r.clicks,
          avgPosition: r.avgPosition,
          uniquePageCount: r.pages.length,
          topPage: r.topPage,
          pages: r.pages,
        })),
    );
  } catch (err) {
    next(err);
  }
});

// -------- GA4 --------

analyticsRouter.get('/projects/:id/analytics/ga4/summary', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const ranges = await Ga4RowModel.aggregate<{
      _id: Date;
      sessions: number;
      engagedSessions: number;
      conversions: number;
      engagementRate: number;
      rows: number;
    }>([
      { $match: { projectId: p, channel: { $regex: /organic/i } } },
      {
        $group: {
          _id: '$rangeEnd',
          sessions: { $sum: '$sessions' },
          engagedSessions: { $sum: '$engagedSessions' },
          engagementRate: { $avg: '$engagementRate' },
          conversions: { $sum: '$conversions' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]);
    const fmt = (r?: typeof ranges[number]): unknown =>
      r
        ? {
            rangeEnd: r._id,
            sessions: r.sessions,
            engagedSessions: r.engagedSessions,
            engagementRate: r.sessions > 0 ? r.engagedSessions / r.sessions : 0,
            conversions: r.conversions,
            conversionRate: r.sessions > 0 ? r.conversions / r.sessions : 0,
            rows: r.rows,
          }
        : null;
    res.json({ current: fmt(ranges[0]), previous: fmt(ranges[1]) });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/ga4/top-landing-pages', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const limit = Math.min(200, Number(req.query.limit ?? 25));
    const re = await latestGa4RangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await Ga4RowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re, channel: { $regex: /organic/i } } },
      {
        $group: {
          _id: '$pagePath',
          sessions: { $sum: '$sessions' },
          engagedSessions: { $sum: '$engagedSessions' },
          conversions: { $sum: '$conversions' },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: limit },
    ]);
    res.json(
      rows.map((r) => ({
        path: r._id,
        sessions: r.sessions,
        engagedSessions: r.engagedSessions,
        engagementRate: r.sessions > 0 ? r.engagedSessions / r.sessions : 0,
        conversions: r.conversions,
        conversionRate: r.sessions > 0 ? r.conversions / r.sessions : 0,
      })),
    );
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/ga4/low-conversion', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const re = await latestGa4RangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await Ga4RowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re, channel: { $regex: /organic/i } } },
      {
        $group: {
          _id: '$pagePath',
          sessions: { $sum: '$sessions' },
          engagedSessions: { $sum: '$engagedSessions' },
          conversions: { $sum: '$conversions' },
        },
      },
      { $match: { sessions: { $gte: 100 } } },
    ]);
    const out = rows
      .map((r) => ({
        path: r._id,
        sessions: r.sessions,
        engagedSessions: r.engagedSessions,
        engagementRate: r.sessions > 0 ? r.engagedSessions / r.sessions : 0,
        conversions: r.conversions,
        conversionRate: r.sessions > 0 ? r.conversions / r.sessions : 0,
      }))
      .filter((r) => r.conversionRate < 0.01)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 50);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/ga4/channel-breakdown', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const re = await latestGa4RangeEnd(p);
    if (!re) return void res.json([]);
    const rows = await Ga4RowModel.aggregate([
      { $match: { projectId: p, rangeEnd: re } },
      {
        $group: {
          _id: '$channel',
          sessions: { $sum: '$sessions' },
          engagedSessions: { $sum: '$engagedSessions' },
          conversions: { $sum: '$conversions' },
        },
      },
      { $sort: { sessions: -1 } },
    ]);
    res.json(rows.map((r) => ({ channel: r._id, ...r, _id: undefined })));
  } catch (err) {
    next(err);
  }
});

// -------- CWV --------

/**
 * Latest CWV per URL per strategy. Returns one row per (url, strategy) using $first after sort.
 * Used by both summary and "slowest important pages" views.
 */
async function latestCwvRows(p: Types.ObjectId): Promise<Array<{
  pageUrl: string;
  strategy: 'mobile' | 'desktop';
  lcp?: number;
  inp?: number;
  cls?: number;
  performanceScore?: number;
  capturedAt: Date;
  error?: string;
}>> {
  return CwvMetricModel.aggregate([
    { $match: { projectId: p } },
    { $sort: { capturedAt: -1 } },
    {
      $group: {
        _id: { pageUrl: '$pageUrl', strategy: '$strategy' },
        lcp: { $first: '$lcp' },
        inp: { $first: '$inp' },
        cls: { $first: '$cls' },
        performanceScore: { $first: '$performanceScore' },
        capturedAt: { $first: '$capturedAt' },
        error: { $first: '$error' },
      },
    },
    {
      $project: {
        _id: 0,
        pageUrl: '$_id.pageUrl',
        strategy: '$_id.strategy',
        lcp: 1,
        inp: 1,
        cls: 1,
        performanceScore: 1,
        capturedAt: 1,
        error: 1,
      },
    },
  ]);
}

function cwvStatus(m: { lcp?: number; inp?: number; cls?: number }): 'good' | 'needs-improvement' | 'poor' {
  const lcpBad = m.lcp != null && m.lcp > 4000;
  const inpBad = m.inp != null && m.inp > 500;
  const clsBad = m.cls != null && m.cls > 0.25;
  if (lcpBad || inpBad || clsBad) return 'poor';
  const lcpNI = m.lcp != null && m.lcp > 2500;
  const inpNI = m.inp != null && m.inp > 200;
  const clsNI = m.cls != null && m.cls > 0.1;
  if (lcpNI || inpNI || clsNI) return 'needs-improvement';
  return 'good';
}

analyticsRouter.get('/projects/:id/analytics/cwv/summary', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const rows = await latestCwvRows(p);
    const byStrategy: Record<string, { good: number; ni: number; poor: number; errors: number; rows: number; avgLcp: number; avgInp: number; avgCls: number }> = {};
    for (const strat of ['mobile', 'desktop'] as const) {
      const subset = rows.filter((r) => r.strategy === strat);
      const valid = subset.filter((r) => !r.error);
      const statuses = valid.map((r) => cwvStatus(r));
      byStrategy[strat] = {
        rows: subset.length,
        errors: subset.filter((r) => r.error).length,
        good: statuses.filter((s) => s === 'good').length,
        ni: statuses.filter((s) => s === 'needs-improvement').length,
        poor: statuses.filter((s) => s === 'poor').length,
        avgLcp:
          valid.length > 0
            ? Math.round(valid.reduce((s, r) => s + (r.lcp ?? 0), 0) / valid.length)
            : 0,
        avgInp:
          valid.length > 0
            ? Math.round(valid.reduce((s, r) => s + (r.inp ?? 0), 0) / valid.length)
            : 0,
        avgCls:
          valid.length > 0
            ? Number((valid.reduce((s, r) => s + (r.cls ?? 0), 0) / valid.length).toFixed(3))
            : 0,
      };
    }
    res.json(byStrategy);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/cwv/timeseries', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const rows = await CwvMetricModel.aggregate<{
      _id: { day: string; strategy: 'mobile' | 'desktop' };
      avgLcp: number;
      avgInp: number;
      avgCls: number;
      avgPerf: number;
      count: number;
    }>([
      { $match: { projectId: p } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt' } },
            strategy: '$strategy',
          },
          avgLcp: { $avg: '$lcp' },
          avgInp: { $avg: '$inp' },
          avgCls: { $avg: '$cls' },
          avgPerf: { $avg: '$performanceScore' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);
    res.json(
      rows.map((r) => ({
        day: r._id.day,
        strategy: r._id.strategy,
        lcp: r.avgLcp,
        inp: r.avgInp,
        cls: r.avgCls,
        performanceScore: r.avgPerf,
        rows: r.count,
      })),
    );
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/cwv/slowest', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const [rows, pages] = await Promise.all([
      latestCwvRows(p),
      PageModel.find({ projectId: p }).select({ url: 1, normalizedUrl: 1, pageRole: 1, isImportant: 1 }).lean(),
    ]);
    const pageBy = new Map<string, { pageRole?: string; isImportant?: boolean; id: string }>();
    for (const pg of pages) {
      const meta = { pageRole: pg.pageRole as string | undefined, isImportant: pg.isImportant, id: String(pg._id) };
      if (pg.url) pageBy.set(pg.url, meta);
      if (pg.normalizedUrl) pageBy.set(pg.normalizedUrl, meta);
    }
    const valid = rows.filter((r) => !r.error);
    const decorated = valid.map((r) => {
      const meta = pageBy.get(r.pageUrl);
      return {
        pageUrl: r.pageUrl,
        path: shortUrl(r.pageUrl),
        pageId: meta?.id ?? null,
        pageRole: meta?.pageRole ?? null,
        isImportant: !!meta?.isImportant,
        strategy: r.strategy,
        lcp: r.lcp,
        inp: r.inp,
        cls: r.cls,
        performanceScore: r.performanceScore,
        status: cwvStatus(r),
        capturedAt: r.capturedAt,
      };
    });
    // Score by LCP descending, important pages first.
    decorated.sort(
      (a, b) => Number(b.isImportant) - Number(a.isImportant) || (b.lcp ?? 0) - (a.lcp ?? 0),
    );
    res.json(decorated.slice(0, 100));
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/cwv/errors', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const rows = await latestCwvRows(p);
    res.json(
      rows
        .filter((r) => r.error)
        .map((r) => ({
          pageUrl: r.pageUrl,
          path: shortUrl(r.pageUrl),
          strategy: r.strategy,
          error: r.error,
          capturedAt: r.capturedAt,
        })),
    );
  } catch (err) {
    next(err);
  }
});

// -------- Issues + Opportunities trends --------

analyticsRouter.get('/projects/:id/analytics/issues/trend', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const days = Math.max(7, Math.min(120, Number(req.query.days ?? 30)));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await IssueModel.aggregate<{ _id: { day: string; severity: string }; count: number }>([
      { $match: { projectId: p, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            severity: '$severity',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);
    const summary = await IssueModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: p, lifecycleStatus: { $in: ACTIVE_LIFECYCLE } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);
    res.json({
      trend: rows.map((r) => ({ day: r._id.day, severity: r._id.severity, count: r.count })),
      openBySeverity: summary.map((r) => ({ severity: r._id, count: r.count })),
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/projects/:id/analytics/opportunities/trend', async (req, res, next) => {
  try {
    const p = pid(req);
    if (!p) return void res.status(400).json({ error: 'invalid project id' });
    const byType = await OpportunityModel.aggregate<{ _id: string; open: number; total: number }>([
      { $match: { projectId: p } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        },
      },
      { $sort: { open: -1 } },
    ]);
    const byPriority = await OpportunityModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: p, status: 'open' } },
      { $group: { _id: '$actionPriority', count: { $sum: 1 } } },
    ]);
    const byStatus = await OpportunityModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: p } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({
      byType: byType.map((r) => ({ type: r._id, open: r.open, total: r.total })),
      byPriority: byPriority.map((r) => ({ priority: r._id, count: r.count })),
      byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    });
  } catch (err) {
    next(err);
  }
});
