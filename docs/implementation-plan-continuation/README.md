# Implementation Plan Continuation

This folder is the handoff plan for the next AI/code writer.

It explains what has already been built, what must be fixed first, what to build next, and which docs must be read before touching code.

## Current Product State

The product is no longer at the initial rebuild stage.

Already implemented or largely implemented:

- crawl and rendered extraction.
- Cheerio default crawl with Playwright fallback/rendered extraction.
- audit rule engine and expanded rules.
- pages, issues, evidence drawer, and page workspace.
- GSC, GA4, and CWV integrations.
- goals, keywords, and opportunities.
- search/traffic/CWV dashboards.
- internal reports and report generation.
- Agenda jobs, monitoring schedules, project job view, and workspace job view.
- early AI project analysis.

Do not restart architecture.

Do not rebuild from scratch.

Do not add authentication yet.

## Product Direction

The next product goal is product-market-fit learning.

The tool should become an SEO execution and reporting workspace:

> Crawl, audit, GSC, GA4, CWV, keywords, and AI-assisted analysis should become prioritized recommendations, execution plans, validation, and client-ready progress.

Do not chase maximum feature count.

Prioritize features that help an SEO analyst answer:

1. What matters most?
2. Why does it matter?
3. What exact action should be taken?
4. Who should do it?
5. How will we validate it?
6. What progress can be shown to the client?

## Mandatory Reading Order

Read these first:

1. `product-implementation-plan/README.md`
2. `product-implementation-plan/10-implementation-done-definition.md`
3. `product-implementation-plan/12-agenda-job-monitor-and-operations.md`
4. `docs/recommendation-engine/README.md`
5. `docs/recommendation-engine/01-product-principles-seo-action-system.md`
6. `docs/recommendation-engine/03-recommendation-data-model.md`
7. `docs/recommendation-engine/04-phase-1-issue-recommendations.md`
8. `docs/ai-implementation/README.md`
9. `docs/ai-implementation/03-ai-architecture-and-model-router.md`

Read auth docs only when authentication phase starts:

- `docs/auth-docs/README.md`

## Continuation Files

Read and execute in this order:

1. `01-current-state-and-non-negotiables.md`
2. `02-phase-1-foundation-hardening.md`
3. `03-phase-2-issue-recommendations.md`
4. `04-phase-3-keyword-page-fit-and-content-analysis.md`
5. `05-phase-4-ai-task-system-alignment.md`
6. `06-phase-5-content-briefs-and-external-ai-writing.md`
7. `07-phase-6-fix-plans-validation-and-reporting.md`
8. `08-phase-7-optional-paid-data-providers.md`
9. `09-authentication-last.md`
10. `10-navigation-project-workflow-archive-reset.md`
11. `11-crawl-scope-rules-url-pattern-grouping.md`
12. `12-project-onboarding-intent-first-flow.md`

## Do Not Build Yet

Do not build these until explicitly asked:

- authentication.
- client portal.
- billing/pricing.
- PDF export.
- backlinks provider.
- local citations provider.
- rank tracking at scale.
- Semrush/Ahrefs-style full competitor database.
- a second AI architecture.

## Required Done Rule

Every phase must end with a self-audit.

Do not mark a phase complete unless:

- backend behavior works.
- frontend behavior works.
- edge cases are checked.
- failed/empty/missing-data states are clear.
- no secrets or raw tokens are exposed.
- no parallel/duplicate data model was introduced.
- implementation is connected to the existing product flow.
