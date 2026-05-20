# 01. Current State And Non-Negotiables

## Current State

The app already has a serious SEO analyst foundation.

Assume the following modules exist and should be extended, not replaced:

- project workspace.
- crawl pipeline.
- audit rules.
- pages table.
- page workspace.
- issues table.
- issue drawer.
- GSC integration.
- GA4 integration.
- CWV/PSI integration.
- goals.
- keywords.
- opportunities.
- dashboards.
- reports.
- monitoring schedules.
- Agenda job views.
- AI router/providers/project analysis.

## Non-Negotiables

### 1. Do Not Create Parallel Systems

Do not create:

- a second AI router.
- a second recommendation store disconnected from issues/opportunities.
- a second job tracking system outside Agenda.
- duplicate report models.
- duplicate keyword/opportunity objects.

Extend the existing objects and flows.

### 2. Authentication Comes Last

Authentication is intentionally deferred.

Do not implement:

- login.
- signup.
- users.
- roles.
- client portal.
- invite flows.
- permissions.

Reason:

The product still needs stronger product-market-fit value before access control work.

### 3. Professional SEO Language

Do not use medical metaphors in product/docs/code.

Use:

- findings.
- root cause summary.
- recommendations.
- action plan.
- validation.
- evidence.
- impact.
- priority.
- owner.
- status.

Avoid:

- doctor.
- prescription.
- treatment.
- symptom.
- diagnosis.

`crawl diagnostics` is allowed because it is standard engineering language.

### 4. Evidence First

Every recommendation must link to evidence:

- issue id.
- finding id.
- page id.
- keyword id.
- GSC metric.
- GA4 metric.
- CWV metric.
- crawl/audit observation.

AI may rewrite or summarize, but AI alone is not evidence.

### 5. Product-Market-Fit Priority

Build features that reduce real SEO agency work:

- fewer manual spreadsheets.
- less manual GSC/GA4 export work.
- clearer client reports.
- actionable recommendations.
- visible progress.
- task ownership.
- validation after fixes.

## Key Docs To Re-Read

- `product-implementation-plan/README.md`
- `product-implementation-plan/10-implementation-done-definition.md`
- `docs/recommendation-engine/README.md`
- `docs/recommendation-engine/01-product-principles-seo-action-system.md`
- `docs/ai-implementation/README.md`
- `docs/ai-implementation/03-ai-architecture-and-model-router.md`

