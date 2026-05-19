# 04. Phase 1: Issue Recommendations

## Phase Goal

Convert existing audit issues into practical fix recommendations.

At the end of this phase, an analyst should open an issue and see:

- root cause summary.
- root cause.
- exact fix.
- owner.
- impact.
- effort.
- validation method.

## What To Build

### Issue Recommendation Generator

Input:

- issue.
- current finding.
- rule metadata.
- page role.
- page title/H1/meta.
- evidence.
- affected URLs.
- project profile.

Output:

- recommendation draft.

## Recommendation Format

Each generated recommendation should answer:

1. What is wrong?
2. Why did it happen?
3. Why does it matter?
4. What exactly should be changed?
5. Who should do it?
6. How do we validate?
7. Is it client-visible?

## Examples

### Missing H1 On Service Page

Root cause summary:

> The service page has no clear H1.

Root cause:

> The page template or content layout does not expose one primary heading.

Recommended action:

> Add one H1 that describes the exact service and audience.

Validation:

> Re-crawl and confirm one H1 exists. Review GSC CTR/position after 2-4 weeks if mapped to a query.

### Noindex Important Page

Root cause summary:

> An important indexable page is marked noindex.

Root cause:

> Robots meta or header is preventing search engines from indexing the page.

Recommended action:

> Remove noindex if the page should rank. Keep noindex only if the analyst intentionally marks it non-indexable.

Validation:

> Re-crawl and confirm indexability. Inspect in GSC after deployment.

## AI Use

Local AI can rewrite recommendations in analyst-friendly language.

Rules/data decide:

- severity.
- evidence.
- whether it is `must_change`.
- validation method.

## UI Requirements

Issue drawer should include:

- recommendation card.
- owner suggestion.
- validation method.
- linked recommendation status.
- create/update recommendation action.

Issues table should show:

- recommendation status.
- owner.
- due date if assigned.

## Validation Checklist

Do not mark complete until:

- top issue types generate useful recommendations.
- recommendations reference evidence.
- no generic "improve SEO" output appears.
- analyst can approve/reject/edit.
- validation method is present.
- self-audit is written.
