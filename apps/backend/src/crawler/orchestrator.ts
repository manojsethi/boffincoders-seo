import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import pLimit from 'p-limit';
import {
  CrawlRunModel,
  PageModel,
  PageSnapshotModel,
  PageContentModel,
  PageRawModel,
  InternalLinkModel,
} from '../db';
import { loadEnv } from '../config/env';
import { getLogger } from '../config/logger';
import { normalizeUrl, isSameSite, getPathDepth } from './normalize/url';
import { getRobots } from './discover/robots';
import { discoverFromSitemaps } from './discover/sitemap';
import { cheerioFetcher } from './fetchers/cheerio.fetcher';
import { crawl4aiExtract, crawl4aiHealth } from './fetchers/crawl4ai.fetcher';
import { extractAll } from './extract';
import { deriveSchemaSource } from './extract/schema';
import { renderRecrawlPages } from './render';
import { ProjectModel } from '../db';
import { guessPageRole } from './page-role';
import { emptyDiagnostics, bumpReason, computeHealth, type Diagnostics } from './diagnostics';
import { runDiscovery } from './scope/discover';
import { ScopeMatcher, toScopeRuleLite } from './scope/apply';
import { CrawlScopeRuleModel, UrlGroupModel, CrawlCandidateModel } from '../db';

const log = getLogger('crawler:orchestrator');
const DEFAULT_UA = 'BoffinSEO/2.0 (+https://boffincoders.com/seo-bot)';

export type CrawlOptions = {
  projectId: string;
  crawlRunId: string;
  primaryDomain: string;
  allowedDomains: string[];
  includeSubdomains: boolean;
  seedUrl?: string;
  maxPages: number;
  userAgent?: string;
  concurrency?: number;
};

export type CrawlResult = {
  diagnostics: Diagnostics;
  pagesCrawled: number;
  markdownCount: number;
};

export async function runCrawl(opts: CrawlOptions): Promise<CrawlResult> {
  const env = loadEnv();
  const projectId = new Types.ObjectId(opts.projectId);
  const crawlRunId = new Types.ObjectId(opts.crawlRunId);
  const ua = opts.userAgent ?? DEFAULT_UA;
  const concurrency = Math.max(1, opts.concurrency ?? 2);

  const seedUrl =
    opts.seedUrl ??
    (opts.primaryDomain.startsWith('http') ? opts.primaryDomain : `https://${opts.primaryDomain}`);

  const allowedHosts = uniqueHosts([opts.primaryDomain, ...opts.allowedDomains]);
  const diagnostics = emptyDiagnostics();
  const c4aiReady = await crawl4aiHealth(env.CRAWL4AI_URL);

  await reportProgress(crawlRunId, 5, 'discovering URLs');
  const robots = await getRobots(seedUrl, ua);
  const sitemap = await discoverFromSitemaps({
    seedUrl,
    userAgent: ua,
    extraSitemaps: robots?.sitemaps() ?? [],
  });
  diagnostics.sitemapStatus =
    sitemap.urls.length > 0 ? 'found' : sitemap.errors.length > 0 ? 'invalid' : 'missing';

  const seen = new Set<string>();
  const frontier: Array<{ url: string; depth: number }> = [];
  // Phase 11. Run discovery-with-scope so frontier already reflects approved rule decisions.
  // Each frontier entry carries its decided group + sample reason so the per-page write can
  // stamp `crawlScopeDecision`, `urlGroupName`, etc.
  const scopeMeta = new Map<
    string,
    { decision: 'crawl' | 'sampled' | 'force_included'; groupName: string; ruleId: string | null; sampleReason: string }
  >();
  const seedNorm = normalizeUrl(seedUrl);
  // P2 #4. Honor crawlScopeSettings.enabled — if explicitly disabled, fall back to seed +
  // sitemap and skip discovery entirely.
  const projectForScope = await ProjectModel.findById(new Types.ObjectId(opts.projectId))
    .select({ crawlScopeSettings: 1 })
    .lean();
  const scopeEnabled =
    (projectForScope as { crawlScopeSettings?: { enabled?: boolean } } | null)?.crawlScopeSettings
      ?.enabled !== false;
  try {
    if (!scopeEnabled) throw new Error('scope-disabled');
    const discovery = await runDiscovery({
      projectId: opts.projectId,
      seedUrl,
      maxPages: opts.maxPages,
      previewSuggested: false,
      persistForCrawlRunId: opts.crawlRunId,
    });
    for (const f of discovery.selectedFrontier) {
      if (seen.has(f.url)) continue;
      if (!isSameSite(f.url, opts.primaryDomain, opts.includeSubdomains)) continue;
      seen.add(f.url);
      const dec: 'crawl' | 'sampled' | 'force_included' =
        f.sampleReason === 'analyst-forced'
          ? 'force_included'
          : f.sampleReason
          ? 'sampled'
          : 'crawl';
      scopeMeta.set(f.url, {
        decision: dec,
        groupName: f.groupName,
        ruleId: f.ruleId,
        sampleReason: f.sampleReason,
      });
      frontier.push({ url: f.url, depth: f.source === 'seed' ? 0 : 1 });
    }
    // Always include seed even if it didn't show up in discovery (edge case for tiny sites).
    if (seedNorm && !seen.has(seedNorm)) {
      seen.add(seedNorm);
      frontier.push({ url: seedNorm, depth: 0 });
      scopeMeta.set(seedNorm, { decision: 'crawl', groupName: 'Homepage', ruleId: null, sampleReason: '' });
    }
    diagnostics.scope = {
      discoveredCandidates: discovery.totals.discovered,
      selectedForCrawl: discovery.totals.selected,
      excludedByRules: discovery.totals.excluded,
      sampledGroups: discovery.groups.filter((g) => g.behavior === 'sample').length,
      forceIncluded: discovery.totals.forceIncluded,
      normalizedDuplicates: discovery.totals.normalizedDuplicates,
      groups: discovery.groups.map((g) => ({
        name: g.name,
        pattern: g.pattern,
        behavior: g.behavior,
        discovered: g.discovered,
        selected: g.selected,
        excluded: g.excluded,
        sampleLimit: g.sampleLimit,
      })),
    };
  } catch (err) {
    // Fall back to old behavior if scope discovery fails — never block a crawl on scope. Also
    // taken when crawlScopeSettings.enabled === false.
    log.warn(
      { err: (err as Error).message, scopeEnabled },
      'scope discovery skipped; falling back to seed+sitemap',
    );
    if (seedNorm) {
      seen.add(seedNorm);
      frontier.push({ url: seedNorm, depth: 0 });
    }
    for (const s of sitemap.urls) {
      if (!isSameSite(s.loc, opts.primaryDomain, opts.includeSubdomains)) continue;
      if (seen.has(s.loc)) continue;
      seen.add(s.loc);
      frontier.push({ url: s.loc, depth: 1 });
      if (seen.size >= opts.maxPages * 4) break;
    }
  }
  diagnostics.discoveredCount = seen.size;

  // Live matcher for links discovered during fetch — apply scope rules before adding to frontier.
  // P1 #1 audit: when crawlScopeSettings.enabled === false, build an empty matcher so the
  // live link-discovery path also bypasses scope. Otherwise links found mid-crawl would still
  // get filtered by approved rules even though the analyst disabled scope.
  const liveRules = scopeEnabled
    ? (
        await CrawlScopeRuleModel.find({
          projectId: new Types.ObjectId(opts.projectId),
          status: 'approved',
        })
          .sort({ priority: -1 })
          .lean()
      ).map(toScopeRuleLite)
    : [];
  const liveMatcher = new ScopeMatcher(liveRules);
  const sampleQuotaByGroup = new Map<string, { used: number; limit: number }>();
  for (const c of scopeMeta.values()) {
    if (c.decision === 'sampled') {
      const cur = sampleQuotaByGroup.get(c.groupName) ?? { used: 0, limit: 0 };
      cur.used += 1;
      sampleQuotaByGroup.set(c.groupName, cur);
    }
  }
  for (const r of liveRules) {
    if (r.behavior !== 'sample') continue;
    const gn = r.groupName || r.name;
    const cur = sampleQuotaByGroup.get(gn) ?? { used: 0, limit: 0 };
    cur.limit = r.sampleLimit;
    sampleQuotaByGroup.set(gn, cur);
  }

  let crawled = 0;
  let markdownCount = 0;
  const limit = pLimit(concurrency);
  const work: Array<Promise<void>> = [];

  await reportProgress(crawlRunId, 10, 'fetching pages');

  while (frontier.length > 0 && crawled < opts.maxPages) {
    const next = frontier.shift();
    if (!next) break;
    if (robots && !robots.isAllowed(next.url, ua)) {
      diagnostics.blockedByRobotsCount += 1;
      diagnostics.skippedCount += 1;
      bumpReason(diagnostics.skippedReasons, 'blocked-by-robots');
      continue;
    }

    work.push(
      limit(async () => {
        if (crawled >= opts.maxPages) return;
        const result = await crawlOne({
          url: next.url,
          depth: next.depth,
          projectId,
          crawlRunId,
          allowedHosts,
          ua,
          c4aiReady,
          crawl4aiUrl: env.CRAWL4AI_URL,
          primaryDomain: opts.primaryDomain,
          includeSubdomains: opts.includeSubdomains,
          scopeMeta: scopeMeta.get(next.url),
        });
        if (result.kind === 'ok') {
          crawled += 1;
          if (result.hasMarkdown) markdownCount += 1;
          diagnostics.crawledCount = crawled;
          diagnostics.depthDistribution[String(next.depth)] =
            (diagnostics.depthDistribution[String(next.depth)] ?? 0) + 1;
          diagnostics.pageRoleDistribution[result.role] =
            (diagnostics.pageRoleDistribution[result.role] ?? 0) + 1;
          if (result.redirectChainCount > 0) diagnostics.redirectChainCount += 1;

          for (const rawLink of result.discoveredLinks) {
            if (!isSameSite(rawLink, opts.primaryDomain, opts.includeSubdomains)) continue;
            // P2 audit round 3: apply analyst-defined normalize rules before deciding. Strip the
            // union of `normalizeStripParams` from the URL query so links discovered mid-crawl
            // dedupe the same way discovery-phase ones do.
            let link = rawLink;
            const normMatches = liveMatcher.normalizeMatches(rawLink);
            if (normMatches.length > 0) {
              const stripParams = new Set<string>();
              for (const m of normMatches) {
                for (const p of m.normalizeStripParams ?? []) stripParams.add(p);
              }
              if (stripParams.size > 0) {
                try {
                  const u = new URL(rawLink);
                  let touched = false;
                  for (const p of stripParams) {
                    if (u.searchParams.has(p)) {
                      u.searchParams.delete(p);
                      touched = true;
                    }
                  }
                  if (touched) {
                    const renorm = normalizeUrl(u.toString());
                    if (renorm) link = renorm;
                  }
                } catch {
                  /* keep raw */
                }
              }
            }
            if (seen.has(link)) {
              if (link !== rawLink) {
                // Original URL was a query-variant; record as normalized duplicate.
                await recordSkippedCandidate(
                  projectId,
                  crawlRunId,
                  rawLink,
                  { id: '', name: 'normalize', groupName: 'normalized', pattern: '', reason: 'Query params stripped — duplicate of canonical URL' },
                  'normalized_duplicate',
                  `Normalized to ${link}`,
                );
                diagnostics.scope = diagnostics.scope ?? {
                  discoveredCandidates: 0,
                  selectedForCrawl: 0,
                  excludedByRules: 0,
                  sampledGroups: 0,
                  forceIncluded: 0,
                  normalizedDuplicates: 0,
                  groups: [],
                };
                diagnostics.scope.normalizedDuplicates += 1;
              }
              continue;
            }
            // Phase 11. Apply scope rules to discovered internal links before adding to frontier
            // so exclude/sample patterns also cover URLs found mid-crawl. force_include wins.
            // P2 #4 audit: also persist excluded/sample-full skips as CrawlCandidate so the
            // analyst can inspect every URL skipped because of scope (not just the discovery
            // ones from sitemap/homepage).
            const decision = liveMatcher.decide(link);
            if (decision) {
              if (decision.behavior === 'exclude') {
                seen.add(link);
                diagnostics.skippedCount += 1;
                bumpReason(diagnostics.skippedReasons, `scope-exclude:${decision.rule.groupName || decision.rule.name}`);
                await recordSkippedCandidate(
                  projectId,
                  crawlRunId,
                  link,
                  decision.rule,
                  'excluded',
                  decision.rule.reason || 'Excluded by scope rule',
                );
                continue;
              }
              if (decision.behavior === 'normalize') {
                // Normalize-only doesn't gate enqueue.
              }
              if (decision.behavior === 'sample') {
                const gn = decision.rule.groupName || decision.rule.name;
                const cur = sampleQuotaByGroup.get(gn) ?? { used: 0, limit: decision.rule.sampleLimit };
                if (cur.used >= cur.limit) {
                  seen.add(link);
                  diagnostics.skippedCount += 1;
                  bumpReason(diagnostics.skippedReasons, `scope-sample-full:${gn}`);
                  await recordSkippedCandidate(
                    projectId,
                    crawlRunId,
                    link,
                    decision.rule,
                    'excluded',
                    `Sample limit reached (${cur.limit}) for ${gn}`,
                  );
                  continue;
                }
                cur.used += 1;
                sampleQuotaByGroup.set(gn, cur);
                scopeMeta.set(link, {
                  decision: 'sampled',
                  groupName: gn,
                  ruleId: decision.rule.id,
                  sampleReason: 'discovered-mid-crawl',
                });
              } else if (decision.behavior === 'force_include') {
                scopeMeta.set(link, {
                  decision: 'force_included',
                  groupName: decision.rule.groupName || decision.rule.name,
                  ruleId: decision.rule.id,
                  sampleReason: 'analyst-forced',
                });
              } else {
                scopeMeta.set(link, {
                  decision: 'crawl',
                  groupName: decision.rule.groupName || decision.rule.name,
                  ruleId: decision.rule.id,
                  sampleReason: '',
                });
              }
            }
            seen.add(link);
            if (seen.size >= opts.maxPages * 4) break;
            frontier.push({ url: link, depth: next.depth + 1 });
          }
          diagnostics.discoveredCount = seen.size;
          if (crawled % 5 === 0) {
            const pct = Math.min(95, 10 + Math.round((crawled / opts.maxPages) * 80));
            await reportProgress(crawlRunId, pct, `crawled ${crawled}/${opts.maxPages}`);
          }
        } else if (result.kind === 'skip') {
          diagnostics.skippedCount += 1;
          bumpReason(diagnostics.skippedReasons, result.reason);
        } else {
          diagnostics.failedCount += 1;
          bumpReason(diagnostics.failedReasons, result.reason);
        }
      }),
    );

    if (work.length >= concurrency * 4) {
      await Promise.all(work.splice(0, work.length));
    }
  }
  await Promise.all(work);

  diagnostics.markdownCoveragePct = crawled === 0 ? 0 : Math.round((markdownCount / crawled) * 100);
  diagnostics.healthStatus = computeHealth(diagnostics);

  // Recompute pageRoleDistribution from authoritative Page records (post-extract role inference
  // can reclassify pages relative to the incremental count built during fetch). P2 audit fix —
  // scope to pages stamped with THIS crawl run so the distribution reflects only what the
  // current scope produced, not legacy pages from prior crawls.
  const pageDocs = await PageModel.find({ projectId, lastCrawlRunId: crawlRunId })
    .select({ pageRole: 1 })
    .lean();
  const freshDist: Record<string, number> = {};
  for (const p of pageDocs) {
    const r = (p.pageRole as string | undefined) ?? 'unknown';
    freshDist[r] = (freshDist[r] ?? 0) + 1;
  }
  diagnostics.pageRoleDistribution = freshDist;

  await CrawlRunModel.updateOne(
    { _id: crawlRunId },
    { $set: { diagnostics, counts: { pages: crawled, markdown: markdownCount } } },
  );

  // P2 #5. Update UrlGroup.crawledCount from actual Page documents written this run, so the
  // analyst sees discovered vs sampled vs crawled accurately.
  try {
    const crawledByGroup = await PageModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId, lastCrawlRunId: crawlRunId, urlGroupName: { $ne: null } } },
      { $group: { _id: '$urlGroupName', count: { $sum: 1 } } },
    ]);
    for (const row of crawledByGroup) {
      if (!row._id) continue;
      await UrlGroupModel.updateMany(
        { projectId, crawlRunId, name: row._id },
        { $set: { crawledCount: row.count } },
      );
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'url-group crawledCount update failed');
  }

  // Doc 04 §"Project-level crawl/render policy" — auto-render selected pages per project settings.
  await maybeAutoRender({
    projectId: opts.projectId,
    crawlRunId: String(crawlRunId),
  }).catch((err) =>
    log.warn({ err: (err as Error).message }, 'auto-render after crawl failed'),
  );

  await reportProgress(crawlRunId, 100, 'crawl complete');
  log.info({ crawled, markdownCount, projectId: opts.projectId }, 'crawl finished');
  return { diagnostics, pagesCrawled: crawled, markdownCount };
}

async function maybeAutoRender(opts: {
  projectId: string;
  crawlRunId: string;
}): Promise<void> {
  const project = await ProjectModel.findById(opts.projectId).lean();
  if (!project) return;
  const settings = (project.crawlSettings as Record<string, unknown> | undefined) ?? {};
  const renderMode = (settings.renderMode as string | undefined) ?? 'cheerio-with-playwright-fallback';
  if (renderMode === 'cheerio-only') return;

  const projectIdObj = new Types.ObjectId(opts.projectId);
  const { PageModel, PageContentModel } = await import('../db');
  const allPages = await PageModel.find({ projectId: projectIdObj }).lean();

  const targets = new Set<string>();
  const max = Number(settings.maxRenderedPages ?? 25);
  const autoImportant = settings.autoRenderImportantPages !== false;
  const autoSchemaNV = settings.autoRenderSchemaNotVerified === true;
  const autoJsSuspected = settings.autoRenderJsSuspected === true;

  if (renderMode === 'playwright-only') {
    for (const p of allPages) {
      if (targets.size >= max) break;
      targets.add(String(p._id));
    }
  } else {
    if (autoImportant) {
      for (const p of allPages) {
        if (targets.size >= max) break;
        if (p.isImportant || p.pageRole === 'home' || p.pageRole === 'pricing' || p.pageRole === 'product') {
          targets.add(String(p._id));
        }
      }
    }
    if (autoSchemaNV) {
      for (const p of allPages) {
        if (targets.size >= max) break;
        if ((p.schemaSource ?? 'not-verified') === 'not-verified') targets.add(String(p._id));
      }
    }
    if (autoJsSuspected) {
      // Heuristic SPA / JS-rendered shell detection: indexable, status 200, tiny body content,
      // no raw JSON-LD. Common pattern when the real content is hydrated by client JS.
      const pageIds = allPages.map((p) => p._id);
      const contents = await PageContentModel.find({
        projectId: projectIdObj,
        pageId: { $in: pageIds },
      })
        .select({ pageId: 1, cleanText: 1, markdown: 1 })
        .lean();
      const wordCountByPage = new Map<string, number>();
      for (const c of contents) {
        const text = (c.cleanText as string | undefined) ?? '';
        const wc = text ? text.split(/\s+/).filter(Boolean).length : 0;
        wordCountByPage.set(String(c.pageId), wc);
      }
      for (const p of allPages) {
        if (targets.size >= max) break;
        if (p.statusCode !== 200) continue;
        if (p.indexability === 'noindex') continue;
        const wc = wordCountByPage.get(String(p._id)) ?? 0;
        const rawSchemaCount = Array.isArray(p.rawSchema) ? p.rawSchema.length : 0;
        if (wc < 80 && rawSchemaCount === 0) targets.add(String(p._id));
      }
    }
  }
  if (targets.size === 0) return;
  await renderRecrawlPages({
    projectId: opts.projectId,
    pageIds: [...targets],
    reason: `auto:${renderMode}`,
    concurrency: Number(settings.renderConcurrency ?? 2),
    timeoutMs: Number(settings.renderTimeoutMs ?? 30000),
  });
}

type CrawlOneInput = {
  url: string;
  depth: number;
  projectId: Types.ObjectId;
  crawlRunId: Types.ObjectId;
  allowedHosts: string[];
  ua: string;
  c4aiReady: boolean;
  crawl4aiUrl: string;
  primaryDomain: string;
  includeSubdomains: boolean;
  scopeMeta?: {
    decision: 'crawl' | 'sampled' | 'force_included';
    groupName: string;
    ruleId: string | null;
    sampleReason: string;
  };
};

type CrawlOneResult =
  | {
      kind: 'ok';
      hasMarkdown: boolean;
      role: string;
      discoveredLinks: string[];
      redirectChainCount: number;
    }
  | { kind: 'skip'; reason: string }
  | { kind: 'fail'; reason: string };

async function crawlOne(input: CrawlOneInput): Promise<CrawlOneResult> {
  const normalized = normalizeUrl(input.url);
  if (!normalized) return { kind: 'skip', reason: 'invalid-url' };
  if (!isSameSite(normalized, input.primaryDomain, input.includeSubdomains)) {
    return { kind: 'skip', reason: 'off-site' };
  }

  const [fetched, c4ai] = await Promise.all([
    cheerioFetcher.fetch({
      url: normalized,
      userAgent: input.ua,
      timeoutMs: 20_000,
      maxRedirects: 5,
    }),
    input.c4aiReady
      ? crawl4aiExtract({ baseUrl: input.crawl4aiUrl, url: normalized, timeoutMs: 30_000 })
      : Promise.resolve({ ok: false, error: 'crawl4ai-unavailable' } as const),
  ]);

  if (fetched.status === 'error' || !fetched.html) {
    return { kind: 'fail', reason: fetched.error ?? `http-${fetched.statusCode}` };
  }
  if (fetched.status === 'not-modified') return { kind: 'skip', reason: 'not-modified' };

  const finalUrl = fetched.finalUrl ?? normalized;
  const extracted = extractAll({
    html: fetched.html,
    url: finalUrl,
    allowedHosts: input.allowedHosts,
    includeMarkdown: !c4ai.ok,
    markdownOverride: c4ai.ok ? c4ai.markdown : undefined,
  });

  const robotsMeta = (extracted.metadata.metaRobots ?? '').toLowerCase();
  const indexability = robotsMeta.includes('noindex') ? 'noindex' : 'index';
  const contentHash = sha256(extracted.cleanText);
  const role = guessPageRole(finalUrl, extracted.metadata.title, {
    h1: extracted.h1[0],
    headings: extracted.headings,
    wordCount: extracted.wordCount,
  });

  const rawSchema = extracted.schema.blocks;
  const schemaSource = deriveSchemaSource({
    hasRaw: rawSchema.length > 0,
    renderedRan: false,
    hasRendered: false,
  });

  const page = await PageModel.findOneAndUpdate(
    { projectId: input.projectId, normalizedUrl: finalUrl },
    {
      $set: {
        projectId: input.projectId,
        url: finalUrl,
        normalizedUrl: finalUrl,
        statusCode: fetched.statusCode,
        indexability,
        canonicalUrl: extracted.metadata.canonicalUrl,
        title: extracted.metadata.title,
        metaDescription: extracted.metadata.metaDescription,
        h1: extracted.h1[0],
        lang: extracted.metadata.lang,
        openGraph: extracted.metadata.openGraph,
        twitter: extracted.metadata.twitter,
        headings: extracted.headings,
        schema: rawSchema,
        schemaSource,
        schemaTypes: extracted.schema.types,
        rawSchema,
        schemaParseErrors: extracted.schema.parseErrors,
        // Rendered fields are NOT touched by initial crawl. Render-recrawl sets them.
        images: extracted.images.map((i) => ({ src: i.src, alt: i.alt })),
        internalLinksOut: extracted.internalLinks.map((l) => l.href),
        pageRole: role.role,
        roleConfidence: role.confidence,
        roleConfidenceLevel: role.confidenceLevel,
        roleSource: role.source,
        roleInferredAt: new Date(),
        lastCrawledAt: new Date(),
        lastCrawlRunId: input.crawlRunId,
        contentHash,
        // Phase 11 — stamp scope provenance so the audit/UI can show template-level context.
        crawlScopeDecision: input.scopeMeta?.decision ?? 'crawl',
        urlGroupName: input.scopeMeta?.groupName ?? undefined,
        scopeRuleId: input.scopeMeta?.ruleId
          ? new Types.ObjectId(input.scopeMeta.ruleId)
          : undefined,
        sampleReason: input.scopeMeta?.sampleReason ?? '',
      },
    },
    { upsert: true, new: true },
  );

  await PageSnapshotModel.create({
    projectId: input.projectId,
    pageId: page._id,
    crawlRunId: input.crawlRunId,
    url: finalUrl,
    statusCode: fetched.statusCode,
    title: extracted.metadata.title,
    metaDescription: extracted.metadata.metaDescription,
    h1: extracted.h1[0],
    canonicalUrl: extracted.metadata.canonicalUrl,
    indexability,
    extracted: {
      wordCount: extracted.wordCount,
      imageCount: extracted.images.length,
      imageMissingAltCount: extracted.imageMissingAltCount,
      internalLinkCount: extracted.internalLinks.length,
      externalLinkCount: extracted.externalLinks.length,
      schemaTypeCount: rawSchema.length,
      depth: getPathDepth(finalUrl),
    },
    contentHash,
    capturedAt: new Date(),
  });

  const markdown = extracted.markdown;
  await PageContentModel.create({
    projectId: input.projectId,
    pageId: page._id,
    crawlRunId: input.crawlRunId,
    markdown,
    cleanText: extracted.cleanText,
    extractionMethod: c4ai.ok ? 'crawl4ai' : 'turndown',
    qualityScore: estimateQuality(extracted.cleanText, markdown),
    tokenEstimate: extracted.tokenEstimate,
    contentHash,
  });

  await PageRawModel.create({
    projectId: input.projectId,
    pageId: page._id,
    crawlRunId: input.crawlRunId,
    html: fetched.html.slice(0, 500_000),
    headers: fetched.headers ?? {},
    statusCode: fetched.statusCode,
    fetcher: fetched.fetcher,
  });

  if (extracted.internalLinks.length > 0) {
    await InternalLinkModel.insertMany(
      extracted.internalLinks.map((l) => ({
        projectId: input.projectId,
        crawlRunId: input.crawlRunId,
        fromPageId: page._id,
        toUrlNormalized: l.href,
        anchorText: l.text,
        isNofollow: l.isNofollow,
      })),
      { ordered: false },
    ).catch(() => {});
  }

  return {
    kind: 'ok',
    hasMarkdown: markdown.length > 100,
    role: role.role,
    discoveredLinks: extracted.internalLinks.map((l) => l.href),
    redirectChainCount: fetched.redirectChain ? fetched.redirectChain.length - 1 : 0,
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function estimateQuality(cleanText: string, markdown: string): number {
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  const mdLen = markdown.length;
  if (wordCount < 50 && mdLen < 200) return 10;
  if (wordCount < 200) return 40;
  if (wordCount < 500) return 65;
  if (wordCount < 1500) return 85;
  return 95;
}

function uniqueHosts(domains: string[]): string[] {
  const set = new Set<string>();
  for (const d of domains) {
    const h = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (h) set.add(h);
  }
  return [...set];
}

/**
 * P2 #4 audit. Persist a mid-crawl scope skip as a CrawlCandidate so the analyst can inspect
 * every URL the live scope matcher rejected, not just the discovery-phase ones. Best-effort: if
 * the URL is already a candidate (e.g. discovery already recorded it), the unique index swallows
 * the insert.
 */
async function recordSkippedCandidate(
  projectId: Types.ObjectId,
  crawlRunId: Types.ObjectId,
  url: string,
  rule: { id: string; name: string; groupName: string; pattern: string; reason: string },
  decision: 'excluded' | 'out_of_scope' | 'normalized_duplicate',
  reason: string,
): Promise<void> {
  try {
    await CrawlCandidateModel.updateOne(
      { projectId, crawlRunId, normalizedUrl: url },
      {
        $setOnInsert: {
          projectId,
          crawlRunId,
          url,
          normalizedUrl: url,
          source: 'link',
          matchedRuleId: rule.id ? new Types.ObjectId(rule.id) : undefined,
          matchedRuleName: rule.name,
          groupName: rule.groupName || rule.name,
          groupPattern: rule.pattern,
          decision,
          reason,
          sampleReason: '',
          selectedForCrawl: false,
        },
      },
      { upsert: true },
    );
  } catch {
    /* race / duplicate is fine */
  }
}

async function reportProgress(crawlRunId: Types.ObjectId, pct: number, step: string): Promise<void> {
  await CrawlRunModel.updateOne(
    { _id: crawlRunId },
    { $set: { progressPercent: pct, currentStep: step } },
  );
}
