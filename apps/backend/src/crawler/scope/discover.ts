import { Types } from 'mongoose';
import {
  CrawlScopeRuleModel,
  GscRowModel,
  CrawlCandidateModel,
  UrlGroupModel,
  ProjectModel,
} from '../../db';
import { discoverFromSitemaps } from '../discover/sitemap';
import { getRobots } from '../discover/robots';
import { normalizeUrl, isSameSite } from '../normalize/url';
import { cheerioFetcher } from '../fetchers/cheerio.fetcher';
import { load as loadHtml } from 'cheerio';
import { extractLinks } from '../extract/links';
import { inferGroupFromPath } from './match';
import {
  ScopeMatcher,
  groupByRule,
  selectSamples,
  toScopeRuleLite,
  type CandidateWithDecision,
  type Behavior,
} from './apply';
import { getDefaultScopeRules } from './defaults';

/**
 * Discovery + scope-decision phase. Phase 11.
 *
 * Inputs:
 *  - project + seed URL
 *  - approved scope rules (and suggested rules if `previewSuggested` true)
 *  - GSC top URLs if connected
 *  - optional crawlRunId so candidates can be persisted
 *
 * Output:
 *  - per-URL decision (crawl / sampled / excluded / force_included / normalized_duplicate)
 *  - per-group counts
 *  - selectedFrontier (URLs the actual crawler should enqueue)
 *
 * The function is shared between two callers:
 *  1. UI estimate endpoint (read-only; we don't persist).
 *  2. Crawl orchestrator (persistent; we write CrawlCandidate + UrlGroup docs).
 */

export interface DiscoveredCandidate {
  url: string;
  normalizedUrl: string;
  source: 'seed' | 'sitemap' | 'homepage-link' | 'gsc' | 'link' | 'analyst';
  sitemapLastmod?: Date | null;
}

export interface ScopeDecisionRecord {
  url: string;
  normalizedUrl: string;
  source: DiscoveredCandidate['source'];
  decision:
    | 'crawl'
    | 'sampled'
    | 'excluded'
    | 'force_included'
    | 'normalized_duplicate'
    | 'blocked_by_robots'
    | 'out_of_scope';
  matchedRuleId: string | null;
  matchedRuleName: string;
  groupName: string;
  groupPattern: string;
  reason: string;
  sampleReason: string;
  selectedForCrawl: boolean;
  sitemapLastmod?: Date | null;
}

export interface ScopeGroupSummary {
  name: string;
  pattern: string;
  pageFamily: string;
  behavior: Behavior;
  ruleId: string | null;
  discovered: number;
  selected: number;
  excluded: number;
  sampleLimit: number;
  examples: string[];
  confidence: number;
  source: string;
}

export interface DiscoveryResult {
  candidates: ScopeDecisionRecord[];
  groups: ScopeGroupSummary[];
  totals: {
    discovered: number;
    selected: number;
    sampled: number;
    excluded: number;
    forceIncluded: number;
    normalizedDuplicates: number;
    blockedByRobots: number;
  };
  warnings: Array<{ severity: 'low' | 'medium' | 'high'; message: string }>;
  selectedFrontier: Array<{ url: string; source: DiscoveredCandidate['source']; sampleReason: string; groupName: string; ruleId: string | null }>;
}

export interface DiscoveryOptions {
  projectId: string;
  seedUrl?: string;
  maxPages: number; // global crawl cap
  userAgent?: string;
  /**
   * Include `suggested` rules in the matcher (preview mode). Default false: only `approved`
   * rules affect crawling, suggestions stay pending.
   */
  previewSuggested?: boolean;
  /**
   * Bypass ALL scope rules — discovery still runs (so the analyst sees coverage), but every
   * candidate falls through to the default behavior. Used when crawlScopeSettings.enabled is
   * false so estimates reflect a no-scope crawl.
   */
  bypassRules?: boolean;
  /** When set, persist candidates + groups against this run. Skip when running estimate. */
  persistForCrawlRunId?: string;
}

export async function runDiscovery(opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const project = await ProjectModel.findById(opts.projectId).lean();
  if (!project) throw new Error('Project not found');
  const pid = new Types.ObjectId(opts.projectId);

  const seedUrl =
    opts.seedUrl ??
    (project.primaryDomain.startsWith('http')
      ? project.primaryDomain
      : `https://${project.primaryDomain}`);
  const ua = opts.userAgent ?? 'BoffinSEOBot/0.1 (+https://boffin.seo)';

  // 1) Pull approved (and optionally suggested) rules from Mongo. Seed defaults if the project
  //    has none yet so callers always get a sensible baseline.
  await ensureDefaultScopeRules(opts.projectId);
  const ruleQuery = opts.previewSuggested
    ? { projectId: pid, status: { $in: ['approved', 'suggested'] } }
    : { projectId: pid, status: 'approved' };
  const rules = opts.bypassRules
    ? []
    : (await CrawlScopeRuleModel.find(ruleQuery).sort({ priority: -1 }).lean()).map(
        toScopeRuleLite,
      );
  const matcher = new ScopeMatcher(
    rules,
    (project.crawlScopeSettings?.defaultBehavior as 'crawl' | 'sample' | undefined) ?? 'crawl',
  );

  // 2) Discover candidate URLs.
  const robots = await getRobots(seedUrl, ua).catch(() => null);
  const sitemap = await discoverFromSitemaps({
    seedUrl,
    userAgent: ua,
    extraSitemaps: robots?.sitemaps() ?? [],
  }).catch(() => ({ urls: [] as Array<{ loc: string; lastmod?: Date }>, errors: [] }));

  const seen = new Map<string, DiscoveredCandidate>();
  const seedNorm = normalizeUrl(seedUrl);
  if (seedNorm) {
    seen.set(seedNorm, { url: seedUrl, normalizedUrl: seedNorm, source: 'seed' });
  }
  for (const s of sitemap.urls) {
    if (!isSameSite(s.loc, project.primaryDomain, !!project.includeSubdomains)) continue;
    const n = normalizeUrl(s.loc);
    if (!n || seen.has(n)) continue;
    seen.set(n, {
      url: s.loc,
      normalizedUrl: n,
      source: 'sitemap',
      sitemapLastmod: s.lastmod ?? null,
    });
  }

  // 3) Best-effort homepage fetch to pick up first-level internal links. Don't fail the whole
  //    discovery if it errors — just skip.
  try {
    const fetched = await cheerioFetcher.fetch({
      url: seedNorm ?? seedUrl,
      userAgent: ua,
      timeoutMs: 12000,
      maxRedirects: 3,
    });
    if (fetched.status === 'ok' && fetched.html) {
      const $ = loadHtml(fetched.html);
      const allowedHosts = [project.primaryDomain.toLowerCase()];
      const { internal } = extractLinks($, fetched.finalUrl ?? seedNorm ?? seedUrl, allowedHosts);
      for (const link of internal) {
        const n = normalizeUrl(link.href);
        if (!n || seen.has(n)) continue;
        if (!isSameSite(n, project.primaryDomain, !!project.includeSubdomains)) continue;
        seen.set(n, { url: link.href, normalizedUrl: n, source: 'homepage-link' });
      }
    }
  } catch {
    /* discovery is best-effort; absence is not an error */
  }

  // 4) GSC top pages if connected. We pull aggregated top URLs by clicks.
  const gscTop = await GscRowModel.aggregate<{ _id: string; clicks: number; impressions: number }>([
    { $match: { projectId: pid } },
    {
      $group: {
        _id: '$pageUrl',
        clicks: { $sum: '$clicks' },
        impressions: { $sum: '$impressions' },
      },
    },
    { $sort: { clicks: -1, impressions: -1 } },
    { $limit: 100 },
  ]).catch(() => []);
  const gscTopUrls = new Set<string>();
  for (const row of gscTop) {
    const n = normalizeUrl(row._id);
    if (!n) continue;
    if (!isSameSite(n, project.primaryDomain, !!project.includeSubdomains)) continue;
    gscTopUrls.add(n);
    if (!seen.has(n)) {
      seen.set(n, { url: row._id, normalizedUrl: n, source: 'gsc' });
    }
  }

  // 4b) Apply normalize rules. Analyst-defined `normalizeStripParams` lists are applied here so
  //     query-only variants merge into a single canonical URL. Audit fix P1 #3.
  const normalizeDedupRecords: ScopeDecisionRecord[] = [];
  const remapped = new Map<string, DiscoveredCandidate>();
  for (const c of seen.values()) {
    const matches = matcher.normalizeMatches(c.normalizedUrl);
    if (matches.length === 0) {
      remapped.set(c.normalizedUrl, c);
      continue;
    }
    const stripParams = new Set<string>();
    for (const m of matches) {
      for (const p of m.normalizeStripParams ?? []) stripParams.add(p);
    }
    if (stripParams.size === 0) {
      remapped.set(c.normalizedUrl, c);
      continue;
    }
    let stripped = c.normalizedUrl;
    try {
      const url = new URL(c.normalizedUrl);
      let touched = false;
      for (const p of stripParams) {
        if (url.searchParams.has(p)) {
          url.searchParams.delete(p);
          touched = true;
        }
      }
      if (touched) {
        stripped = normalizeUrl(url.toString()) ?? c.normalizedUrl;
      }
    } catch {
      /* keep original */
    }
    if (stripped === c.normalizedUrl) {
      remapped.set(c.normalizedUrl, c);
      continue;
    }
    if (remapped.has(stripped)) {
      // Already saw the canonical version — record this URL as a normalized duplicate and skip.
      normalizeDedupRecords.push({
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        source: c.source,
        decision: 'normalized_duplicate',
        matchedRuleId: matches[0]?.id ?? null,
        matchedRuleName: matches[0]?.name ?? '',
        groupName: matches[0]?.groupName || matches[0]?.name || 'normalized',
        groupPattern: matches[0]?.pattern ?? '',
        reason: `Stripped params [${[...stripParams].join(', ')}] — duplicate of ${stripped}`,
        sampleReason: '',
        selectedForCrawl: false,
        sitemapLastmod: c.sitemapLastmod ?? null,
      });
    } else {
      remapped.set(stripped, { ...c, normalizedUrl: stripped });
      if (stripped !== c.normalizedUrl) {
        normalizeDedupRecords.push({
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          source: c.source,
          decision: 'normalized_duplicate',
          matchedRuleId: matches[0]?.id ?? null,
          matchedRuleName: matches[0]?.name ?? '',
          groupName: matches[0]?.groupName || matches[0]?.name || 'normalized',
          groupPattern: matches[0]?.pattern ?? '',
          reason: `Stripped params [${[...stripParams].join(', ')}] — canonical is ${stripped}`,
          sampleReason: '',
          selectedForCrawl: false,
          sitemapLastmod: c.sitemapLastmod ?? null,
        });
      }
    }
  }
  // Replace seen map with normalized canonical URLs.
  seen.clear();
  for (const [u, c] of remapped) seen.set(u, c);

  // 5) Robots block. Calculate this early so the candidate record reflects "blocked".
  const robotsBlocked = new Set<string>();
  for (const c of seen.values()) {
    if (robots && !robots.isAllowed(c.normalizedUrl, ua)) {
      robotsBlocked.add(c.normalizedUrl);
    }
  }

  // 6) Decide each candidate.
  const decisions: CandidateWithDecision[] = [];
  const records: ScopeDecisionRecord[] = [...normalizeDedupRecords];
  for (const c of seen.values()) {
    if (robotsBlocked.has(c.normalizedUrl)) {
      records.push({
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        source: c.source,
        decision: 'blocked_by_robots',
        matchedRuleId: null,
        matchedRuleName: '',
        groupName: 'blocked-by-robots',
        groupPattern: '',
        reason: 'robots.txt disallows fetching this URL',
        sampleReason: '',
        selectedForCrawl: false,
        sitemapLastmod: c.sitemapLastmod ?? null,
      });
      continue;
    }
    const d = matcher.decide(c.normalizedUrl);
    if (d) {
      decisions.push({
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        source: c.source,
        decision: { kind: 'matched', decision: d },
        sitemapLastmod: c.sitemapLastmod ?? null,
      });
    } else {
      decisions.push({
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        source: c.source,
        decision: {
          kind: 'default',
          behavior:
            (project.crawlScopeSettings?.defaultBehavior as 'crawl' | 'sample' | undefined) ??
            'crawl',
        },
        sitemapLastmod: c.sitemapLastmod ?? null,
      });
    }
  }

  // 7) Group by rule (or by default behavior) and resolve sample selection per group.
  const grouped = groupByRule(decisions);
  const totals = {
    discovered: seen.size,
    selected: 0,
    sampled: 0,
    excluded: 0,
    forceIncluded: 0,
    normalizedDuplicates: normalizeDedupRecords.length,
    blockedByRobots: robotsBlocked.size,
  };
  const groupSummaries: ScopeGroupSummary[] = [];
  const selectedFrontier: DiscoveryResult['selectedFrontier'] = [];

  for (const [_key, bucket] of grouped) {
    const rule = bucket.rule;
    const behavior = bucket.behavior;
    const ruleId = rule?.id ?? null;

    if (behavior === 'exclude') {
      for (const c of bucket.urls) {
        records.push({
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          source: c.source,
          decision: 'excluded',
          matchedRuleId: ruleId,
          matchedRuleName: rule?.name ?? '',
          groupName: rule?.groupName || rule?.name || 'excluded',
          groupPattern: rule?.pattern ?? '',
          reason: rule?.reason ?? '',
          sampleReason: '',
          selectedForCrawl: false,
          sitemapLastmod: c.sitemapLastmod ?? null,
        });
      }
      totals.excluded += bucket.urls.length;
    } else if (behavior === 'force_include') {
      for (const c of bucket.urls) {
        records.push({
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          source: c.source,
          decision: 'force_included',
          matchedRuleId: ruleId,
          matchedRuleName: rule?.name ?? '',
          groupName: rule?.groupName || rule?.name || 'force-included',
          groupPattern: rule?.pattern ?? '',
          reason: rule?.reason ?? '',
          sampleReason: 'analyst-forced',
          selectedForCrawl: true,
          sitemapLastmod: c.sitemapLastmod ?? null,
        });
        selectedFrontier.push({
          url: c.normalizedUrl,
          source: c.source,
          sampleReason: 'analyst-forced',
          groupName: rule?.groupName || rule?.name || 'force-included',
          ruleId,
        });
      }
      totals.forceIncluded += bucket.urls.length;
      totals.selected += bucket.urls.length;
    } else if (behavior === 'sample') {
      const limit = rule?.sampleLimit ?? project.crawlScopeSettings?.maxSamplePerGroup ?? 5;
      const samples = selectSamples(bucket.urls, limit, { gscTopUrls });
      const sampledSet = new Set(samples.map((s) => s.url));
      const sampleReasonByUrl = new Map(samples.map((s) => [s.url, s.reason]));
      for (const c of bucket.urls) {
        if (sampledSet.has(c.normalizedUrl)) {
          records.push({
            url: c.url,
            normalizedUrl: c.normalizedUrl,
            source: c.source,
            decision: 'sampled',
            matchedRuleId: ruleId,
            matchedRuleName: rule?.name ?? '',
            groupName: rule?.groupName || rule?.name || 'sampled',
            groupPattern: rule?.pattern ?? '',
            reason: rule?.reason ?? '',
            sampleReason: sampleReasonByUrl.get(c.normalizedUrl) ?? 'sample-selected',
            selectedForCrawl: true,
            sitemapLastmod: c.sitemapLastmod ?? null,
          });
          selectedFrontier.push({
            url: c.normalizedUrl,
            source: c.source,
            sampleReason: sampleReasonByUrl.get(c.normalizedUrl) ?? 'sample-selected',
            groupName: rule?.groupName || rule?.name || 'sampled',
            ruleId,
          });
        } else {
          records.push({
            url: c.url,
            normalizedUrl: c.normalizedUrl,
            source: c.source,
            decision: 'excluded',
            matchedRuleId: ruleId,
            matchedRuleName: rule?.name ?? '',
            groupName: rule?.groupName || rule?.name || 'sampled',
            groupPattern: rule?.pattern ?? '',
            reason: `Sample limit reached (${limit}/${bucket.urls.length})`,
            sampleReason: '',
            selectedForCrawl: false,
            sitemapLastmod: c.sitemapLastmod ?? null,
          });
        }
      }
      totals.sampled += samples.length;
      totals.selected += samples.length;
      totals.excluded += bucket.urls.length - samples.length;
    } else {
      // 'crawl' (matched or default)
      for (const c of bucket.urls) {
        records.push({
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          source: c.source,
          decision: 'crawl',
          matchedRuleId: ruleId,
          matchedRuleName: rule?.name ?? '',
          groupName: rule?.groupName || rule?.name || (c.decision.kind === 'default' ? heuristicGroupName(c.normalizedUrl) : ''),
          groupPattern: rule?.pattern ?? heuristicPattern(c.normalizedUrl),
          reason: rule?.reason ?? 'Default crawl behavior',
          sampleReason: '',
          selectedForCrawl: true,
          sitemapLastmod: c.sitemapLastmod ?? null,
        });
        selectedFrontier.push({
          url: c.normalizedUrl,
          source: c.source,
          sampleReason: '',
          groupName: rule?.groupName || rule?.name || (c.decision.kind === 'default' ? heuristicGroupName(c.normalizedUrl) : ''),
          ruleId,
        });
      }
      totals.selected += bucket.urls.length;
    }

    if (rule) {
      const selected = bucket.urls.filter((c) => {
        if (behavior === 'exclude') return false;
        return true;
      }).length;
      groupSummaries.push({
        name: rule.groupName || rule.name,
        pattern: rule.pattern,
        pageFamily: rule.pageFamily,
        behavior,
        ruleId: rule.id,
        discovered: bucket.urls.length,
        selected:
          behavior === 'exclude'
            ? 0
            : behavior === 'sample'
            ? Math.min(rule.sampleLimit, bucket.urls.length)
            : behavior === 'force_include'
            ? bucket.urls.length
            : selected,
        excluded:
          behavior === 'exclude'
            ? bucket.urls.length
            : behavior === 'sample'
            ? Math.max(0, bucket.urls.length - rule.sampleLimit)
            : 0,
        sampleLimit: behavior === 'sample' ? rule.sampleLimit : 0,
        examples: bucket.urls.slice(0, 10).map((c) => c.normalizedUrl),
        confidence: rule.confidence,
        source: rule.source,
      });
    } else {
      // Default-behavior group — synthesise a heuristic entry so analyst sees it.
      const example = bucket.urls[0]?.normalizedUrl ?? '';
      const heur = inferGroupFromPath(safePath(example));
      groupSummaries.push({
        name: heur.name,
        pattern: heur.pattern,
        pageFamily: heur.pageFamily,
        behavior,
        ruleId: null,
        discovered: bucket.urls.length,
        selected: bucket.urls.length,
        excluded: 0,
        sampleLimit: 0,
        examples: bucket.urls.slice(0, 10).map((c) => c.normalizedUrl),
        confidence: 0.5,
        source: 'heuristic',
      });
    }
  }

  // 8) Enforce global maxPages cap. Force_included first, then sampled, then crawl-all. Any URL
  //    that does NOT make the cut is rewritten to `out_of_scope` so the persisted
  //    CrawlCandidate matches what the crawler actually fetched. Otherwise the UI would claim a
  //    URL was "selectedForCrawl" while the frontier had already dropped it. Audit fix P1 #2.
  if (selectedFrontier.length > opts.maxPages) {
    const force = selectedFrontier.filter((f) => f.sampleReason === 'analyst-forced');
    const sampled = selectedFrontier.filter((f) => f.sampleReason && f.sampleReason !== 'analyst-forced');
    const crawl = selectedFrontier.filter((f) => !f.sampleReason);
    const trimmed: typeof selectedFrontier = [];
    for (const list of [force, sampled, crawl]) {
      for (const f of list) {
        if (trimmed.length >= opts.maxPages) break;
        trimmed.push(f);
      }
    }
    const keptUrls = new Set(trimmed.map((f) => f.url));
    for (const rec of records) {
      if (rec.selectedForCrawl && !keptUrls.has(rec.normalizedUrl)) {
        rec.decision = 'out_of_scope';
        rec.selectedForCrawl = false;
        rec.reason = `Trimmed by global maxPages cap (${opts.maxPages})`;
        rec.sampleReason = '';
      }
    }
    // Re-derive group-level selected/excluded counts after trim.
    for (const g of groupSummaries) {
      const inGroup = records.filter((r) => r.groupName === g.name);
      g.selected = inGroup.filter((r) => r.selectedForCrawl).length;
      g.excluded = inGroup.length - g.selected;
    }
    selectedFrontier.length = 0;
    selectedFrontier.push(...trimmed);
    // Re-derive totals from canonical records so the estimate matches the persisted candidate
    // decisions exactly. Audit fix P1 #2.
    const refreshed = recountTotalsFromRecords(records, totals.normalizedDuplicates);
    totals.selected = refreshed.selected;
    totals.sampled = refreshed.sampled;
    totals.excluded = refreshed.excluded;
    totals.forceIncluded = refreshed.forceIncluded;
    totals.blockedByRobots = refreshed.blockedByRobots;
  }

  // 9) Warnings.
  const warnings: DiscoveryResult['warnings'] = [];
  if (totals.selected === 0) {
    warnings.push({
      severity: 'high',
      message: 'No URLs would be crawled. Review exclude rules.',
    });
  }
  if (totals.selected > opts.maxPages) {
    warnings.push({
      severity: 'medium',
      message: `Selected ${totals.selected} URLs but maxPages is ${opts.maxPages}. The crawler will stop at ${opts.maxPages}.`,
    });
  }
  const goals = (project.goals as Array<{ type?: string }> | undefined) ?? [];
  const hasLocalGoal = goals.some((g) => /local/i.test(g.type ?? ''));
  const locationsGroup = groupSummaries.find((g) => /location/i.test(g.pattern));
  if (hasLocalGoal && locationsGroup && (locationsGroup.behavior === 'sample' || locationsGroup.behavior === 'exclude')) {
    warnings.push({
      severity: 'medium',
      message: `Local SEO goal is set but ${locationsGroup.pattern} is ${locationsGroup.behavior}d. Consider switching to crawl-all.`,
    });
  }

  // 10) Persist if a crawlRunId is supplied.
  if (opts.persistForCrawlRunId) {
    await persistDiscovery(opts.persistForCrawlRunId, opts.projectId, records, groupSummaries);
  }

  return {
    candidates: records,
    groups: groupSummaries,
    totals,
    warnings,
    selectedFrontier,
  };
}

async function persistDiscovery(
  crawlRunId: string,
  projectId: string,
  candidates: ScopeDecisionRecord[],
  groups: ScopeGroupSummary[],
): Promise<void> {
  const pid = new Types.ObjectId(projectId);
  const crid = new Types.ObjectId(crawlRunId);
  // Wipe prior candidate records for this run so re-discovery is idempotent.
  await CrawlCandidateModel.deleteMany({ projectId: pid, crawlRunId: crid });
  if (candidates.length > 0) {
    await CrawlCandidateModel.insertMany(
      candidates.map((c) => ({
        projectId: pid,
        crawlRunId: crid,
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        source: c.source,
        matchedRuleId: c.matchedRuleId ? new Types.ObjectId(c.matchedRuleId) : undefined,
        matchedRuleName: c.matchedRuleName,
        groupName: c.groupName,
        groupPattern: c.groupPattern,
        decision: c.decision,
        reason: c.reason,
        sampleReason: c.sampleReason,
        selectedForCrawl: c.selectedForCrawl,
        sitemapLastmod: c.sitemapLastmod ?? undefined,
      })),
      { ordered: false },
    ).catch(() => {
      /* duplicate normalizedUrl on same run — caller already filtered, ignore */
    });
  }
  await UrlGroupModel.deleteMany({ projectId: pid, crawlRunId: crid });
  if (groups.length > 0) {
    await UrlGroupModel.insertMany(
      groups.map((g) => ({
        projectId: pid,
        crawlRunId: crid,
        name: g.name,
        pattern: g.pattern,
        pageFamily: g.pageFamily,
        behavior: g.behavior,
        sampleLimit: g.sampleLimit,
        discoveredCount: g.discovered,
        sampledCount: g.behavior === 'sample' ? g.selected : 0,
        crawledCount: 0,
        excludedCount: g.excluded,
        examples: g.examples,
        sourceRuleId: g.ruleId ? new Types.ObjectId(g.ruleId) : undefined,
        confidence: g.confidence,
        lastEvaluatedAt: new Date(),
      })),
    );
  }
}

/**
 * Seed default scope rules for a project if it has none. Idempotent.
 */
export async function ensureDefaultScopeRules(projectId: string): Promise<void> {
  const pid = new Types.ObjectId(projectId);
  const existing = await CrawlScopeRuleModel.countDocuments({ projectId: pid });
  if (existing > 0) return;
  const defaults = getDefaultScopeRules();
  await CrawlScopeRuleModel.insertMany(
    defaults.map((d) => ({
      projectId: pid,
      name: d.name,
      pattern: d.pattern,
      patternType: d.patternType,
      behavior: d.behavior,
      sampleLimit: d.sampleLimit ?? 5,
      priority: d.priority,
      groupName: d.groupName,
      pageFamily: d.pageFamily ?? '',
      reason: d.reason,
      source: 'system',
      confidence: 0.9,
      status: d.status,
      normalizeStripParams: d.normalizeStripParams ?? [],
    })),
  );
}

/**
 * Recompute summary totals from the canonical ScopeDecisionRecord list. Called after the
 * maxPages trim so the estimate response matches what was actually persisted as
 * `selectedForCrawl: true`.
 */
function recountTotalsFromRecords(
  records: ScopeDecisionRecord[],
  normalizedDuplicates: number,
): {
  selected: number;
  sampled: number;
  excluded: number;
  forceIncluded: number;
  blockedByRobots: number;
  discovered: number;
} {
  let selected = 0;
  let sampled = 0;
  let excluded = 0;
  let forceIncluded = 0;
  let blocked = 0;
  for (const r of records) {
    switch (r.decision) {
      case 'crawl':
        selected += 1;
        break;
      case 'sampled':
        selected += 1;
        sampled += 1;
        break;
      case 'force_included':
        selected += 1;
        forceIncluded += 1;
        break;
      case 'excluded':
      case 'out_of_scope':
        excluded += 1;
        break;
      case 'blocked_by_robots':
        blocked += 1;
        break;
      case 'normalized_duplicate':
        // Counted separately via normalizedDuplicates.
        break;
    }
  }
  return {
    selected,
    sampled,
    excluded,
    forceIncluded,
    blockedByRobots: blocked,
    discovered: selected + excluded + blocked + normalizedDuplicates,
  };
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith('/') ? url : '/';
  }
}

function heuristicPattern(url: string): string {
  return inferGroupFromPath(safePath(url)).pattern;
}

function heuristicGroupName(url: string): string {
  return inferGroupFromPath(safePath(url)).name;
}
