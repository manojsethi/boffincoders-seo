# SEO Analyst Product Build Plan

This folder defines the full product roadmap for turning `boffincoders-seo-v1` into a serious SEO analyst operating system.

This is not an MVP checklist. This is the product direction for a full-fledged SEO tool that a senior SEO analyst or agency owner would want to use instead of jumping between many separate tools.

## Why This Folder Exists

The current rebuild has a clean foundation:

- `apps/web`
- `apps/backend`
- `packages/schemas`
- Express backend
- Agenda jobs
- Crawl/audit/AI/report workflow shell
- Tailwind + Ant Design + Recharts

But the product is still shallow compared with the goal.

The current implementation has already moved beyond the original rebuild baseline:

- crawl and rendered extraction.
- expanded audit rules.
- pages, issues, evidence, and page workspace.
- GSC, GA4, and CWV integrations.
- goals, keywords, and opportunities.
- dashboards and internal reports.
- Agenda jobs, monitoring, and job visibility.
- early AI profile/project analysis.

The remaining product gap is no longer "basic data collection".

The main gap is execution value:

- exact recommendations.
- keyword-page fit analysis.
- content recommendations.
- fix plans.
- task ownership.
- client access.
- validation after implementation.
- business-goal progress reporting.

## Old Project Source

Use the old project as a source of useful intelligence:

`/Users/boffincoders/Manoj/Projects/boffincoders-seo`

The old project had:

- around 76 unique audit rule IDs.
- GSC integration.
- GA4 integration.
- Core Web Vitals / PageSpeed integration.
- search performance screens.
- traffic screens.
- keyword-related analytics.
- drift monitoring.
- web vitals dashboards.
- more audit rule categories.

The new project currently has far fewer implemented SEO rules and much less integrated SEO data.

## New Project Target

All implementation should happen in:

`/Users/boffincoders/Manoj/Projects/boffincoders-seo-v1`

## Product Principle

The tool must help an SEO analyst answer:

1. What is wrong?
2. Where exactly is it wrong?
3. Why does it matter?
4. What should be fixed first?
5. Who should fix it?
6. What evidence proves the issue?
7. How do we verify the fix?
8. What changed this week or month?
9. What can we show the client?
10. What opportunities can grow leads, sales, donations, applications, bookings, traffic, or visibility?

If a feature does not help answer one of these, it is not finished.

## Product-Market-Fit Alignment

Until product-market fit is clearer, do not chase maximum feature count.

Prioritize features that make the tool easier to sell to a real SEO agency:

- reduce analyst manual work.
- explain exactly what to fix.
- prove progress with GSC, GA4, CWV, crawl, and audit evidence.
- support client communication.
- support team execution.
- keep optional paid data providers modular.

The product should not try to beat Semrush or Ahrefs at every data asset immediately.

The sharper position is:

> An SEO execution and reporting workspace that turns crawl, GSC, GA4, CWV, keywords, and AI-assisted analysis into prioritized fixes, content actions, client reports, and verified progress.

This positioning keeps the product focused while still allowing future integrations for SERP data, keyword volume, backlinks, local SEO, and rank tracking.

## Required Documentation Order

Read and implement in this order:

| Order | File | Purpose |
|---|---|---|
| 1 | `01-old-vs-current-gap-analysis.md` | What old had, what V1 has, and what is missing. |
| 2 | `02-product-north-star-and-end-to-end-flow.md` | Full product vision and user journey. |
| 3 | `03-phase-1-pages-issues-evidence-triage.md` | Pages, issues, evidence, and immediate analyst triage. |
| 4 | `04-phase-2-audit-rule-expansion.md` | Restore and expand audit rule intelligence. |
| 5 | `05-phase-3-integrations-gsc-ga4-cwv.md` | Restore GSC, GA4, CWV and analytics data. |
| 6 | `06-phase-4-goals-keywords-opportunities.md` | Client goals, keyword strategy, opportunities. |
| 7 | `07-phase-5-reporting-dashboards-graphs.md` | Reports, dashboards, graphs, comparison views. |
| 8 | `08-phase-6-agency-scale-and-advanced-product.md` | Agency workflows, alerts, sharing, advanced features. |
| 9 | `09-info-icons-glossary-and-ux-education.md` | Mandatory info icons and glossary rules. |
| 10 | `10-implementation-done-definition.md` | Completion criteria and self-audit requirements. |
| 11 | `11-rule-engine-and-audit-behaviour.md` | Mandatory rule-engine behaviour, applicability, evidence, and audit status model. |
| 12 | `12-agenda-job-monitor-and-operations.md` | Agenda job visibility, project job monitor, and agency operations dashboard. |

## Mandatory Rule Implementation Reading

Before implementing or expanding audit rules, read:

- `04-phase-2-audit-rule-expansion.md`
- `11-rule-engine-and-audit-behaviour.md`
- the Phase 2 section inside `10-implementation-done-definition.md`

Old project rules are useful references, but they are not product truth.

Open-source tools are useful references, but they are not product truth.

Rules must be:

- applicability-first.
- evidence-first.
- page-role aware.
- website-type aware.
- business-goal aware where relevant.
- able to return `not_applicable`.
- able to return `not_verified`.
- able to return `needs_review`.
- careful with contextual areas like E-E-A-T, GEO, AEO, content quality, and conversion readiness.

Do not mark audit-rule implementation complete unless the rule behaviour document is satisfied.

## Mandatory Info Icon Rule

Every technical SEO term in the UI must have an info icon.

The info icon must explain:

- what the term means.
- why it matters.
- how the tool measured it.
- what good or bad means.
- what the analyst or client should do next.

Examples:

- Indexability
- Canonical
- Noindex
- Sitemap
- Robots.txt
- Crawl depth
- Orphan page
- Internal link
- Structured data
- JSON-LD
- Schema
- LCP
- INP
- CLS
- CTR
- Impressions
- Average position
- Cannibalization
- Search intent
- Conversion action
- E-E-A-T
- GEO
- AEO
- Entity
- Topical authority

Do not assume users understand SEO language.

## Product Bar

This product should eventually replace or reduce dependency on:

- manual Screaming Frog exports.
- manual GSC exports.
- manual GA4 reports.
- manual Excel issue tracking.
- generic AI prompts.
- disconnected content planning sheets.
- manual monthly report creation.
- scattered client notes.

The product should become the central workspace for SEO audit, strategy, execution, monitoring, and reporting.
