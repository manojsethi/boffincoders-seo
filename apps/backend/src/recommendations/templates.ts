// Deterministic recommendation templates keyed by audit rule ID.
// Each template returns the analyst-facing fields the recommendation needs.
// Doc continuation §"Phase 2" — recommendations stay rule-driven; AI rewriting is a later add.

export type Template = {
  type:
    | 'technical'
    | 'content'
    | 'keyword'
    | 'internal-link'
    | 'schema'
    | 'conversion'
    | 'performance'
    | 'eeat-trust'
    | 'crawlability'
    | 'indexing'
    | 'other';
  ownerType: 'seo' | 'content' | 'developer' | 'client' | 'analyst';
  effort: 'trivial' | 'small' | 'medium' | 'large';
  expectedImpact: 'high' | 'medium' | 'low';
  verdictBySeverity?: Partial<
    Record<'critical' | 'high' | 'medium' | 'low' | 'info', 'must_change' | 'should_improve' | 'consider' | 'monitor'>
  >;
  title: (ctx: { primaryUrl?: string; affectedCount?: number; pageRole?: string }) => string;
  rootCauseSummary: string;
  rootCause: string;
  recommendedAction: string;
  whyItMatters: string;
  validationMethod: string;
  // When evidence is mostly cross-page (template/site-wide), pluralize wording.
  groupable?: boolean;
};

const path = (u?: string): string => {
  if (!u) return 'this page';
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
};

/**
 * Subset of rule IDs the generator handles. Everything else falls back to a generic template that
 * still pulls evidence from the issue + finding, but uses neutral language.
 */
export const TEMPLATES: Record<string, Template> = {
  'headings.h1.missing-or-multiple': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change', medium: 'should_improve' },
    title: (c) =>
      c.affectedCount && c.affectedCount > 1
        ? `Restore one clear H1 on ${c.affectedCount} pages`
        : `Add a clear H1 on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'The page has no H1, or has more than one H1.',
    rootCause:
      'The page template or content layout does not expose a single primary heading that describes the page subject.',
    recommendedAction:
      'Add one H1 that names the exact topic / service / page subject and the target audience. Demote secondary H1s to H2.',
    whyItMatters:
      'H1 is the page’s primary topic signal for crawlers and assistive tech. Missing or duplicate H1s blur the page’s intent and reduce relevance signals.',
    validationMethod:
      'Re-crawl and confirm exactly one H1 exists per affected URL. For GSC-mapped pages, track CTR + position over 2-4 weeks.',
    groupable: true,
  },
  'metadata.title.missing-or-bad-length': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change', medium: 'should_improve' },
    title: (c) =>
      c.affectedCount && c.affectedCount > 1
        ? `Rewrite titles on ${c.affectedCount} pages (missing or wrong length)`
        : `Rewrite the title on ${path(c.primaryUrl)}`,
    rootCauseSummary:
      'The page has no <title>, or the title is outside the 30-65 character zone.',
    rootCause:
      'Title was either omitted from the template or generated with boilerplate that is too short / too long.',
    recommendedAction:
      'Write a 50-60 character title that includes the primary keyword and the brand. Avoid generic placeholders.',
    whyItMatters:
      '<title> is the strongest on-page ranking + snippet signal. Snippets that get truncated or under-described lose CTR.',
    validationMethod:
      'Re-crawl + verify title in the rendered HTML. Track GSC CTR over 21 days for affected URLs.',
    groupable: true,
  },
  'metadata.meta-description.missing-or-bad-length': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'low',
    verdictBySeverity: { high: 'should_improve', medium: 'should_improve' },
    title: (c) =>
      c.affectedCount && c.affectedCount > 1
        ? `Write meta descriptions on ${c.affectedCount} pages`
        : `Write a meta description on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'Meta description is missing or outside the 70-160 character window.',
    rootCause:
      'The CMS/template does not enforce a meta description, or analyst notes never seeded one.',
    recommendedAction:
      'Write a 120-155 character description that previews the page’s offer + a call to action.',
    whyItMatters:
      'Meta description does not rank, but it directly drives organic CTR. Google rewrites bad descriptions; well-written ones preserve the brand’s framing.',
    validationMethod: 'Re-crawl and confirm length. Watch CTR delta in GSC over 21 days.',
    groupable: true,
  },
  'metadata.title.equals-h1': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'low',
    title: (c) => `Differentiate title from H1 on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'The <title> and the H1 are identical.',
    rootCause:
      'The template auto-fills both fields from the same source, missing the chance to use each for a different audience.',
    recommendedAction:
      'Use the title for the SERP snippet (include brand + clearest value), use the H1 for in-page clarity (audience + outcome).',
    whyItMatters:
      'Title is for the SERP click; H1 is for the visitor on the page. Identical strings waste either the click or the landing experience.',
    validationMethod: 'Re-crawl + confirm differentiation. Check GSC CTR.',
  },
  'metadata.title.brand-only': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change' },
    title: (c) => `Replace brand-only title on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'The <title> is just the brand name with no topic descriptor.',
    rootCause: 'Title fell back to a default brand placeholder.',
    recommendedAction:
      'Write a topical title that includes the page’s primary keyword + brand suffix.',
    whyItMatters:
      'Brand-only titles win zero non-branded queries and lose CTR vs competitors.',
    validationMethod: 'Re-crawl + GSC CTR after deploy.',
  },
  'indexability.noindex-important-page': {
    type: 'indexing',
    ownerType: 'developer',
    effort: 'trivial',
    expectedImpact: 'high',
    verdictBySeverity: { critical: 'must_change', high: 'must_change' },
    title: (c) => `Remove noindex from important page ${path(c.primaryUrl)}`,
    rootCauseSummary: 'An important indexable page is currently set to noindex.',
    rootCause:
      'A robots meta tag or X-Robots-Tag header is preventing search engines from indexing the page. Often a leftover from staging or a CMS toggle.',
    recommendedAction:
      'Remove the noindex directive if the page should rank. If the page truly should not rank, mark it as intentionally non-indexable on the page settings so this rule stops firing.',
    whyItMatters:
      'A noindex on an important page removes it from organic results entirely — no impressions, no clicks, no rankings.',
    validationMethod:
      'Re-crawl + confirm `<meta name="robots">` content. Request indexing in GSC; check Coverage report after 7-14 days.',
  },
  'site-health.duplicate-h1': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'should_improve', medium: 'should_improve' },
    title: (c) => `Resolve duplicate H1 across ${c.affectedCount ?? 'several'} pages`,
    rootCauseSummary: 'Multiple pages use the same H1 text.',
    rootCause:
      'A template fills H1 from a default field, or content was reused verbatim across services / categories.',
    recommendedAction:
      'Rewrite each affected H1 to describe its specific page topic. Pick a canonical primary page if pages truly target the same query (cannibalization).',
    whyItMatters:
      'Duplicate H1s create cannibalization signals — Google has to guess which URL to rank, and CTR drops on every affected page.',
    validationMethod:
      'Re-crawl + verify unique H1 per URL. Track GSC for which URL gains impressions after the change.',
    groupable: true,
  },
  'metadata.og.image-missing': {
    type: 'content',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'low',
    title: (c) => `Add OG image on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'Open Graph image is missing from the page.',
    rootCause: 'Template never set og:image or the resource path is broken.',
    recommendedAction:
      'Add a 1200x630 og:image (and twitter:image) that summarises the page topic. Avoid logos-only.',
    whyItMatters:
      'Social shares without an OG image preview poorly, losing CTR on LinkedIn / X / Slack / WhatsApp.',
    validationMethod: 'Re-crawl + check OG image in the SERP / social inspector tools.',
    groupable: true,
  },
  'metadata.og.title-mismatch': {
    type: 'content',
    ownerType: 'content',
    effort: 'trivial',
    expectedImpact: 'low',
    title: (c) => `Align OG title with page title on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'og:title differs sharply from the page <title>.',
    rootCause: 'Templates managed separately drifted out of sync.',
    recommendedAction:
      'Align og:title with the page <title> unless the social preview needs different framing.',
    whyItMatters: 'Inconsistent social previews dilute branding and confuse shared links.',
    validationMethod: 'Re-crawl + manual social-preview check.',
  },
  'images.alt-text.missing': {
    type: 'content',
    ownerType: 'content',
    effort: 'medium',
    expectedImpact: 'low',
    title: (c) => `Add alt text to images on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'Images on the page have no alt attribute.',
    rootCause: 'CMS or editor workflow does not require alt on upload.',
    recommendedAction:
      'Write descriptive alt for content images (avoid keyword stuffing). Leave decorative images with empty alt="".',
    whyItMatters:
      'Alt text supports accessibility, image search, and intent inference for AI / LLM crawlers.',
    validationMethod: 'Re-crawl + sample 5 images per affected page for alt quality.',
    groupable: true,
  },
  'structured-data.jsonld.missing': {
    type: 'schema',
    ownerType: 'developer',
    effort: 'medium',
    expectedImpact: 'medium',
    title: (c) => `Add JSON-LD schema on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'No JSON-LD structured data was found on the page.',
    rootCause:
      'Template doesn’t inject schema for the page role (Article / Service / FAQ / Organization).',
    recommendedAction:
      'Add JSON-LD matching the page role: Article for content, Service for service pages, Organization on home, BreadcrumbList on deep pages, FAQ where Q/A blocks exist.',
    whyItMatters:
      'Schema unlocks rich results (FAQ, breadcrumbs, ratings) and improves AI/LLM understanding of the page entity.',
    validationMethod:
      'Re-crawl + validate via Google Rich Results Test. Watch GSC Enhancements report after 14 days.',
    groupable: true,
  },
  'structured-data.org-or-website.missing-on-home': {
    type: 'schema',
    ownerType: 'developer',
    effort: 'small',
    expectedImpact: 'medium',
    title: () => 'Add Organization + WebSite schema on the home page',
    rootCauseSummary: 'Home page is missing Organization or WebSite JSON-LD.',
    rootCause: 'Site template omits the entity schema block.',
    recommendedAction:
      'Add Organization JSON-LD (name, logo, sameAs, contactPoint) and WebSite JSON-LD (with potentialAction SearchAction) on the home page.',
    whyItMatters:
      'Organization + WebSite schema are entity anchors — they help Google build the site’s knowledge graph and enable sitelinks search boxes.',
    validationMethod: 'Re-crawl home + validate via Rich Results Test.',
  },
  'structured-data.breadcrumb.missing-on-deep': {
    type: 'schema',
    ownerType: 'developer',
    effort: 'small',
    expectedImpact: 'low',
    title: (c) => `Add BreadcrumbList schema on ${c.affectedCount ?? 'deep'} pages`,
    rootCauseSummary: 'Deep pages have no BreadcrumbList JSON-LD.',
    rootCause: 'Breadcrumb template doesn’t emit JSON-LD.',
    recommendedAction: 'Render BreadcrumbList JSON-LD matching the visible breadcrumb path.',
    whyItMatters: 'Breadcrumb rich results replace the URL line in SERPs, lifting CTR on deep pages.',
    validationMethod: 'Re-crawl + Rich Results Test.',
    groupable: true,
  },
  'structured-data.parse-error': {
    type: 'schema',
    ownerType: 'developer',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change' },
    title: (c) => `Fix invalid JSON-LD on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'JSON-LD on the page could not be parsed.',
    rootCause: 'Invalid JSON or HTML-encoded characters break the structured-data block.',
    recommendedAction:
      'Open the affected JSON-LD block; fix syntax (unescaped quotes, trailing commas). Re-test with Rich Results Test.',
    whyItMatters: 'Broken JSON-LD = no rich results + may suppress related schema on the page.',
    validationMethod: 'Re-crawl + Rich Results Test.',
  },
  'internal-links.orphan-page': {
    type: 'internal-link',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change' },
    title: (c) => `Link to orphan page ${path(c.primaryUrl)}`,
    rootCauseSummary: 'The page has no incoming internal links.',
    rootCause:
      'The page was published without being added to a hub / category / nav.',
    recommendedAction:
      'Add 3-5 contextual internal links from relevant hub / parent pages. Include it in nav if appropriate.',
    whyItMatters:
      'Orphan pages get little PageRank and may not be discovered by crawlers — orphan + important = lost ranking ceiling.',
    validationMethod: 'Re-crawl + confirm internalLinksIn ≥ 3.',
  },
  'internal-links.important-page-weakly-linked': {
    type: 'internal-link',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    title: (c) => `Strengthen internal links into ${path(c.primaryUrl)}`,
    rootCauseSummary: 'Important page has few incoming internal links.',
    rootCause: 'Internal links are concentrated on home/footer; page lacks contextual links.',
    recommendedAction:
      'Add contextual internal links from related content pages. Aim for ≥ 5 in-context anchors with descriptive text.',
    whyItMatters: 'Authority flow to important pages drives ranking on competitive queries.',
    validationMethod: 'Re-crawl + confirm internalLinksIn grew. Watch GSC position over 28 days.',
  },
  'security.url-not-https': {
    type: 'technical',
    ownerType: 'developer',
    effort: 'medium',
    expectedImpact: 'high',
    verdictBySeverity: { critical: 'must_change', high: 'must_change' },
    title: () => 'Force HTTPS across the site',
    rootCauseSummary: 'Pages are accessible over HTTP and not redirected to HTTPS.',
    rootCause: 'TLS missing or redirect rules not configured.',
    recommendedAction:
      'Provision TLS, force a 301 from HTTP → HTTPS, and update internal links + canonical URLs to https.',
    whyItMatters:
      'HTTPS is a ranking signal and a browser security standard. Mixed HTTP exposes users to MITM and shows insecure-content warnings.',
    validationMethod: 'Re-crawl + confirm all pages 301 to HTTPS. Validate cert + check mixed-content scanner.',
  },
  'content-quality.thin-content': {
    type: 'content',
    ownerType: 'content',
    effort: 'large',
    expectedImpact: 'medium',
    title: (c) => `Expand thin content on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'The page word count is below the threshold for its role.',
    rootCause: 'Page was published as a stub or content was thinned without replanning.',
    recommendedAction:
      'Expand to cover sub-topics readers ask about. Add 2-3 supporting sections, FAQs, and proof signals.',
    whyItMatters: 'Thin content ranks for fewer terms and engages users for less time.',
    validationMethod: 'Re-crawl + watch GSC impressions/clicks + GA4 engagement after 28 days.',
  },
  'cwv.lcp.fails-threshold': {
    type: 'performance',
    ownerType: 'developer',
    effort: 'medium',
    expectedImpact: 'high',
    verdictBySeverity: { critical: 'must_change', high: 'must_change', medium: 'should_improve' },
    title: (c) => `Fix LCP on ${path(c.primaryUrl)}`,
    rootCauseSummary:
      'Largest Contentful Paint exceeds the 2500 ms good threshold (poor > 4000 ms).',
    rootCause:
      'Hero image, blocking JS/CSS, slow server response, or render-blocking fonts are delaying the largest above-the-fold element.',
    recommendedAction:
      'Prioritize the hero image (fetchpriority="high" + preload + correct dimensions). Cut blocking JS, defer non-critical CSS, reduce TTFB (cache + edge). Inline above-the-fold CSS where useful.',
    whyItMatters:
      'LCP is a Core Web Vital. Poor LCP harms rankings on competitive queries and increases bounce on mobile.',
    validationMethod:
      'Re-run CWV sync + confirm LCP ≤ 2500 ms in field data. Watch CrUX 28-day window after the fix lands.',
  },
  'cwv.inp.fails-threshold': {
    type: 'performance',
    ownerType: 'developer',
    effort: 'medium',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change', medium: 'should_improve' },
    title: (c) => `Fix INP on ${path(c.primaryUrl)}`,
    rootCauseSummary:
      'Interaction to Next Paint exceeds the 200 ms good threshold (poor > 500 ms).',
    rootCause:
      'Long JavaScript tasks or heavy event handlers are blocking the main thread between input and next paint.',
    recommendedAction:
      'Break up long tasks (use `scheduler.yield()` / `setTimeout` chunks). Defer non-critical scripts. Audit third-party tags + heavy event listeners (analytics, chat, ad scripts).',
    whyItMatters:
      'INP is a Core Web Vital — slow interactions feel broken and reduce engagement + conversion.',
    validationMethod:
      'Re-run CWV sync + confirm INP ≤ 200 ms. Watch CrUX 28-day window after fix.',
  },
  'cwv.cls.fails-threshold': {
    type: 'performance',
    ownerType: 'developer',
    effort: 'small',
    expectedImpact: 'medium',
    verdictBySeverity: { critical: 'must_change', high: 'must_change', medium: 'should_improve' },
    title: (c) => `Fix CLS on ${path(c.primaryUrl)}`,
    rootCauseSummary: 'Cumulative Layout Shift exceeds the 0.1 good threshold (poor > 0.25).',
    rootCause:
      'Images / ads / embeds without reserved dimensions, or late-injected DOM (cookie banner, sticky promo) is shifting the layout after first paint.',
    recommendedAction:
      'Set explicit width/height (or aspect-ratio) on images + iframes. Reserve space for ads + embeds. Avoid injecting content above existing content after load.',
    whyItMatters:
      'CLS is a Core Web Vital — layout jumps cause misclicks and frustration, reducing engagement and conversion.',
    validationMethod:
      'Re-run CWV sync + confirm CLS ≤ 0.1. Manual scroll-through to confirm no late shifts.',
  },
  'eeat.about-page-missing': {
    type: 'eeat-trust',
    ownerType: 'content',
    effort: 'medium',
    expectedImpact: 'medium',
    title: () => 'Publish a real About page',
    rootCauseSummary: 'No About page found on the site.',
    rootCause: 'Site went live without an About section linked from the main navigation.',
    recommendedAction:
      'Publish an About page (`/about`) with the team, history, locations, and credibility signals. Link from main nav + footer.',
    whyItMatters: 'About is an E-E-A-T anchor — both Google and AI search platforms read it to establish authoritativeness.',
    validationMethod: 'Re-crawl + confirm About page exists and is internally linked.',
  },
  'eeat.contact-page-missing': {
    type: 'eeat-trust',
    ownerType: 'content',
    effort: 'small',
    expectedImpact: 'medium',
    title: () => 'Publish a real Contact page',
    rootCauseSummary: 'No Contact page found on the site.',
    rootCause: 'Site missing standard contact route, or contact info lives only in a popup/footer.',
    recommendedAction:
      'Publish `/contact` with phone, email, physical address (if applicable), and a contact form. Link from nav + footer.',
    whyItMatters:
      'Contact info is a trust + E-E-A-T anchor and is required for many Google business signals.',
    validationMethod: 'Re-crawl + confirm `/contact` exists.',
  },
};

/**
 * Generic fallback for any rule that doesn't have a dedicated template yet. Uses the issue's own
 * title + severity to compose a neutral-but-useful recommendation.
 */
export function genericTemplate(args: {
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  affectedCount: number;
  primaryUrl?: string;
}): Template {
  const ownerByCategory: Record<string, Template['ownerType']> = {
    'on-page': 'content',
    'content-quality': 'content',
    'structured-data': 'developer',
    'crawl-indexing': 'developer',
    indexability: 'developer',
    'internal-links': 'content',
    images: 'content',
    'security-social': 'developer',
    'site-health': 'developer',
    'trust-eeat': 'content',
    accessibility: 'developer',
  };
  const typeByCategory: Record<string, Template['type']> = {
    'on-page': 'content',
    'content-quality': 'content',
    'structured-data': 'schema',
    'crawl-indexing': 'crawlability',
    indexability: 'indexing',
    'internal-links': 'internal-link',
    images: 'content',
    'security-social': 'technical',
    'site-health': 'technical',
    'trust-eeat': 'eeat-trust',
    accessibility: 'technical',
  };
  return {
    type: typeByCategory[args.category] ?? 'other',
    ownerType: ownerByCategory[args.category] ?? 'analyst',
    effort: 'medium',
    expectedImpact:
      args.severity === 'critical' || args.severity === 'high'
        ? 'high'
        : args.severity === 'low'
          ? 'low'
          : 'medium',
    verdictBySeverity: {
      critical: 'must_change',
      high: 'should_improve',
      medium: 'should_improve',
      low: 'consider',
      info: 'monitor',
    },
    title: (c) =>
      c.affectedCount && c.affectedCount > 1
        ? `${args.title} (${c.affectedCount} pages)`
        : `${args.title} on ${path(c.primaryUrl)}`,
    rootCauseSummary: args.title,
    rootCause: `Detected by rule ${args.ruleId}. Open the issue for evidence specifics.`,
    recommendedAction:
      'Open the issue drawer for affected URLs and evidence. Apply the fix per the rule documentation, then re-audit.',
    whyItMatters:
      'This rule is part of the standard SEO audit baseline. Fixing items in this category compounds across many queries.',
    validationMethod: 'Re-audit + confirm the rule moves to pass or not_applicable.',
  };
}
