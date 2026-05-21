import { Types } from 'mongoose';
import {
  PageModel,
  PageContentModel,
  CrawlRunModel,
  ProjectModel,
  WebsiteProfileModel,
  SiteConnectionModel,
  CwvMetricModel,
} from '../db';
import { gscPageTotals } from '../integrations/google/gsc';
import { ga4PageTotals } from '../integrations/google/ga4';
import { cwvLatestByPage } from '../integrations/google/cwv';
import type { Goal, WebsiteCategory } from '@boffin/schemas';
import type { PageView, SiteContext } from './types';

export async function loadSiteContext(opts: {
  projectId: string;
  auditRunId: string;
  crawlRunId: string;
}): Promise<SiteContext> {
  const projectId = new Types.ObjectId(opts.projectId);
  const auditRunId = new Types.ObjectId(opts.auditRunId);
  const crawlRunId = new Types.ObjectId(opts.crawlRunId);

  const [project, profile, crawlRun] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    WebsiteProfileModel.findOne({ projectId }).lean(),
    CrawlRunModel.findById(crawlRunId).lean(),
  ]);
  if (!project) throw new Error(`Project not found: ${opts.projectId}`);

  // Phase 11 — scope audit to pages produced by THIS crawl run. Otherwise audit logic considers
  // pages from prior crawls that may now be excluded/sampled-out, defeating the scope feature.
  // Prefer `lastCrawlRunId` (set by orchestrator); fall back to `lastCrawledAt >= crawlRun.startedAt`
  // for pages stamped before the field landed.
  const crawlStartedAt = (crawlRun as { startedAt?: Date } | null)?.startedAt ?? null;
  const pages = await PageModel.find({
    projectId,
    $or: [
      { lastCrawlRunId: crawlRunId },
      ...(crawlStartedAt ? [{ lastCrawledAt: { $gte: crawlStartedAt } }] : []),
    ],
  }).lean();

  const contentByPage = new Map<string, { markdown: string; cleanText: string; wordCount: number }>();
  const contents = await PageContentModel.find({ projectId, crawlRunId }).lean();
  for (const c of contents) {
    const text = c.cleanText ?? '';
    contentByPage.set(String(c.pageId), {
      markdown: c.markdown ?? '',
      cleanText: text,
      wordCount: text ? text.split(/\s+/).length : 0,
    });
  }

  const overrides = (project.ruleOverrides as Record<string, unknown> | undefined) ?? {};
  const ruleOverrides = {
    disabledRuleIds: (overrides.disabledRuleIds as string[] | undefined) ?? [],
    excludedPagePatterns: (overrides.excludedPagePatterns as string[] | undefined) ?? [],
    includedPagePatterns: (overrides.includedPagePatterns as string[] | undefined) ?? [],
    importantPagePatterns: (overrides.importantPagePatterns as string[] | undefined) ?? [],
    intentionallyNonIndexablePatterns:
      (overrides.intentionallyNonIndexablePatterns as string[] | undefined) ?? [],
  };

  const importantRegexes = ruleOverrides.importantPagePatterns.map(safeRegex).filter(isDefined);
  const nonIndexableRegexes = ruleOverrides.intentionallyNonIndexablePatterns
    .map(safeRegex)
    .filter(isDefined);

  const pageViews: PageView[] = pages.map((p) => {
    const c = contentByPage.get(String(p._id));
    const url = (p.url as string | undefined) ?? (p.normalizedUrl as string | undefined) ?? '';
    const isImportantStored = (p.isImportant as boolean | undefined) === true;
    const isImportant = isImportantStored || importantRegexes.some((r) => r.test(url));
    const isIntentionallyNonIndexableStored = (p.isIntentionallyNonIndexable as boolean | undefined) === true;
    const isIntentionallyNonIndexable =
      isIntentionallyNonIndexableStored || nonIndexableRegexes.some((r) => r.test(url));

    return {
      _id: p._id,
      url,
      normalizedUrl: p.normalizedUrl ?? '',
      statusCode: p.statusCode ?? undefined,
      indexability: p.indexability ?? undefined,
      canonicalUrl: p.canonicalUrl ?? undefined,
      title: p.title ?? undefined,
      metaDescription: p.metaDescription ?? undefined,
      h1: p.h1 ?? undefined,
      lang: (p.lang as string | undefined) ?? undefined,
      openGraph: (p.openGraph ?? {}) as Record<string, string>,
      twitter: (p.twitter ?? {}) as Record<string, string>,
      headings: (p.headings ?? []) as Array<{ level: number; text: string }>,
      schema: (p.schema ?? []) as Array<Record<string, unknown>>,
      schemaSource:
        (p.schemaSource as 'raw-html' | 'rendered-html' | 'both' | 'none' | 'not-verified' | undefined) ??
        'not-verified',
      schemaTypes: (p.schemaTypes as string[] | undefined) ?? [],
      rawSchema: (p.rawSchema ?? []) as Array<Record<string, unknown>>,
      renderedSchema: (p.renderedSchema ?? []) as Array<Record<string, unknown>>,
      schemaParseErrors: (p.schemaParseErrors as string[] | undefined) ?? [],
      renderedExtractedAt: (p.renderedExtractedAt as Date | undefined) ?? undefined,
      renderedRecrawlReason: (p.renderedRecrawlReason as string | undefined) ?? undefined,
      images: (p.images ?? []) as Array<{ src: string; alt?: string }>,
      internalLinksOut: (p.internalLinksOut ?? []) as string[],
      internalLinksIn: p.internalLinksIn ?? 0,
      pageRole: p.pageRole ?? 'unknown',
      pageSubtype: p.pageSubtype ?? undefined,
      contentHash: p.contentHash ?? undefined,
      cleanText: c?.cleanText ?? '',
      markdown: c?.markdown ?? '',
      wordCount: c?.wordCount ?? 0,
      roleConfidence: (p.roleConfidence as number | undefined) ?? 0,
      roleConfidenceLevel: p.roleConfidenceLevel as 'high' | 'medium' | 'low' | undefined,
      roleSource: ((p.roleSource as 'analyst' | 'ai' | 'heuristic' | undefined) ?? 'heuristic'),
      isImportant,
      isIntentionallyNonIndexable,
    };
  });

  const incomingLinkCount = new Map<string, number>();
  for (const p of pageViews) {
    for (const link of p.internalLinksOut) {
      incomingLinkCount.set(link, (incomingLinkCount.get(link) ?? 0) + 1);
    }
  }

  const duplicateTitles = groupBy(pageViews, (p) => (p.title ?? '').trim());
  const duplicateMetas = groupBy(pageViews, (p) => (p.metaDescription ?? '').trim());

  const diag = (crawlRun?.diagnostics ?? {}) as Record<string, unknown>;
  const sitemapStatus = diag.sitemapStatus;
  const sitemapAvailable = sitemapStatus === 'found' || sitemapStatus === 'partial';
  const robotsAvailable = typeof diag.robotsStatus === 'string' ? diag.robotsStatus !== 'missing' : true;

  const connections = await SiteConnectionModel.find({ projectId, status: 'connected' }).lean();
  const providerSet = new Set(connections.map((c) => c.provider));

  // CWV doesn't require OAuth — presence of recent metrics is sufficient.
  const cwvCount = await CwvMetricModel.countDocuments({ projectId });
  const cwvAvailable = providerSet.has('cwv') || cwvCount > 0;

  // Load per-page integration data and attach to PageViews.
  const [gscMap, ga4Map, cwvMap] = await Promise.all([
    providerSet.has('gsc') ? gscPageTotals(projectId) : Promise.resolve(new Map()),
    providerSet.has('ga4')
      ? ga4PageTotals(projectId, project.primaryDomain)
      : Promise.resolve(new Map()),
    cwvAvailable ? cwvLatestByPage(projectId) : Promise.resolve(new Map()),
  ]);

  for (const p of pageViews) {
    const url = p.url;
    const norm = p.normalizedUrl;
    const gsc = gscMap.get(url) ?? gscMap.get(norm);
    if (gsc) p.gsc = gsc;
    const ga4 = ga4Map.get(url) ?? ga4Map.get(norm);
    if (ga4) p.ga4 = ga4;
    const cwv = cwvMap.get(url) ?? cwvMap.get(norm);
    if (cwv) p.cwv = cwv;
  }

  return {
    projectId,
    auditRunId,
    primaryDomain: project.primaryDomain,
    websiteCategory: profile?.websiteCategory as WebsiteCategory | undefined,
    websiteCategoryApproved: !!profile?.approvedAt,
    goals: ((project.goals as Goal[] | undefined) ?? []) as Goal[],
    pages: pageViews,
    duplicateTitles,
    duplicateMetas,
    incomingLinkCount,
    sitemapAvailable,
    robotsAvailable,
    sourcesAvailable: {
      gsc: providerSet.has('gsc'),
      ga4: providerSet.has('ga4'),
      cwv: cwvAvailable,
      backlinks: providerSet.has('backlinks'),
      citations: providerSet.has('citations'),
      aiVisibility: providerSet.has('ai-visibility'),
      renderedHtml: false,
    },
    ruleOverrides,
  };
}

function groupBy<T extends { normalizedUrl: string }>(
  items: T[],
  keyFn: (item: T) => string,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(item.normalizedUrl);
    map.set(key, arr);
  }
  return map;
}

function safeRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}

function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined;
}
