# 09. Info Icons, Glossary And UX Education

## Purpose

This product must be usable by two very different audiences:

1. Senior SEO analysts who already understand the terms and need fast workflow.
2. Founders, marketers, developers, and junior SEO team members who need context before they can act.

The UI must not assume that every user understands technical SEO vocabulary. Every technical term must have an info icon with a clear explanation.

This is not decoration. It is part of the product value.

If a report says "Canonical mismatch", "Indexability", "LCP", "CTR", "Cannibalization", "Schema", "AEO", or "Orphan page", the user must be able to understand:

- What it means.
- Why it matters.
- How the tool detected it.
- What a good value looks like.
- What to do next.
- Whether the recommendation is based on crawl data, GSC, GA4, CWV, AI, or external data.

## Product Rule

Every SEO, analytics, crawl, performance, keyword, reporting, AI, and strategy term shown in the UI must have an info icon unless the term is plain language.

Examples of plain language:

- Page
- URL
- Title
- Status
- Traffic
- Report

Examples that must have info icons:

- Indexability
- Canonical
- Noindex
- Robots.txt
- Core Web Vitals
- LCP
- INP
- CLS
- CTR
- Average position
- Search intent
- Keyword cannibalization
- Topic cluster
- Entity coverage
- E-E-A-T
- GEO
- AEO
- Schema
- Structured data
- Orphan page
- Crawl depth
- Internal link equity
- Conversion action
- Opportunity score

## Where Info Icons Must Appear

### 1. Table Headers

Any technical column in a table must have an info icon in the header.

Examples:

- Pages table:
  - Indexability
  - Crawl depth
  - Links in
  - Links out
  - Canonical
  - Schema
  - Organic clicks
  - CTR
  - Avg position
  - Issue count

- Issues table:
  - Severity
  - Priority
  - Impact
  - Effort
  - Lifecycle status
  - Evidence
  - Affected URLs

- Keywords table:
  - Intent
  - Difficulty
  - Search volume
  - CTR
  - Cannibalization
  - Mapped page
  - Opportunity score

### 2. Chart Titles And Metric Labels

Every chart title or metric label using technical language must include an info icon.

Examples:

- "Organic Clicks"
- "Average Position"
- "Core Web Vitals Pass Rate"
- "Indexable Pages"
- "High Priority Issues"
- "Search Visibility"
- "Content Gap"
- "Topic Coverage"

The tooltip must also explain what the chart shows and what the user should look for.

Bad:

> Organic Clicks

Better:

> Organic Clicks (info icon)

Tooltip:

> The number of clicks from Google organic search. This comes from Google Search Console. A drop can indicate ranking loss, lower CTR, seasonal demand changes, or tracking/property issues.

### 3. Filters

Technical filters need info icons because users may otherwise filter incorrectly.

Examples:

- Indexable only
- Non-indexable
- Noindex
- Canonicalized
- Redirected
- Orphan pages
- Low CTR
- Query drop
- Missing schema
- High intent
- Quick wins
- Branded / non-branded

### 4. Issue Drawer

Every issue drawer must include explainers for:

- Rule name
- Severity
- Priority
- Impact
- Effort
- Category
- Evidence
- Affected page
- Data source
- Verification status

The issue drawer is where analysts will explain problems to developers and clients. It must be educational without becoming noisy.

### 5. Page Workspace

The page-level screen must include info icons for each audit section:

- Crawl status
- Indexability
- Metadata
- Headings
- Content quality
- Internal links
- Schema
- Search performance
- GA4 engagement
- Core Web Vitals
- AI summary
- Opportunities

### 6. Reports

Reports must have info icons or expandable definitions for technical terms.

Client-facing reports must avoid unexplained jargon.

If the report says:

> 12 pages are noindex.

It must explain:

> Noindex means the page is telling search engines not to show it in search results. This is fine for private, admin, legal, or duplicate pages, but harmful if important service, product, or content pages are affected.

### 7. Settings And Integrations

Settings screens must explain integration terms:

- GSC property
- GA4 property
- OAuth
- Data retention
- Sync frequency
- Crawl limit
- User agent
- Sitemap
- Robots.txt
- Crawl4AI markdown
- Markdown extraction

### 8. AI Screens

AI output must clearly label:

- AI-generated
- Data-backed
- Needs analyst review
- Confidence
- Source pages
- Missing evidence

If an AI insight is not supported by crawl, GSC, GA4, CWV, or keyword data, the UI must say so.

## Tooltip Content Template

Every info icon should follow this structure where possible:

### Short Definition

Explain the term in one or two sentences.

### Why It Matters

Explain the SEO or business impact.

### How This Tool Measures It

Mention the data source:

- Crawl
- Crawl4AI markdown
- HTML extraction
- Google Search Console
- GA4
- Core Web Vitals
- User-entered project goals
- AI analysis
- External keyword provider
- Manual analyst input

### Good / Bad Signals

Give practical interpretation.

Example:

- Good: Important pages are indexable.
- Bad: Important service or lead-generation pages are noindex.

### What To Do Next

Give a short action.

Example:

> Review whether this page should appear in Google. If yes, remove the noindex directive and re-audit.

### Limitations

If data may be incomplete, say it.

Example:

> GSC data only includes Google organic search and may be delayed by 1-3 days.

## Required Glossary Categories

The product needs a searchable glossary page. The glossary must also power inline info icons so definitions stay consistent.

### Crawl And Indexing Terms

#### Crawl

The process of visiting website pages and collecting technical, content, and link data.

Why it matters:

If the tool cannot crawl the site properly, audit results may be incomplete or misleading.

#### Crawl Depth

How many clicks a page is from the homepage or crawl start point.

Why it matters:

Important pages buried too deep may receive less internal link value and may be harder for users and search engines to discover.

#### Sitemap

A file that lists URLs the website wants search engines to discover.

Why it matters:

Missing, outdated, or noisy sitemaps can reduce crawl efficiency and hide important page coverage problems.

#### Robots.txt

A file that tells crawlers which parts of a site they can or cannot access.

Why it matters:

Incorrect robots rules can block important pages or assets from search engines.

#### Blocked By Robots

The page or asset cannot be crawled because robots.txt disallows it.

Why it matters:

This is normal for private/admin areas, but harmful if important public pages are blocked.

#### Status Code

The HTTP response code returned by a URL.

Why it matters:

200 means accessible, 3xx means redirected, 4xx means client error, and 5xx means server error. Search engines and users are affected differently by each.

#### Redirect Chain

A sequence where one URL redirects to another, which may redirect again.

Why it matters:

Long redirect chains slow down users and crawlers, waste crawl budget, and can weaken SEO signals.

#### Broken URL

A URL returning an error such as 404 or 500.

Why it matters:

Broken URLs hurt user experience, waste internal links, and can damage search trust if important pages are affected.

#### Canonical URL

The preferred version of a page that search engines should index when similar or duplicate URLs exist.

Why it matters:

Incorrect canonicals can cause Google to ignore the wrong page or consolidate signals incorrectly.

#### Indexability

Whether a page can be indexed by search engines.

Why it matters:

Important pages must be indexable. Pages that are blocked, noindex, canonicalized elsewhere, or erroring may not appear in search results.

#### Noindex

A directive telling search engines not to include a page in search results.

Why it matters:

Useful for private or duplicate pages, dangerous on important commercial or informational pages.

#### Orphan Page

A page found in a sitemap or external source but not linked internally from the site crawl.

Why it matters:

Search engines and users may have difficulty discovering orphan pages, and those pages may receive weak internal authority.

#### Internal Link

A link from one page on the same website to another page on the same website.

Why it matters:

Internal links help users navigate and help search engines understand page importance and topical relationships.

#### External Link

A link from the website to another domain.

Why it matters:

External links can provide context and trust, but broken or irrelevant external links may hurt quality.

#### Crawl4AI Markdown

Cleaned page content extracted into markdown format for analysis.

Why it matters:

Markdown helps AI and rule engines analyze page content without noisy HTML, scripts, and layout code.

### On-Page SEO Terms

#### Title Tag

The HTML title used by browsers and often shown in search results.

Why it matters:

It strongly influences relevance, click-through rate, and how users understand the page.

#### Meta Description

A short page summary that may appear in search results.

Why it matters:

It does not directly guarantee rankings, but it can improve click-through rate when written well.

#### H1

The main heading of a page.

Why it matters:

It helps users and search engines understand the main topic of the page.

#### Heading Structure

The hierarchy of H1, H2, H3, and deeper headings.

Why it matters:

Clear headings improve readability, content structure, accessibility, and topical clarity.

#### Alt Text

Text describing an image for search engines and assistive technology.

Why it matters:

It improves accessibility and helps image/content relevance.

#### Thin Content

A page with too little useful content for its purpose.

Why it matters:

Thin pages often fail to satisfy search intent and may not rank well.

#### Duplicate Title

Multiple pages using the same title tag.

Why it matters:

It makes pages harder to distinguish in search and can indicate duplicate or weak page targeting.

#### Duplicate Meta Description

Multiple pages using the same meta description.

Why it matters:

It reduces result uniqueness and may signal template-level SEO neglect.

### Structured Data Terms

#### Schema

Structured data that helps search engines understand page entities, relationships, and content type.

Why it matters:

Schema can improve eligibility for rich results and helps machines interpret the page more accurately.

#### JSON-LD

A common format for adding schema to a web page.

Why it matters:

Google recommends JSON-LD for many structured data types because it is clean and maintainable.

#### Organization Schema

Structured data describing an organization.

Why it matters:

It helps search engines understand brand identity, logo, contact points, and entity relationships.

#### WebSite Schema

Structured data describing the website as a whole.

Why it matters:

It helps establish site identity and may support search features such as sitelinks search box where eligible.

#### Breadcrumb Schema

Structured data describing the page's position in the site hierarchy.

Why it matters:

It helps search engines understand site structure and may improve search result presentation.

#### Article Schema

Structured data for editorial or blog content.

Why it matters:

It helps clarify author, date, headline, and article context.

#### FAQ Schema

Structured data for question-and-answer content.

Why it matters:

It helps machines understand direct answers, although rich result display depends on search engine eligibility.

#### Product Schema

Structured data describing a product.

Why it matters:

It can support product understanding and rich result eligibility when complete and valid.

### Performance Terms

#### Core Web Vitals

Google's user experience metrics for loading, interactivity, and visual stability.

Why it matters:

Poor Core Web Vitals can hurt user experience and may affect search performance in competitive areas.

#### LCP

Largest Contentful Paint. It measures how quickly the main visible content loads.

Why it matters:

Slow LCP makes pages feel slow and can reduce conversions and organic performance.

#### INP

Interaction to Next Paint. It measures page responsiveness after user interaction.

Why it matters:

Poor INP makes pages feel sluggish, especially on mobile.

#### CLS

 Cumulative Layout Shift. It measures unexpected layout movement.

Why it matters:

High CLS creates a frustrating experience and can cause accidental clicks.

#### FCP

First Contentful Paint. It measures when the first visible content appears.

Why it matters:

It helps diagnose perceived loading speed.

#### TTFB

Time To First Byte. It measures how long the server takes to begin responding.

Why it matters:

High TTFB can slow the entire loading experience.

### Search Console Terms

#### Query

The search phrase a user typed into Google.

Why it matters:

Queries reveal real demand and how users discover the website.

#### Clicks

The number of times users clicked the website from Google search results.

Why it matters:

Clicks represent actual organic search traffic from Google.

#### Impressions

The number of times the website appeared in Google search results.

Why it matters:

High impressions with low clicks may indicate weak title, description, ranking position, or intent mismatch.

#### CTR

Click-through rate. Clicks divided by impressions.

Why it matters:

CTR shows how often users choose the result when they see it.

#### Average Position

The average ranking position in Google Search Console.

Why it matters:

It helps estimate search visibility, but it is an average and can hide query/device/location variation.

#### Keyword Cannibalization

When multiple pages compete for the same or similar search queries.

Why it matters:

It can split ranking signals and confuse which page should rank.

#### Quick Win

An opportunity where a page or query is close to delivering more traffic with relatively low effort.

Why it matters:

It helps analysts prioritize work that can produce visible gains quickly.

### Analytics Terms

#### Sessions

Visits to the website.

Why it matters:

Sessions show user demand and acquisition volume.

#### Users

People visiting the website.

Why it matters:

Users help distinguish repeat visits from audience growth.

#### Engagement Rate

The percentage of sessions considered engaged by GA4.

Why it matters:

Low engagement may indicate poor content fit, slow UX, weak layout, or irrelevant traffic.

#### Conversion

A meaningful action completed by a visitor.

Why it matters:

SEO should support business outcomes, not only traffic.

#### Organic Sessions

Sessions from unpaid search traffic.

Why it matters:

This is one of the main measures of SEO impact.

#### Channel

The source category of traffic, such as Organic Search, Paid Search, Direct, Referral, or Social.

Why it matters:

Channel context helps separate SEO performance from other marketing activity.

### Strategy Terms

#### Search Intent

The reason behind a user's search.

Why it matters:

Pages must match intent to rank and convert.

Common intent types:

- Informational
- Commercial
- Transactional
- Navigational
- Local
- Support

#### Funnel Stage

Where the user is in the decision journey.

Why it matters:

Content should support awareness, consideration, conversion, retention, or advocacy depending on the page purpose.

#### Entity

A clearly identifiable thing, such as a company, person, service, product, place, school, nonprofit, topic, or concept.

Why it matters:

Search engines and AI systems use entities to understand meaning and relationships.

#### Topic Cluster

A group of related pages covering a broader topic.

Why it matters:

Topic clusters help build topical authority and improve internal linking.

#### Topical Authority

The perceived expertise of a website around a subject area.

Why it matters:

Sites with deep, useful coverage of a topic are more likely to perform well.

#### E-E-A-T

Experience, Expertise, Authoritativeness, and Trustworthiness.

Why it matters:

It is especially important for content where accuracy, trust, safety, money, health, or professional credibility matter.

#### AEO

Answer Engine Optimization. Optimizing content so answer engines can extract clear answers.

Why it matters:

Search behavior increasingly includes direct answers, AI summaries, and assistant-style responses.

#### GEO

Generative Engine Optimization. Optimizing content for visibility and usefulness in AI-generated answers.

Why it matters:

Users may discover brands through AI answer engines, not only traditional search results.

#### Content Gap

A missing topic, page, answer, or keyword opportunity compared with user demand or competitors.

Why it matters:

Content gaps help analysts decide what to create, improve, or consolidate.

#### Opportunity Score

A prioritization score estimating potential value relative to effort and confidence.

Why it matters:

It helps teams choose what to work on first.

## Tooltip Examples

### Indexability

Definition:

> Whether a page can be included in search engine results.

Why it matters:

> Important pages that are not indexable cannot reliably bring organic traffic.

How this tool measures it:

> The tool checks HTTP status, robots.txt, meta robots, canonical tags, and crawl accessibility.

Good / bad:

> Good: Important pages return 200, are not blocked, are not noindex, and canonicalize to themselves. Bad: Lead-generation or content pages are noindex, blocked, redirected unexpectedly, or canonicalized elsewhere.

What to do next:

> Confirm whether the page should rank. If yes, remove blocking directives and re-audit.

### CTR

Definition:

> Click-through rate is the percentage of search impressions that became clicks.

Why it matters:

> Low CTR can mean the page appears in search but users are not choosing it.

How this tool measures it:

> Clicks divided by impressions from Google Search Console.

Good / bad:

> Good CTR depends on ranking position and query type. A page ranking in positions 1-3 should usually have stronger CTR than a page ranking in positions 8-20.

What to do next:

> Review title tag, meta description, search intent, SERP competitors, and whether the query is branded or non-branded.

### Keyword Cannibalization

Definition:

> Multiple pages ranking or being shown for the same search query.

Why it matters:

> It may split authority and make Google unsure which page is the best result.

How this tool measures it:

> The tool compares GSC query-to-page data and flags queries where multiple URLs receive impressions or clicks.

What to do next:

> Decide the preferred ranking page, then consolidate, differentiate, redirect, canonicalize, or improve internal linking.

### LCP

Definition:

> Largest Contentful Paint measures how quickly the main content appears.

Why it matters:

> Slow LCP makes the page feel slow and can reduce conversions.

How this tool measures it:

> The tool uses Core Web Vitals data where available.

What to do next:

> Optimize hero images, server response, render-blocking resources, and above-the-fold content delivery.

### Canonical

Definition:

> A canonical tag tells search engines which URL is the preferred version of similar or duplicate content.

Why it matters:

> Incorrect canonicals can cause the wrong URL to be indexed.

How this tool measures it:

> The crawler extracts canonical tags from page HTML.

What to do next:

> Important unique pages should usually self-canonicalize unless there is a deliberate duplicate/preferred URL strategy.

### Orphan Page

Definition:

> A page that exists but is not linked from other crawled pages.

Why it matters:

> Orphan pages are harder for users and search engines to discover.

How this tool measures it:

> The tool compares URLs found from sitemap or integrations against URLs discovered through internal links.

What to do next:

> Add relevant internal links from navigation, hub pages, related content, or conversion pages.

### Schema

Definition:

> Structured data that helps machines understand page content and entities.

Why it matters:

> It can improve search understanding and rich result eligibility.

How this tool measures it:

> The crawler extracts JSON-LD and other structured data from the page.

What to do next:

> Add the correct schema type for the page purpose and validate required properties.

### Search Intent

Definition:

> The reason someone searched for a query.

Why it matters:

> A page that does not match intent usually struggles to rank or convert.

How this tool measures it:

> The tool can infer intent from query patterns, page content, SERP data when available, and analyst input.

What to do next:

> Match the page format and content depth to the user's intent.

### Conversion Action

Definition:

> A valuable action a user can take, such as submitting a form, booking a call, donating, applying, buying, or downloading.

Why it matters:

> SEO should improve business outcomes, not only traffic.

How this tool measures it:

> The tool uses project goals, GA4 events, page content, and analyst-defined actions.

What to do next:

> Ensure important pages have clear, relevant conversion actions.

### GEO / AEO

Definition:

> GEO focuses on visibility in AI-generated answers. AEO focuses on clear answer extraction.

Why it matters:

> Search behavior is shifting toward AI summaries, assistants, and answer engines.

How this tool measures it:

> The tool checks answer clarity, entity coverage, citations, structured content, summaries, FAQs, and source credibility signals.

What to do next:

> Add direct answers, strengthen entity information, improve citations, and make content easier for machines to summarize accurately.

## Glossary Page Requirements

The product must include a glossary page or help center inside the application.

### Required Features

- Search by term.
- Filter by category.
- Show related terms.
- Show data source.
- Show examples.
- Link from glossary term to relevant screens.
- Allow beginner and expert explanations.

### Glossary Entry Structure

Each glossary entry must include:

- Term
- Category
- Short definition
- Detailed explanation
- Why it matters
- How the tool measures it
- Good signal
- Bad signal
- Recommended action
- Related terms
- Data source
- Limitations

### Example Entry

Term:

> Average Position

Category:

> Google Search Console

Short definition:

> The average ranking position of a page or query in Google Search.

Why it matters:

> It helps estimate visibility, but it should be interpreted with clicks, impressions, CTR, device, location, and query type.

How the tool measures it:

> Imported from Google Search Console.

Good signal:

> Important target queries moving from positions 8-20 into positions 1-7.

Bad signal:

> Important high-impression queries declining over time.

Recommended action:

> Review page relevance, title, content depth, internal links, and competing pages.

Limitations:

> Average position is not a fixed rank. It is averaged across searches and can vary by user, device, and location.

## Beginner / Expert Mode

The UI should support two explanation levels:

### Beginner Mode

Use plain language and practical examples.

Example:

> This page tells Google not to show it in search results.

### Expert Mode

Use precise SEO language.

Example:

> The page is non-indexable because it contains a meta robots noindex directive.

### Analyst Preference

Each user should eventually be able to choose:

- Beginner explanations
- Expert explanations
- Compact tooltips
- Expanded tooltips

For the first implementation, use compact tooltips with a "Learn more" link to the glossary.

## UI Behavior

### Tooltip Trigger

Use a small info icon next to the term.

The icon should be:

- Visible enough to notice.
- Not visually noisy.
- Keyboard accessible.
- Screen-reader accessible.

### Tooltip Length

Tooltips should be short.

Recommended tooltip length:

- 2-4 short sentences.

Longer explanations should open the glossary drawer or help page.

### Glossary Drawer

When a tooltip needs more explanation, show:

- Short definition in tooltip.
- "Learn more" opens side drawer.
- Drawer includes examples and recommended actions.

### Reports

Reports should not show too many icons visually. Instead, use:

- Expandable definitions.
- Glossary appendix.
- Inline explanation for high-impact terms.

## Accessibility Requirements

Info icons must be accessible.

Requirements:

- Keyboard focusable.
- Screen-reader label.
- Tooltip content readable by screen readers.
- Sufficient contrast.
- No hover-only access on mobile.
- Tap behavior on mobile.
- Escape closes tooltip/drawer.

## Data Source Labels

Every metric should show where it came from.

Examples:

- Crawl
- GSC
- GA4
- Core Web Vitals
- AI
- Manual input
- External keyword provider

This matters because SEO analysts need to trust the data.

Example:

> Organic clicks: 1,240
> Source: Google Search Console
> Last synced: 2026-05-15 10:30

## Missing Data Education

When data is missing, the UI must explain why.

Bad:

> No data

Better:

> No GSC data is available yet. Connect Google Search Console to see clicks, impressions, CTR, average position, query opportunities, and cannibalization.

Bad:

> CWV unavailable

Better:

> Core Web Vitals data is unavailable for this URL. This can happen when the page does not have enough Chrome UX Report field data. You can still review lab performance separately later.

## Info Icon Completion Criteria

This file is complete only when:

- All technical table headers have info icons.
- All chart metrics have info icons or chart explanations.
- All issue fields have explainers.
- All integration metrics show source and last sync time.
- All reports define technical terms.
- Missing-data states explain what is missing and why it matters.
- Tooltips work on desktop and mobile.
- Tooltips are accessible by keyboard and screen reader.
- A glossary page or drawer exists.
- Glossary entries are reused by the UI instead of duplicated manually.

## Do Not Mark This Complete If

- Technical terms appear without explanation.
- Tooltips only define the term but do not explain why it matters.
- Tooltips do not mention data source.
- Reports contain jargon without client-friendly explanation.
- Mobile users cannot open tooltips.
- Tooltips are too long and become unreadable.
- The glossary exists but is not linked from the actual product screens.

## Self-Audit Questions

Before marking this phase complete, answer:

1. Can a non-SEO founder understand the dashboard without external explanation?
2. Can a junior SEO understand what each issue means and what to do next?
3. Can a senior SEO quickly ignore explanations and keep working?
4. Does every metric show data source and freshness?
5. Do missing-data states explain what the user should connect or fix?
6. Do reports explain technical terms well enough for clients?
7. Are tooltips accessible and usable on mobile?

