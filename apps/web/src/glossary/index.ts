// Single source for SEO glossary. Doc 9 §"Mandatory Info Icon Rule".
// Each entry explains: what the term means, why it matters, how it's measured,
// what good/bad looks like, and what to do next.

export type GlossaryEntry = {
  term: string;
  short: string;
  whatItIs: string;
  whyItMatters: string;
  howWeMeasure: string;
  whatGoodLooksLike: string;
  whatToDoNext: string;
  source?: 'crawl' | 'gsc' | 'ga4' | 'cwv' | 'analyst' | 'ai';
};

const G: Record<string, GlossaryEntry> = {
  url: {
    term: 'URL',
    short: 'The page address.',
    whatItIs: 'The web address of the page being audited.',
    whyItMatters: 'Each URL is a distinct entry in Google’s index.',
    howWeMeasure: 'Captured from the crawl.',
    whatGoodLooksLike: 'Clean, readable, lowercase, no tracking params.',
    whatToDoNext: 'Keep URLs stable; avoid unnecessary redirects.',
    source: 'crawl',
  },
  role: {
    term: 'Page role',
    short: 'What kind of page this is.',
    whatItIs:
      'A heuristic classification of the page purpose (home, product, article, contact, legal, etc.).',
    whyItMatters: 'Audit rules apply or skip based on page role.',
    howWeMeasure: 'Inferred from URL pattern + title + (optionally) AI from markdown.',
    whatGoodLooksLike: 'High confidence on important pages so the right rules run.',
    whatToDoNext:
      'Click "Infer role" to refresh, or override the role from the page workspace if wrong.',
    source: 'crawl',
  },
  indexability: {
    term: 'Indexability',
    short: 'Whether Google can include this page in search results.',
    whatItIs: 'Result of robots meta tags and X-Robots headers controlling indexing.',
    whyItMatters: 'Noindex pages cannot rank. They are invisible in organic search.',
    howWeMeasure: 'Read meta robots from the crawled HTML.',
    whatGoodLooksLike: '"index" for pages that should rank.',
    whatToDoNext:
      'If an important page is noindex, remove the directive. If intentional, mark as intentionally non-indexable so it stops appearing as an issue.',
    source: 'crawl',
  },
  canonical: {
    term: 'Canonical URL',
    short: 'The preferred URL for this content.',
    whatItIs: 'A <link rel="canonical"> hint telling Google which URL to rank when duplicates exist.',
    whyItMatters: 'Without a canonical, duplicate URLs may dilute ranking signals.',
    howWeMeasure: 'Read the canonical link in the page <head>.',
    whatGoodLooksLike: 'Self-referential canonical on indexable pages.',
    whatToDoNext: 'Add a canonical link if missing. Make sure it points to the preferred URL.',
    source: 'crawl',
  },
  noindex: {
    term: 'Noindex',
    short: 'Tells Google not to include this page in search results.',
    whatItIs: 'A meta robots or header directive that blocks indexing.',
    whyItMatters: 'Important pages must not be noindex if they should rank.',
    howWeMeasure: 'Detected from meta robots and X-Robots-Tag in the response.',
    whatGoodLooksLike: 'Only intentional pages (admin, login, thank-you) are noindex.',
    whatToDoNext:
      'If unintentional, remove the directive. If intentional, mark it as intentionally non-indexable.',
    source: 'crawl',
  },
  status: {
    term: 'HTTP status',
    short: 'The response code returned by the page.',
    whatItIs: 'The HTTP status returned to the crawler. 200 means OK.',
    whyItMatters: 'Non-200 pages do not rank and lose link equity.',
    howWeMeasure: 'Captured during crawl.',
    whatGoodLooksLike: '200 for pages that should rank; controlled redirects for moved content.',
    whatToDoNext: 'Investigate origin, fix server errors, or redirect to a working URL.',
    source: 'crawl',
  },
  issues: {
    term: 'Issues',
    short: 'Persistent work items created from audit findings.',
    whatItIs:
      'Open work items grouped by audit rule. Issues survive across audits so progress is tracked.',
    whyItMatters: 'A single source of truth for what needs to be fixed.',
    howWeMeasure: 'Created when rules return fail / warning / opportunity / needs_review.',
    whatGoodLooksLike: 'Few open critical/high issues on important pages.',
    whatToDoNext: 'Triage by severity and priority, assign owners, verify after fixes.',
  },
  severity: {
    term: 'Severity',
    short: 'How serious the issue is.',
    whatItIs: 'critical, high, medium, low, info.',
    whyItMatters: 'Helps decide what to fix first.',
    howWeMeasure: 'Set by each audit rule based on SEO/business risk.',
    whatGoodLooksLike: 'Critical and high counts trending down over time.',
    whatToDoNext: 'Fix critical and high before medium/low.',
  },
  priority: {
    term: 'Priority',
    short: 'Sorting score combining severity, impact, confidence, and page importance.',
    whatItIs: 'A 0-100 score the tool uses to rank issues.',
    whyItMatters: 'Two issues can share severity but differ in business impact.',
    howWeMeasure:
      'priority = 0.4 × severity + 0.25 × impact + 0.15 × confidence + 0.2 × page-importance.',
    whatGoodLooksLike: 'Top issues align with business-critical pages.',
    whatToDoNext: 'Work top-down through the priority list.',
  },
  'action-priority': {
    term: 'Action priority (P0/P1/P2)',
    short: 'When to act on the issue.',
    whatItIs:
      'P0: fix immediately. P1: fix this cycle. P2: plan, batch, or monitor. Computed from severity + page importance + confidence.',
    whyItMatters: 'Decouples planning urgency from technical severity.',
    howWeMeasure: 'P0 for critical or important-page high-severity. P1 for high. P2 otherwise.',
    whatGoodLooksLike: 'Few P0/P1 carried week-to-week.',
    whatToDoNext: 'Schedule P0 today. P1 in current sprint. P2 in backlog.',
  },
  impact: {
    term: 'Impact',
    short: 'Estimated SEO/business uplift if fixed.',
    whatItIs: '0-100 estimate of how much this fix could move rankings, traffic, or conversions.',
    whyItMatters: 'High-impact fixes deserve attention even when severity is medium.',
    howWeMeasure: 'Per-rule default + page importance multiplier.',
    whatGoodLooksLike: 'Issues with both high impact and high confidence.',
    whatToDoNext: 'Tackle high-impact issues with low effort first.',
  },
  effort: {
    term: 'Effort',
    short: 'How costly the fix is.',
    whatItIs: 'trivial, small, medium, large, unknown.',
    whyItMatters: 'Helps with batching and resource planning.',
    howWeMeasure: 'Per-rule default; analysts can override later.',
    whatGoodLooksLike: 'Quick wins (high impact + trivial/small effort) cleared first.',
    whatToDoNext: 'Sequence work: quick wins now, large overhauls in sprints.',
  },
  evidence: {
    term: 'Evidence',
    short: 'The proof for the finding.',
    whatItIs: 'Observed values + sources used to detect the issue.',
    whyItMatters: 'Lets you verify the issue is real before working on it.',
    howWeMeasure: 'Each rule attaches structured evidence from crawl/GSC/GA4/CWV.',
    whatGoodLooksLike: 'Every finding has at least an observed value and a source.',
    whatToDoNext:
      'If evidence looks wrong, mark as not applicable or re-audit. Otherwise act on the recommendation.',
  },
  confidence: {
    term: 'Confidence',
    short: 'How sure the tool is.',
    whatItIs: 'high, medium, low. Computed per finding.',
    whyItMatters: 'Low-confidence findings should be reviewed, not auto-actioned.',
    howWeMeasure: 'Rule-defined; depends on inputs + page role certainty.',
    whatGoodLooksLike: 'High confidence on factual checks. Medium/low triggers needs_review.',
    whatToDoNext: 'Review low-confidence findings manually before acting.',
  },
  'group-key': {
    term: 'Issue group',
    short: 'Multiple pages affected by the same problem.',
    whatItIs: 'When one issue spans many URLs, they share a group key.',
    whyItMatters: 'Fix at the template level rather than page by page.',
    howWeMeasure: 'Cross-page rules emit groupKey + affectedUrls.',
    whatGoodLooksLike: 'Group fixes resolve many pages at once.',
    whatToDoNext: 'Inspect affected URLs and find the shared template/cause.',
  },
  'links-in': {
    term: 'Links in',
    short: 'Internal links pointing to this page.',
    whatItIs: 'Count of other pages on this site linking here.',
    whyItMatters: 'Pages with few inbound internal links inherit less authority and are harder to discover.',
    howWeMeasure: 'Counted from the latest crawl link graph.',
    whatGoodLooksLike: 'Important pages have 5+ relevant internal links.',
    whatToDoNext: 'Add contextual links from hub/parent pages.',
    source: 'crawl',
  },
  'links-out': {
    term: 'Links out',
    short: 'Internal links from this page.',
    whatItIs: 'Count of internal destinations this page links to.',
    whyItMatters: 'Pages should pass link equity to relevant related pages.',
    howWeMeasure: 'Counted from the page’s extracted HTML.',
    whatGoodLooksLike: 'Sensible navigation + a few contextual links to related pages.',
    whatToDoNext: 'Avoid dead-end pages; link to related content where useful.',
    source: 'crawl',
  },
  'orphan-page': {
    term: 'Orphan page',
    short: 'A page no other page links to.',
    whatItIs: 'Internal link graph shows zero inbound links from crawled pages.',
    whyItMatters:
      'Orphans are harder for search engines to discover and inherit no internal link equity.',
    howWeMeasure: 'Inbound internal link count = 0 in the crawl.',
    whatGoodLooksLike: 'No important page is an orphan.',
    whatToDoNext: 'Link the page from at least one relevant hub or parent.',
    source: 'crawl',
  },
  schema: {
    term: 'Structured data',
    short: 'Machine-readable data describing the page.',
    whatItIs: 'JSON-LD (and other formats) declaring page type, entities, FAQs, products, etc.',
    whyItMatters: 'Schema unlocks rich results and AI Overview citations.',
    howWeMeasure: 'Extracted from <script type="application/ld+json"> blocks.',
    whatGoodLooksLike: 'Page role-appropriate schema present and valid.',
    whatToDoNext: 'Add or fix JSON-LD that matches the page type.',
    source: 'crawl',
  },
  'schema-source': {
    term: 'Schema source',
    short: 'Where the JSON-LD was extracted from.',
    whatItIs:
      'Cheerio reads raw HTML; Playwright reads rendered HTML after JS executes. We track which one produced the schema.',
    whyItMatters:
      'Missing JSON-LD in raw HTML does not mean missing schema — JS-injected schema needs rendered verification before failing.',
    howWeMeasure:
      'raw-html · rendered-html · both · none (rendered ran, nothing found) · not-verified (rendered not yet run).',
    whatGoodLooksLike: 'raw-html or both for important pages.',
    whatToDoNext:
      'Trigger Render selected from the Pages table to verify schema on JS-rendered pages.',
    source: 'crawl',
  },
  ctr: {
    term: 'Click-through rate (CTR)',
    short: 'How often searchers click the result.',
    whatItIs: 'Clicks divided by impressions in Google Search Console.',
    whyItMatters: 'Low CTR on high-impression pages signals weak SERP snippet.',
    howWeMeasure: 'From Search Console; needs GSC connected.',
    whatGoodLooksLike: 'CTR appropriate to position and intent.',
    whatToDoNext: 'Rewrite title and meta description; add schema if relevant.',
    source: 'gsc',
  },
  impressions: {
    term: 'Impressions',
    short: 'How often the URL appeared in Google.',
    whatItIs: 'Count of times the URL was shown in search results.',
    whyItMatters: 'Impressions show visibility opportunity.',
    howWeMeasure: 'From Search Console; needs GSC connected.',
    whatGoodLooksLike: 'Growing impressions on target pages.',
    whatToDoNext: 'Focus optimization on pages with rising impressions.',
    source: 'gsc',
  },
  position: {
    term: 'Average position',
    short: 'Average ranking in Google results.',
    whatItIs: 'Average SERP position over the selected date range.',
    whyItMatters: 'Pages at positions 4-20 are quick-win candidates.',
    howWeMeasure: 'From Search Console; needs GSC connected.',
    whatGoodLooksLike: 'Important pages in top 3.',
    whatToDoNext: 'Identify quick wins (positions 4-20 with meaningful impressions).',
    source: 'gsc',
  },
  sessions: {
    term: 'Sessions',
    short: 'Visits from organic search.',
    whatItIs: 'GA4 organic sessions per page over the selected date range.',
    whyItMatters: 'Sessions measure realized traffic.',
    howWeMeasure: 'From GA4; needs GA4 connected.',
    whatGoodLooksLike: 'Sessions trending up on target pages.',
    whatToDoNext: 'Investigate drops; align SEO work with high-session pages.',
    source: 'ga4',
  },
  conversions: {
    term: 'Conversions',
    short: 'Tracked goal completions.',
    whatItIs: 'GA4 conversions per page (e.g. form submits, purchases, signups).',
    whyItMatters: 'Connects SEO effort to business outcomes.',
    howWeMeasure: 'From GA4; needs GA4 + conversion events configured.',
    whatGoodLooksLike: 'High-traffic pages convert.',
    whatToDoNext: 'Improve CTAs and conversion paths on high-traffic, low-conversion pages.',
    source: 'ga4',
  },
  lcp: {
    term: 'LCP',
    short: 'Largest Contentful Paint.',
    whatItIs: 'Time to render the largest visible content element. Core Web Vital.',
    whyItMatters: 'Slow LCP hurts user experience and is a ranking signal.',
    howWeMeasure: 'From PageSpeed Insights / field data; needs CWV enabled.',
    whatGoodLooksLike: '≤ 2.5s on mobile.',
    whatToDoNext: 'Optimize hero image, server response, render-blocking resources.',
    source: 'cwv',
  },
  inp: {
    term: 'INP',
    short: 'Interaction to Next Paint.',
    whatItIs: 'Latency of user interactions. Core Web Vital.',
    whyItMatters: 'Sluggish INP frustrates users on conversion pages.',
    howWeMeasure: 'From PageSpeed Insights / field data.',
    whatGoodLooksLike: '≤ 200ms.',
    whatToDoNext: 'Reduce JS execution and main-thread blocking on interactive elements.',
    source: 'cwv',
  },
  cls: {
    term: 'CLS',
    short: 'Cumulative Layout Shift.',
    whatItIs: 'Visual stability score. Core Web Vital.',
    whyItMatters: 'Layout shifts trigger missed clicks and reduce trust.',
    howWeMeasure: 'From PageSpeed Insights / field data.',
    whatGoodLooksLike: '≤ 0.1.',
    whatToDoNext: 'Reserve image/ad dimensions, avoid late-injected DOM.',
    source: 'cwv',
  },
  'data-gap': {
    term: 'Data gap',
    short: 'Required data source is missing.',
    whatItIs: 'When a rule cannot run because GSC, GA4, CWV, or another source is not connected.',
    whyItMatters:
      'Gaps tell you which features are blocked. They are not SEO issues by themselves.',
    howWeMeasure: 'Tracked separately from issues; surfaced on the audit overview.',
    whatGoodLooksLike: 'Few gaps relative to the rule set you care about.',
    whatToDoNext: 'Connect the missing source from Integrations.',
  },
  goal: {
    term: 'Goal',
    short: 'A measurable outcome this site is trying to drive.',
    whatItIs:
      'A business outcome (leads, sales, donations, applications, awareness, local visibility, etc.) tied to specific pages or URL patterns.',
    whyItMatters:
      'Audit rules and opportunities are weighted by whether they affect goal pages. Without goals, every page looks equally important.',
    howWeMeasure: 'Set manually per project; pages can be linked by ID or URL pattern.',
    whatGoodLooksLike: '1-3 primary goals with the related pages mapped.',
    whatToDoNext: 'Add goals on the Goals tab and attach the pages they apply to.',
    source: 'analyst',
  },
  keyword: {
    term: 'Keyword',
    short: 'A search query users type to find content.',
    whatItIs: 'A query string that may be tracked, imported from GSC, or added manually.',
    whyItMatters: 'Keywords are the bridge between user intent and page targets.',
    howWeMeasure: 'GSC import aggregates queries → impressions/clicks/CTR/position.',
    whatGoodLooksLike: 'Each important keyword has one mapped page, with intent + funnel labelled.',
    whatToDoNext: 'Import GSC queries, then map each to its target page.',
    source: 'gsc',
  },
  'search-intent': {
    term: 'Search intent',
    short: 'What the user is trying to accomplish.',
    whatItIs:
      'Informational, commercial, transactional, navigational, local, or support. Drives what kind of page should rank.',
    whyItMatters: 'A page that mismatches intent will not rank or convert regardless of optimization.',
    howWeMeasure: 'Labelled manually, optionally AI-suggested in future phases.',
    whatGoodLooksLike: 'Each keyword has intent set; page content matches.',
    whatToDoNext: 'Label intent on Keywords. Verify mapped page satisfies that intent.',
  },
  'funnel-stage': {
    term: 'Funnel stage',
    short: 'Where the user is in the buying journey.',
    whatItIs: 'TOFU (awareness), MOFU (consideration), BOFU (decision), or retention.',
    whyItMatters: 'Helps ensure keyword coverage across the funnel — not only bottom-of-funnel.',
    howWeMeasure: 'Labelled manually on each keyword.',
    whatGoodLooksLike: 'Good coverage across TOFU/MOFU/BOFU for primary goals.',
    whatToDoNext: 'Label funnel stage on Keywords. Plan content for any underserved stages.',
  },
  'quick-win': {
    term: 'Quick win',
    short: 'Keyword ranking just outside the top 3 — easiest CTR upside.',
    whatItIs:
      'A query where the page already ranks between positions 4 and 20 with meaningful impressions. Small improvements often unlock big traffic gains.',
    whyItMatters: 'Highest ROI opportunities — the page is already credible to Google.',
    howWeMeasure: 'GSC: avgPosition between 4 and 20, impressions ≥ 100.',
    whatGoodLooksLike: 'Move into top 3 with content refresh, internal links, or intent alignment.',
    whatToDoNext: 'Refresh the page, strengthen internal links, align with searcher intent.',
    source: 'gsc',
  },
  cannibalization: {
    term: 'Cannibalization',
    short: 'Two or more pages compete for the same query.',
    whatItIs: 'When multiple URLs on the same site rank for one query, splitting authority.',
    whyItMatters: 'Diluted signals → no page ranks as well as a consolidated single page would.',
    howWeMeasure: 'GSC: a single query with ≥2 distinct ranking URLs and ≥100 impressions.',
    whatGoodLooksLike: 'One canonical page per query.',
    whatToDoNext: 'Pick a primary page, consolidate or canonicalize, fix internal links.',
    source: 'gsc',
  },
  'content-gap': {
    term: 'Content gap',
    short: 'A keyword you have no page targeting.',
    whatItIs: 'A keyword with impressions where no mapped/crawled page exists.',
    whyItMatters: 'Lost ranking potential. You are showing up by accident, not design.',
    howWeMeasure: 'Keyword with no mappedPageId AND no ranking URL inside the crawl set.',
    whatGoodLooksLike: 'Every important keyword maps to a dedicated, well-targeted page.',
    whatToDoNext: 'Create a new target page or significantly expand a close-match page.',
  },
  'opportunity-score': {
    term: 'Opportunity score',
    short: 'Estimated value of acting on this opportunity.',
    whatItIs: 'Composite score from impact, traffic potential, confidence, and effort.',
    whyItMatters: 'Lets you sort hundreds of findings by ROI.',
    howWeMeasure: 'Deterministic rules: severity × traffic boost, clamped to 0-100.',
    whatGoodLooksLike: 'P1 opportunities scored 60+. Use score to plan sprints.',
    whatToDoNext: 'Sort by score, group by page or goal, work top-down.',
  },
  clicks: {
    term: 'Clicks',
    short: 'How many users clicked your result.',
    whatItIs: 'Clicks from Google Search to your page over the selected period.',
    whyItMatters: 'Direct measure of organic traffic earned.',
    howWeMeasure: 'Search Console: clicks dimension via searchanalytics API.',
    whatGoodLooksLike: 'Growing month-over-month for important pages and intents.',
    whatToDoNext: 'Improve title/meta for high-impression low-click pages, refresh content, build internal links.',
    source: 'gsc',
  },
  'conversion-rate': {
    term: 'Conversion rate',
    short: 'Conversions ÷ sessions.',
    whatItIs: 'Share of organic sessions on a page that result in a tracked GA4 conversion event.',
    whyItMatters: 'Captures how well traffic converts after it arrives. Strong CR multiplies SEO ROI.',
    howWeMeasure: 'GA4 conversions ÷ sessions per organic landing page.',
    whatGoodLooksLike: 'Varies by industry. >2% for B2B service, >1% for ecommerce category pages.',
    whatToDoNext: 'For high-traffic pages with CR < 1%, audit CTA placement, intent match, proof signals.',
    source: 'ga4',
  },
  'performance-score': {
    term: 'Performance score',
    short: 'Lighthouse performance score (0-100).',
    whatItIs: 'Composite score from PSI combining LCP/INP/CLS + Speed Index + TBT for a page.',
    whyItMatters: 'Quick overall page-speed health indicator; useful for sorting slowest pages.',
    howWeMeasure: 'PSI lighthouse performance score during CWV sync.',
    whatGoodLooksLike: '≥ 90 = green. 50-89 = amber. < 50 = poor.',
    whatToDoNext: 'Sort by lowest score, prioritize fixes on important pages.',
    source: 'cwv',
  },
  'cwv-strategy': {
    term: 'CWV strategy',
    short: 'Mobile or desktop measurement.',
    whatItIs: 'PSI captures separate field data for mobile vs desktop. Both are real-user signals.',
    whyItMatters: 'Mobile is Google’s primary ranking signal in most markets; desktop must still pass for users on laptops.',
    howWeMeasure: 'Per-strategy rows stored from each PSI call.',
    whatGoodLooksLike: 'Both strategies in the good band for important pages.',
    whatToDoNext: 'Fix mobile first if you must choose. Confirm both with the latest sync.',
    source: 'cwv',
  },
  channel: {
    term: 'Channel',
    short: 'Acquisition source group from GA4.',
    whatItIs: 'GA4 default channel grouping: Organic Search, Direct, Referral, Organic Social, etc.',
    whyItMatters: 'Validates whether the SEO story (clicks from GSC) matches actual session attribution.',
    howWeMeasure: 'GA4 sessionDefaultChannelGroup dimension.',
    whatGoodLooksLike: 'Organic Search growth track aligns with GSC clicks growth.',
    whatToDoNext: 'If Direct dominates while GSC clicks fall, check for tracking issues or branded traffic shifts.',
    source: 'ga4',
  },
  'engagement-rate': {
    term: 'Engagement rate',
    short: 'Share of sessions that engaged.',
    whatItIs: 'Engaged sessions ÷ total sessions. Engaged = ≥10s, conversion, or ≥2 pageviews.',
    whyItMatters: 'Low engagement on high-traffic pages signals content/intent issues.',
    howWeMeasure: 'GA4 engagementRate metric averaged across organic landing pages.',
    whatGoodLooksLike: '≥ 55-60% for content pages; depends on content type.',
    whatToDoNext: 'Audit page speed, content depth, intent match for low-engagement landing pages.',
    source: 'ga4',
  },
  'data-freshness': {
    term: 'Data freshness',
    short: 'When the underlying data was last synced.',
    whatItIs: 'Timestamp of the most recent GSC/GA4/CWV sync that this view depends on.',
    whyItMatters: 'Stale data leads to wrong decisions. Knowing what age the data is matters more than the chart itself.',
    howWeMeasure: 'Most recent rangeEnd (GSC/GA4) or capturedAt (CWV) per project.',
    whatGoodLooksLike: 'Within the last 24-48 hours during active campaigns.',
    whatToDoNext: 'If stale, trigger a sync from Settings → Integrations.',
  },
  'quick-win-zone': {
    term: 'Quick-win zone',
    short: 'Queries ranking position 4-20.',
    whatItIs: 'Search Console queries where small improvements typically yield large CTR/click gains.',
    whyItMatters: 'Highest ROI tier — already ranking, just needs a nudge.',
    howWeMeasure: 'avgPosition ∈ [4, 20] with impressions ≥ 100.',
    whatGoodLooksLike: 'Most quick-wins moved into top 3 over consecutive months.',
    whatToDoNext: 'Refresh content, build internal links, align intent.',
    source: 'gsc',
  },
  'cwv-pass-fail': {
    term: 'CWV pass/fail',
    short: 'Distribution of pages passing all 3 Core Web Vitals.',
    whatItIs: 'A page passes when LCP, INP, and CLS are all in the "good" range.',
    whyItMatters: 'Google’s page experience signal; analyst-friendly view of CWV health.',
    howWeMeasure: 'LCP ≤ 2500 ms AND INP ≤ 200 ms AND CLS ≤ 0.1.',
    whatGoodLooksLike: 'Important pages all green; aggregate pass rate ≥ 75%.',
    whatToDoNext: 'Sort by slowest important pages and fix LCP/INP first.',
    source: 'cwv',
  },
  job: {
    term: 'Job',
    short: 'A unit of background work.',
    whatItIs: 'Anything the system does asynchronously — crawls, audits, syncs, report generation, monitoring.',
    whyItMatters: 'Every long action runs as a job. Seeing job state lets the analyst trust the system.',
    howWeMeasure: 'Agenda tracks every job with start time, finish time, lock state, and failure reason.',
    whatGoodLooksLike: 'Most jobs complete within their expected window. Few failures, no stuck locks.',
    whatToDoNext: 'Open the job drawer to see related run + recommended action.',
  },
  'job-trigger': {
    term: 'Source',
    short: 'What started the job.',
    whatItIs: 'Manual (analyst clicked), scheduled (recurring), or system (chained from another job).',
    whyItMatters: 'Scheduled jobs that fail repeatedly are different from one-off manual retries.',
    howWeMeasure: 'Recorded as `trigger` on the job payload.',
    whatGoodLooksLike: 'Mix of scheduled (healthy automation) + occasional manual reruns.',
    whatToDoNext: 'If scheduled jobs keep failing, fix the root cause rather than retrying.',
  },
  'job-duration': {
    term: 'Duration',
    short: 'How long the job ran.',
    whatItIs: 'Elapsed time from start to finish (or now, if still running).',
    whyItMatters: 'Long-running jobs may indicate a stuck handler, slow integration, or large workload.',
    howWeMeasure: 'finishedAt − startedAt for completed jobs; live counter for running jobs.',
    whatGoodLooksLike: 'Sync jobs in seconds-to-minutes. Crawls in minutes-to-low-hours.',
    whatToDoNext: 'If far above usual, check provider quota, network, or open the related run.',
  },
  'job-next-run': {
    term: 'Next run',
    short: 'When this job is scheduled to run again.',
    whatItIs: 'Agenda’s nextRunAt — populated for repeating schedules + queued one-offs.',
    whyItMatters: 'Lets the analyst plan around upcoming syncs/reports and confirm automation is healthy.',
    howWeMeasure: 'Agenda stores nextRunAt from the schedule spec or single-job submission.',
    whatGoodLooksLike: 'Recurring jobs always have a future nextRunAt.',
    whatToDoNext: 'If a recurring job has no nextRunAt, the schedule is broken — reschedule from code.',
  },
  'job-lock': {
    term: 'Lock',
    short: 'Agenda’s active-execution marker.',
    whatItIs: 'A worker takes a lock when it starts a job. The lock auto-releases on success/failure.',
    whyItMatters: 'A lock older than the lock lifetime usually means a crashed worker — the job is stuck.',
    howWeMeasure: 'Stored as lockedAt on the Agenda document.',
    whatGoodLooksLike: 'Locks only present while the job is genuinely running.',
    whatToDoNext: 'If stale (>30 min) without finish, treat the job as failed and investigate the worker.',
  },
  'job-schedule': {
    term: 'Schedule',
    short: 'Recurring run cadence.',
    whatItIs: 'Agenda interval spec (e.g. `1 day`, `5 minutes`) that produces repeating jobs.',
    whyItMatters: 'Schedules are how monitoring/sync stays current without manual triggers.',
    howWeMeasure: 'Stored as repeatInterval on the Agenda document.',
    whatGoodLooksLike: 'GSC/GA4 sync schedules running daily, weekly monitor running on Mondays.',
    whatToDoNext: 'If the schedule is missing, the recurring job needs to be re-registered at startup.',
  },
  'content-brief': {
    term: 'Content brief',
    short: 'Evidence-backed plan for a single page + keyword.',
    whatItIs:
      'Structured brief built from mapped keyword + page content-fit + GSC + goals + audit issues. Optional AI assist enriches outline + sections. Analyst-reviewed before writing.',
    whyItMatters:
      'Removes "what should this page say" ambiguity. Content team gets evidence + outline + checklist instead of vague directions.',
    howWeMeasure:
      'One brief per (project, keyword, page, version). Evidence refs link back to keyword-fit, recommendations, GSC.',
    whatGoodLooksLike:
      'Briefs that get accepted, implemented, then validated via re-crawl + GSC + GA4.',
    whatToDoNext: 'Pick a mapped keyword + click New brief. Review the suggested outline, edit, then mark Approved.',
  },
  'ai-assistant': {
    term: 'AI assistant',
    short: 'A controlled helper, not a content generator.',
    whatItIs:
      'A small set of audit-logged AI tasks (summarize, classify intent, suggest sections, rewrite a recommendation, explain evidence). Powered by Gemma 4 via OpenRouter — one provider, one model.',
    whyItMatters:
      'Speeds up analyst work without replacing rules or inventing facts. Every output is marked as suggested until the analyst accepts it.',
    howWeMeasure:
      'Each task call is logged with provider/model/confidence/source ids. Output schemas are validated before display.',
    whatGoodLooksLike:
      'On-demand suggestions an analyst can accept, edit, or dismiss. No silent writes to evidence.',
    whatToDoNext: 'Click an AI assist button on a page or recommendation. Review the suggestion, then accept or dismiss.',
  },
  'keyword-fit': {
    term: 'Keyword fit',
    short: 'How well a target keyword maps to a real page.',
    whatItIs:
      'Deterministic verdict comparing the keyword to its mapped page + ranking URL: good_fit, needs_minor_update, must_improve, wrong_page_ranking, cannibalized, create_new_page, monitor.',
    whyItMatters:
      'Identifies the exact action: improve the page, move the ranking to the right URL, or create a new target.',
    howWeMeasure:
      'GSC metrics + title/H1/meta token coverage + body word count + page role — no AI.',
    whatGoodLooksLike: 'Most mapped keywords resolve to good_fit or needs_minor_update.',
    whatToDoNext:
      'Approve the linked recommendation; for must_improve/wrong_page work the recommended actions next sprint.',
    source: 'gsc',
  },
  'page-fit': {
    term: 'Content fit',
    short: 'How well a page matches its mapped keywords + intent.',
    whatItIs:
      'Page-level verdict combining keyword fits, missing sections, trust signals, CTA clarity, schema, internal links, depth.',
    whyItMatters:
      'A page can have no audit issues yet still fail commercial intent. Content fit catches that.',
    howWeMeasure:
      'Heuristics over crawled markdown + audit issues + keyword-fit verdicts — strict thresholds only.',
    whatGoodLooksLike: 'healthy or minor_update on important pages.',
    whatToDoNext:
      'Walk missing sections + open the linked recommendations from the page workspace.',
  },
  recommendation: {
    term: 'Recommendation',
    short: 'A specific, evidence-backed action for an issue.',
    whatItIs:
      'A generated proposal that translates an audit issue into: root cause, exact action, why it matters, owner, validation method.',
    whyItMatters:
      'A list of issues isn’t actionable on its own. Recommendations turn findings into work the team can execute and validate.',
    howWeMeasure:
      'Generated deterministically from the rule that fired, the finding evidence, page context, and severity.',
    whatGoodLooksLike:
      'Each active recommendation has a clear owner, a recommended action, and a validation step.',
    whatToDoNext: 'Approve / edit / reject in the issue drawer. Move to Planned once it’s scheduled.',
  },
  'recommendation-action': {
    term: 'Recommended action',
    short: 'What the analyst should do.',
    whatItIs: 'The concrete change to ship to fix the issue.',
    whyItMatters: 'Removes ambiguity from the issue list — turns “this is wrong” into “do this.”',
    howWeMeasure: 'Rule template + specific evidence from the finding (e.g. observed strings).',
    whatGoodLooksLike: 'A single paragraph an SEO or developer can read and execute without back-and-forth.',
    whatToDoNext: 'Edit if your situation needs custom wording; approve once you agree.',
  },
  'validation-method': {
    term: 'Validation method',
    short: 'How we confirm the fix worked.',
    whatItIs: 'A specific check — re-crawl, re-audit, GSC metric movement, GA4 conversions, CWV snapshot, or analyst sign-off.',
    whyItMatters: 'Recommendations without validation become noise. Every change must be provable.',
    howWeMeasure: 'Each rule template ships with a validation method; analyst can edit.',
    whatGoodLooksLike: 'Validation matches the data source that proves the change (e.g. GSC CTR for snippet changes, re-crawl for markup).',
    whatToDoNext: 'Run the validation after the team marks the recommendation as Implemented.',
  },
  'max-pages': {
    term: 'Max pages',
    short: 'Hard cap on URLs the crawler will fetch in one run.',
    whatItIs:
      'Upper bound on the number of pages a crawl run fetches. Scope rules + sampling still apply on top — max-pages is only the absolute ceiling.',
    whyItMatters:
      'Limits crawl time + cost and prevents runaway frontier explosion on very large sites.',
    howWeMeasure: 'Counted per crawl run.',
    whatGoodLooksLike: 'Set high enough to cover important pages + samples, low enough to keep crawls under a few minutes.',
    whatToDoNext: 'Light: 50. Standard: 200. Full: 2000. Custom: pick your own.',
  },
  'render-mode': {
    term: 'Render mode',
    short: 'How the crawler fetches each page.',
    whatItIs:
      'Cheerio-only fetches raw HTML — fast, no JS. Cheerio + Playwright fallback fetches raw HTML first, then re-renders selected pages in headless Chromium when needed. Playwright-only renders every page in Chromium.',
    whyItMatters:
      'JS-rendered sites need Playwright to see real content + schema. Static sites do not, and Chromium is much slower.',
    howWeMeasure: 'Per-project crawl setting.',
    whatGoodLooksLike: 'Default to Cheerio + Playwright fallback. Switch to Playwright-only for SPA shells.',
    whatToDoNext: 'Pick fallback mode unless you know the site needs full render.',
  },
  'crawl-scope': {
    term: 'Crawl scope',
    short: 'Pattern rules deciding crawl / sample / exclude / force-include per URL family.',
    whatItIs:
      'Project-level scope rules let the analyst sample repeated sections (blog, case studies), exclude noise (tag archives, search, login), force-include important pages, and normalize tracking params.',
    whyItMatters:
      'Without scope, the crawler treats every URL equally — wasting budget on duplicates and creating noisy audit findings.',
    howWeMeasure: 'Approved rules apply at crawl time. AI suggestions stay pending until analyst approves.',
    whatGoodLooksLike:
      'A small set of rules: sample blog/news/case-studies, exclude tag/search, force-include money pages.',
    whatToDoNext: 'Review suggested rules + run the pre-crawl estimate before the first crawl.',
  },
  'fix-plan': {
    term: 'Fix plan',
    short: 'Execution surface for the week.',
    whatItIs:
      'A grouped list of recommendations, issues, opportunities, and content briefs the team will execute this week or month, each with an owner, priority, target date, and validation method.',
    whyItMatters:
      'Without a plan, audit findings sit in lists. The plan is what turns recommendations into shipped work.',
    howWeMeasure:
      'Per-item lifecycle (planned → in-progress → fixed → ready-for-validation → validated / failed-validation / deferred) plus evidence-based validation results from the same data source the item originated from.',
    whatGoodLooksLike:
      'A small, ranked list. Every item has an owner. Validation pulls real data — not analyst opinion.',
    whatToDoNext:
      'Generate weekly draft, prune what doesn\'t belong this week, run validation after work lands.',
  },
  'experimental-rule': {
    term: 'Experimental rule',
    short: 'A new rule that is not yet trusted for client-ready reports.',
    whatItIs:
      'Rules in `experimental` lifecycle. They do not affect scores or create production issues yet.',
    whyItMatters: 'Lets us validate new checks without polluting the issue list.',
    howWeMeasure: 'Per-rule lifecycle flag.',
    whatGoodLooksLike: 'Experimental rules promoted to active once they prove useful.',
    whatToDoNext: 'Review experimental findings separately; nothing to fix yet.',
  },
};

export type GlossaryTerm = keyof typeof G;

export function lookupGlossary(term: string): GlossaryEntry | undefined {
  return G[term];
}

export type GlossaryListEntry = GlossaryEntry & { key: GlossaryTerm };

export function listGlossaryEntries(): GlossaryListEntry[] {
  return Object.entries(G)
    .map(([key, entry]) => ({ ...entry, key: key as GlossaryTerm }))
    .sort((a, b) => a.term.localeCompare(b.term));
}

export const glossary = G;
