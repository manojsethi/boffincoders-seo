import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule, FindingDraft } from '../types';

/**
 * XML sitemap missing/unreachable.
 */
const sitemapMissing: AuditRule = {
  id: 'site-health.sitemap.missing',
  version: '1.0.0',
  name: 'XML sitemap missing or unreachable',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects projects without a reachable XML sitemap.',
  whyItMatters: 'A sitemap helps search engines discover and prioritize URLs.',
  recommendationTemplate: 'Publish a valid XML sitemap and reference it from robots.txt.',
  defaultSeverity: 'medium',
  defaultImpact: 45,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['site.sitemap'],
  scope: 'site',
  appliesTo() {
    return APPLIES;
  },
  evaluateSite({ site }) {
    if (site.sitemapAvailable) return [];
    return [
      {
        status: 'fail',
        severity: 'medium',
        title: 'XML sitemap missing or unreachable',
        observed: 'No reachable sitemap found at common locations.',
        whyItMatters: 'A sitemap helps search engines discover and prioritize URLs.',
        recommendation: 'Publish a valid XML sitemap and reference it from robots.txt.',
        howToFix:
          'Generate /sitemap.xml from your CMS or framework and add Sitemap: directive to robots.txt.',
        evidence: { sitemapAvailable: false },
        evidenceSources: ['sitemap', 'robots'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: 45,
        effortEstimate: 'small',
        groupKey: 'sitemap-missing',
      },
    ];
  },
};

/**
 * Duplicate titles across indexable pages.
 */
const duplicateTitles: AuditRule = {
  id: 'site-health.duplicate-titles',
  version: '1.0.0',
  name: 'Duplicate title across pages',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects identical titles used across multiple indexable pages.',
  whyItMatters: 'Duplicate titles dilute targeting and confuse search engines about page intent.',
  recommendationTemplate: 'Write a unique title for each indexable page.',
  defaultSeverity: 'medium',
  defaultImpact: 60,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 2) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const out: FindingDraft[] = [];
    for (const [title, urls] of site.duplicateTitles.entries()) {
      if (urls.length < 2) continue;
      out.push({
        status: 'fail',
        severity: urls.length > 5 ? 'high' : 'medium',
        title: `Duplicate title across ${urls.length} pages`,
        observed: `Title "${title.slice(0, 80)}" is used on ${urls.length} URLs.`,
        whyItMatters:
          'Duplicate titles dilute targeting and confuse search engines about page intent.',
        recommendation: 'Write a unique title for each indexable page.',
        howToFix:
          'Edit titles in the CMS for each affected URL. Consider canonical or noindex if pages are near-duplicates.',
        evidence: { title, count: urls.length, sampleUrls: urls.slice(0, 5) },
        evidenceSources: ['crawl'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: Math.min(70, urls.length * 8),
        effortEstimate: urls.length > 10 ? 'medium' : 'small',
        affectedUrls: urls,
        groupKey: `dup-title:${title}`,
      });
    }
    return out;
  },
};

/**
 * Duplicate meta descriptions across indexable pages.
 */
const duplicateMetas: AuditRule = {
  id: 'site-health.duplicate-meta-descriptions',
  version: '1.0.0',
  name: 'Duplicate meta description across pages',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects identical meta descriptions used across multiple indexable pages.',
  whyItMatters:
    'Identical meta descriptions weaken SERP snippet uniqueness and click-through.',
  recommendationTemplate: 'Write a unique meta description per indexable page.',
  defaultSeverity: 'low',
  defaultImpact: 35,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 2) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const out: FindingDraft[] = [];
    for (const [meta, urls] of site.duplicateMetas.entries()) {
      if (urls.length < 2) continue;
      if (meta.length < 20) continue; // skip empties / generic short strings
      out.push({
        status: 'warning',
        severity: urls.length > 5 ? 'medium' : 'low',
        title: `Duplicate meta description across ${urls.length} pages`,
        observed: `"${meta.slice(0, 80)}" used on ${urls.length} URLs.`,
        whyItMatters: 'Identical meta descriptions weaken SERP snippet uniqueness.',
        recommendation: 'Write a unique meta description per indexable page.',
        evidence: { meta: meta.slice(0, 200), count: urls.length, sampleUrls: urls.slice(0, 5) },
        evidenceSources: ['crawl'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: Math.min(50, urls.length * 5),
        effortEstimate: 'small',
        affectedUrls: urls,
        groupKey: `dup-meta:${meta.slice(0, 64)}`,
      });
    }
    return out;
  },
};

/**
 * Sitemap includes noindex URLs — usually a CMS bug.
 */
const sitemapIncludesNoindex: AuditRule = {
  id: 'site-health.sitemap-includes-noindex',
  version: '1.0.0',
  name: 'Sitemap includes noindex pages',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages that are noindex but still appear in the XML sitemap.',
  whyItMatters:
    'Sitemaps should list only canonical, indexable URLs. Noindex URLs in sitemaps confuse crawlers.',
  recommendationTemplate: 'Exclude noindex pages from the sitemap, or remove the noindex if they should rank.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['site.sitemap'],
  scope: 'site',
  appliesTo({ site }) {
    if (!site.sitemapAvailable) return notApplicable('other', 'no sitemap to evaluate');
    return APPLIES;
  },
  evaluateSite({ site }) {
    // Approximation: count crawled pages that are noindex (sitemap-derived URL set isn't stored on
    // site context). Treat any indexable=noindex page that wasn't explicitly intentionally non-indexable.
    const offenders = site.pages.filter(
      (p) => p.indexability === 'noindex' && !p.isIntentionallyNonIndexable,
    );
    if (offenders.length === 0) return [];
    return [
      {
        status: 'warning',
        severity: 'low',
        title: `${offenders.length} noindex pages also in crawl set`,
        observed: `Sitemap likely lists noindex URLs.`,
        whyItMatters:
          'Sitemap should only contain canonical, indexable URLs. Mixed signals waste crawl budget.',
        recommendation:
          'Exclude noindex pages from sitemap, or remove noindex if pages should rank.',
        evidence: {
          noindexInCrawlSet: offenders.length,
          sampleUrls: offenders.slice(0, 5).map((p) => p.url),
        },
        evidenceSources: ['sitemap', 'crawl'],
        confidence: 0.6,
        confidenceLevel: 'low',
        impactScore: 20,
        effortEstimate: 'small',
        groupKey: 'sitemap-noindex',
        affectedUrls: offenders.map((p) => p.url),
      },
    ];
  },
};

/**
 * Robots.txt missing or unparsed.
 */
const robotsMissing: AuditRule = {
  id: 'site-health.robots-missing',
  version: '1.0.0',
  name: 'robots.txt missing or unreachable',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects sites where robots.txt is missing or unreachable.',
  whyItMatters:
    'robots.txt controls crawl behavior. Missing file makes crawl signals ambiguous + omits Sitemap directive.',
  recommendationTemplate: 'Publish a robots.txt with Sitemap: directive.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['site.robots'],
  scope: 'site',
  appliesTo() {
    return APPLIES;
  },
  evaluateSite({ site }) {
    if (site.robotsAvailable) return [];
    return [
      {
        status: 'warning',
        severity: 'low',
        title: 'robots.txt missing or unparsed',
        observed: 'No robots.txt found at primary domain.',
        whyItMatters:
          'robots.txt controls crawl + advertises sitemap. Missing → ambiguous crawl signals.',
        recommendation:
          'Publish /robots.txt with User-agent + Sitemap directive. Even an empty allow-all is fine.',
        evidence: { robotsAvailable: false },
        evidenceSources: ['robots'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: 25,
        effortEstimate: 'small',
        groupKey: 'robots-missing',
      },
    ];
  },
};

export const siteHealthRules: AuditRule[] = [
  sitemapMissing,
  duplicateTitles,
  duplicateMetas,
  sitemapIncludesNoindex,
  robotsMissing,
];
