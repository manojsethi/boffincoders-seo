import { APPLIES, isImportantPage, notApplicable } from '../applicability';
import type { AuditRule } from '../types';

/**
 * Canonical missing. Important pages get a fail; non-important pages get warning.
 */
const canonicalMissing: AuditRule = {
  id: 'crawl-indexing.canonical.missing',
  version: '1.0.0',
  name: 'Canonical URL missing',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects indexable pages without a <link rel="canonical">.',
  whyItMatters: 'Without canonical, duplicate URLs may dilute ranking signals.',
  recommendationTemplate: 'Add a self-referential canonical link in <head>.',
  defaultSeverity: 'medium',
  defaultImpact: 35,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.indexability === 'noindex') return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.canonicalUrl && page.canonicalUrl.trim().length > 0) {
      return { status: 'pass', severity: 'info', title: 'Canonical present' };
    }
    const important = isImportantPage(page);
    return {
      status: important ? 'fail' : 'warning',
      severity: important ? 'medium' : 'low',
      title: 'Missing canonical URL',
      observed: 'No <link rel="canonical"> on this page.',
      whyItMatters: 'Without a canonical, duplicate URLs may dilute ranking signals.',
      recommendation: 'Add a self-referential canonical link in <head>.',
      howToFix: '<link rel="canonical" href="..." /> pointing to the preferred URL.',
      evidence: { canonicalUrl: null, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 1,
      impactScore: important ? 45 : 25,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Important page is noindex. Doc 11 §"Example 1: Important Page Is Noindex".
 */
const importantNoindex: AuditRule = {
  id: 'indexability.noindex-important-page',
  version: '1.0.0',
  name: 'Important page is blocked from indexing',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects important pages whose meta robots / X-Robots prevents indexing.',
  whyItMatters: 'Noindex pages cannot rank.',
  recommendationTemplate:
    'If this page should rank, remove the noindex directive. Otherwise mark as intentionally non-indexable.',
  defaultSeverity: 'critical',
  defaultImpact: 90,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.robots-meta'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.indexability !== 'noindex') return notApplicable('other', 'page is not noindex');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const important = isImportantPage(page);
    if (!important) {
      // Uncertain importance: surface as needs_review so analyst can mark intentional or not.
      return {
        status: 'needs_review',
        severity: 'medium',
        title: 'Page is noindex — confirm intent',
        needsReviewReason:
          'Page is noindex but importance is uncertain. Mark intentionally non-indexable or remove noindex.',
        observed: 'meta robots contains "noindex".',
        whyItMatters: 'Noindex pages cannot rank. Confirm whether this is intentional.',
        evidence: { indexability: page.indexability, pageRole: page.pageRole },
        evidenceSources: ['crawl'],
        confidence: 0.5,
        confidenceLevel: 'medium',
        impactScore: 40,
      };
    }
    return {
      status: 'fail',
      severity: 'critical',
      priority: 'P0',
      title: 'Important page is noindex',
      observed: 'meta robots contains "noindex" and this page is treated as important.',
      whyItMatters: 'Important pages must be indexable. Otherwise they cannot rank or drive conversions.',
      recommendation:
        'If this page should appear in Google, remove the noindex directive and re-audit. Otherwise mark it as intentionally non-indexable.',
      howToFix: 'Remove <meta name="robots" content="noindex"> or the X-Robots-Tag header on this template.',
      evidence: { indexability: page.indexability, pageRole: page.pageRole, reason: 'important' },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 90,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * HTTP status not 200. 5xx are critical; 4xx are high.
 */
const statusNot200: AuditRule = {
  id: 'crawl-indexing.status.not-200',
  version: '1.0.0',
  name: 'Page returns non-200 status',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose HTTP response is not 200.',
  whyItMatters: 'Non-200 pages do not get indexed and lose ranking equity.',
  recommendationTemplate: 'Fix the response status or redirect to a working URL.',
  defaultSeverity: 'high',
  defaultImpact: 75,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.status'],
  scope: 'page',
  appliesTo({ page }) {
    if (typeof page.statusCode !== 'number' || page.statusCode === 200) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const code = page.statusCode ?? 0;
    const isServerError = code >= 500;
    return {
      status: 'fail',
      severity: isServerError ? 'critical' : 'high',
      priority: isServerError ? 'P0' : 'P1',
      title: `Page returns HTTP ${code}`,
      observed: `Status code: ${code}`,
      whyItMatters: 'Non-200 pages do not get indexed or lose ranking equity.',
      recommendation: 'Fix the response status or redirect to a working URL.',
      howToFix: 'Investigate origin (CMS, server, redirect chain) and restore a 200 response.',
      evidence: { statusCode: code, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: isServerError ? 85 : 70,
      effortEstimate: 'small',
    };
  },
};

/**
 * Canonical points to a different URL. Often intentional, but warn when it points away from a clearly
 * important indexable page so analyst can verify it's not a mistake.
 */
const canonicalNotSelf: AuditRule = {
  id: 'crawl-indexing.canonical.not-self',
  version: '1.0.0',
  name: 'Canonical URL is not self-referencing',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose canonical points to a different URL.',
  whyItMatters:
    'A non-self canonical tells Google the current URL should not rank — only intentional when consolidating duplicates.',
  recommendationTemplate:
    'Verify the canonical target. If this page should rank, the canonical must self-reference.',
  defaultSeverity: 'medium',
  defaultImpact: 40,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.canonicalUrl) return notApplicable('other', 'no canonical to evaluate');
    if (page.indexability === 'noindex')
      return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const canonical = (page.canonicalUrl ?? '').trim();
    const here = (page.normalizedUrl || page.url || '').trim();
    if (!canonical || !here) return { status: 'pass', severity: 'info', title: 'Canonical present' };
    if (sameUrl(canonical, here)) {
      return { status: 'pass', severity: 'info', title: 'Canonical self-references' };
    }
    const important = isImportantPage(page);
    return {
      status: important ? 'fail' : 'warning',
      severity: important ? 'medium' : 'low',
      title: 'Canonical points to a different URL',
      observed: `Page URL: ${here}. Canonical: ${canonical}.`,
      whyItMatters:
        'A non-self canonical tells Google this URL should not rank. Confirm this is intentional.',
      recommendation:
        'If this page should rank, change canonical to self-reference. Otherwise document why this URL is consolidating to another.',
      howToFix: '<link rel="canonical" href="<same-url-as-page>" />',
      evidence: { canonicalUrl: canonical, pageUrl: here, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.85,
      confidenceLevel: 'medium',
      impactScore: important ? 55 : 25,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Canonical points to the homepage. Common bug from CMSs that hard-code canonical.
 */
const canonicalToHomepage: AuditRule = {
  id: 'crawl-indexing.canonical.points-to-home',
  version: '1.0.0',
  name: 'Canonical URL points to the homepage',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects non-home pages whose canonical resolves to the home URL.',
  whyItMatters: 'A canonical to home tells Google only the home page should rank — usually a CMS bug.',
  recommendationTemplate:
    'Replace the canonical with a self-reference unless this page is truly an alias of the homepage.',
  defaultSeverity: 'high',
  defaultImpact: 70,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page, site }) {
    if (!page.canonicalUrl) return notApplicable('other');
    if (page.pageRole === 'home') return notApplicable('page-role-mismatch');
    const home = homepageUrl(site.primaryDomain);
    if (!isHomepageCanonical(page.canonicalUrl, home)) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page, site }) {
    const here = page.normalizedUrl || page.url || '';
    return {
      status: 'fail',
      severity: 'high',
      priority: 'P1',
      title: 'Canonical points to homepage',
      observed: `Non-home page ${here} canonical = ${page.canonicalUrl}.`,
      whyItMatters: 'Google will consolidate this URL into the homepage, so it will not rank on its own.',
      recommendation: 'Change canonical to self-reference.',
      howToFix: '<link rel="canonical" href="<this-page-url>" />',
      evidence: {
        canonicalUrl: page.canonicalUrl,
        pageUrl: here,
        homepageUrl: homepageUrl(site.primaryDomain),
      },
      evidenceSources: ['crawl'],
      confidence: 0.95,
      confidenceLevel: 'high',
      impactScore: 70,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Redirect chain detected on a crawled URL (more than one hop). Slows crawl + loses equity.
 */
const redirectChain: AuditRule = {
  id: 'crawl-indexing.redirect-chain',
  version: '1.0.0',
  name: 'Redirect chain detected',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages reached through multiple redirects.',
  whyItMatters:
    'Long redirect chains slow crawling, lose link equity, and frustrate users on slow connections.',
  recommendationTemplate: 'Redirect directly to the final URL with a single 301.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.headers'],
  scope: 'page',
  appliesTo({ page }) {
    // Heuristic: read redirect-hop count from extended evidence via finalUrl mismatch.
    if (!page.normalizedUrl || !page.url) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.normalizedUrl === page.url) {
      return { status: 'pass', severity: 'info', title: 'No redirect chain' };
    }
    return {
      status: 'warning',
      severity: 'low',
      title: 'Page reached via redirect',
      observed: `Requested: ${page.url} → final: ${page.normalizedUrl}`,
      whyItMatters: 'Redirect hops waste crawl budget and weaken signals.',
      recommendation: 'Update internal links to point at the final URL directly. Avoid chained 30x.',
      evidence: { requestedUrl: page.url, finalUrl: page.normalizedUrl, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.8,
      confidenceLevel: 'medium',
      impactScore: 20,
      effortEstimate: 'small',
    };
  },
};

/**
 * X-Robots-Tag noindex even when meta robots is missing — covered indirectly by importantNoindex above
 * (indexability flag derived from both). Keeping separate sitemap-includes-noindex below as site rule.
 */

/**
 * Tracking params in URL or canonical. Common CMS bug.
 */
const trackingParams: AuditRule = {
  id: 'crawl-indexing.url.tracking-params',
  version: '1.0.0',
  name: 'Tracking params in URL or canonical',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects UTM / fbclid / gclid tracking params on indexable URL or canonical.',
  whyItMatters:
    'Tracking params multiply duplicate URLs. Canonical with tracking params is a serious CMS bug.',
  recommendationTemplate:
    'Strip tracking params at canonical time. Use robots/server rules to keep tracked URLs out of index.',
  defaultSeverity: 'medium',
  defaultImpact: 45,
  defaultEffort: 'small',
  defaultValidationMethod: 'Re-crawl + confirm canonical contains no tracking params.',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const TRACKING = /[?&](utm_[a-z]+|fbclid|gclid|msclkid|mc_eid|mc_cid|ref|hsCtaTracking)=/i;
    const inUrl = TRACKING.test(page.normalizedUrl || page.url || '');
    const inCanonical = page.canonicalUrl ? TRACKING.test(page.canonicalUrl) : false;
    if (!inUrl && !inCanonical) {
      return { status: 'pass', severity: 'info', title: 'URL clean of tracking params' };
    }
    return {
      status: inCanonical ? 'fail' : 'warning',
      severity: inCanonical ? 'high' : 'medium',
      priority: inCanonical ? 'P1' : 'P2',
      title: inCanonical
        ? 'Canonical contains tracking params'
        : 'URL contains tracking params',
      observed: `${inCanonical ? 'canonical' : 'url'}: ${inCanonical ? page.canonicalUrl : page.url}`,
      whyItMatters:
        'Tracking params on canonical create a different canonical per visitor — sabotages canonicalization.',
      recommendation: 'Strip utm_* / fbclid / gclid from canonical generation.',
      evidence: { inUrl, inCanonical, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: inCanonical ? 60 : 25,
      effortEstimate: 'small',
    };
  },
};

/**
 * Cross-domain canonical.
 */
const canonicalCrossDomain: AuditRule = {
  id: 'crawl-indexing.canonical.cross-domain',
  version: '1.0.0',
  name: 'Canonical points to different domain',
  category: 'crawl-indexing',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose canonical URL lives on a different domain.',
  whyItMatters:
    'Cross-domain canonical tells Google another site should rank — only intentional during migration.',
  recommendationTemplate: 'Set canonical to same domain unless this is an intentional consolidation.',
  defaultSeverity: 'high',
  defaultImpact: 65,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.canonicalUrl || !page.url) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page, site }) {
    try {
      const here = new URL(page.url).hostname.replace(/^www\./, '');
      const canon = new URL(page.canonicalUrl!).hostname.replace(/^www\./, '');
      const allowed = new Set([site.primaryDomain.toLowerCase(), ...site.pages
        .map((p) => {
          try {
            return new URL(p.url).hostname.replace(/^www\./, '');
          } catch {
            return '';
          }
        })
        .filter(Boolean)]);
      if (canon === here || allowed.has(canon))
        return { status: 'pass', severity: 'info', title: 'Canonical on same domain' };
      return {
        status: 'fail',
        severity: 'high',
        priority: 'P1',
        title: 'Canonical points to a different domain',
        observed: `Page on ${here}, canonical on ${canon}.`,
        whyItMatters:
          'Cross-domain canonical hands ranking signals to another site. Usually a misconfiguration.',
        recommendation: 'Update canonical to this site\'s domain unless intentional.',
        evidence: { here, canonHost: canon, canonicalUrl: page.canonicalUrl, pageUrl: page.url },
        evidenceSources: ['crawl'],
        confidence: 1,
        confidenceLevel: 'high',
        impactScore: 65,
        effortEstimate: 'trivial',
      };
    } catch {
      return null;
    }
  },
};

export const crawlIndexingRules: AuditRule[] = [
  canonicalMissing,
  importantNoindex,
  statusNot200,
  canonicalNotSelf,
  canonicalToHomepage,
  redirectChain,
  trackingParams,
  canonicalCrossDomain,
];

function normalizeForCompare(u: string): string {
  return u
    .trim()
    .replace(/#.*$/, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function sameUrl(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function homepageUrl(primaryDomain: string): string {
  const d = primaryDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `https://${d}`;
}

function isHomepageCanonical(canonical: string, home: string): boolean {
  return sameUrl(canonical, home);
}
