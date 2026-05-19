import { APPLIES, isImportantPage, notApplicable } from '../applicability';
import type { AuditRule } from '../types';

const TITLE_MIN = 25;
const TITLE_MAX = 65;
const META_MIN = 70;
const META_MAX = 160;

/**
 * Metadata: title length / presence. Title is universal — applies to every indexable page.
 */
const titleRule: AuditRule = {
  id: 'metadata.title.missing-or-bad-length',
  version: '1.0.0',
  name: 'Title is missing or wrong length',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose <title> is empty, too short, or too long for SERP usefulness.',
  whyItMatters:
    'Titles are a primary ranking and click-through factor. Empty or off-length titles weaken SERP performance.',
  recommendationTemplate: 'Write a unique, descriptive title between 25 and 65 characters.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other', 'page returns error status');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const title = (page.title ?? '').trim();
    if (title.length >= TITLE_MIN && title.length <= TITLE_MAX) {
      return { status: 'pass', severity: 'info', title: 'Title length OK' };
    }
    const isMissing = title.length === 0;
    const isLong = title.length > TITLE_MAX;
    return {
      status: 'fail',
      severity: isMissing ? 'high' : isLong ? 'low' : 'medium',
      title: isMissing ? 'Missing <title>' : isLong ? 'Title too long' : 'Title too short',
      observed: isMissing ? 'No <title> tag content.' : `Title length: ${title.length} chars.`,
      whyItMatters:
        'Titles are a primary ranking and click-through factor. Empty or off-length titles weaken SERP performance.',
      recommendation: 'Write a unique, descriptive title 25-65 characters.',
      howToFix: 'Update the page <title> in your CMS or template head.',
      evidence: { titleLength: title.length, sample: title.slice(0, 80) },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: isMissing ? 80 : 50,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Metadata: meta description.
 */
const metaDescRule: AuditRule = {
  id: 'metadata.meta-description.missing-or-bad-length',
  version: '1.0.0',
  name: 'Meta description is missing or wrong length',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose meta description is empty, too short, or too long.',
  whyItMatters: 'Meta descriptions influence click-through from search results.',
  recommendationTemplate: 'Write a meta description 70-160 characters that matches the page intent.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const md = (page.metaDescription ?? '').trim();
    if (md.length >= META_MIN && md.length <= META_MAX) return { status: 'pass', severity: 'info', title: 'Meta description OK' };
    const isMissing = md.length === 0;
    return {
      status: 'fail',
      severity: isMissing ? 'medium' : 'low',
      title: isMissing ? 'Missing meta description' : `Meta description ${md.length < META_MIN ? 'too short' : 'too long'}`,
      observed: isMissing ? 'No <meta name="description">.' : `Length: ${md.length} chars.`,
      whyItMatters: 'Meta descriptions drive click-through from search results.',
      recommendation: 'Write a meta description 70-160 characters.',
      howToFix: 'Add or edit the meta description in the page <head>.',
      evidence: { length: md.length, sample: md.slice(0, 160) },
      evidenceSources: ['crawl'],
      confidence: 1,
      impactScore: isMissing ? 40 : 25,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Headings: H1 missing or multiple. Doc 11 §"Headings And Content".
 */
const h1Rule: AuditRule = {
  id: 'headings.h1.missing-or-multiple',
  version: '1.0.0',
  name: 'H1 missing or multiple H1s',
  category: 'headings',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'content-relevance',
  description: 'Detects pages missing an H1 or with multiple conflicting H1 tags.',
  whyItMatters: 'A single descriptive H1 improves topical clarity and accessibility.',
  recommendationTemplate: 'Use exactly one H1 that reflects the page topic.',
  defaultSeverity: 'medium',
  defaultImpact: 35,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.headings'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const h1s = page.headings.filter((h) => h.level === 1);
    if (h1s.length === 1 && h1s[0]!.text.trim().length > 0) return { status: 'pass', severity: 'info', title: 'Single H1 present' };
    const isMissing = h1s.length === 0;
    return {
      status: 'fail',
      severity: isMissing ? 'medium' : 'low',
      title: isMissing ? 'Missing H1' : `${h1s.length} H1 tags on page`,
      observed: isMissing ? 'No <h1> found.' : `Found ${h1s.length} H1 tags.`,
      whyItMatters: 'A single descriptive H1 improves topical clarity for search engines and accessibility.',
      recommendation: 'Use exactly one H1 that reflects the page topic.',
      howToFix: 'Convert duplicate H1s to H2 or remove. Add an H1 if missing.',
      evidence: { h1Count: h1s.length, h1Samples: h1s.slice(0, 3).map((h) => h.text) },
      evidenceSources: ['crawl'],
      confidence: 1,
      impactScore: isMissing ? 50 : 25,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Images: missing alt text. Not applicable when page has no images.
 */
const imageAltRule: AuditRule = {
  id: 'images.alt-text.missing',
  version: '1.0.0',
  name: 'Images missing alt text',
  category: 'images',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages where content images lack descriptive alt attributes.',
  whyItMatters: 'Alt text supports accessibility and image search ranking.',
  recommendationTemplate: 'Add descriptive alt text to all content images.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.images'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.images.length === 0) return notApplicable('other', 'no images on page');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const total = page.images.length;
    const missing = page.images.filter((i) => !i.alt || i.alt.trim().length === 0).length;
    if (missing === 0) return { status: 'pass', severity: 'info', title: 'All images have alt text' };
    const pct = Math.round((missing / total) * 100);
    return {
      status: 'fail',
      severity: pct > 50 ? 'medium' : 'low',
      title: `${missing}/${total} images missing alt text`,
      observed: `${pct}% of images lack alt attributes.`,
      whyItMatters: 'Alt text supports accessibility and image search ranking.',
      recommendation: 'Add descriptive alt text to all content images.',
      howToFix: 'In your CMS, edit each image and provide concise alt text describing the image content.',
      evidence: { missingCount: missing, totalCount: total, percent: pct },
      evidenceSources: ['crawl'],
      confidence: 1,
      impactScore: Math.min(60, pct),
      effortEstimate: 'small',
    };
  },
};

/**
 * Title equals H1 verbatim — anti-pattern that wastes title real estate.
 */
const titleEqualsH1: AuditRule = {
  id: 'metadata.title.equals-h1',
  version: '1.0.0',
  name: 'Title equals H1 verbatim',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages where <title> is identical to the H1.',
  whyItMatters:
    'Title and H1 serve different roles. Identical content wastes SERP real estate and skips intent matching.',
  recommendationTemplate:
    'Differentiate title (SERP-facing + brand) from H1 (page-facing + topical).',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.headings'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.title || !page.h1) return notApplicable('other', 'missing title or h1');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const t = (page.title ?? '').trim().toLowerCase();
    const h = (page.h1 ?? '').trim().toLowerCase();
    if (t !== h) return { status: 'pass', severity: 'info', title: 'Title differs from H1' };
    return {
      status: 'warning',
      severity: 'low',
      title: 'Title and H1 are identical',
      observed: `Title and H1 both equal: "${page.title}"`,
      whyItMatters:
        'Differentiating title from H1 lets you target SERP CTR and on-page topic separately.',
      recommendation: 'Rewrite title to lead with primary keyword + brand, keep H1 as topical hook.',
      evidence: { title: page.title, h1: page.h1 },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 15,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Open Graph image missing — affects social sharing CTR.
 */
const ogImageMissing: AuditRule = {
  id: 'metadata.og.image-missing',
  version: '1.0.0',
  name: 'Open Graph image missing',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages without og:image, which controls how the URL renders in social previews.',
  whyItMatters: 'Without og:image, social sharing previews fall back to generic thumbnails and lose CTR.',
  recommendationTemplate:
    'Add <meta property="og:image"> pointing to a 1200×630 representative image.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    if (page.pageRole === 'utility' || page.pageRole === 'legal') return notApplicable('page-role-mismatch');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const ogImage = page.openGraph?.image;
    if (ogImage && ogImage.length > 0) {
      return { status: 'pass', severity: 'info', title: 'og:image present' };
    }
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Open Graph image missing',
      observed: 'No <meta property="og:image"> on page.',
      whyItMatters: 'Without og:image, social/Slack/Discord previews fall back to favicon or weak content image.',
      recommendation: 'Add og:image meta pointing to a 1200×630 representative image.',
      howToFix: '<meta property="og:image" content="…/og-cover.png" />',
      evidence: {
        ogKeys: Object.keys(page.openGraph ?? {}),
        firstContentImage: page.images[0]?.src,
        pageRole: page.pageRole,
      },
      evidenceSources: ['crawl'],
      confidence: 0.95,
      confidenceLevel: 'high',
      impactScore: 15,
      effortEstimate: 'small',
      validationMethod: 'Re-crawl + confirm og:image meta extracted.',
    };
  },
};

/**
 * Headings: skipped levels (H1 then H3 with no H2 in between).
 * Lighthouse-style accessibility / structure check.
 */
const headingsSkip: AuditRule = {
  id: 'headings.hierarchy.skip',
  version: '1.0.0',
  name: 'Heading levels skip',
  category: 'headings',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'content-relevance',
  description:
    'Detects pages whose heading hierarchy skips levels (e.g. H1 → H3 with no H2).',
  whyItMatters:
    'Logical heading order helps assistive tech and signals topic structure to crawlers.',
  recommendationTemplate: 'Re-order headings so levels descend by one at a time.',
  defaultSeverity: 'low',
  defaultImpact: 15,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.headings'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.headings.length < 3) return notApplicable('other', 'not enough headings to assess');
    return APPLIES;
  },
  evaluatePage({ page }) {
    let prev = page.headings[0]!.level;
    let skipped: Array<{ from: number; to: number; text: string }> = [];
    for (let i = 1; i < page.headings.length; i++) {
      const cur = page.headings[i]!;
      if (cur.level > prev + 1) skipped.push({ from: prev, to: cur.level, text: cur.text });
      prev = cur.level;
    }
    if (skipped.length === 0) {
      return { status: 'pass', severity: 'info', title: 'Heading order clean' };
    }
    return {
      status: 'warning',
      severity: 'low',
      title: `${skipped.length} heading level jump${skipped.length > 1 ? 's' : ''}`,
      observed: `e.g. H${skipped[0]!.from} → H${skipped[0]!.to} at "${skipped[0]!.text.slice(0, 60)}"`,
      whyItMatters: 'Heading skip patterns hurt accessibility and confuse topical hierarchy.',
      recommendation: 'Adjust subsection headings so levels step by one (H2 → H3, not H2 → H4).',
      evidence: { skips: skipped.slice(0, 5), totalHeadings: page.headings.length },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 10,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Lang attribute missing on <html>. Important for international + accessibility.
 */
const langMissing: AuditRule = {
  id: 'accessibility-seo.lang-missing',
  version: '1.0.0',
  name: 'HTML lang attribute missing',
  category: 'accessibility-seo',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages whose <html> tag lacks a lang attribute.',
  whyItMatters: 'lang signals language to screen readers + Google language detection.',
  recommendationTemplate: 'Add <html lang="en"> (or appropriate language code).',
  defaultSeverity: 'low',
  defaultImpact: 15,
  defaultEffort: 'trivial',
  defaultValidationMethod: 'Re-crawl this URL + confirm html lang attribute present.',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const lang = (page.lang ?? '').trim();
    if (lang.length > 0) return { status: 'pass', severity: 'info', title: 'lang attribute present' };
    return {
      status: 'warning',
      severity: 'low',
      title: 'HTML lang attribute missing',
      observed: 'No lang attribute on <html>.',
      whyItMatters: 'Screen readers + search engines rely on lang for language detection.',
      recommendation: 'Add <html lang="en"> matching the primary content language.',
      evidence: { lang: page.lang ?? null },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 15,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * og:title differs significantly from title — usually a misconfigured CMS template.
 */
const ogTitleMismatch: AuditRule = {
  id: 'metadata.og.title-mismatch',
  version: '1.0.0',
  name: 'og:title differs from page title',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages where og:title text differs significantly from <title>.',
  whyItMatters:
    'og:title controls social preview headlines. Big drift from <title> hurts brand consistency.',
  recommendationTemplate: 'Align og:title with <title> unless intentionally optimizing for social CTR.',
  defaultSeverity: 'low',
  defaultImpact: 10,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.title || !page.openGraph?.title) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const a = (page.title ?? '').trim().toLowerCase();
    const b = (page.openGraph?.title ?? '').trim().toLowerCase();
    if (a === b) return { status: 'pass', severity: 'info', title: 'og:title matches title' };
    // Lightweight similarity: shared prefix length / longest length.
    const longer = Math.max(a.length, b.length);
    let common = 0;
    while (common < Math.min(a.length, b.length) && a[common] === b[common]) common++;
    const ratio = longer === 0 ? 1 : common / longer;
    if (ratio > 0.6) return { status: 'pass', severity: 'info', title: 'og:title similar enough' };
    return {
      status: 'warning',
      severity: 'low',
      title: 'og:title differs from <title>',
      observed: `<title>: "${page.title}"\nog:title: "${page.openGraph.title}"`,
      whyItMatters: 'Inconsistent titles between SERP and social preview confuse readers.',
      recommendation: 'Align og:title with <title> unless intentionally differing for social CTR.',
      evidence: { title: page.title, ogTitle: page.openGraph.title, similarity: ratio },
      evidenceSources: ['crawl'],
      confidence: 0.85,
      confidenceLevel: 'medium',
      impactScore: 10,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Brand-only title (e.g. "Acme Inc." with no topic). Wastes title real estate on non-home pages.
 */
const titleBrandOnly: AuditRule = {
  id: 'metadata.title.brand-only',
  version: '1.0.0',
  name: 'Title is brand-only (no page topic)',
  category: 'metadata',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects non-home pages whose title is short enough to be brand-only with no topical keywords.',
  whyItMatters:
    'Title without page-specific topic loses CTR + ranking. SERP can\'t differentiate from other pages.',
  recommendationTemplate: 'Write a page-specific title that includes the primary topic + brand.',
  defaultSeverity: 'medium',
  defaultImpact: 40,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole === 'home') return notApplicable('page-role-mismatch');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    const title = (page.title ?? '').trim();
    if (title.length === 0 || title.length > 35) return notApplicable('other', 'title too long to be brand-only');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const t = (page.title ?? '').trim();
    // No separator + short = likely brand only.
    const hasSeparator = /[|·•:\-—]/.test(t);
    if (hasSeparator || t.split(/\s+/).length > 4) {
      return { status: 'pass', severity: 'info', title: 'Title appears to include topic' };
    }
    return {
      status: 'warning',
      severity: 'medium',
      title: 'Title looks brand-only on non-home page',
      observed: `Title: "${t}". No separator, ${t.split(/\s+/).length} words.`,
      whyItMatters: 'Page-specific titles drive CTR + topical match.',
      recommendation: 'Rewrite title to include the page topic + brand, e.g. "Primary topic — Brand".',
      evidence: { title: t, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.7,
      confidenceLevel: 'medium',
      impactScore: 35,
      effortEstimate: 'trivial',
    };
  },
};

export const onPageRules: AuditRule[] = [
  titleRule,
  metaDescRule,
  h1Rule,
  imageAltRule,
  titleEqualsH1,
  ogImageMissing,
  headingsSkip,
  langMissing,
  ogTitleMismatch,
  titleBrandOnly,
];

// Re-export single-rule for tests / overrides
export { titleRule, metaDescRule, h1Rule, imageAltRule };
// keep isImportantPage referenced to satisfy potential future tuning
void isImportantPage;
