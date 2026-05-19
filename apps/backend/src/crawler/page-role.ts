// Heuristic page-role inference. Doc 11 §"Page-Level Applicability".
// Combines URL pattern + title cues + (optionally) content / headings signals.
// AI-assisted refinement runs lazily after crawl.

export type PageRole =
  | 'home'
  | 'navigation-hub'
  | 'content-article'
  | 'product'
  | 'collection'
  | 'documentation'
  | 'pricing'
  | 'about'
  | 'contact'
  | 'legal'
  | 'utility'
  | 'service'
  | 'category'
  | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type RoleGuess = {
  role: PageRole;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  source: 'heuristic' | 'ai' | 'analyst';
};

function toLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function makeGuess(role: PageRole, confidence: number): RoleGuess {
  return { role, confidence, confidenceLevel: toLevel(confidence), source: 'heuristic' };
}

/**
 * Heuristic page-role inference. Accepts optional content cues to disambiguate `service` vs
 * `content-article` and `category` vs `collection`.
 */
export function guessPageRole(
  url: string,
  title?: string,
  cues?: { h1?: string; headings?: Array<{ level: number; text: string }>; wordCount?: number },
): RoleGuess {
  let path = '/';
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return makeGuess('unknown', 0);
  }
  if (path === '/' || path === '') return makeGuess('home', 0.95);

  const t = (title ?? '').toLowerCase();
  const h1 = (cues?.h1 ?? '').toLowerCase();
  const headingText = (cues?.headings ?? []).map((h) => h.text).join(' ').toLowerCase();
  const hay = `${path} ${t} ${h1} ${headingText}`;

  const has = (s: string | RegExp): boolean =>
    typeof s === 'string' ? hay.includes(s) : s.test(hay);

  // Strict legal/utility first — high confidence
  if (has(/\b(privacy|terms|legal|cookies|gdpr|disclaimer|imprint)\b/))
    return makeGuess('legal', 0.92);
  if (has(/\b(sitemap|search|login|signup|signin|sign-in|sign-up|account|cart|checkout|404|thank[- ]you)\b/))
    return makeGuess('utility', 0.85);

  // Contact / about
  if (has(/\bcontact[- ]?us?\b/) || has(/\bcontact\b/)) return makeGuess('contact', 0.88);
  if (has(/\babout[- ]?us?\b/) || has(/\babout\b/)) return makeGuess('about', 0.8);

  // Commercial
  if (has(/\bpricing\b/) || has(/\bplans?\b/) || has(/\bsubscription\b/) || has(/\bbuy\b/))
    return makeGuess('pricing', 0.85);

  // Documentation
  if (has(/\b(docs?|documentation|reference|api[- ]reference|guide|tutorial|manual)\b/))
    return makeGuess('documentation', 0.8);

  // Case study + blog + news + insights → article
  if (has(/\b(blog|news|article|insights?|case[- ]?stud(y|ies)|stories|press)\b/))
    return makeGuess('content-article', 0.78);

  // Service pages — strong cue from `/services/`, `/solutions/`, `/expertise/`, or service title
  if (
    has(/\/services?\//) ||
    has(/\/solutions?\//) ||
    has(/\/expertise\//) ||
    has(/\/what-we-do\//) ||
    has(/\bservice\b/) ||
    has(/\bsolution\b/) ||
    has(/\bconsulting\b/)
  ) {
    return makeGuess('service', 0.75);
  }

  // Industries / verticals → category
  if (has(/\/industries?\//) || has(/\/verticals?\//) || has(/\/sectors?\//))
    return makeGuess('category', 0.75);

  // Products
  if (has(/\/products?\//) || has(/\/shop\//) || has(/\/item\//) || has(/\bsku\b/))
    return makeGuess('product', 0.7);

  // Collections / categories
  if (has(/\/(category|categories|collection|collections|tag|topic|topics)\//))
    return makeGuess('collection', 0.7);

  // Navigation-hub: depth 1 with few words → likely a section landing
  const segs = path.split('/').filter(Boolean);
  const depth = segs.length;
  const wc = cues?.wordCount ?? 0;

  if (depth === 1) {
    if (wc > 0 && wc < 200) return makeGuess('navigation-hub', 0.55);
    if (wc >= 400) return makeGuess('content-article', 0.5);
    return makeGuess('navigation-hub', 0.5);
  }

  if (depth >= 2) {
    if (wc >= 400) return makeGuess('content-article', 0.55);
    if (wc > 0 && wc < 150) return makeGuess('navigation-hub', 0.45);
    return makeGuess('content-article', 0.4);
  }

  return makeGuess('unknown', 0.3);
}
