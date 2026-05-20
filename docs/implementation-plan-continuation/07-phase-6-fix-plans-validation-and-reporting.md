# 07. Phase 6: Fix Plans, Validation, And Reporting

## Purpose

Turn recommendations into execution workflow and client-visible progress.

## Must Read

- `docs/recommendation-engine/08-phase-5-fix-plans-workflows-and-validation.md`
- `docs/recommendation-engine/09-phase-6-client-strategy-reports-and-progress.md`
- `product-implementation-plan/07-phase-5-reporting-dashboards-graphs.md`
- `product-implementation-plan/12-agenda-job-monitor-and-operations.md`

## Fix Plan Requirements

A fix plan should group approved recommendations into:

- this week.
- this month.
- technical fixes.
- content fixes.
- developer handoff.
- client-needed items.

Each fix plan should include:

- recommendation ids.
- owner.
- due date.
- status.
- expected impact.
- validation method.
- report visibility.

## Validation Requirements

Support:

- implemented.
- fixed pending verification.
- verified.
- reopened.
- rejected.

Validation sources:

- re-crawl.
- re-audit.
- rendered extraction.
- GSC trend.
- GA4 trend.
- CWV trend.
- analyst manual confirmation.

## Reporting Requirements

Reports should include:

- what changed.
- recommendations completed.
- fixes verified.
- open high-priority work.
- traffic/search/CWV movement.
- goal progress.
- next actions.
- client-safe explanations.
- internal notes hidden from client view.

PDF is still deferred.

Internal web report and browser print are enough for now.

## Validation

Validate:

- fixed issue becomes verified after re-audit.
- failed validation reopens work.
- report shows completed and pending recommendations.
- client view hides internal-only items.
- no raw JSON/report blobs shown to clients.

