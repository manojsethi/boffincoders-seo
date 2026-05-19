import type {
  Applicability,
  PageRuleContext,
  PageView,
  RequiredInput,
  SiteRuleContext,
} from './types';

/**
 * Engine helper for rules. Wraps common applicability patterns so individual
 * rules stay short and consistent. Doc 11 §"Applicability Model".
 */
export const APPLIES: Applicability = { kind: 'applies' };

type NotApplicableReason =
  | 'page-role-mismatch'
  | 'website-type-mismatch'
  | 'page-pattern-excluded'
  | 'page-intentionally-non-indexable'
  | 'page-low-importance'
  | 'analyst-disabled'
  | 'other';

export function notApplicable(reason: NotApplicableReason, detail?: string): Applicability {
  return { kind: 'not_applicable', reason, detail };
}

export function notVerified(
  reason:
    | 'gsc-not-connected'
    | 'ga4-not-connected'
    | 'cwv-unavailable'
    | 'backlinks-not-connected'
    | 'citations-not-connected'
    | 'ai-visibility-not-tracked'
    | 'rendered-html-missing'
    | 'markdown-missing'
    | 'crawl-incomplete'
    | 'other',
  detail?: string,
): Applicability {
  return { kind: 'not_verified', reason, detail };
}

export function needsReview(detail: string): Applicability {
  return { kind: 'needs_review', detail };
}

/**
 * Check whether a page is "important" per analyst overrides + heuristics + GSC clicks (when available).
 * Doc 11 §"Page-Level Applicability".
 */
export function isImportantPage(page: PageView): boolean {
  if (page.isImportant) return true;
  // Heuristic-only fallback: home, navigation hubs, commercial pages, and high-link-equity pages
  const role = page.pageRole;
  if (['home', 'pricing', 'product', 'collection', 'navigation-hub'].includes(role)) return true;
  if (page.internalLinksIn >= 5) return true;
  return false;
}

/**
 * Page matches one of the provided role groups, or its role is uncertain (low confidence).
 */
export function pageRoleApplies(page: PageView, roles: string[]): boolean {
  return roles.includes(page.pageRole);
}

export function pageRoleConfidenceIsLow(page: PageView): boolean {
  return page.roleConfidenceLevel === 'low' || page.roleConfidence < 0.4;
}

/**
 * Build a canonical key. Cross-page rules pass groupKey; page rules use ruleId|pageId.
 */
export function buildCanonicalKey(opts: {
  ruleId: string;
  pageId?: { toString: () => string };
  groupKey?: string;
}): string {
  if (opts.groupKey) return `${opts.ruleId}|group:${opts.groupKey}`;
  if (opts.pageId) return `${opts.ruleId}|${opts.pageId.toString()}`;
  return `${opts.ruleId}|site`;
}

/**
 * Check required inputs against site context. Returns the first missing input as not_verified, or null.
 */
export function checkRequiredInputs(
  rule: { requiredInputs: ReadonlyArray<unknown> },
  ctx: PageRuleContext | SiteRuleContext,
): Applicability | null {
  const site = ctx.site;
  for (const input of rule.requiredInputs as ReadonlyArray<import('./types').RequiredInput>) {
    const missing = inputMissingReason(input, ctx, site);
    if (missing) return missing;
  }
  return null;
}

function inputMissingReason(
  input: RequiredInput,
  ctx: PageRuleContext | SiteRuleContext,
  site: SiteRuleContext['site'],
): Applicability | null {
  switch (input) {
    case 'integration.gsc':
      return site.sourcesAvailable.gsc ? null : notVerified('gsc-not-connected');
    case 'integration.ga4':
      return site.sourcesAvailable.ga4 ? null : notVerified('ga4-not-connected');
    case 'integration.cwv':
      return site.sourcesAvailable.cwv ? null : notVerified('cwv-unavailable');
    case 'integration.backlinks':
      return site.sourcesAvailable.backlinks ? null : notVerified('backlinks-not-connected');
    case 'integration.citations':
      return site.sourcesAvailable.citations ? null : notVerified('citations-not-connected');
    case 'integration.ai-visibility':
      return site.sourcesAvailable.aiVisibility ? null : notVerified('ai-visibility-not-tracked');
    case 'page.rendered-html':
      return site.sourcesAvailable.renderedHtml ? null : notVerified('rendered-html-missing');
    case 'page.markdown': {
      const page = (ctx as PageRuleContext).page;
      return page && page.markdown.length > 0 ? null : notVerified('markdown-missing');
    }
    case 'page.html':
    case 'page.headers':
    case 'page.status':
    case 'page.robots-meta':
    case 'page.headings':
    case 'page.schema':
    case 'page.internal-links':
    case 'page.images':
      return null; // assumed present once page is crawled
    case 'site.sitemap':
      return site.sitemapAvailable ? null : null; // missing sitemap is itself a rule
    case 'site.robots':
      return null;
    case 'project.goals':
      return site.goals.length > 0 ? null : null; // goals optional in Phase A
    case 'project.websiteCategory':
      return site.websiteCategory ? null : null;
  }
}

/**
 * Combine multiple applicability checks. Returns first non-applies result, else APPLIES.
 */
export function firstBlocking(...checks: Array<Applicability | null | undefined>): Applicability {
  for (const c of checks) {
    if (!c) continue;
    if (c.kind !== 'applies') return c;
  }
  return APPLIES;
}
