// Deterministic opportunity engine. Doc 6 §"Opportunity Engine".
// Reads existing evidence (GSC/GA4/CWV/audit findings/pages/issues) and produces stable
// opportunity records keyed by canonicalKey so re-generation is idempotent.

import { Types } from 'mongoose';
import {
  PageModel,
  GscRowModel,
  Ga4RowModel,
  CwvMetricModel,
  IssueModel,
  KeywordModel,
  OpportunityModel,
  ProjectModel,
} from '../db';
import { ACTIVE_LIFECYCLE_STATUSES } from './lifecycle';
import { getLogger } from '../config/logger';

const log = getLogger('audit:opportunities');

type Draft = {
  canonicalKey: string;
  type:
    | 'quick-win'
    | 'ctr'
    | 'content-gap'
    | 'cannibalization'
    | 'wrong-page-ranking'
    | 'internal-link'
    | 'schema'
    | 'conversion'
    | 'performance'
    | 'eeat-trust'
    | 'geo-aeo';
  title: string;
  pageId?: Types.ObjectId;
  pageUrl?: string;
  keyword?: string;
  goalId?: string;
  evidence: Record<string, unknown>;
  impactScore: number;
  effortEstimate: 'trivial' | 'small' | 'medium' | 'large' | 'unknown';
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  priority: number;
  actionPriority: 'P0' | 'P1' | 'P2';
  recommendedAction: string;
  sourceRules: string[];
  sourceIssueId?: Types.ObjectId;
};

export async function generateOpportunities(opts: {
  projectId: string;
}): Promise<{ generated: number; deleted: number }> {
  const pid = new Types.ObjectId(opts.projectId);
  const project = await ProjectModel.findById(pid).lean();
  if (!project) throw new Error('Project not found');

  const goals = ((project.goals as Array<{ id?: string; relatedPageIds?: string[]; relatedPagePatterns?: string[]; type: string; priority: string }> | undefined) ?? []);
  const goalPageIds = new Set<string>();
  for (const g of goals) for (const id of g.relatedPageIds ?? []) goalPageIds.add(id);
  const goalPatterns = goals.flatMap((g) => g.relatedPagePatterns ?? []).map(safeRegex).filter(Boolean) as RegExp[];

  const [pages, gscByPage, gscByQuery, ga4ByPath, cwvByUrl, issues, keywords] = await Promise.all([
    PageModel.find({ projectId: pid }).lean(),
    aggregateGscByPage(pid),
    aggregateGscByQuery(pid),
    aggregateGa4ByPath(pid, project.primaryDomain as string),
    cwvByUrlMap(pid),
    IssueModel.find({ projectId: pid, lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES } }).lean(),
    KeywordModel.find({ projectId: pid }).lean(),
  ]);

  const pageById = new Map(pages.map((p) => [String(p._id), p]));
  const urlToPageId = new Map<string, string>();
  for (const p of pages) {
    if (p.url) urlToPageId.set(p.url, String(p._id));
    if (p.normalizedUrl) urlToPageId.set(p.normalizedUrl, String(p._id));
  }

  const isGoalPage = (pageId: string, url: string): boolean => {
    if (goalPageIds.has(pageId)) return true;
    return goalPatterns.some((r) => r.test(url));
  };

  const drafts: Draft[] = [];

  // --- Quick-win opportunities (positions 4-20 with meaningful impressions) ---
  for (const row of gscByQuery) {
    if (isJunkQuery(row._id)) continue;
    if (row.impressions < 100) continue;
    if (row.avgPosition < 4 || row.avgPosition > 20) continue;
    const pageId = urlToPageId.get(row.topPage);
    drafts.push({
      canonicalKey: `quick-win|${row._id}`,
      type: 'quick-win',
      title: `Quick win: "${row._id}" at position ${row.avgPosition.toFixed(1)}`,
      pageId: pageId ? new Types.ObjectId(pageId) : undefined,
      pageUrl: row.topPage,
      keyword: row._id,
      goalId: pageId ? findGoalForPage(goals, pageId, row.topPage) : undefined,
      evidence: {
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
        avgPosition: row.avgPosition,
      },
      impactScore: Math.min(80, Math.round(row.impressions / 10)),
      effortEstimate: 'medium',
      confidence: 0.85,
      confidenceLevel: 'high',
      priority: scoreOpportunity({ impressions: row.impressions, severity: 'medium' }),
      actionPriority: row.impressions > 500 ? 'P1' : 'P2',
      recommendedAction:
        'Refresh content + add internal links + improve E-E-A-T signals. Confirm the ranking URL still matches intent.',
      sourceRules: ['gsc.position-11-to-20-quick-win'],
    });
  }

  // --- CTR opportunity (high impressions, below-expected CTR) ---
  for (const row of gscByPage) {
    if (row.impressions < 300) continue;
    const expected = expectedCtrAt(row.avgPosition);
    if (row.ctr >= expected * 0.8) continue;
    const pageId = urlToPageId.get(row._id);
    drafts.push({
      canonicalKey: `ctr|${row._id}`,
      type: 'ctr',
      title: `Low CTR vs expected (${(row.ctr * 100).toFixed(2)}% at position ${row.avgPosition.toFixed(1)})`,
      pageId: pageId ? new Types.ObjectId(pageId) : undefined,
      pageUrl: row._id,
      goalId: pageId ? findGoalForPage(goals, pageId, row._id) : undefined,
      evidence: { ...row, expectedCtr: expected },
      impactScore: Math.min(80, Math.round(row.impressions / 30)),
      effortEstimate: 'small',
      confidence: 0.85,
      confidenceLevel: 'high',
      priority: scoreOpportunity({ impressions: row.impressions, severity: 'medium' }),
      actionPriority: row.impressions > 1000 ? 'P1' : 'P2',
      recommendedAction:
        'Rewrite title + meta description. Consider FAQ / table answers to align snippet with intent.',
      sourceRules: ['gsc.high-impressions-low-ctr'],
    });
  }

  // --- Wrong-page ranking (analyst preferred page differs from ranking URL) ---
  for (const k of keywords) {
    if (isJunkQuery(k.keyword)) continue;
    if (!k.preferredUrl || !k.rankingUrl) continue;
    if (urlsEqual(k.preferredUrl, k.rankingUrl)) continue;
    const pageId = k.mappedPageId ? String(k.mappedPageId) : undefined;
    drafts.push({
      canonicalKey: `wrong-page|${k.keyword}`,
      type: 'wrong-page-ranking',
      title: `Wrong page ranks for "${k.keyword}"`,
      pageId: pageId ? new Types.ObjectId(pageId) : undefined,
      pageUrl: k.rankingUrl,
      keyword: k.keyword,
      evidence: {
        preferredUrl: k.preferredUrl,
        rankingUrl: k.rankingUrl,
        clicks: k.clicks,
        impressions: k.impressions,
        position: k.position,
      },
      impactScore: 55,
      effortEstimate: 'medium',
      confidence: 0.9,
      confidenceLevel: 'high',
      priority: scoreOpportunity({ impressions: k.impressions, severity: 'medium' }),
      actionPriority: 'P1',
      recommendedAction:
        'Audit internal links — point them at the preferred page. Adjust titles/H1 + canonical signals to disambiguate intent.',
      sourceRules: ['gsc.query-cannibalization'],
    });
  }

  // --- Cannibalization candidates (one query appearing on 2+ ranking URLs) ---
  for (const row of gscByQuery) {
    if (isJunkQuery(row._id)) continue;
    if (row.uniquePageCount < 2) continue;
    if (row.impressions < 100) continue;
    drafts.push({
      canonicalKey: `cannibal|${row._id}`,
      type: 'cannibalization',
      title: `Cannibalization: ${row.uniquePageCount} pages compete for "${row._id}"`,
      pageUrl: row.topPage,
      keyword: row._id,
      evidence: {
        uniquePageCount: row.uniquePageCount,
        impressions: row.impressions,
        clicks: row.clicks,
        position: row.avgPosition,
      },
      impactScore: 45,
      effortEstimate: 'medium',
      confidence: 0.7,
      confidenceLevel: 'medium',
      priority: scoreOpportunity({ impressions: row.impressions, severity: 'low' }),
      actionPriority: 'P2',
      recommendedAction:
        'Pick a primary page + consolidate content or canonicalize. Update internal links to point at the winning URL.',
      sourceRules: ['gsc.query-cannibalization'],
    });
  }

  // --- High traffic, low conversion ---
  for (const row of ga4ByPath) {
    if (row.sessions < 100) continue;
    const convRate = row.sessions > 0 ? row.conversions / row.sessions : 0;
    if (convRate > 0.01) continue;
    const pageId = urlToPageId.get(row._id);
    drafts.push({
      canonicalKey: `conv|${row._id}`,
      type: 'conversion',
      title: `Conversion gap: ${row.sessions} sessions, ${row.conversions} conversions`,
      pageId: pageId ? new Types.ObjectId(pageId) : undefined,
      pageUrl: row._id,
      goalId: pageId ? findGoalForPage(goals, pageId, row._id) : undefined,
      evidence: { ...row, convRate },
      impactScore: Math.min(85, Math.round(row.sessions / 30)),
      effortEstimate: 'medium',
      confidence: 0.85,
      confidenceLevel: 'high',
      priority: scoreOpportunity({ impressions: row.sessions, severity: 'medium' }),
      actionPriority: row.sessions > 500 ? 'P1' : 'P2',
      recommendedAction:
        'Audit CTA placement, page intent vs query intent, proof + trust signals, conversion path.',
      sourceRules: ['ga4.high-traffic-low-conversion'],
    });
  }

  // --- CWV poor on important pages ---
  for (const [url, m] of cwvByUrl) {
    const pageId = urlToPageId.get(url);
    const page = pageId ? pageById.get(pageId) : undefined;
    const important = page?.isImportant || isGoalPage(pageId ?? '', url);
    const poor =
      (m.lcp != null && m.lcp > 4000) ||
      (m.inp != null && m.inp > 500) ||
      (m.cls != null && m.cls > 0.25);
    if (!poor) continue;
    drafts.push({
      canonicalKey: `perf|${url}`,
      type: 'performance',
      title: `Poor CWV on ${important ? 'important page' : 'page'}`,
      pageId: pageId ? new Types.ObjectId(pageId) : undefined,
      pageUrl: url,
      evidence: m,
      impactScore: important ? 70 : 40,
      effortEstimate: 'medium',
      confidence: 0.9,
      confidenceLevel: 'high',
      priority: scoreOpportunity({ impressions: 0, severity: important ? 'high' : 'medium' }),
      actionPriority: important ? 'P1' : 'P2',
      recommendedAction:
        'Run PageSpeed Insights → address LCP/INP/CLS root causes (image priority, JS, layout shift).',
      sourceRules: ['cwv.lcp.fails-threshold', 'cwv.inp.fails-threshold', 'cwv.cls.fails-threshold'],
    });
  }

  // --- Goal page missing CTA / weak conversion content (from existing issues) ---
  for (const i of issues) {
    if (i.ruleId !== 'conversion.cta-missing') continue;
    const pageId = i.pageId ? String(i.pageId) : undefined;
    const pageUrl = pageId ? pageById.get(pageId)?.url : undefined;
    drafts.push({
      canonicalKey: `cta|${pageId ?? i.canonicalKey}`,
      type: 'conversion',
      title: i.title,
      pageId: i.pageId ? new Types.ObjectId(String(i.pageId)) : undefined,
      pageUrl: pageUrl ?? undefined,
      goalId: pageId && pageUrl ? findGoalForPage(goals, pageId, pageUrl) : undefined,
      evidence: { sourceIssueId: String(i._id), category: i.category, severity: i.severity },
      impactScore: i.impact ?? 45,
      effortEstimate: (i.effort as Draft['effortEstimate']) ?? 'small',
      confidence: i.confidence ?? 0.7,
      confidenceLevel: (i.confidenceLevel as Draft['confidenceLevel']) ?? 'medium',
      priority: i.priority ?? 50,
      actionPriority: (i.actionPriority as Draft['actionPriority']) ?? 'P2',
      recommendedAction:
        'Add primary CTA above the fold + at end of content. Strengthen proof + clarity around the conversion action.',
      sourceRules: [i.ruleId as string],
      sourceIssueId: i._id,
    });
  }

  // --- Schema opportunities surfaced from audit findings ---
  for (const i of issues) {
    if (!String(i.ruleId).startsWith('structured-data.')) continue;
    if (i.lifecycleStatus === 'blocked-by-data-gap') continue;
    const pageId = i.pageId ? String(i.pageId) : undefined;
    const pageUrl = pageId ? pageById.get(pageId)?.url : undefined;
    drafts.push({
      canonicalKey: `schema|${i.canonicalKey}`,
      type: 'schema',
      title: i.title,
      pageId: i.pageId ? new Types.ObjectId(String(i.pageId)) : undefined,
      pageUrl: pageUrl ?? undefined,
      evidence: { ruleId: i.ruleId, severity: i.severity, sourceIssueId: String(i._id) },
      impactScore: i.impact ?? 30,
      effortEstimate: (i.effort as Draft['effortEstimate']) ?? 'small',
      confidence: i.confidence ?? 0.85,
      confidenceLevel: (i.confidenceLevel as Draft['confidenceLevel']) ?? 'high',
      priority: i.priority ?? 30,
      actionPriority: (i.actionPriority as Draft['actionPriority']) ?? 'P2',
      recommendedAction:
        'Add or fix the JSON-LD schema appropriate for the page role. Validate via Rich Results Test before deploy.',
      sourceRules: [i.ruleId as string],
      sourceIssueId: i._id,
    });
  }

  // --- Internal-link opportunity for orphan / weakly-linked important pages ---
  for (const i of issues) {
    if (
      i.ruleId !== 'internal-links.orphan-page' &&
      i.ruleId !== 'internal-links.important-page-weakly-linked'
    )
      continue;
    const pageId = i.pageId ? String(i.pageId) : undefined;
    const pageUrl = pageId ? pageById.get(pageId)?.url : undefined;
    drafts.push({
      canonicalKey: `link|${i.canonicalKey}`,
      type: 'internal-link',
      title: i.title,
      pageId: i.pageId ? new Types.ObjectId(String(i.pageId)) : undefined,
      pageUrl: pageUrl ?? undefined,
      goalId: pageId && pageUrl ? findGoalForPage(goals, pageId, pageUrl) : undefined,
      evidence: { ruleId: i.ruleId, severity: i.severity, sourceIssueId: String(i._id) },
      impactScore: i.impact ?? 35,
      effortEstimate: 'small',
      confidence: 0.9,
      confidenceLevel: 'high',
      priority: i.priority ?? 40,
      actionPriority: (i.actionPriority as Draft['actionPriority']) ?? 'P2',
      recommendedAction:
        'Add 3-5 contextual internal links from related hub/parent pages. Re-crawl + re-audit to verify.',
      sourceRules: [i.ruleId as string],
      sourceIssueId: i._id,
    });
  }

  // --- Content-gap (keyword has no mapped page AND no ranking page in crawl set) ---
  for (const k of keywords) {
    if (isJunkQuery(k.keyword)) continue;
    if (k.mappedPageId) continue;
    if (k.rankingUrl && urlToPageId.has(k.rankingUrl)) continue;
    if (k.impressions < 50) continue;
    drafts.push({
      canonicalKey: `gap|${k.keyword}`,
      type: 'content-gap',
      title: `Content gap for "${k.keyword}"`,
      keyword: k.keyword,
      pageUrl: k.rankingUrl ?? undefined,
      evidence: { impressions: k.impressions, position: k.position, clicks: k.clicks },
      impactScore: Math.min(70, Math.round(k.impressions / 10)),
      effortEstimate: 'large',
      confidence: 0.75,
      confidenceLevel: 'medium',
      priority: scoreOpportunity({ impressions: k.impressions, severity: 'medium' }),
      actionPriority: k.impressions > 200 ? 'P1' : 'P2',
      recommendedAction:
        'Create a dedicated target page for this keyword OR significantly expand an existing close-match page.',
      sourceRules: [],
    });
  }

  // Hard-purge any opportunity whose keyword (or canonicalKey query segment) is junk. These
  // shouldn't have been produced at all, but earlier runs (before the filter existed) may have
  // left rows behind as `not-applicable` ghosts.
  const candidates = await OpportunityModel.find({
    projectId: pid,
    $or: [{ keyword: { $exists: true, $ne: null } }, { canonicalKey: { $regex: '\\|' } }],
  })
    .select({ _id: 1, keyword: 1, canonicalKey: 1 })
    .lean();
  const junkIds = candidates
    .filter(
      (c) =>
        (c.keyword && isJunkQuery(c.keyword)) ||
        isJunkQuery((c.canonicalKey ?? '').split('|').slice(1).join('|')),
    )
    .map((c) => c._id);
  if (junkIds.length > 0) {
    const purgeResult = await OpportunityModel.deleteMany({ _id: { $in: junkIds } });
    log.info({ purged: purgeResult.deletedCount }, 'junk opportunities purged');
  }

  // Persist via upsert keyed by (projectId, canonicalKey). Stale records removed.
  const now = new Date();
  const seenKeys = new Set<string>();
  for (const d of drafts) {
    seenKeys.add(d.canonicalKey);
    await OpportunityModel.updateOne(
      { projectId: pid, canonicalKey: d.canonicalKey },
      {
        $setOnInsert: { projectId: pid, canonicalKey: d.canonicalKey, firstSeenAt: now, status: 'open' },
        $set: {
          type: d.type,
          title: d.title,
          pageId: d.pageId,
          pageUrl: d.pageUrl,
          keyword: d.keyword,
          goalId: d.goalId,
          evidence: d.evidence,
          impactScore: d.impactScore,
          effortEstimate: d.effortEstimate,
          confidence: d.confidence,
          confidenceLevel: d.confidenceLevel,
          priority: d.priority,
          actionPriority: d.actionPriority,
          recommendedAction: d.recommendedAction,
          sourceRules: d.sourceRules,
          sourceIssueId: d.sourceIssueId,
          lastSeenAt: now,
        },
      },
      { upsert: true },
    );
  }

  // Delete opportunities no longer surfaced (only auto-managed ones that weren't manually closed).
  const stale = await OpportunityModel.find({
    projectId: pid,
    canonicalKey: { $nin: [...seenKeys] },
    status: { $in: ['open', 'planned', 'in-progress'] },
  })
    .select({ _id: 1 })
    .lean();
  let deleted = 0;
  if (stale.length > 0) {
    const r = await OpportunityModel.updateMany(
      { _id: { $in: stale.map((s) => s._id) } },
      { $set: { status: 'not-applicable', lastSeenAt: now } },
    );
    deleted = r.modifiedCount ?? 0;
  }

  log.info(
    { projectId: opts.projectId, generated: drafts.length, deleted },
    'opportunities regenerated',
  );
  return { generated: drafts.length, deleted };
}

function expectedCtrAt(position: number): number {
  if (position < 1.5) return 0.28;
  if (position < 2.5) return 0.16;
  if (position < 3.5) return 0.11;
  if (position < 4.5) return 0.08;
  if (position < 6) return 0.06;
  if (position < 8) return 0.045;
  if (position < 10) return 0.035;
  if (position < 12) return 0.025;
  return 0.015;
}

function scoreOpportunity(opts: { impressions: number; severity: 'low' | 'medium' | 'high' | 'critical' }): number {
  const sevWeight = opts.severity === 'critical' ? 80 : opts.severity === 'high' ? 60 : opts.severity === 'medium' ? 40 : 20;
  const trafficBoost = Math.min(40, Math.round(opts.impressions / 50));
  return Math.min(100, sevWeight + trafficBoost);
}

/**
 * Mirror the GSC import junk filter so opportunity generation can't surface
 * operator queries, mocks, or seed leftovers regardless of how data was loaded.
 */
export function isJunkQuery(q: string): boolean {
  const s = (q ?? '').trim().toLowerCase();
  if (!s) return true;
  if (s === 'mock-query' || s === 'mock_query' || s === 'placeholder') return true;
  if (s.startsWith('site:')) return true;
  if (/^\(\s*not\s+set\s*\)$/i.test(s)) return true;
  if (/^[0-9\-_.]+$/.test(s)) return true;
  return false;
}

function safeRegex(p: string): RegExp | null {
  try {
    return new RegExp(p);
  } catch {
    return null;
  }
}

function urlsEqual(a: string, b: string): boolean {
  return a.replace(/\/$/, '').toLowerCase() === b.replace(/\/$/, '').toLowerCase();
}

function findGoalForPage(
  goals: Array<{ id?: string; relatedPageIds?: string[]; relatedPagePatterns?: string[] }>,
  pageId: string,
  pageUrl: string,
): string | undefined {
  for (const g of goals) {
    if ((g.relatedPageIds ?? []).includes(pageId)) return g.id;
    if ((g.relatedPagePatterns ?? []).some((p) => safeRegex(p)?.test(pageUrl))) return g.id;
  }
  return undefined;
}

async function aggregateGscByPage(projectId: Types.ObjectId): Promise<
  Array<{ _id: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>
> {
  const rows = await GscRowModel.aggregate<{
    _id: string;
    clicks: number;
    impressions: number;
    avgPosition: number;
  }>([
    { $match: { projectId } },
    {
      $group: {
        _id: '$pageUrl',
        clicks: { $sum: '$clicks' },
        impressions: { $sum: '$impressions' },
        avgPosition: { $avg: '$position' },
      },
    },
  ]);
  return rows.map((r) => ({
    ...r,
    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
  }));
}

async function aggregateGscByQuery(projectId: Types.ObjectId): Promise<
  Array<{
    _id: string;
    clicks: number;
    impressions: number;
    avgPosition: number;
    uniquePageCount: number;
    topPage: string;
  }>
> {
  const rows = await GscRowModel.aggregate<{
    _id: string;
    clicks: number;
    impressions: number;
    avgPosition: number;
    pages: string[];
    topPage: string;
  }>([
    { $match: { projectId } },
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
  ]);
  return rows.map((r) => ({
    _id: r._id,
    clicks: r.clicks,
    impressions: r.impressions,
    avgPosition: r.avgPosition,
    uniquePageCount: r.pages.length,
    topPage: r.topPage,
  }));
}

async function aggregateGa4ByPath(
  projectId: Types.ObjectId,
  primaryDomain: string,
): Promise<Array<{ _id: string; sessions: number; engagedSessions: number; conversions: number; engagementRate: number }>> {
  const rows = await Ga4RowModel.aggregate<{
    _id: string;
    sessions: number;
    engagedSessions: number;
    conversions: number;
    engagementRate: number;
  }>([
    { $match: { projectId, channel: { $regex: /organic/i } } },
    {
      $group: {
        _id: '$pagePath',
        sessions: { $sum: '$sessions' },
        engagedSessions: { $sum: '$engagedSessions' },
        engagementRate: { $avg: '$engagementRate' },
        conversions: { $sum: '$conversions' },
      },
    },
  ]);
  const host = primaryDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return rows.map((r) => ({
    _id: r._id.startsWith('http') ? r._id : `https://${host}${r._id}`,
    sessions: r.sessions,
    engagedSessions: r.engagedSessions,
    conversions: r.conversions,
    engagementRate: r.engagementRate ?? 0,
  }));
}

async function cwvByUrlMap(projectId: Types.ObjectId): Promise<
  Map<string, { lcp?: number; inp?: number; cls?: number; performanceScore?: number; capturedAt: Date }>
> {
  const rows = await CwvMetricModel.aggregate<{
    _id: string;
    lcp?: number;
    inp?: number;
    cls?: number;
    performanceScore?: number;
    capturedAt: Date;
  }>([
    { $match: { projectId } },
    { $sort: { capturedAt: -1 } },
    {
      $group: {
        _id: '$pageUrl',
        lcp: { $first: '$lcp' },
        inp: { $first: '$inp' },
        cls: { $first: '$cls' },
        performanceScore: { $first: '$performanceScore' },
        capturedAt: { $first: '$capturedAt' },
      },
    },
  ]);
  return new Map(
    rows.map((r) => [
      r._id,
      { lcp: r.lcp, inp: r.inp, cls: r.cls, performanceScore: r.performanceScore, capturedAt: r.capturedAt },
    ]),
  );
}
