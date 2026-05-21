# Phase 11: Crawl Scope Rules, URL Pattern Grouping, And Template Sampling

## Purpose

The product should not blindly crawl a full website when many URLs are repetitive, low-priority, or template-driven.

The goal is:

> Crawl the right set of pages seriously, sample repeated URL patterns intelligently, and report common issues at the template/group level instead of creating noisy duplicate findings.

This phase improves:

- crawl speed.
- crawl cost.
- rendered crawl cost.
- audit noise.
- analyst focus.
- report clarity.
- onboarding confidence.

This is not only a technical crawl optimization. It is a product workflow improvement for SEO analysts.

## Product Problem

Many real websites contain repeated URL families:

- `/blog/**`
- `/case-studies/**`
- `/testimonials/**`
- `/resources/**`
- `/events/**`
- `/news/**`
- `/products/**`
- `/collections/**`
- `/locations/**`
- `/faculty/**`
- `/authors/**`
- `/tags/**`
- `/category/**`
- `/search/**`
- pagination URLs.
- UTM/tracking URLs.

If the tool crawls everything equally:

- crawl runs become slow.
- reports fill with duplicate issues.
- analysts waste time reading the same problem on 50 similar pages.
- important commercial/service/conversion pages get buried.
- client reports look noisy instead of strategic.

The system must distinguish:

- pages that should be crawled deeply.
- pages that should be sampled.
- pages that should be excluded.
- pages that should be normalized.
- pages that belong to the same template/group.

## Senior SEO Analyst Principle

Do not optimize for maximum crawled pages.

Optimize for:

1. enough coverage to detect real SEO issues.
2. enough sampling to understand repeated templates.
3. enough focus to prioritize high-value pages.
4. enough transparency so analysts trust what was skipped or sampled.

A serious SEO audit should answer:

- What important pages need work?
- Which templates have repeated problems?
- Which sections were sampled?
- Which URLs were excluded and why?
- Are we missing an important page type?
- Is the crawl representative enough to support recommendations?

## Current State

Current crawler flow, simplified:

1. seed URL.
2. robots.
3. sitemap discovery.
4. frontier seeded from sitemap.
5. Cheerio crawl by default.
6. internal links are discovered.
7. up to `maxPages`.
8. optional rendered crawl fallback based on project crawl settings.

Relevant files:

- `apps/backend/src/crawler/orchestrator.ts`
- `apps/backend/src/crawler/discover/sitemap.ts`
- `apps/backend/src/crawler/normalize/url.ts`
- `apps/backend/src/crawler/page-role.ts`
- `apps/backend/src/db/models/project.ts`
- `apps/web/src/app/projects/[id]/settings/crawl/page.tsx`

Current project settings support render mode, but not crawl scope patterns.

Existing `ruleOverrides` has some pattern fields, but this is not enough for crawl scope because it is rule/audit-oriented, not crawler-selection-oriented.

## Final Product Decision

Add project-level crawl scope rules.

Rules should support:

- crawl all.
- sample max N.
- exclude.
- include/force crawl.
- mark important.
- normalize query params.
- group as a page/template family.

Rules should be visible and editable by analysts during project setup and crawl settings.

AI may suggest rules, but must not silently apply destructive crawl exclusions.

Analyst approval is required before AI-suggested rules affect the crawl.

## User Flow

### 1. Project Setup

After creating a project, the analyst should see:

1. Project profile.
2. Goals.
3. Integrations.
4. Crawl settings.
5. Crawl scope rules.

Crawl scope should answer:

- What should we crawl fully?
- What should we sample?
- What should we ignore?
- Which URL families exist?

### 2. Discovery Step

Before full crawl, the system should discover candidate URLs from:

- homepage.
- robots/sitemap.
- top navigation links.
- footer links.
- first-level internal links.
- sitemap URL paths.
- GSC top pages, if GSC is connected.

The discovery step does not need to fetch every page deeply.

It should produce:

- candidate URL list.
- detected URL patterns.
- counts per pattern.
- suggested crawl behavior per pattern.
- examples per pattern.

### 3. AI-Assisted Suggestions

AI can inspect URL paths, titles if already available, sitemap metadata, and shallow discovery examples.

AI should suggest:

- group name.
- URL pattern.
- page family.
- recommended behavior.
- sample size.
- reason.
- confidence.

Examples:

```json
{
  "groupName": "Blog articles",
  "pattern": "/blog/**",
  "behavior": "sample",
  "sampleLimit": 5,
  "reason": "Large article directory. Sample enough to detect template/content quality issues without overloading the crawl.",
  "confidence": 0.88
}
```

Analyst must approve, edit, or reject each suggestion.

### 4. Analyst Review Screen

The crawl scope screen should show a table:

| Group | Pattern | Discovered | Behavior | Sample Limit | Examples | Source | Confidence | Status |
|---|---:|---:|---|---:|---|---|---:|---|
| Blog articles | `/blog/**` | 412 | Sample | 5 | View | AI suggested | 88% | Pending |
| Service pages | `/services/**` | 16 | Crawl all | - | View | Heuristic | 72% | Approved |
| Tag archives | `/tag/**` | 97 | Exclude | - | View | Heuristic | 91% | Approved |

Each row should support:

- approve.
- edit.
- reject.
- test pattern.
- view matched URLs.
- change behavior.
- change sample size.
- mark as important.

### 5. Pre-Crawl Summary

Before running a full crawl, show:

- total discovered URLs.
- expected full crawl URLs.
- expected sampled URLs.
- expected excluded URLs.
- top sampled groups.
- top excluded groups.
- warnings if important-looking pages are excluded.

Example:

```text
Discovered: 1,240 URLs
Will crawl fully: 82 URLs
Will sample: 26 URLs across 5 groups
Will exclude: 1,132 URLs
Potential risk: /locations/** is sampled, but project has a local SEO goal.
```

The analyst should be able to continue or edit scope rules.

## Rule Behaviors

### Crawl All

Use for:

- homepage.
- services.
- products or categories when core to business.
- pricing.
- contact.
- about.
- important conversion pages.
- top GSC pages.
- pages marked important.

Behavior:

- all matching URLs enter crawl queue, within global maxPages.
- higher priority in frontier.

### Sample

Use for:

- blogs.
- case studies.
- testimonials.
- resources.
- news.
- events.
- large docs directories.
- product detail pages when ecommerce is not the current focus.

Behavior:

- choose representative URLs up to `sampleLimit`.
- still track discovered count.
- assign all matching URLs to same group.
- audit sampled pages.
- report template/group issue if issue appears repeatedly in sample.

### Exclude

Use for:

- search result pages.
- tag archives, unless content strategy requires them.
- author archives, unless publisher SEO requires them.
- pagination duplicates.
- login/account/cart/checkout.
- API endpoints.
- feeds.
- media asset URLs.
- UTM/tracking variants.
- internal preview/staging URLs.

Behavior:

- do not crawl.
- record exclusion reason.
- show in crawl diagnostics.

### Force Include

Use for:

- analyst-selected URLs.
- client-critical landing pages.
- top revenue/conversion pages.
- GSC high-impression pages.
- pages that match an exclude/sample pattern but must be crawled fully.

Behavior:

- always crawl unless blocked by robots or invalid URL.
- overrides sample/exclude rule.

### Normalize

Use for:

- UTM parameters.
- tracking parameters.
- sort/filter parameters.
- trailing slash variants.
- mixed casing where safe.

Behavior:

- canonicalize URLs before dedupe.
- record original examples.

## Default System Rules

The system should ship with safe defaults, but analysts can edit.

### Always Exclude By Default

- `/wp-json/**`
- `/feed/**`
- `/**/feed/**`
- `/search/**`
- `/wp-admin/**`
- `/cart/**`
- `/checkout/**`
- `/account/**`
- `/login/**`
- `/admin/**`
- URLs with `utm_*`
- URLs with `fbclid`
- URLs with `gclid`
- file assets: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.pdf`, `.zip`, `.css`, `.js`, `.woff`, `.woff2`

Important:

PDF exclusion should be configurable because some NGO, education, government, and research websites rely heavily on PDFs.

### Usually Sample

- `/blog/**`
- `/news/**`
- `/case-studies/**`
- `/testimonials/**`
- `/resources/**`
- `/events/**`
- `/authors/**`
- `/tag/**`
- `/category/**`

But do not hardcode this blindly.

Examples:

- Publisher site: blog/news may be core and should not be sampled too aggressively.
- Ecommerce site: product pages may need deeper sampling.
- Local SEO site: location pages may need full crawl.
- Education site: course/faculty pages may be important.
- NGO site: campaigns/resources may be primary conversion pages.

The system must consider website type, goals, and analyst overrides.

## Dynamic Website Types

Crawl scope must not assume every website is a service business.

Support examples:

### Service Business

Usually crawl fully:

- home.
- services.
- industries.
- pricing.
- contact.
- about.
- case-study index.

Usually sample:

- blog.
- case studies.
- testimonials.

### NGO

Usually crawl fully:

- home.
- donate.
- campaigns.
- about.
- impact.
- contact.
- volunteer.

Usually sample:

- news.
- events.
- resources.
- stories.

### Education

Usually crawl fully:

- admissions.
- programs.
- courses.
- departments.
- fees.
- contact.

Usually sample:

- faculty profiles.
- news.
- events.
- student stories.

### Ecommerce

Usually crawl fully:

- home.
- category pages.
- top products from GSC.
- collection pages.
- policy pages.

Usually sample:

- product detail pages by category.
- reviews.
- tag/filter pages.

### SaaS / Documentation

Usually crawl fully:

- home.
- product.
- pricing.
- features.
- integrations.
- use cases.
- docs top-level.

Usually sample:

- deep docs pages.
- release notes.
- changelog.
- blog.

### Local Business

Usually crawl fully:

- services.
- locations.
- contact.
- reviews/testimonials page.
- appointment/booking pages.

Usually sample:

- blog.
- gallery.
- staff profiles.

## Sampling Strategy

Sampling should not simply take the first N URLs.

For each sampled group, choose a representative set:

1. first URL by sitemap/order.
2. newest URL if sitemap `lastmod` exists.
3. oldest URL if sitemap `lastmod` exists.
4. URL with highest internal link count, if known.
5. URL with GSC clicks/impressions, if connected.
6. random middle sample.
7. analyst-forced URLs.

If sample limit is 5, prefer:

- 1 newest.
- 1 oldest.
- 1 top internally linked.
- 1 top GSC page.
- 1 random or first.

If GSC is not connected, skip GSC weighting.

Always show why each sampled URL was selected.

## URL Grouping

Every discovered URL should have a crawl scope decision:

- `crawl`
- `sampled`
- `excluded`
- `force_included`
- `normalized_duplicate`
- `blocked_by_robots`
- `out_of_scope`

Every URL that matches a pattern should be assigned to a URL group/template group.

Example groups:

- Blog Article Template
- Case Study Template
- Product Detail Template
- Location Page Template
- Faculty Profile Template
- Event Detail Template
- Tag Archive Template

## Issue Grouping Impact

If sampled pages from the same group share the same issue, report it as a group/template issue.

Example:

Instead of:

- Blog page 1 missing author.
- Blog page 2 missing author.
- Blog page 3 missing author.
- Blog page 4 missing author.
- Blog page 5 missing author.

Show:

```text
Blog Article Template: missing author byline/schema
Sampled pages affected: 5/5
Discovered pages in group: 412
Likely template-level issue: yes
Recommendation: update the blog article template.
```

Important:

Do not claim all 412 pages are definitely affected unless all 412 were checked.

Use language:

- "Detected in 5 of 5 sampled pages."
- "Likely affects the Blog Article Template."
- "Validate after template fix by recrawling another sample."

## Reporting Impact

Reports should separate:

1. important URL issues.
2. template/group issues.
3. sampled-section findings.
4. excluded-section notes.
5. crawl coverage summary.

Client-friendly example:

```text
We sampled the Blog Article section because it contains 412 similar URLs. The sampled pages showed a repeated missing author/schema pattern, which suggests a template-level fix rather than individual page edits.
```

Internal analyst example:

```text
Scope rule /blog/** sampled 5 of 412. Rule structured-data.article.missing fired on 5/5 sampled pages. Treat as template-level unless a larger sample disproves it.
```

## Data Model Direction

### Project Crawl Scope Settings

Add to Project:

```ts
crawlScopeSettings: {
  enabled: boolean;
  defaultBehavior: 'crawl' | 'sample';
  maxSamplePerGroup: number;
  aiSuggestionsEnabled: boolean;
  requireApprovalForAiRules: boolean;
}
```

### Crawl Scope Rule

Can be embedded in Project or its own collection.

Recommended: separate collection if rules need history/approval.

```ts
CrawlScopeRule {
  projectId
  name
  pattern
  patternType: 'glob' | 'regex' | 'prefix'
  behavior: 'crawl' | 'sample' | 'exclude' | 'force_include' | 'normalize'
  sampleLimit
  priority
  groupName
  pageFamily
  reason
  source: 'system' | 'heuristic' | 'ai' | 'analyst'
  confidence
  status: 'suggested' | 'approved' | 'rejected' | 'disabled'
  createdAt
  updatedAt
}
```

### URL Group / Template Group

```ts
UrlGroup {
  projectId
  name
  pattern
  pageFamily
  discoveredCount
  crawledCount
  sampledCount
  excludedCount
  sampleLimit
  examples: string[]
  sourceRuleId
  confidence
  lastEvaluatedAt
}
```

### Page Fields

Add to Page:

```ts
crawlScopeDecision: 'crawl' | 'sampled' | 'force_included'
urlGroupId
urlGroupName
scopeRuleId
sampleReason
```

For excluded URLs, do not create full Page records unless needed. Store them in crawl diagnostics or a lightweight `CrawlCandidate`/`ExcludedUrl` collection.

### Crawl Candidate

Recommended for transparency:

```ts
CrawlCandidate {
  projectId
  crawlRunId
  url
  normalizedUrl
  source: 'seed' | 'sitemap' | 'link' | 'gsc'
  matchedRuleId
  groupName
  decision
  reason
  selectedForCrawl: boolean
}
```

This helps the analyst inspect what was excluded/sampled without creating full page records.

## Backend Implementation Direction

### 1. Discover Candidate URLs

Add a discovery/candidate phase before fetch.

Inputs:

- seed URL.
- sitemap URLs.
- robots.
- homepage links.
- GSC pages if connected.

Output:

- candidate URLs.
- normalized URLs.
- source.
- path segments.

### 2. Apply Built-In Normalization

Before grouping:

- remove known tracking params.
- normalize trailing slash according to existing behavior.
- dedupe normalized URLs.
- keep original URL examples.

### 3. Generate Pattern Suggestions

Use deterministic heuristics first:

- group by first one or two path segments.
- detect numeric/date slug patterns.
- detect common directory names.
- detect pagination/query patterns.
- count URLs per group.

Then optionally AI can label the groups:

- group name.
- page family.
- suggested behavior.
- sample limit.
- reason.

AI must not create final active rules without approval.

### 4. Apply Approved Rules

Before fetching:

1. force include rules.
2. exclude rules.
3. normalize rules.
4. sample rules.
5. crawl rules.
6. fallback default behavior.

Rule priority must be explicit.

If multiple rules match:

- highest priority wins.
- force include should normally beat exclude.
- analyst rules should beat system/AI rules.

### 5. Select Samples

For sample groups:

- choose representative URLs.
- record sample reason.
- avoid selecting only one page type if group is mixed.
- include analyst-forced pages.

### 6. Feed Selected URLs Into Existing Crawler

Do not rewrite the whole crawler.

Instead:

- build `selectedFrontier`.
- pass it to existing crawl logic.
- continue discovering links, but apply scope rules before adding links to frontier.

### 7. Diagnostics

Extend crawl diagnostics with:

```ts
scope: {
  discoveredCandidates
  selectedForCrawl
  excludedByRules
  sampledGroups
  forceIncluded
  normalizedDuplicates
  groups: [
    {
      name
      pattern
      behavior
      discovered
      selected
      excluded
      sampleLimit
    }
  ]
}
```

## Frontend Implementation Direction

### Crawl Settings Page

Extend:

- `apps/web/src/app/projects/[id]/settings/crawl/page.tsx`

Add sections:

1. Crawl mode/render settings, already exists.
2. Crawl scope rules.
3. Suggested URL groups.
4. Pre-crawl estimate.

### Crawl Scope Rules UI

Table columns:

- status.
- group name.
- pattern.
- behavior.
- sample limit.
- discovered count.
- selected count.
- examples.
- source.
- confidence.
- actions.

Actions:

- approve.
- edit.
- reject.
- disable.
- test pattern.
- view matched URLs.

### Pattern Editor

Fields:

- name.
- pattern.
- pattern type.
- behavior.
- sample limit.
- group name.
- page family.
- priority.
- reason.

Show pattern examples:

- `/blog/**`
- `/case-studies/**`
- `/events/*`
- `/products/**?variant=*`

### Pre-Crawl Estimate Panel

Show:

- discovered candidates.
- selected for full crawl.
- selected as samples.
- excluded.
- normalized duplicates.
- estimated rendered pages.
- warning cards.

Warnings:

- important-looking pages excluded.
- local SEO goal but `/locations/**` sampled/excluded.
- ecommerce goal but `/products/**` sampled too low.
- publisher/content goal but `/blog/**` excluded.
- too many pages selected for current maxPages.

### Pages Table Impact

Pages table should include optional fields:

- URL group.
- scope decision.
- sample reason.

Do not clutter default table too much. These can be hidden columns or a filter.

### Issues/Recommendations Impact

Issue drawer should show:

- sampled group context.
- sampled count.
- discovered count.
- whether issue is likely template-level.

Recommendation should say:

- "Fix template" when repeated in sampled group.
- "Fix individual page" when isolated.

## AI Task Direction

Add AI task:

`suggest-crawl-scope-rules`

Input:

- project website category.
- project goals.
- candidate URL groups.
- examples per group.
- counts.
- existing rules.

Output:

```json
{
  "suggestions": [
    {
      "groupName": "Blog articles",
      "pattern": "/blog/**",
      "behavior": "sample",
      "sampleLimit": 5,
      "pageFamily": "article",
      "reason": "...",
      "riskIfWrong": "...",
      "confidence": 0.88
    }
  ],
  "warnings": [
    {
      "message": "Location pages are sampled but local SEO goal is active.",
      "severity": "medium"
    }
  ],
  "confidence": 0.82
}
```

Use cheap/local model only by default.

AI output must be:

- schema validated.
- stored as suggestions.
- analyst reviewed.
- never silently applied.

## Example Rules

### Blog Heavy Site

```json
[
  {
    "name": "Blog articles",
    "pattern": "/blog/**",
    "behavior": "sample",
    "sampleLimit": 8,
    "groupName": "Blog Article Template"
  },
  {
    "name": "Tag archives",
    "pattern": "/tag/**",
    "behavior": "exclude",
    "groupName": "Tag Archives"
  }
]
```

### Service Business

```json
[
  {
    "name": "Service pages",
    "pattern": "/services/**",
    "behavior": "crawl",
    "groupName": "Service Pages"
  },
  {
    "name": "Case studies",
    "pattern": "/case-studies/**",
    "behavior": "sample",
    "sampleLimit": 5,
    "groupName": "Case Study Template"
  }
]
```

### NGO

```json
[
  {
    "name": "Campaign pages",
    "pattern": "/campaigns/**",
    "behavior": "crawl",
    "groupName": "Campaign Pages"
  },
  {
    "name": "News",
    "pattern": "/news/**",
    "behavior": "sample",
    "sampleLimit": 5,
    "groupName": "News Article Template"
  }
]
```

### Education

```json
[
  {
    "name": "Courses",
    "pattern": "/courses/**",
    "behavior": "crawl",
    "groupName": "Course Pages"
  },
  {
    "name": "Faculty profiles",
    "pattern": "/faculty/**",
    "behavior": "sample",
    "sampleLimit": 8,
    "groupName": "Faculty Profile Template"
  }
]
```

## Acceptance Criteria

### Product Acceptance

Pass only if:

- analyst can see and edit crawl scope rules before full crawl.
- AI suggestions are clearly suggestions, not automatically applied.
- analyst can approve/reject/edit suggested rules.
- system shows pre-crawl estimate.
- repeated URL families can be sampled.
- important URLs can be force-included.
- excluded URLs are visible somewhere.
- crawl diagnostics explain what happened.

### Crawl Acceptance

Pass only if:

- `/blog/** sample max 5` actually crawls max 5 blog URLs unless force-included.
- `/case-studies/** sample max 5` actually crawls max 5 case-study URLs unless force-included.
- excluded patterns do not enter fetch queue.
- force include overrides sampling.
- same URL with UTM params is normalized/deduped.
- robots rules still apply.
- global maxPages is still respected.

### Audit Acceptance

Pass only if:

- sampled pages show group/template context.
- repeated sampled issues can be grouped.
- recommendations can say template-level fix where appropriate.
- report does not claim all discovered URLs are definitely affected unless actually verified.
- data gaps distinguish "not crawled due to scope" from "not verified due to missing render/integration."

### UI Acceptance

Pass only if:

- Crawl Settings has a clear Crawl Scope section.
- Rule table is understandable.
- pattern test/view matched URLs exists.
- warnings are shown for risky scope choices.
- no technical term appears without help/info icon if it is likely unfamiliar.

## Self-Audit Required

After implementation, test at least:

1. site with `/blog/**` and sample limit 5.
2. site with `/case-studies/**` and sample limit 3.
3. excluded `/tag/**`.
4. force-included URL inside sampled pattern.
5. UTM URL normalization.
6. GSC top page force include, if GSC data exists.
7. report wording for sampled group issue.
8. crawl diagnostics count: discovered vs selected vs excluded.
9. UI pattern test and matched URL preview.
10. AI suggestion pending approval flow.

Do not mark complete unless the crawl actually selects the right URLs and the UI makes the scope decisions understandable to an SEO analyst.
