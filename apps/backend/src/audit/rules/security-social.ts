import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule } from '../types';

/**
 * URL not on HTTPS.
 */
const notHttps: AuditRule = {
  id: 'security.url-not-https',
  version: '1.0.0',
  name: 'URL is not HTTPS',
  category: 'security-trust',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects pages served over HTTP rather than HTTPS.',
  whyItMatters:
    'HTTPS is a baseline ranking signal and a hard trust requirement for modern browsers.',
  recommendationTemplate:
    'Force HTTPS via redirect + HSTS. Ensure all internal links use https://.',
  defaultSeverity: 'high',
  defaultImpact: 80,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.url) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.url.startsWith('https://')) {
      return { status: 'pass', severity: 'info', title: 'URL on HTTPS' };
    }
    return {
      status: 'fail',
      severity: 'high',
      priority: 'P1',
      title: 'Page served over HTTP',
      observed: `URL: ${page.url}`,
      whyItMatters: 'Browsers flag HTTP as insecure; Google prefers HTTPS for ranking.',
      recommendation:
        'Force HTTPS at the server / edge with 301 redirect, then add HSTS.',
      howToFix:
        'Configure HTTP → HTTPS redirect on your origin or CDN. Add `Strict-Transport-Security` header.',
      evidence: { url: page.url, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 80,
      effortEstimate: 'small',
    };
  },
};

/**
 * Mixed-content images (img src=http on an https page).
 */
const mixedContent: AuditRule = {
  id: 'security.mixed-content',
  version: '1.0.0',
  name: 'Mixed-content image references',
  category: 'security-trust',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description:
    'Detects HTTPS pages that reference image assets over HTTP. Modern browsers block these.',
  whyItMatters:
    'Mixed content breaks page experience, raises browser warnings, and hurts trust signals.',
  recommendationTemplate:
    'Update all asset URLs to https:// or protocol-relative.',
  defaultSeverity: 'medium',
  defaultImpact: 40,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.images'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.url || !page.url.startsWith('https://')) return notApplicable('other');
    if (page.images.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const http = page.images.filter((i) => (i.src ?? '').startsWith('http://'));
    if (http.length === 0)
      return { status: 'pass', severity: 'info', title: 'No mixed-content images' };
    return {
      status: 'fail',
      severity: 'medium',
      title: `${http.length} image(s) loaded over HTTP`,
      observed: `Sample: ${http
        .slice(0, 3)
        .map((i) => i.src)
        .join(' ; ')}`,
      whyItMatters: 'Browsers block HTTP assets on HTTPS pages, breaking visuals + trust.',
      recommendation: 'Rewrite image URLs to https:// (or use protocol-relative).',
      evidence: { mixedContentCount: http.length, samples: http.slice(0, 5).map((i) => i.src) },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 40,
      effortEstimate: 'small',
    };
  },
};

/**
 * Twitter card meta missing (alongside og rule).
 */
const twitterCardMissing: AuditRule = {
  id: 'metadata.twitter-card.missing',
  version: '1.0.0',
  name: 'Twitter/X card meta not detected',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects content pages without Twitter Card meta tags for X / Twitter share previews.',
  whyItMatters:
    'Without twitter:card, X/Twitter falls back to summary card with weak preview vs summary_large_image.',
  recommendationTemplate:
    'Add <meta name="twitter:card" content="summary_large_image"> + twitter:title / image.',
  defaultSeverity: 'low',
  defaultImpact: 10,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.pageRole === 'utility' || page.pageRole === 'legal')
      return notApplicable('page-role-mismatch');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const tw = page.twitter ?? {};
    const card = tw.card;
    const image = tw.image;
    if (card && image) {
      return { status: 'pass', severity: 'info', title: 'twitter:card present' };
    }
    const missing: string[] = [];
    if (!card) missing.push('twitter:card');
    if (!image) missing.push('twitter:image');
    return {
      status: 'opportunity',
      severity: 'low',
      title: `Twitter card meta missing (${missing.join(', ')})`,
      observed: `Detected twitter meta keys: ${Object.keys(tw).join(', ') || 'none'}.`,
      whyItMatters: 'Without twitter:card + twitter:image, X falls back to weak preview.',
      recommendation:
        'Add <meta name="twitter:card" content="summary_large_image"> + twitter:title / image.',
      howToFix:
        '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="…/og-cover.png">',
      evidence: { twitterKeys: Object.keys(tw), missing, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.95,
      confidenceLevel: 'high',
      impactScore: 10,
      effortEstimate: 'small',
      validationMethod: 'Re-crawl + confirm twitter:card meta extracted.',
    };
  },
};

export const securitySocialRules: AuditRule[] = [notHttps, mixedContent, twitterCardMissing];
