import { APPLIES, notApplicable, needsReview, pageRoleConfidenceIsLow } from '../applicability';
import type { AuditRule } from '../types';

const CONTENT_ROLES = ['content-article', 'product', 'documentation'];

/**
 * Thin content — doc 11 §"Example 3: Thin Content". Page-role-aware. Does not apply to
 * contact, legal, utility, navigation, login pages.
 */
const thinContent: AuditRule = {
  id: 'content-quality.thin-content',
  version: '1.0.0',
  name: 'Thin content on intent-heavy page',
  category: 'content-quality',
  layer: 'content-relevance',
  pack: 'core',
  scoresInto: 'content-relevance',
  description: 'Detects pages with insufficient useful information for the inferred page intent.',
  whyItMatters: 'Thin content struggles to rank and provides little value to readers or AI engines.',
  recommendationTemplate: 'Expand the page to fully cover the topic for its inferred intent.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.markdown'],
  scope: 'page',
  appliesTo({ page }) {
    if (!CONTENT_ROLES.includes(page.pageRole)) return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page))
      return needsReview('page role uncertain — review whether the page should have substantive content');
    if (page.markdown.length === 0 && page.cleanText.length === 0) return notApplicable('other', 'no content extracted');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.wordCount >= 300) {
      return { status: 'pass', severity: 'info', title: 'Content depth OK' };
    }
    const isVeryThin = page.wordCount < 100;
    return {
      status: 'fail',
      severity: isVeryThin ? 'high' : 'medium',
      title: isVeryThin ? 'Very thin content' : 'Thin content',
      observed: `Word count: ${page.wordCount}`,
      whyItMatters:
        'Thin content struggles to rank and provides little value to readers or AI engines.',
      recommendation:
        'Add depth that satisfies the page intent: definitions, examples, FAQs, comparison tables, evidence.',
      howToFix:
        'Expand the body to cover who the page is for, what problem it solves, proof, process, FAQs, related internal links, and a next action.',
      evidence: { wordCount: page.wordCount, role: page.pageRole },
      evidenceSources: ['page-content'],
      confidence: 0.8,
      confidenceLevel: 'medium',
      impactScore: isVeryThin ? 65 : 35,
      effortEstimate: 'medium',
    };
  },
};

/**
 * Direct answer / lead paragraph for AEO. Opportunity-style.
 */
const missingDirectAnswer: AuditRule = {
  id: 'content-quality.aeo.missing-direct-answer',
  version: '1.0.0',
  name: 'No direct answer / lead paragraph',
  category: 'aeo',
  layer: 'ai-visibility',
  pack: 'ai-visibility',
  scoresInto: 'ai-visibility',
  description:
    'Detects content pages whose opening paragraph does not contain a clear direct answer for AI citation.',
  whyItMatters:
    'AI Overviews + Perplexity prefer pages that answer the query directly in the first 2-3 sentences.',
  recommendationTemplate:
    'Open with a clear 2-3 sentence direct answer to the page\'s primary query.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.markdown'],
  scope: 'page',
  appliesTo({ page }) {
    if (!CONTENT_ROLES.includes(page.pageRole)) return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('page role uncertain for direct-answer applicability');
    if (page.markdown.length === 0) return notApplicable('other', 'no markdown');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const md = page.markdown;
    const lead = extractLead(md);
    const wordCount = lead.split(/\s+/).filter(Boolean).length;
    // Heuristic: a lead paragraph should be 30-120 words and end with a period.
    if (wordCount >= 30 && wordCount <= 160) {
      return { status: 'pass', severity: 'info', title: 'Lead paragraph present' };
    }
    return {
      status: 'opportunity',
      severity: 'low',
      title: wordCount < 30 ? 'Lead paragraph too short' : 'No direct-answer lead detected',
      observed: `Detected lead paragraph word count: ${wordCount}.`,
      whyItMatters:
        'AI engines extract answers from the first content paragraph. A weak or missing lead reduces AI citation chance.',
      recommendation:
        'Add a 30-120 word opening paragraph that directly answers the page\'s primary query.',
      howToFix:
        'Lead with: who this page is for, what they need, and the direct answer/value in 2-3 sentences.',
      evidence: { leadWordCount: wordCount, leadSample: lead.slice(0, 200), pageRole: page.pageRole },
      evidenceSources: ['page-content'],
      confidence: 0.65,
      confidenceLevel: 'medium',
      impactScore: 25,
      effortEstimate: 'small',
    };
  },
};

/**
 * Updated/published date in markdown for E-E-A-T + GEO. Opportunity-style on articles only.
 */
const updatedDateMissing: AuditRule = {
  id: 'content-quality.geo.updated-date-missing',
  version: '1.0.0',
  name: 'No updated / published date visible',
  category: 'geo',
  layer: 'ai-visibility',
  pack: 'ai-visibility',
  scoresInto: 'ai-visibility',
  description:
    'Detects article-style pages that do not surface a visible publication or update date.',
  whyItMatters:
    'Freshness signal helps E-E-A-T, GEO, and AI engines that prefer recent answers.',
  recommendationTemplate:
    'Show a "Last updated" or "Published" date near the title.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.markdown'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'content-article') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('article role low confidence');
    if (page.markdown.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const text = page.markdown.toLowerCase();
    const has = /\b(updated|published|posted|written)\b[^\n]{0,40}\b(20\d{2}|19\d{2})/.test(text)
      || /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+20\d{2}\b/.test(text);
    if (has) return { status: 'pass', severity: 'info', title: 'Date present in content' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Article date not detected',
      observed: 'No "Updated" / "Published" date phrase found in extracted content.',
      whyItMatters:
        'Articles without a visible date are penalized by E-E-A-T and skipped by some AI engines.',
      recommendation:
        'Display a "Last updated YYYY-MM-DD" date near the title on article templates.',
      evidence: { pageRole: page.pageRole, wordCount: page.wordCount },
      evidenceSources: ['page-content'],
      confidence: 0.6,
      confidenceLevel: 'medium',
      impactScore: 15,
      effortEstimate: 'small',
    };
  },
};

/**
 * Page has no next-action / CTA — commercial pages only.
 */
const ctaMissing: AuditRule = {
  id: 'conversion.cta-missing',
  version: '1.0.0',
  name: 'Conversion page lacks visible CTA',
  category: 'conversion',
  layer: 'business-outcomes',
  pack: 'business-goal',
  scoresInto: 'conversion-readiness',
  description:
    'Detects commercial / pricing / product pages that do not surface a clear next-action.',
  whyItMatters:
    'Without a clear CTA, traffic does not convert. SEO investment leaks at the bottom of the funnel.',
  recommendationTemplate:
    'Add a primary CTA above the fold and repeat at the end of content.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.markdown'],
  scope: 'page',
  appliesTo({ page }) {
    const commercial = ['pricing', 'product', 'collection'];
    if (!commercial.includes(page.pageRole)) return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('commercial role low confidence');
    if (page.markdown.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const text = page.markdown.toLowerCase();
    const cues = [
      'get started',
      'sign up',
      'sign-up',
      'buy now',
      'add to cart',
      'request a quote',
      'request quote',
      'book a',
      'schedule',
      'contact sales',
      'try free',
      'free trial',
      'book demo',
      'request demo',
    ];
    const hit = cues.find((c) => text.includes(c));
    if (hit) return { status: 'pass', severity: 'info', title: 'CTA detected' };
    return {
      status: 'warning',
      severity: 'medium',
      title: 'No clear next-action on commercial page',
      observed: 'No common CTA phrases found in extracted content.',
      whyItMatters:
        'Commercial pages without a CTA leak SEO traffic instead of converting it.',
      recommendation:
        'Add a clear primary CTA (book, buy, request) above the fold and at the end.',
      evidence: { pageRole: page.pageRole, sample: page.markdown.slice(0, 200) },
      evidenceSources: ['page-content'],
      confidence: 0.7,
      confidenceLevel: 'medium',
      impactScore: 45,
      effortEstimate: 'small',
    };
  },
};

function extractLead(md: string): string {
  const paras = md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('!') && !p.startsWith('|') && !p.startsWith('-'));
  return (paras[0] ?? '').slice(0, 800);
}

/**
 * Article role with no author byline — E-E-A-T concern.
 */
const authorBylineMissing: AuditRule = {
  id: 'eeat.article.author-byline-missing',
  version: '1.0.0',
  name: 'Article has no visible author byline',
  category: 'eeat',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects article-style pages that do not surface a visible author or "by" attribution.',
  whyItMatters:
    'E-E-A-T expects expert content to credit identifiable authors. Missing byline weakens trust.',
  recommendationTemplate:
    'Add a visible "By <Name>" near the title + link to author page or schema.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.markdown'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'content-article') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('article role low confidence');
    if (page.markdown.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const text = page.markdown.toLowerCase();
    const hasByline = /\bby\s+[a-z][a-z .'-]{2,40}/.test(text) || /written by/.test(text) || /author/.test(text);
    if (hasByline) return { status: 'pass', severity: 'info', title: 'Author byline detected' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'No visible author byline',
      observed: 'No "by", "written by", or "author" phrase detected in content.',
      whyItMatters: 'E-E-A-T expects authored articles to credit identifiable authors.',
      recommendation: 'Display "By <Name>" near the title + add Person/author schema.',
      evidence: { pageRole: page.pageRole, sample: page.markdown.slice(0, 200) },
      evidenceSources: ['page-content'],
      confidence: 0.7,
      confidenceLevel: 'medium',
      impactScore: 20,
      effortEstimate: 'small',
    };
  },
};

/**
 * Heading too long — over 100 chars on H1 or H2 hurts readability + AI extraction.
 */
const headingTooLong: AuditRule = {
  id: 'headings.too-long',
  version: '1.0.0',
  name: 'Heading text is too long',
  category: 'headings',
  layer: 'content-relevance',
  pack: 'core',
  scoresInto: 'content-relevance',
  description: 'Detects H1/H2 headings over 100 characters.',
  whyItMatters:
    'Long headings hurt readability + scannability. AI engines extract shorter, clearer headings.',
  recommendationTemplate: 'Rewrite headings to <80 chars; lead with topic.',
  defaultSeverity: 'low',
  defaultImpact: 10,
  defaultEffort: 'trivial',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.headings'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.headings.length === 0) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const longs = page.headings.filter((h) => (h.level === 1 || h.level === 2) && h.text.length > 100);
    if (longs.length === 0)
      return { status: 'pass', severity: 'info', title: 'Heading lengths OK' };
    return {
      status: 'warning',
      severity: 'low',
      title: `${longs.length} long heading(s)`,
      observed: `Sample: "${longs[0]!.text.slice(0, 120)}…"`,
      whyItMatters: 'Long headings hurt scannability and AI engine extraction.',
      recommendation: 'Trim H1/H2 to <80 chars + lead with topic keyword.',
      evidence: { longHeadingCount: longs.length, samples: longs.slice(0, 3).map((h) => h.text) },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 10,
      effortEstimate: 'trivial',
    };
  },
};

/**
 * Article with no internal links to related pages — content silo / cluster opportunity.
 */
const articleNoInternalLinks: AuditRule = {
  id: 'content-quality.article-no-related-links',
  version: '1.0.0',
  name: 'Article has no internal links to related content',
  category: 'content-quality',
  layer: 'content-relevance',
  pack: 'core',
  scoresInto: 'content-relevance',
  description:
    'Detects content-article pages with zero outgoing internal links — breaks content clustering.',
  whyItMatters:
    'Articles without related-link callouts trap users and waste cluster equity.',
  recommendationTemplate:
    'Link to 2-3 related articles + the parent topic hub.',
  defaultSeverity: 'low',
  defaultImpact: 20,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['page.internal-links'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'content-article') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('article role low confidence');
    return APPLIES;
  },
  evaluatePage({ page }) {
    if (page.internalLinksOut.length >= 2) {
      return { status: 'pass', severity: 'info', title: 'Article links onward' };
    }
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Article has no related internal links',
      observed: `internalLinksOut: ${page.internalLinksOut.length}`,
      whyItMatters: 'Articles without contextual related links break topic clusters.',
      recommendation: 'Add 2-3 contextual links to related articles + parent hub.',
      evidence: { internalLinksOut: page.internalLinksOut.length, pageRole: page.pageRole },
      evidenceSources: ['internal-links'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: 20,
      effortEstimate: 'small',
    };
  },
};

export const contentQualityRules: AuditRule[] = [
  thinContent,
  missingDirectAnswer,
  updatedDateMissing,
  ctaMissing,
  authorBylineMissing,
  headingTooLong,
  articleNoInternalLinks,
];
