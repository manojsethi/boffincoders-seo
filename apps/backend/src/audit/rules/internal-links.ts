import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule, FindingDraft } from '../types';

/**
 * Orphan page — site rule that emits one finding per orphan. Cross-page, groupKey="orphans".
 */
const orphanSiteRule: AuditRule = {
  id: 'internal-links.orphan-page',
  version: '1.0.0',
  name: 'Orphan page (no internal links in)',
  category: 'internal-links',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages with zero internal links pointing to them.',
  whyItMatters: 'Orphans are harder to discover and inherit no internal link equity.',
  recommendationTemplate: 'Link from a relevant hub/parent page.',
  defaultSeverity: 'medium',
  defaultImpact: 40,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['page.internal-links'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 3) return notApplicable('other', 'too few pages crawled to detect orphans');
    return APPLIES;
  },
  evaluateSite({ site }) {
    return site.pages
      .filter((p) => {
        if (p.pageRole === 'home' || p.pageRole === 'utility') return false;
        if (p.isIntentionallyNonIndexable) return false;
        return (site.incomingLinkCount.get(p.normalizedUrl) ?? 0) === 0;
      })
      .map((p) => ({
        status: 'fail' as const,
        severity: p.isImportant ? 'high' as const : 'medium' as const,
        title: 'Orphan page (no internal links in)',
        observed: 'No internal links from any other crawled page point here.',
        whyItMatters:
          'Orphan pages are harder for search engines to discover and inherit no internal link equity.',
        recommendation: 'Link from at least one relevant hub/parent page.',
        howToFix:
          'Add contextual links from related pages (category page, topical cluster hub, navigation).',
        evidence: { incomingLinks: 0, role: p.pageRole, url: p.url },
        evidenceSources: ['internal-links' as const],
        confidence: 0.9,
        confidenceLevel: 'high' as const,
        impactScore: p.isImportant ? 60 : 35,
        effortEstimate: 'small' as const,
        pageId: p._id,
        affectedUrls: [p.url],
        groupKey: 'orphans',
      }));
  },
};

/**
 * Shallow coverage — site-wide rollup when orphan rate > 15%.
 */
const shallowCoverage: AuditRule = {
  id: 'internal-links.shallow-coverage',
  version: '1.0.0',
  name: 'Site-wide orphan rate is high',
  category: 'site-architecture',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects sites where a large share of pages lack incoming internal links.',
  whyItMatters: 'High orphan rate indicates weak internal architecture and lost link equity.',
  recommendationTemplate: 'Build hub-and-spoke linking across topical clusters.',
  defaultSeverity: 'medium',
  defaultImpact: 60,
  defaultEffort: 'large',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['page.internal-links'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 5) return notApplicable('other', 'too few pages crawled');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const orphanCount = site.pages.filter(
      (p) =>
        p.pageRole !== 'home' &&
        !p.isIntentionallyNonIndexable &&
        (site.incomingLinkCount.get(p.normalizedUrl) ?? 0) === 0,
    ).length;
    const pct = Math.round((orphanCount / site.pages.length) * 100);
    if (pct < 15) return [];
    return [
      {
        status: 'fail',
        severity: pct > 40 ? 'high' : 'medium',
        title: `${pct}% of pages are orphans`,
        observed: `${orphanCount} of ${site.pages.length} pages have no incoming internal links.`,
        whyItMatters:
          'High orphan rate indicates weak internal architecture and lost crawl/link equity.',
        recommendation: 'Build hub-and-spoke linking across topical clusters.',
        howToFix:
          'Identify clusters, add hub pages, and link from hubs/parents to all relevant spokes.',
        evidence: { orphanCount, totalPages: site.pages.length, orphanPercent: pct },
        evidenceSources: ['internal-links'],
        confidence: 0.85,
        confidenceLevel: 'high',
        impactScore: Math.min(80, pct * 1.5),
        effortEstimate: 'large',
        groupKey: 'shallow-coverage',
      },
    ];
  },
};

/**
 * Dead-end page: page has zero internal links out. Hurts crawl + user flow.
 */
const deadEndPage: AuditRule = {
  id: 'internal-links.dead-end',
  version: '1.0.0',
  name: 'Dead-end page (no internal links out)',
  category: 'internal-links',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages with zero outgoing internal links.',
  whyItMatters: 'Dead-ends trap crawl + users; they break topical authority flow.',
  recommendationTemplate: 'Add contextual links to related pages or category hubs.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['page.internal-links'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole === 'legal' || page.pageRole === 'utility') return notApplicable('page-role-mismatch');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const out = page.internalLinksOut.length;
    if (out > 0) return { status: 'pass', severity: 'info', title: 'Page links onward' };
    return {
      status: 'warning',
      severity: 'low',
      title: 'No internal links from this page',
      observed: 'Page has 0 outgoing internal links.',
      whyItMatters: 'Dead-end pages stop crawl + users at this node.',
      recommendation: 'Add 3-5 contextual links to related content.',
      evidence: { internalLinksOut: out, pageRole: page.pageRole },
      evidenceSources: ['internal-links'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 20,
      effortEstimate: 'small',
    };
  },
};

/**
 * Weak internal links to an important page (heuristic threshold: < 3 incoming).
 */
const weakInternalLinks: AuditRule = {
  id: 'internal-links.important-page-weakly-linked',
  version: '1.0.0',
  name: 'Important page weakly linked internally',
  category: 'internal-links',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects important pages with very few internal links pointing to them.',
  whyItMatters:
    'Important pages need internal link equity to rank. Low link-in count signals low priority to Google.',
  recommendationTemplate:
    'Add 3-5 internal links from related hub or article pages.',
  defaultSeverity: 'medium',
  defaultImpact: 45,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['page.internal-links'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole === 'home') return notApplicable('page-role-mismatch');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (!page.isImportant && page.pageRole !== 'product' && page.pageRole !== 'pricing')
      return notApplicable('page-low-importance');
    if (page.internalLinksIn === 0) return notApplicable('other', 'orphan rule already covers zero links');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.internalLinksIn >= 3) {
      return { status: 'pass', severity: 'info', title: 'Internal links sufficient' };
    }
    return {
      status: 'warning',
      severity: 'medium',
      title: 'Important page has few internal links in',
      observed: `Incoming internal links: ${page.internalLinksIn}.`,
      whyItMatters: 'Internal link equity tells Google this page matters. Low link-in count caps ranking ceiling.',
      recommendation: 'Add internal links from 3-5 relevant pages.',
      evidence: {
        internalLinksIn: page.internalLinksIn,
        pageRole: page.pageRole,
        isImportant: page.isImportant,
      },
      evidenceSources: ['internal-links'],
      confidence: 0.8,
      confidenceLevel: 'medium',
      impactScore: 40,
      effortEstimate: 'small',
    };
  },
};

/**
 * Page is deep — more than 4 path segments. Reduces crawl + discovery.
 */
const tooDeepPage: AuditRule = {
  id: 'internal-links.page-too-deep',
  version: '1.0.0',
  name: 'Page is too deep in URL structure',
  category: 'site-architecture',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description:
    'Detects indexable pages buried > 4 segments deep in URL path. Often reduces crawl + discovery.',
  whyItMatters:
    'Deep pages are crawled less often and harder for users to reach. Reduces overall ranking potential.',
  recommendationTemplate: 'Flatten URL structure or surface page via cluster hub.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const depth = urlDepth(page.normalizedUrl || page.url || '');
    if (depth <= 4) return { status: 'pass', severity: 'info', title: 'URL depth OK' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: `URL is ${depth} segments deep`,
      observed: page.normalizedUrl,
      whyItMatters: 'Deep URLs are crawled less and feel buried to users.',
      recommendation: 'Flatten URL structure, or guarantee internal links + sitemap inclusion for these URLs.',
      evidence: { depth, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: Math.min(40, depth * 5),
      effortEstimate: 'medium',
    };
  },
};

function urlDepth(u: string): number {
  try {
    const url = new URL(u);
    const segs = url.pathname.split('/').filter(Boolean);
    return segs.length;
  } catch {
    return 0;
  }
}

/**
 * Site-level: many pages share the same exact title — covered by site-health.duplicate-titles already.
 * Add: duplicate H1 across pages (different bug pattern).
 */
const duplicateH1: AuditRule = {
  id: 'site-health.duplicate-h1',
  version: '1.0.0',
  name: 'Duplicate H1 across pages',
  category: 'headings',
  layer: 'content-relevance',
  pack: 'core',
  scoresInto: 'content-relevance',
  description: 'Detects identical H1 used across multiple indexable pages.',
  whyItMatters: 'Duplicate H1 weakens topical clarity and can signal templated, thin pages.',
  recommendationTemplate: 'Write a page-specific H1 for each URL.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.headings'],
  scope: 'site',
  appliesTo({ site }) {
    if (site.pages.length < 2) return notApplicable('other');
    return APPLIES;
  },
  evaluateSite({ site }) {
    const buckets = new Map<string, string[]>();
    for (const p of site.pages) {
      const h1 = (p.h1 ?? '').trim();
      if (!h1) continue;
      const arr = buckets.get(h1) ?? [];
      arr.push(p.normalizedUrl);
      buckets.set(h1, arr);
    }
    const out: FindingDraft[] = [];
    for (const [h1, urls] of buckets.entries()) {
      if (urls.length < 2) continue;
      out.push({
        status: 'warning',
        severity: urls.length > 5 ? 'medium' : 'low',
        title: `Duplicate H1 across ${urls.length} pages`,
        observed: `H1 "${h1.slice(0, 80)}" used on ${urls.length} URLs.`,
        whyItMatters: 'Identical H1 confuses topical clarity and weakens internal page distinction.',
        recommendation: 'Write a page-specific H1 reflecting each page topic.',
        evidence: { h1: h1.slice(0, 200), count: urls.length, sampleUrls: urls.slice(0, 5) },
        evidenceSources: ['crawl'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: Math.min(45, urls.length * 4),
        effortEstimate: 'small',
        affectedUrls: urls,
        groupKey: `dup-h1:${h1.slice(0, 64)}`,
      });
    }
    return out;
  },
};

export const internalLinkRules: AuditRule[] = [
  orphanSiteRule,
  shallowCoverage,
  deadEndPage,
  weakInternalLinks,
  tooDeepPage,
  duplicateH1,
];
