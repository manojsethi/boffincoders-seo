# 05. Phase 3: GSC, GA4 And Core Web Vitals Integrations

## Phase Goal

Restore external SEO performance data so the product can move beyond crawl-only audits.

The old project had stronger integration logic. The new product needs this data to support keyword strategy, performance tracking, reporting, opportunity scoring, and data-driven audit rules.

## Google Search Console

### Required Features

- OAuth connect.
- property list.
- property selection.
- disconnect.
- connection status.
- last sync.
- sync error display.
- manual sync.
- scheduled sync through Agenda.

### Data To Store

Store GSC rows by:

- project ID.
- query.
- page URL.
- date.
- clicks.
- impressions.
- CTR.
- average position.

### Product Uses

Use GSC data for:

- keyword list.
- search performance dashboard.
- keyword movers.
- high impressions low CTR opportunities.
- position 11-20 quick wins.
- query missing from title/H1 checks.
- declining clicks alerts.
- cannibalization detection.
- page opportunity scoring.
- reports.

### GSC Screens

Create Search Performance screen with:

- clicks trend.
- impressions trend.
- CTR trend.
- average position trend.
- top queries.
- top pages.
- query/page table.
- keyword movers.
- position bucket distribution.
- quick-win list.
- declining query/page list.

## GA4

### Required Features

- OAuth connect.
- account list.
- property list.
- property selection.
- disconnect.
- connection status.
- last sync.
- sync error display.
- manual sync.
- scheduled sync through Agenda.

### Data To Store

Store GA4 data by:

- project ID.
- page path.
- date.
- channel.
- sessions.
- users.
- pageviews.
- engaged sessions.
- average engagement time.
- conversions.
- organic sessions.

Also store breakdowns by:

- channel.
- device.
- country.
- hour.

### Product Uses

Use GA4 data for:

- traffic dashboard.
- conversion insights.
- high traffic zero conversion pages.
- organic sessions trend.
- engagement analysis.
- page value prioritization.
- report KPIs.
- business goal tracking.

### GA4 Screens

Create Traffic screen with:

- sessions trend.
- users trend.
- organic sessions trend.
- conversions trend.
- top landing pages.
- channel breakdown.
- device breakdown.
- country breakdown.
- hour heatmap.
- high traffic / low conversion pages.

## Core Web Vitals / PageSpeed Insights

### Required Features

- enable/disable.
- choose mobile or desktop.
- choose important pages to test.
- auto-test top pages.
- scheduled sync.
- last sync.
- error display.

### Data To Store

Store by URL:

- strategy.
- LCP.
- INP.
- CLS.
- FCP.
- TTFB.
- performance score.
- SEO score.
- accessibility score.
- best practices score.
- captured at.

### Product Uses

Use CWV for:

- performance dashboard.
- poor LCP on important pages.
- poor INP on conversion pages.
- poor CLS on organic landing pages.
- technical reports.
- developer tasks.
- progress tracking.

## Integration Status Page

Create an Integrations screen with cards for:

- Google Search Console.
- GA4.
- Core Web Vitals / PageSpeed.

Each card shows:

- connected/not connected.
- selected property.
- last sync.
- last error.
- rows stored.
- data range.
- features powered.
- connect/disconnect buttons.
- sync button.

## Analytics Endpoints

Create backend analytics endpoints for:

- GSC time series.
- GSC position distribution.
- keyword movers.
- GA4 time series.
- GA4 breakdown by channel/device/country/hour.
- GA4 hour heatmap.
- CWV trend.
- CWV distribution.
- audit history.
- issue breakdown.
- page breakdown.
- drift summary.
- project dashboard.
- workspace rollup.

## Missing Data UX

If a source is missing, do not hide the feature silently.

Show:

- what data is missing.
- why it matters.
- what features are limited.
- how to connect it.

Example:

```txt
Search Console is not connected.

Without it, the tool cannot show keywords, clicks, impressions, CTR, average position, quick wins, or cannibalization.

[Connect Search Console]
```

## Info Icons Required

Add info icons for:

- Search Console.
- GA4.
- Core Web Vitals.
- Clicks.
- Impressions.
- CTR.
- Average position.
- Sessions.
- Users.
- Engagement.
- Conversions.
- LCP.
- INP.
- CLS.
- FCP.
- TTFB.

## Completion Criteria

This phase is complete only when:

- GSC OAuth and sync work.
- GA4 OAuth and sync work.
- CWV/PSI sync works.
- data is persisted.
- analytics endpoints exist.
- dashboards consume the data.
- audit rules can use the data.
- missing-source states are clear.

