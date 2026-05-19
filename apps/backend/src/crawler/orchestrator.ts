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

  const seedNorm = normalizeUrl(seedUrl);
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
  diagnostics.discoveredCount = seen.size;

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

          for (const link of result.discoveredLinks) {
            if (seen.has(link)) continue;
            if (!isSameSite(link, opts.primaryDomain, opts.includeSubdomains)) continue;
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
  // can reclassify pages relative to the incremental count built during fetch).
  const pageDocs = await PageModel.find({ projectId }).select({ pageRole: 1 }).lean();
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
        contentHash,
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

async function reportProgress(crawlRunId: Types.ObjectId, pct: number, step: string): Promise<void> {
  await CrawlRunModel.updateOne(
    { _id: crawlRunId },
    { $set: { progressPercent: pct, currentStep: step } },
  );
}
