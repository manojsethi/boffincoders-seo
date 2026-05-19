# 07. Phase 5: Reporting, Dashboards And Graphs

## Phase Goal

Make the product valuable for ongoing SEO communication and decision-making.

PDF is deferred. Reports should first be strong in-tool reports. Later, client sharing can be a web-based report page.

## Deferred Phase D Dashboard Requirements

Phase D integration foundation may be accepted once GSC, GA4, CWV syncs work and the data reaches pages/audits. However, the visual analytics promised in the integration phase must not be forgotten.

This reporting/dashboard phase must include the deferred Phase D analytics surfaces:

- Search Performance dashboard from GSC data.
- Traffic dashboard from GA4 data.
- Core Web Vitals dashboard from PSI/CrUX data.
- Analytics endpoints that feed those dashboards.
- Data freshness and missing-source warnings for every dashboard/report.
- Tables next to charts so analysts can move from trend to exact URL/query/action.

Do not mark this phase complete if GSC/GA4/CWV data exists only inside page rows or audit rules. The analyst must have dedicated dashboards for understanding search performance, traffic quality, and page experience trends.

## Report Types

### Initial Audit Report

Purpose:

- establish SEO baseline.
- explain current health.
- identify first priorities.
- connect issues to goals.

Sections:

- executive summary.
- website profile.
- business goals.
- crawl coverage.
- audit health.
- critical issues.
- high-impact opportunities.
- keyword baseline.
- traffic baseline.
- conversion baseline.
- content quality.
- internal linking.
- schema/structured data.
- performance/Core Web Vitals.
- E-E-A-T/trust.
- GEO/AEO readiness.
- next 30-day plan.

### Weekly Progress Report

Purpose:

- show what changed this week.
- support weekly SEO operations.

Sections:

- work completed.
- new issues.
- verified fixes.
- failed verification.
- traffic movement.
- keyword movement.
- new opportunities.
- next week focus.

### Monthly Progress Report

Purpose:

- support client/account review.
- show business impact.

Sections:

- goal progress.
- organic traffic trend.
- keyword trend.
- conversion trend.
- technical health trend.
- issue movement.
- content work.
- wins.
- risks.
- next month plan.

### Technical Verification Report

Purpose:

- prove fixes worked.

Sections:

- fixes submitted.
- fixes verified.
- fixes failed.
- before/after evidence.
- remaining blockers.

### Opportunity Report

Purpose:

- present growth opportunities.

Sections:

- quick wins.
- content gaps.
- internal link opportunities.
- CTR improvements.
- conversion opportunities.
- GEO/AEO opportunities.

## Report UI Requirements

Each report page should show:

- report type.
- period.
- source crawl/audit/integration runs.
- data freshness.
- report status.
- internal/client view toggle.
- editable executive summary.
- issue include/exclude controls.
- opportunity include/exclude controls.
- section ordering.
- approval status.

## Report Readiness Warnings

Show warnings if:

- crawl is unreliable.
- audit not complete.
- profile not approved.
- GSC not connected.
- GA4 not connected.
- CWV not enabled.
- business goals missing.
- too many critical issues unresolved.

Do not always block report generation, but explain limitations clearly.

## Dashboard Graphs

### Workspace Dashboard

Graphs/cards:

- active projects.
- lifecycle distribution.
- critical/high issues by project.
- reports due.
- failed crawls/audits.
- failed integrations.
- issue movement across portfolio.
- upcoming scheduled runs.
- client risk list.

### Project Overview Dashboard

Graphs/cards:

- lifecycle state.
- next action.
- audit score trend.
- issue severity trend.
- issue opened vs verified.
- crawl coverage trend.
- traffic trend.
- keyword trend.
- conversion trend.
- CWV trend.

### Crawl Dashboard

Graphs:

- discovered/crawled/skipped/failed.
- crawl depth distribution.
- page role distribution.
- markdown coverage.
- failed/skipped reasons.
- sitemap/robots status.

### Audit Dashboard

Graphs:

- category scores.
- severity distribution.
- top rules by affected pages.
- issue trend.
- not applicable rules.
- not verified rules.
- report readiness.

### Search Performance Dashboard

Graphs:

- clicks trend.
- impressions trend.
- CTR trend.
- average position trend.
- position buckets.
- keyword movers.
- top pages.
- top queries.
- quick wins.
- declining query/page list.
- high impressions low CTR list.
- position 11-20 opportunity list.
- query/page table with clicks, impressions, CTR, average position, and trend.
- cannibalization candidates where multiple URLs receive impressions/clicks for the same query.
- data freshness card showing last GSC sync, selected property, row count, and date range.

### Traffic Dashboard

Graphs:

- sessions trend.
- users trend.
- organic sessions trend.
- conversions trend.
- channel breakdown.
- device breakdown.
- country breakdown.
- hour heatmap.
- top landing pages.
- high traffic / low conversion pages.
- organic landing page engagement table.
- landing page table with sessions, users, engaged sessions, engagement rate, conversions, and trend.
- data freshness card showing last GA4 sync, selected property, row count, and date range.

### Core Web Vitals Dashboard

Graphs:

- LCP trend.
- INP trend.
- CLS trend.
- performance score trend.
- metric distribution.
- slowest important pages.
- CWV pass/fail trend.
- mobile vs desktop comparison where both strategies are available.
- important page table with URL, role, LCP, INP, CLS, performance score, captured at, and issue link.
- PSI/CrUX error list for URLs that could not be measured.
- data freshness card showing last CWV sync, tested URL count, strategy, and error count.

### Analytics Endpoints Required

Create backend endpoints that support dashboard and reporting needs. At minimum:

- GSC time series.
- GSC top queries.
- GSC top pages.
- GSC query/page table.
- GSC position distribution.
- GSC keyword/query movers.
- GSC declining queries/pages.
- GSC high impressions low CTR opportunities.
- GSC cannibalization candidates.
- GA4 time series.
- GA4 top landing pages.
- GA4 organic landing page table.
- GA4 channel breakdown.
- GA4 device breakdown.
- GA4 country breakdown.
- GA4 hour heatmap.
- GA4 high traffic / low conversion pages.
- CWV trend.
- CWV distribution.
- CWV slowest important pages.
- CWV pass/fail trend.
- CWV measurement errors.
- Dashboard data freshness summary.

These endpoints should power both screens and reports. Do not duplicate analytics logic separately in report builders.

### Keywords Dashboard

Graphs:

- mapped vs unmapped keywords.
- keywords by intent.
- keywords by position bucket.
- opportunity score distribution.
- quick wins.
- cannibalization clusters.

### Issues Dashboard

Graphs:

- issues by severity.
- issues by category.
- issues by owner.
- issues by lifecycle.
- issue aging.
- priority distribution.

## Chart Rules

Every chart must answer a real question.

Examples:

- Are we improving?
- What is blocking growth?
- Which pages matter most?
- Which issues are most urgent?
- Which keywords are close to improvement?
- Which client needs attention?

Do not add decorative charts.

## Pair Charts With Tables

Charts show patterns.

Tables show action.

Example:

- Chart: low CTR opportunity trend.
- Table: exact queries/pages to optimize.

## Info Icons Required

Every report section and chart metric must have an info icon.

The icon should explain:

- what the metric means.
- how it is calculated.
- data source.
- why it matters.
- how to improve it.

## Completion Criteria

This phase is complete only when:

- initial report is useful in a client conversation.
- weekly/monthly reports show change over time.
- reports include evidence.
- reports include next actions.
- dashboards use real data.
- charts have useful tables.
- missing data is clearly explained.
- every technical metric has an info icon.
