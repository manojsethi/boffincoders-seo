# 01. Old Vs Current Gap Analysis

## Purpose

This document compares the old project and the current `boffincoders-seo-v1` rebuild so the next implementation phases restore lost SEO value while keeping the cleaner architecture.

## Current V1 Strengths

The current rebuild correctly implements several foundation decisions:

- simple repo structure.
- one Express backend.
- Agenda inside backend.
- shared Zod schemas only.
- extensionless imports.
- Tailwind, Ant Design, and Recharts.
- Crawl4AI/Cheerio/Turndown content extraction path.
- basic project lifecycle.
- basic pages screen.
- basic issues screen.
- persistent issues model.
- AI analysis after crawl/audit evidence.
- basic markdown reports.
- monitoring schedule shell.

This foundation is good.

## Current V1 Weaknesses

The current product is not yet a strong SEO analyst tool.

### 1. Audit Rules Are Too Few

Current V1 has about 14 audit rules.

Old project had around 76 unique audit rule IDs across:

- SEO.
- Schema.
- GEO.
- AEO.
- Conversion.
- E-E-A-T.
- Data-driven GSC/GA4/CWV.
- Drift.
- Site-level rules.

This is why current scans show fewer issues, such as 143 instead of 1000+.

Important: fewer issues is not always bad. Persistent issue grouping is better than dumping every raw finding. But the current product is missing too much rule coverage.

Important rule implementation warning:

The gap is not only "old had more rules and current has fewer rules". The deeper gap is that the new product needs a smarter audit rule operating model.

Old rules must be reviewed, tuned, and adapted before porting. Some old rules, especially E-E-A-T, content quality, GEO, AEO, and conversion-style rules, can be too strict if applied to every website or every page.

Before rule work starts, read:

- `04-phase-2-audit-rule-expansion.md`
- `11-rule-engine-and-audit-behaviour.md`

### 2. Pages Screen Is Not Actionable Enough

Current pages screen shows:

- URL.
- Role.
- Status.
- Indexability.
- Links in.
- Title.

Missing:

- total issue count per page.
- critical/high/medium/low issue breakdown.
- issue popover.
- top issue per page.
- content quality.
- word count.
- schema status.
- target keyword count.
- GSC clicks/impressions/CTR/position.
- GA4 sessions/conversions.
- Core Web Vitals.
- last changed.

An analyst cannot quickly see which pages need work.

### 3. Issues Screen Does Not Show Location Clearly

Current issues screen shows:

- severity.
- title.
- category.
- status.
- priority.
- impact.
- effort.

Missing:

- affected URL.
- page role.
- page title.
- site-wide/page-level/segment-level label.
- evidence preview.
- first seen.
- last seen.
- owner.
- due date.
- validation method.
- link to page workspace.

An analyst cannot quickly answer: "Where exactly is this issue?"

### 4. GSC / GA4 / CWV Are Not Product-Complete

Old project had stronger integration logic:

- GSC OAuth.
- GSC property selection.
- GSC query/page/date sync.
- GSC summaries.
- GA4 OAuth.
- GA4 property selection.
- GA4 page/channel/date sync.
- GA4 breakdowns by channel/device/country/hour.
- Core Web Vitals / PageSpeed sync.
- analytics rollups and graphs.

Current V1 has integration stubs, but not enough persistence and UI to power real SEO decisions.

### 5. Keyword Analysis Is Missing

Current V1 does not yet support:

- seed keywords.
- imported GSC queries as keywords.
- keyword-to-page mapping.
- search intent.
- funnel stage.
- quick wins.
- content gaps.
- cannibalization.
- keyword trend.
- query missing from title/H1.
- keyword opportunity scoring.

This is critical.

SEO work without keyword strategy is incomplete.

### 6. Client Goal Strategy Is Missing

Current profile has some goal-like fields, but the product does not yet support dynamic business goals.

Examples of goals the product must support:

- get more leads.
- win more projects.
- get consultation calls.
- increase quote requests.
- increase ecommerce sales.
- increase donations.
- increase volunteers.
- increase course applications.
- increase bookings.
- grow subscriptions.
- increase demo requests.
- grow organic visibility.
- improve local visibility.
- improve AI/GEO visibility.

These goals must adapt to website type.

### 7. Reports Are Too Thin

Current reports are useful as a start, but they are not yet strong enough for:

- client communication.
- weekly/monthly progress.
- before/after comparison.
- goal progress.
- issue movement.
- keyword movement.
- traffic movement.
- conversion movement.
- clear next-step planning.

PDF is deferred, which is fine. But in-tool reports must become much richer.

### 8. Agency Operations Are Early

Current workspace gives a basic overview.

Missing:

- report readiness queue.
- critical client risk list.
- issue aging.
- owner workload.
- failed integration queue.
- verification queue.
- opportunities backlog.
- schedule health.
- client health score.

## Old Project Areas To Port

### Audit Rules

Review useful rules from the old project, but do not copy them blindly.

Each old rule must be checked for:

- whether the SEO concept is still valuable.
- whether the rule is too strict.
- which website types it applies to.
- which page roles it applies to.
- what evidence it can produce.
- when it should return `not_applicable`.
- when it should return `not_verified`.
- when it should return `needs_review`.
- whether it should create an issue, opportunity, or review item.

Old rule files to review:

- `apps/worker/src/audit/rules/seo.ts`
- `apps/worker/src/audit/rules/schema.ts`
- `apps/worker/src/audit/rules/geo.ts`
- `apps/worker/src/audit/rules/aeo.ts`
- `apps/worker/src/audit/rules/conversion.ts`
- `apps/worker/src/audit/rules/eeat.ts`
- `apps/worker/src/audit/rules/data-driven.ts`
- `apps/worker/src/audit/rules/drift.ts`
- `apps/worker/src/audit/rules/site.ts`

### Integrations

Review and port useful logic from:

- `apps/api/src/services/integrations/gsc.service.ts`
- `apps/api/src/services/integrations/ga4.service.ts`
- `apps/api/src/services/integrations/cwv.service.ts`
- `apps/api/src/services/integrations/google-oauth.ts`

### Analytics

Review and port useful logic from:

- `apps/api/src/services/analytics/analytics.service.ts`

Important old analytics features:

- GSC time series.
- GSC position distribution.
- keyword movers.
- GA4 time series.
- GA4 channel/device/country/hour breakdown.
- CWV trend.
- CWV distribution.
- audit history.
- issue breakdown.
- page breakdown.
- drift summary.
- workspace rollup.

### Frontend Product Areas

Old project had pages for:

- integrations.
- keywords.
- search performance.
- traffic.
- web vitals.
- drift.
- knowledgebase.

These product areas should return in V1, but with better UX.

## Critical Gap Table

| Gap | Priority | Reason |
|---|---|---|
| Page issue counts missing | Critical | Analysts cannot triage pages quickly. |
| Issues missing affected URL | Critical | Analysts cannot locate the problem. |
| Rule coverage reduced to 14 | Critical | Product loses SEO value. |
| Rule engine lacks contextual behaviour | Critical | More rules will create noise unless applicability, evidence, not-applicable, not-verified, and needs-review states are implemented. |
| GSC persistence missing | Critical | No keyword/query opportunity engine. |
| GA4 persistence missing | Critical | No traffic/conversion analysis. |
| Keyword strategy missing | Critical | SEO work is incomplete without keywords. |
| Dynamic client goals missing | High | Recommendations are not tied to business outcomes. |
| CWV dashboard missing | High | Performance impact is not visible. |
| Reports too thin | High | Does not replace manual reporting. |
| Info icons missing | High | Non-experts cannot understand the product. |
| Controllers/services missing | Medium | Routes are too heavy, but product value matters more first. |

## Product Direction

The next phases should not focus on architecture polish.

They should focus on:

1. analyst visibility.
2. audit intelligence.
3. external data integrations.
4. keyword and goal strategy.
5. opportunity engine.
6. reporting and dashboards.
7. agency-scale monitoring.
