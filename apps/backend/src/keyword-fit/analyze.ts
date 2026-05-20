// Deterministic keyword-page fit analyzer. Doc continuation §"Phase 3" +
// recommendation-engine §05. AI is intentionally NOT used here — rules + GSC + page metadata only.
// Strict thresholds keep us from labeling content "bad" without evidence.

import { Types } from 'mongoose';
import {
  KeywordModel,
  KeywordFitModel,
  PageModel,
  PageContentModel,
  GscRowModel,
} from '../db';
import { isJunkQuery } from '../audit/opportunities';
import { getLogger } from '../config/logger';

const log = getLogger('keyword-fit');

export type FitVerdict =
  | 'good_fit'
  | 'needs_minor_update'
  | 'must_improve'
  | 'wrong_page_ranking'
  | 'cannibalized'
  | 'create_new_page'
  | 'needs_target_mapping'
  | 'merge_or_redirect'
  | 'do_not_target'
  | 'monitor';

/**
 * Compute fit verdicts for every keyword in a project. Idempotent — upserts on (project, keyword).
 */
export async function analyzeKeywordFits(opts: { projectId: string }): Promise<{
  analyzed: number;
  byVerdict: Record<string, number>;
}> {
  const pid = new Types.ObjectId(opts.projectId);
  const keywords = await KeywordModel.find({ projectId: pid }).lean();
  if (keywords.length === 0) return { analyzed: 0, byVerdict: {} };

  // Pull pages once + content (latest crawl) for keyword-context look-ups.
  const pages = await PageModel.find({ projectId: pid })
    .select({ url: 1, normalizedUrl: 1, title: 1, h1: 1, metaDescription: 1, pageRole: 1, headings: 1, isImportant: 1 })
    .lean();
  const pageById = new Map<string, PageMeta>(pages.map((p) => [String(p._id), p as PageMeta]));
  const urlToPageId = new Map<string, string>();
  for (const p of pages) {
    if (p.url) urlToPageId.set(p.url.toLowerCase(), String(p._id));
    if (p.normalizedUrl) urlToPageId.set(p.normalizedUrl.toLowerCase(), String(p._id));
  }

  // Latest content per page (markdown for text fit).
  const contents = await PageContentModel.aggregate<{
    _id: Types.ObjectId;
    pageId: Types.ObjectId;
    markdown: string;
    cleanText: string;
  }>([
    { $match: { projectId: pid } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$pageId',
        markdown: { $first: '$markdown' },
        cleanText: { $first: '$cleanText' },
      },
    },
    { $project: { _id: 1, pageId: '$_id', markdown: 1, cleanText: 1 } },
  ]);
  const contentByPageId = new Map(contents.map((c) => [String(c.pageId ?? c._id), c]));

  // Latest period GSC totals per (query, page).
  const latestGsc = await GscRowModel.findOne({ projectId: pid })
    .sort({ rangeEnd: -1 })
    .select({ rangeEnd: 1 })
    .lean();
  const gscRows =
    latestGsc?.rangeEnd != null
      ? await GscRowModel.find({ projectId: pid, rangeEnd: latestGsc.rangeEnd })
          .select({ pageUrl: 1, query: 1, clicks: 1, impressions: 1, position: 1 })
          .lean()
      : [];
  // Aggregate per query → pages that ranked + competing count.
  const gscByQuery = new Map<
    string,
    { topPage: string; topImpr: number; pages: Set<string>; clicks: number; impressions: number; avgPos: number }
  >();
  for (const r of gscRows) {
    const q = (r.query ?? '').toLowerCase();
    if (!q) continue;
    let b = gscByQuery.get(q);
    if (!b) {
      b = { topPage: r.pageUrl ?? '', topImpr: 0, pages: new Set(), clicks: 0, impressions: 0, avgPos: 0 };
      gscByQuery.set(q, b);
    }
    if (r.pageUrl) b.pages.add(r.pageUrl);
    if ((r.impressions ?? 0) > b.topImpr) {
      b.topImpr = r.impressions ?? 0;
      b.topPage = r.pageUrl ?? b.topPage;
    }
    b.clicks += r.clicks ?? 0;
    b.impressions += r.impressions ?? 0;
    // Approximate weighted avg position by impression-weighted; cheap mean is fine for ranking.
    b.avgPos = b.avgPos === 0 ? r.position ?? 0 : (b.avgPos + (r.position ?? 0)) / 2;
  }

  const byVerdict: Record<string, number> = {};
  let analyzed = 0;
  for (const k of keywords) {
    if (isJunkQuery(k.keyword)) continue;
    const verdict = computeVerdict(k as Keyword, {
      pageById,
      urlToPageId,
      contentByPageId,
      gscByQuery,
    });
    byVerdict[verdict.verdict] = (byVerdict[verdict.verdict] ?? 0) + 1;
    await KeywordFitModel.updateOne(
      { projectId: pid, keywordId: k._id },
      {
        $set: {
          keyword: k.keyword,
          mappedPageId: k.mappedPageId,
          rankingPageId: verdict.rankingPageId,
          rankingUrl: verdict.rankingUrl,
          intent: k.intent,
          funnelStage: k.funnelStage,
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          confidenceLevel: verdict.confidenceLevel,
          rootCauseSummary: verdict.rootCauseSummary,
          evidence: verdict.evidence,
          recommendedActions: verdict.recommendedActions,
          clicks: verdict.clicks,
          impressions: verdict.impressions,
          ctr: verdict.ctr,
          position: verdict.position,
          competingPageCount: verdict.competingPageCount,
          lastAnalyzedAt: new Date(),
        },
        $setOnInsert: {
          projectId: pid,
          keywordId: k._id,
        },
      },
      { upsert: true },
    );
    analyzed += 1;
  }
  log.info({ projectId: opts.projectId, analyzed, byVerdict }, 'keyword fits analyzed');
  return { analyzed, byVerdict };
}

// ---------- Verdict logic ----------

type Keyword = {
  _id: Types.ObjectId;
  keyword: string;
  intent?: string;
  funnelStage?: string;
  mappedPageId?: Types.ObjectId;
  preferredUrl?: string;
  rankingUrl?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type PageMeta = {
  url?: string | null;
  title?: string | null;
  h1?: string | null;
  metaDescription?: string | null;
  pageRole?: string | null;
  isImportant?: boolean | null;
  headings?: Array<{ level?: number | null; text?: string | null }> | null;
};
type Ctx = {
  pageById: Map<string, PageMeta>;
  urlToPageId: Map<string, string>;
  contentByPageId: Map<string, { markdown?: string; cleanText?: string }>;
  gscByQuery: Map<string, { topPage: string; pages: Set<string>; clicks: number; impressions: number; avgPos: number }>;
};

type VerdictResult = {
  verdict: FitVerdict;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  rootCauseSummary: string;
  evidence: Record<string, unknown>;
  recommendedActions: string[];
  rankingPageId?: Types.ObjectId;
  rankingUrl?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  competingPageCount: number;
};

const COMMERCIAL = new Set(['commercial', 'transactional']);

function computeVerdict(k: Keyword, ctx: Ctx): VerdictResult {
  const q = k.keyword.toLowerCase();
  const gsc = ctx.gscByQuery.get(q);
  const observations: string[] = [];
  const recs: string[] = [];

  // Use ONLY current-period GSC metrics. Audit feedback 2026-05-20: falling back to stale
  // keyword.clicks/impressions/position can produce confidently wrong must_improve verdicts when
  // the latest sync window has no row for this query. If GSC is missing we report 0s and force
  // monitor downstream.
  const hasCurrentGsc = !!gsc;
  const clicks = gsc?.clicks ?? 0;
  const impressions = gsc?.impressions ?? 0;
  const position = gsc?.avgPos ?? 0;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const competingPageCount = gsc?.pages.size ?? 1;
  // Ranking URL still falls back to keyword.rankingUrl since that's what GSC originally captured
  // when the keyword was imported. The metrics are what we refuse to age.
  const rankingUrlRaw = gsc?.topPage ?? k.rankingUrl ?? '';
  const rankingUrl = rankingUrlRaw || undefined;
  const rankingPageId = rankingUrl ? ctx.urlToPageId.get(rankingUrl.toLowerCase()) : undefined;
  const mappedPageId = k.mappedPageId ? String(k.mappedPageId) : undefined;

  const mappedPage = mappedPageId ? ctx.pageById.get(mappedPageId) : undefined;

  // Page that the keyword is currently attached to for content checks: mappedPage > rankingPage
  const referencePageId = mappedPageId ?? rankingPageId;
  const referencePage = referencePageId ? ctx.pageById.get(referencePageId) : undefined;
  const referenceContent = referencePageId ? ctx.contentByPageId.get(referencePageId) : undefined;

  // Tokenize keyword roughly.
  const keywordTokens = q
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  const titleHit = !!referencePage?.title && containsAllTokens(referencePage.title ?? '', keywordTokens);
  const h1Hit = !!referencePage?.h1 && containsAllTokens(referencePage.h1 ?? '', keywordTokens);
  const metaHit =
    !!referencePage?.metaDescription &&
    containsAllTokens(referencePage.metaDescription ?? '', keywordTokens);
  const headingHit =
    !!referencePage?.headings?.some((h) => containsAllTokens(h?.text ?? '', keywordTokens));
  const contentText = (referenceContent?.cleanText ?? referenceContent?.markdown ?? '').toLowerCase();
  const contentMentions = keywordTokens.filter((t) => contentText.includes(t)).length;
  const tokenCoverage = keywordTokens.length === 0 ? 1 : contentMentions / keywordTokens.length;
  const wordCount = contentText.split(/\s+/).filter(Boolean).length;
  const shallow = wordCount > 0 && wordCount < 250;

  observations.push(
    `Title contains target tokens: ${titleHit ? 'yes' : 'no'}`,
    `H1 contains target tokens: ${h1Hit ? 'yes' : 'no'}`,
    `Body covers ${Math.round(tokenCoverage * 100)}% of target tokens`,
  );
  if (gsc) {
    observations.push(`GSC: ${impressions} impressions, ${clicks} clicks, position ${position.toFixed(1)}`);
  } else {
    observations.push(
      'No GSC data for this query in the latest sync window — stored metrics ignored to avoid stale evidence.',
    );
  }
  if (shallow) observations.push(`Body word count is shallow (~${wordCount}).`);

  // Build verdict layers in priority order.

  // 0. Stale-evidence guard: no row in latest GSC sync window. Force monitor with low confidence.
  // Audit feedback 2026-05-20.
  if (!hasCurrentGsc) {
    if (mappedPageId) {
      recs.push('No GSC impressions in the latest window — confirm the mapping is still relevant.');
    } else {
      recs.push('Wait for the next GSC sync, or remove the keyword if it no longer matters.');
    }
    return finalize({
      verdict: 'monitor',
      confidence: 0.45,
      confidenceLevel: 'low',
      rootCauseSummary: 'No GSC data in the latest sync window — verdict held until data refreshes.',
    });
  }

  // 0b. Needs target mapping: query has GSC demand but the analyst hasn't mapped a target page yet.
  // We split this from create_new_page so analyst can either confirm an existing crawl page is the
  // right target OR plan a brand-new page. Audit feedback 2026-05-20.
  if (!mappedPageId && impressions >= 50) {
    const rankingInCrawl = rankingPageId && ctx.pageById.has(rankingPageId);
    if (rankingInCrawl) {
      recs.push(
        `Confirm "${truncatePath(rankingUrl)}" is the intended target and map it explicitly, or pick a better existing page.`,
      );
      return finalize({
        verdict: 'needs_target_mapping',
        confidence: 0.75,
        confidenceLevel: 'medium',
        rootCauseSummary: `Query has ${impressions} impressions but no analyst-mapped target. Ranking URL is in the crawl set — confirm or override.`,
      });
    }
    // No mapped page AND ranking URL isn't a crawled page → propose a new target page.
    recs.push(
      'Plan a dedicated target page for this query (or significantly expand the closest existing page).',
    );
    return finalize({
      verdict: 'create_new_page',
      confidence: 0.7,
      confidenceLevel: 'medium',
      rootCauseSummary: rankingUrl
        ? `Query has ${impressions} impressions; ranking URL ${truncatePath(rankingUrl)} is not in the crawl set, so there is no target page to optimize.`
        : `Query has ${impressions} impressions but no mapped or crawled target page.`,
    });
  }

  // 1. Cannibalization: ≥2 distinct ranking URLs for same query.
  if (competingPageCount >= 2 && impressions >= 100) {
    recs.push(
      'Pick a primary page + canonicalize or consolidate competing URLs.',
      'Update internal links to point at the winning URL.',
    );
    return finalize({
      verdict: 'cannibalized',
      confidence: 0.85,
      confidenceLevel: 'high',
      rootCauseSummary: `${competingPageCount} of your URLs rank for "${k.keyword}".`,
    });
  }

  // 2. Wrong page ranking: mapped target ≠ ranking page.
  if (mappedPageId && rankingPageId && mappedPageId !== rankingPageId) {
    recs.push(
      'Strengthen internal links pointing at the mapped target page.',
      'De-optimize the wrong-ranking page (title/H1) so signals concentrate on the target.',
      'Verify canonical chains.',
    );
    return finalize({
      verdict: 'wrong_page_ranking',
      confidence: 0.9,
      confidenceLevel: 'high',
      rootCauseSummary: `Google ranks ${truncatePath(rankingUrl)} but the analyst target is ${truncatePath(mappedPage?.url ?? '')}.`,
    });
  }

  // Mapping-required gate: without an analyst-set mapped page we don't issue strict verdicts.
  // Even if a ranking page is in the crawl set, we don't know if it's the intended target.
  // Audit feedback 2026-05-20.
  if (!mappedPageId) {
    if (impressions >= 50) {
      recs.push(
        'Confirm or override the ranking URL as the intended target before any content work.',
      );
      return finalize({
        verdict: 'needs_target_mapping',
        confidence: 0.7,
        confidenceLevel: 'medium',
        rootCauseSummary:
          rankingPageId && ctx.pageById.has(rankingPageId)
            ? `Query has ${impressions} impressions but no analyst-mapped target. Ranking URL is in the crawl set — confirm or override.`
            : `Query has ${impressions} impressions but no mapped or crawled target page.`,
      });
    }
    recs.push('Map the keyword to its intended target page, or wait for more GSC signal.');
    return finalize({
      verdict: 'monitor',
      confidence: 0.5,
      confidenceLevel: 'low',
      rootCauseSummary: 'No analyst-mapped target page — cannot judge content fit yet.',
    });
  }

  // 4. Must improve: hard evidence the page exists but underperforms.
  // Commercial intent at quick-win position with weak title/H1 → must improve.
  // Or thin content for commercial intent.
  // Or position 4-20 with sub-expected CTR and target tokens missing from title.
  if (referencePage) {
    const intentCommercial = COMMERCIAL.has(k.intent ?? '');
    const quickWinRange = position >= 4 && position <= 20;
    const goodPosition = position >= 1 && position < 4;
    const lowCtr = impressions >= 300 && ctr < expectedCtrAt(position) * 0.8;
    const titleMisaligned = !titleHit && !h1Hit;
    const shallowForCommercial = intentCommercial && shallow;
    const contentMissingTopic = tokenCoverage < 0.5 && keywordTokens.length >= 2;

    if (
      (quickWinRange && impressions >= 100 && (titleMisaligned || contentMissingTopic)) ||
      shallowForCommercial ||
      (quickWinRange && lowCtr && titleMisaligned)
    ) {
      if (titleMisaligned) recs.push('Rewrite title + H1 to include the target topic verbatim.');
      if (contentMissingTopic)
        recs.push('Add a dedicated section answering the target query in plain language.');
      if (shallowForCommercial)
        recs.push('Expand commercial pages with proof, deliverables, FAQs, and CTAs.');
      if (lowCtr) recs.push('Rewrite meta description so the snippet earns the click.');
      return finalize({
        verdict: 'must_improve',
        confidence: 0.85,
        confidenceLevel: 'high',
        rootCauseSummary: titleMisaligned
          ? `Page ranks at avg position ${position.toFixed(1)} but title/H1 doesn't carry the target topic.`
          : shallowForCommercial
            ? `Commercial-intent page has only ~${wordCount} words of body content.`
            : `Page ranks in quick-win range with sub-expected CTR.`,
      });
    }

    // 5. Healthy fit: top-3 position with title/H1 matching tokens.
    if (goodPosition && (titleHit || h1Hit) && tokenCoverage >= 0.7) {
      recs.push('Monitor performance. Refresh on quarterly cadence; build supporting internal links.');
      return finalize({
        verdict: 'good_fit',
        confidence: 0.9,
        confidenceLevel: 'high',
        rootCauseSummary: `Page ranks position ${position.toFixed(1)} with on-topic title + ${Math.round(
          tokenCoverage * 100,
        )}% body token coverage.`,
      });
    }

    // 6. Minor update: page exists, mostly fits, but small gap (e.g. missing meta or one section).
    if ((titleHit || h1Hit) && tokenCoverage >= 0.5) {
      if (!metaHit) recs.push('Refine the meta description to include the target query.');
      if (!headingHit) recs.push('Add an H2/H3 explicitly framing the target query.');
      if (impressions === 0) recs.push('Watch GSC — no impressions yet for this keyword.');
      return finalize({
        verdict: 'needs_minor_update',
        confidence: 0.75,
        confidenceLevel: 'medium',
        rootCauseSummary: 'Page is on-topic but missing supporting signals.',
      });
    }
  }

  // 7. Monitor: not enough evidence to act yet.
  recs.push('Keep an eye on this keyword. Decide action once impressions or rankings establish.');
  return finalize({
    verdict: 'monitor',
    confidence: 0.55,
    confidenceLevel: 'low',
    rootCauseSummary: 'Insufficient evidence to recommend a specific action.',
  });

  function finalize(p: { verdict: FitVerdict; confidence: number; confidenceLevel: 'high' | 'medium' | 'low'; rootCauseSummary: string }): VerdictResult {
    return {
      verdict: p.verdict,
      confidence: p.confidence,
      confidenceLevel: p.confidenceLevel,
      rootCauseSummary: p.rootCauseSummary,
      evidence: {
        observations,
        gsc: gsc
          ? { clicks: gsc.clicks, impressions: gsc.impressions, position: gsc.avgPos }
          : { clicks: 0, impressions: 0, position: 0, note: 'no GSC for this query' },
        mapped: mappedPage ? { url: mappedPage.url, title: mappedPage.title, h1: mappedPage.h1 } : null,
        ranking: rankingUrl ? { url: rankingUrl } : null,
        wordCount,
        tokenCoverage,
      },
      recommendedActions: recs,
      rankingPageId: rankingPageId ? new Types.ObjectId(rankingPageId) : undefined,
      rankingUrl,
      clicks,
      impressions,
      ctr,
      position,
      competingPageCount,
    };
  }
}

// ---------- Helpers ----------

const STOPWORDS = new Set([
  'the','and','for','with','from','your','our','that','this','what','when','how','where','why',
  'are','was','were','will','can','you','its','their','they','have','has','had','out','into','about','all','any','not','use',
]);

function containsAllTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const t = text.toLowerCase();
  return tokens.every((tok) => t.includes(tok));
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

function truncatePath(u?: string): string {
  if (!u) return '—';
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}
