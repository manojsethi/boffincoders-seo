# 03. Phase 2: Issue Recommendations

## Purpose

Turn audit issues into actionable SEO recommendations.

This is the next major product-market-fit phase.

The product should stop at neither:

- "143 issues found"
- "missing H1"
- "duplicate title"

It should say:

- what exact action is needed.
- why it matters.
- where it applies.
- who should fix it.
- how to validate it.
- whether it belongs in a client report.

## Must Read

- `docs/recommendation-engine/README.md`
- `docs/recommendation-engine/01-product-principles-seo-action-system.md`
- `docs/recommendation-engine/03-recommendation-data-model.md`
- `docs/recommendation-engine/04-phase-1-issue-recommendations.md`
- `product-implementation-plan/11-rule-engine-and-audit-behaviour.md`
- `product-implementation-plan/10-implementation-done-definition.md`

## Build Scope

Create a recommendation system connected to existing:

- issues.
- findings.
- pages.
- project profile.
- keywords when available.
- goals when available.
- reports.

Do not create generic AI-only recommendations.

## Required Recommendation Fields

Each recommendation should include:

- project id.
- recommendation type.
- status.
- verdict.
- title.
- root cause summary.
- recommended action.
- why it matters.
- evidence references.
- expected impact.
- effort.
- priority score.
- confidence.
- owner type.
- optional assigned user.
- validation method.
- source finding ids.
- source issue ids.
- linked page ids.
- linked keyword ids when relevant.
- linked goal ids when relevant.
- report visibility.

## Required UI

Add recommendation visibility to:

- Issue drawer.
- Issues table.
- Page workspace Issues tab.
- Project overview top action area.

Issue drawer must show:

- recommendation card.
- root cause summary.
- evidence.
- action steps.
- owner suggestion.
- impact/effort/priority.
- validation method.
- approve/edit/reject controls.
- report visibility.

## AI Use

Local AI may:

- rewrite a recommendation in clearer language.
- group similar issues.
- summarize evidence.

Rules/data must decide:

- severity.
- status.
- must-change threshold.
- validation method.
- evidence.

Do not let AI invent facts.

## Validation

Validate on real audit data:

- missing H1.
- noindex important page.
- duplicate title group.
- missing canonical.
- missing JSON-LD not verified case.
- CWV issue if available.

Expected behavior:

- not-verified findings should not produce false fix recommendations.
- grouped issues should create one grouped recommendation where appropriate.
- recommendations should be editable/rejectable.
- recommendation status should persist.
- evidence links should open the issue/page context.

## Done Definition

Do not mark complete until:

- recommendations are connected to existing issues/findings.
- no duplicate recommendation system exists.
- recommendations have evidence.
- analyst can approve/edit/reject.
- validation method is always present.
- self-audit includes examples from multiple issue types.

