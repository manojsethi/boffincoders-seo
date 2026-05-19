import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule } from '../types';

/**
 * Generic / placeholder alt text (e.g. "image", "photo", "img_1234.jpg").
 */
const imageGenericAlt: AuditRule = {
  id: 'images.alt-text.generic',
  version: '1.0.0',
  name: 'Generic / placeholder alt text',
  category: 'images',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description:
    'Detects images with alt text that is a filename, "image", "photo", or other non-descriptive placeholder.',
  whyItMatters:
    'Placeholder alt text helps neither accessibility nor image search. Empty or filename alt is treated as missing.',
  recommendationTemplate: 'Replace placeholder alt text with a concise descriptive sentence.',
  defaultSeverity: 'low',
  defaultImpact: 15,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.images'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.images.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const generic = page.images.filter((i) => {
      const alt = (i.alt ?? '').trim().toLowerCase();
      if (!alt) return false;
      if (/^(image|photo|picture|img|graphic|icon)\s*\d*$/.test(alt)) return true;
      if (/\.(jpe?g|png|webp|gif|svg)$/i.test(alt)) return true;
      if (alt.length < 5) return true;
      return false;
    });
    if (generic.length === 0)
      return { status: 'pass', severity: 'info', title: 'Alt text descriptive enough' };
    return {
      status: 'warning',
      severity: 'low',
      title: `${generic.length}/${page.images.length} images have generic alt`,
      observed: `Sample placeholder alts: ${generic
        .slice(0, 3)
        .map((g) => `"${(g.alt ?? '').slice(0, 30)}"`)
        .join(', ')}`,
      whyItMatters: 'Generic alt text fails accessibility AND image search.',
      recommendation: 'Replace each with a concise, descriptive alt that conveys image content + context.',
      evidence: { genericCount: generic.length, totalImages: page.images.length },
      evidenceSources: ['crawl'],
      confidence: 0.9,
      confidenceLevel: 'high',
      impactScore: Math.min(40, generic.length * 4),
      effortEstimate: 'small',
    };
  },
};

/**
 * Heavy image count without aspect: many <img> without dimensions slows LCP.
 * Opportunity-style — actual perf data lives in Phase D.
 */
const imagesOnPage: AuditRule = {
  id: 'images.payload.heavy',
  version: '1.0.0',
  name: 'Many images on page (potential LCP risk)',
  category: 'images',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description:
    'Detects pages with a high number of <img> tags. Without lazy-loading + dimensions, this risks LCP/CLS.',
  whyItMatters: 'Image-heavy pages without optimization hurt Core Web Vitals and ranking on mobile.',
  recommendationTemplate:
    'Confirm lazy-loading, explicit dimensions, and next-gen image format on each image.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.images'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.images.length < 25) return notApplicable('other', 'image count below threshold');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    return {
      status: 'opportunity',
      severity: 'low',
      title: `${page.images.length} images on page — verify optimization`,
      observed: `${page.images.length} <img> tags extracted.`,
      whyItMatters: 'Heavy image use without optimization hurts CWV + mobile rank.',
      recommendation:
        'Audit: lazy-loading, explicit width/height, AVIF/WebP, responsive srcset, CDN.',
      evidence: { imageCount: page.images.length, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.7,
      confidenceLevel: 'medium',
      impactScore: 25,
      effortEstimate: 'medium',
    };
  },
};

/**
 * Alt text too long (over 250 chars) — usually misuse (paragraph content).
 */
const imageAltTooLong: AuditRule = {
  id: 'images.alt-text.too-long',
  version: '1.0.0',
  name: 'Image alt text too long',
  category: 'images',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects images with alt text exceeding 250 characters.',
  whyItMatters:
    'Excessively long alt text is treated as spammy + slows screen-reader navigation.',
  recommendationTemplate: 'Trim alt to under 125 chars; move descriptive prose to a caption.',
  defaultSeverity: 'low',
  defaultImpact: 10,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.images'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.images.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const longs = page.images.filter((i) => (i.alt ?? '').length > 250);
    if (longs.length === 0) return { status: 'pass', severity: 'info', title: 'Alt lengths OK' };
    return {
      status: 'warning',
      severity: 'low',
      title: `${longs.length} image(s) have overly long alt text`,
      observed: `Sample alt length: ${longs[0]!.alt!.length} chars.`,
      whyItMatters: 'Long alt text is treated as spammy + harms screen-reader UX.',
      recommendation: 'Trim alt to under 125 chars; use captions for long descriptions.',
      evidence: { longCount: longs.length, sample: longs[0]!.alt?.slice(0, 200) },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 10,
      effortEstimate: 'trivial',
    };
  },
};

export const imageRules: AuditRule[] = [imageGenericAlt, imagesOnPage, imageAltTooLong];
