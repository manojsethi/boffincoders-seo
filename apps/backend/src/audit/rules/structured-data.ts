import { APPLIES, notApplicable, needsReview, pageRoleConfidenceIsLow } from '../applicability';
import type { AuditRule, PageView } from '../types';

/**
 * Compute combined schema-presence facts from raw + rendered.
 * Doc 11 §"Raw Vs Rendered Evidence" — schema rules must NOT fail on Cheerio-only absence.
 */
function schemaFacts(page: PageView): {
  hasAny: boolean;
  hasRaw: boolean;
  hasRendered: boolean;
  renderedRan: boolean;
  types: Set<string>;
  source: string;
} {
  const raw = page.rawSchema ?? [];
  const rendered = page.renderedSchema ?? [];
  const types = new Set<string>(page.schemaTypes ?? []);
  return {
    hasAny: raw.length > 0 || rendered.length > 0,
    hasRaw: raw.length > 0,
    hasRendered: rendered.length > 0,
    renderedRan: !!page.renderedExtractedAt,
    types,
    source: page.schemaSource,
  };
}

/**
 * JSON-LD presence. Doc 11: do not create hard missing-schema issues from Cheerio-only absence.
 * Return not_verified until rendered extraction has run.
 */
const jsonLdMissing: AuditRule = {
  id: 'structured-data.jsonld.missing',
  version: '1.1.0',
  name: 'No structured data on page',
  category: 'structured-data',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects indexable pages with no JSON-LD structured data.',
  whyItMatters: 'Schema unlocks rich results and AI Overview citations on suitable pages.',
  recommendationTemplate: 'Add JSON-LD appropriate to the page role (Article, Product, FAQ, Org).',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    if (page.statusCode && page.statusCode >= 400) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const facts = schemaFacts(page);
    if (facts.hasAny) {
      return { status: 'pass', severity: 'info', title: 'Schema present' };
    }
    if (!facts.renderedRan) {
      // No raw schema, rendered verification has not run. Doc 11: not_verified, not fail.
      return {
        status: 'not_verified',
        severity: 'info',
        title: 'Schema presence not verified',
        observed: 'No JSON-LD in raw HTML. Rendered (Playwright) verification has not run.',
        notVerifiedReason: 'schema-not-verified',
        evidence: {
          schemaSource: facts.source,
          rawSchemaCount: 0,
          renderedRan: false,
          source: 'raw-html',
        },
        evidenceSources: ['crawl'],
        confidence: 0.95,
        confidenceLevel: 'high',
      };
    }
    // Rendered ran and still no schema → opportunity (Doc 11 schema rule is opportunity-style).
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Add structured data',
      observed:
        'No <script type="application/ld+json"> found in raw or rendered HTML. Rendered verification ran at ' +
        (page.renderedExtractedAt?.toISOString() ?? 'unknown') +
        '.',
      whyItMatters: 'Schema markup unlocks rich results and AI Overview citations.',
      recommendation:
        'Add JSON-LD appropriate for the page role (Article, Product, FAQ, Organization).',
      howToFix: 'Inject JSON-LD via your CMS, framework, or schema plugin.',
      evidence: {
        schemaSource: facts.source,
        rawSchemaCount: 0,
        renderedSchemaCount: 0,
        renderedRan: true,
        renderedExtractedAt: page.renderedExtractedAt,
        source: 'rendered-html',
        pageRole: page.pageRole,
      },
      evidenceSources: ['crawl', 'rendered-html'],
      confidence: 0.9,
      confidenceLevel: 'high',
      impactScore: 25,
      effortEstimate: 'small',
    };
  },
};

/**
 * Organization / WebSite schema on home page. Page-role-aware.
 * Same raw-vs-rendered semantics — Doc 11.
 */
const orgWebsiteOnHome: AuditRule = {
  id: 'structured-data.org-or-website.missing-on-home',
  version: '1.1.0',
  name: 'Home page missing Organization / WebSite schema',
  category: 'structured-data',
  layer: 'trust-entity',
  pack: 'core',
  scoresInto: 'trust-entity',
  description: 'Detects home pages without Organization, WebSite, or LocalBusiness schema.',
  whyItMatters: 'These schemas help Google build the brand entity and knowledge panel.',
  recommendationTemplate: 'Add Organization (or LocalBusiness) and WebSite JSON-LD to the home page.',
  defaultSeverity: 'medium',
  defaultImpact: 45,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'home') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('home page role inferred with low confidence');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const facts = schemaFacts(page);
    const trustTypes = ['Organization', 'WebSite', 'LocalBusiness'];
    const hasTrustType = trustTypes.some((t) => facts.types.has(t));

    if (hasTrustType) {
      return { status: 'pass', severity: 'info', title: 'Brand entity schema present' };
    }

    if (!facts.renderedRan && !facts.hasRaw) {
      return {
        status: 'not_verified',
        severity: 'info',
        title: 'Brand entity schema presence not verified',
        observed: 'No JSON-LD in raw HTML. Rendered (Playwright) verification has not run.',
        notVerifiedReason: 'schema-not-verified',
        evidence: {
          schemaSource: facts.source,
          detectedTypes: [...facts.types],
          renderedRan: false,
          source: 'raw-html',
        },
        evidenceSources: ['crawl'],
        confidence: 0.95,
        confidenceLevel: 'high',
      };
    }

    return {
      status: 'fail',
      severity: 'medium',
      title: 'Home page missing Organization / WebSite schema',
      observed: `Detected schema types: ${[...facts.types].join(', ') || 'none'}. Source: ${facts.source}.`,
      whyItMatters:
        'Organization/WebSite schema helps Google build a knowledge panel and brand entity.',
      recommendation: 'Add Organization (or LocalBusiness) and WebSite JSON-LD to the home page.',
      howToFix:
        'Include JSON-LD with @type Organization (name, url, logo, sameAs) and WebSite (potentialAction SearchAction).',
      evidence: {
        schemaSource: facts.source,
        detectedTypes: [...facts.types],
        renderedRan: facts.renderedRan,
        renderedExtractedAt: page.renderedExtractedAt,
        source: facts.hasRendered ? 'rendered-html' : facts.hasRaw ? 'raw-html' : 'none',
      },
      evidenceSources: facts.hasRendered ? ['crawl', 'rendered-html'] : ['crawl'],
      confidence: 1,
      impactScore: 45,
      effortEstimate: 'small',
    };
  },
};

/**
 * Schema parse errors detected. High signal — fix before adding more schema.
 */
const schemaParseErrors: AuditRule = {
  id: 'structured-data.parse-error',
  version: '1.0.0',
  name: 'Schema JSON-LD parse errors',
  category: 'structured-data',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects pages where JSON-LD blocks failed to parse.',
  whyItMatters:
    'Invalid JSON-LD is ignored by Google entirely and breaks rich result eligibility.',
  recommendationTemplate: 'Validate JSON-LD in https://search.google.com/test/rich-results.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.schemaParseErrors || page.schemaParseErrors.length === 0)
      return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    return {
      status: 'fail',
      severity: 'medium',
      title: `${page.schemaParseErrors.length} schema parse error(s)`,
      observed: page.schemaParseErrors.slice(0, 3).join(' | '),
      whyItMatters: 'Invalid JSON-LD is silently dropped — no rich result eligibility.',
      recommendation:
        'Validate every JSON-LD block via Rich Results test. Fix syntax / required fields.',
      howToFix:
        'Use a schema-generator library or validate via https://search.google.com/test/rich-results before deploy.',
      evidence: {
        parseErrors: page.schemaParseErrors.slice(0, 5),
        rawBlockCount: page.rawSchema.length,
        renderedBlockCount: page.renderedSchema.length,
      },
      evidenceSources: ['crawl'],
      confidence: 1,
      confidenceLevel: 'high',
      impactScore: 50,
      effortEstimate: 'small',
    };
  },
};

/**
 * Article schema missing on article-role pages. Opportunity-style.
 */
const articleSchemaMissing: AuditRule = {
  id: 'structured-data.article.missing',
  version: '1.0.0',
  name: 'Article schema missing on article page',
  category: 'structured-data',
  layer: 'ai-visibility',
  pack: 'ai-visibility',
  scoresInto: 'ai-visibility',
  description:
    'Detects content-article pages without Article / BlogPosting / NewsArticle schema.',
  whyItMatters: 'Article schema unlocks article rich results, AI Overview eligibility, and author context.',
  recommendationTemplate:
    'Add Article (or BlogPosting / NewsArticle) JSON-LD with headline, datePublished, dateModified, author.',
  defaultSeverity: 'low',
  defaultImpact: 30,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'content-article') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('article role inferred with low confidence');
    if (!page.schemaSource || page.schemaSource === 'not-verified') {
      return notApplicable('other', 'schema-not-verified path covers raw-only absence');
    }
    return APPLIES;
  },
  evaluatePage({ page }) {
    const articleTypes = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report'];
    const has = (page.schemaTypes ?? []).some((t) => articleTypes.includes(t));
    if (has) return { status: 'pass', severity: 'info', title: 'Article schema present' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'No Article schema on article page',
      observed: `Detected types: ${(page.schemaTypes ?? []).join(', ') || 'none'}.`,
      whyItMatters:
        'Article schema unlocks rich results + AI engine context (author, date, topic).',
      recommendation:
        'Add Article (or BlogPosting / NewsArticle) JSON-LD with headline, datePublished, dateModified, author.',
      evidence: {
        schemaTypes: page.schemaTypes ?? [],
        schemaSource: page.schemaSource,
        pageRole: page.pageRole,
      },
      evidenceSources: ['crawl'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: 30,
      effortEstimate: 'small',
    };
  },
};

/**
 * Breadcrumb schema missing on deep pages.
 */
const breadcrumbSchemaMissing: AuditRule = {
  id: 'structured-data.breadcrumb.missing-on-deep',
  version: '1.0.0',
  name: 'Breadcrumb schema missing on deep page',
  category: 'structured-data',
  layer: 'technical-foundation',
  pack: 'core',
  scoresInto: 'technical-foundation',
  description: 'Detects deep pages without BreadcrumbList schema.',
  whyItMatters: 'BreadcrumbList replaces URL in SERPs and helps Google understand hierarchy.',
  recommendationTemplate: 'Add BreadcrumbList JSON-LD reflecting the page hierarchy.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    const depth = breadcrumbDepth(page.normalizedUrl || page.url || '');
    if (depth < 2) return notApplicable('other', 'page is not deep enough');
    if (!page.schemaSource || page.schemaSource === 'not-verified') {
      return notApplicable('other', 'schema-not-verified covers this');
    }
    return APPLIES;
  },
  evaluatePage({ page }) {
    const has = (page.schemaTypes ?? []).includes('BreadcrumbList');
    if (has) return { status: 'pass', severity: 'info', title: 'Breadcrumb schema present' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Breadcrumb schema missing on deep page',
      observed: `URL depth: ${breadcrumbDepth(page.normalizedUrl || page.url || '')}. No BreadcrumbList detected.`,
      whyItMatters: 'BreadcrumbList renders nicer SERP UI and clarifies site structure.',
      recommendation: 'Add BreadcrumbList JSON-LD with itemListElement for each parent level.',
      evidence: { schemaTypes: page.schemaTypes ?? [], pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.8,
      confidenceLevel: 'medium',
      impactScore: 20,
      effortEstimate: 'small',
    };
  },
};

function breadcrumbDepth(u: string): number {
  try {
    const segs = new URL(u).pathname.split('/').filter(Boolean);
    return segs.length;
  } catch {
    return 0;
  }
}

/**
 * FAQ schema opportunity — page has FAQ-style content but no FAQPage schema.
 */
const faqSchemaOpportunity: AuditRule = {
  id: 'structured-data.faq.opportunity',
  version: '1.0.0',
  name: 'FAQ-style content without FAQPage schema',
  category: 'structured-data',
  layer: 'ai-visibility',
  pack: 'ai-visibility',
  scoresInto: 'ai-visibility',
  description:
    'Detects pages whose headings look like questions ("How", "What", "Why") without FAQPage schema.',
  whyItMatters:
    'FAQPage schema unlocks rich snippets + AI citation. Question-style content without it loses eligibility.',
  recommendationTemplate: 'Add FAQPage JSON-LD with each question + answer pair.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.headings', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.schemaSource || page.schemaSource === 'not-verified')
      return notApplicable('other', 'schema-not-verified covers this');
    if (page.headings.length < 3) return notApplicable('other');
    const questionish = page.headings.filter((h) =>
      /^(how|what|why|when|where|can|do|does|is|are)\b/i.test(h.text.trim()),
    );
    if (questionish.length < 3) return notApplicable('other', 'not enough question headings');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const hasFaq = (page.schemaTypes ?? []).includes('FAQPage');
    if (hasFaq) return { status: 'pass', severity: 'info', title: 'FAQPage schema present' };
    const questionCount = page.headings.filter((h) =>
      /^(how|what|why|when|where|can|do|does|is|are)\b/i.test(h.text.trim()),
    ).length;
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'FAQ-style content without FAQPage schema',
      observed: `${questionCount} question headings detected.`,
      whyItMatters: 'FAQPage schema unlocks rich results + AI citation.',
      recommendation: 'Wrap Q+A pairs in FAQPage JSON-LD.',
      evidence: { questionHeadingCount: questionCount, schemaTypes: page.schemaTypes ?? [] },
      evidenceSources: ['crawl'],
      confidence: 0.8,
      confidenceLevel: 'medium',
      impactScore: 25,
      effortEstimate: 'small',
    };
  },
};

/**
 * Service schema on service-role page.
 */
const serviceSchemaMissing: AuditRule = {
  id: 'structured-data.service.missing',
  version: '1.0.0',
  name: 'Service schema missing on service page',
  category: 'structured-data',
  layer: 'ai-visibility',
  pack: 'ai-visibility',
  scoresInto: 'ai-visibility',
  description: 'Detects service-role pages without Service / ProfessionalService schema.',
  whyItMatters:
    'Service schema disambiguates what the page offers for AI / Google Business / local SERP.',
  recommendationTemplate:
    'Add Service JSON-LD with name, provider, areaServed, serviceType, offers.',
  defaultSeverity: 'low',
  defaultImpact: 25,
  defaultEffort: 'small',
  reportVisibility: 'both',
  ownerHint: 'developer',
  lifecycle: 'active',
  requiredInputs: ['page.html', 'page.schema'],
  scope: 'page',
  appliesTo({ page }) {
    if (page.pageRole !== 'service') return notApplicable('page-role-mismatch');
    if (pageRoleConfidenceIsLow(page)) return needsReview('service role low confidence');
    if (!page.schemaSource || page.schemaSource === 'not-verified')
      return notApplicable('other', 'schema-not-verified covers this');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const types = page.schemaTypes ?? [];
    const has = types.some((t) => /service/i.test(t));
    if (has) return { status: 'pass', severity: 'info', title: 'Service schema present' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Service schema missing',
      observed: `Detected schema types: ${types.join(', ') || 'none'}.`,
      whyItMatters: 'Service schema clarifies what the page offers for AI + business directory.',
      recommendation: 'Add Service or ProfessionalService JSON-LD.',
      evidence: { schemaTypes: types, pageRole: page.pageRole },
      evidenceSources: ['crawl'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: 25,
      effortEstimate: 'small',
    };
  },
};

export const structuredDataRules: AuditRule[] = [
  jsonLdMissing,
  orgWebsiteOnHome,
  schemaParseErrors,
  articleSchemaMissing,
  breadcrumbSchemaMissing,
  faqSchemaOpportunity,
  serviceSchemaMissing,
];

/** Rule IDs subject to render-recrawl re-evaluation. */
export const renderSensitiveRuleIds = new Set<string>([
  jsonLdMissing.id,
  orgWebsiteOnHome.id,
]);
