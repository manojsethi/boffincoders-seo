# 10. AI Done Definition And Self-Audit

## Done Definition

AI work is not complete because a model returns text.

AI work is complete only when the product workflow improves and output is safe, structured, explainable, and reviewable.

## General Done Criteria

Every AI phase must include:

- structured schema.
- validation.
- confidence.
- evidence/source ids.
- fallback behavior.
- analyst review or override where needed.
- no secret leakage.
- backend typecheck.
- self-audit.

## Required Self-Audit Format

```markdown
# AI Phase X Self-Audit

## Implemented

- ...

## Models Used

- ...

## Tasks Implemented

- ...

## Data Sources Used

- ...

## Validation Results

- ...

## Failure Handling

- ...

## Analyst Review Flow

- ...

## Remaining Gaps

- ...

## Verdict

Pass / Partial / Fail
```

If verdict is Partial or Fail, do not move to the next AI phase.

## Phase 1 Acceptance

Local runtime is complete only when:

- llama.cpp server runs.
- SmolLM3-3B can be called.
- Qwen3-4B can be called.
- backend provider works.
- model router works.
- malformed JSON is rejected.

## Phase 2 Acceptance

Website/page classification is complete only when:

- website profile inference works.
- page role inference works.
- analyst can override.
- low confidence is marked for review.
- rules respect role source/confidence.

## Phase 3 Acceptance

Summaries/entities/intent is complete only when:

- summaries are useful.
- entities are structured.
- intent labels support opportunities.
- outputs have source ids.

## Phase 4 Acceptance

Recommendation rewrite/grouping is complete only when:

- AI does not invent evidence.
- original rule output remains visible.
- grouped issues reduce noise.
- analyst can review/regenerate.

## Phase 5 Acceptance

Report assist is complete only when:

- drafts use real data.
- no fake metrics appear.
- analyst can edit before publishing.
- client-facing text is safe.

## Phase 6 Acceptance

RunPod scale path is complete only when:

- provider is behind model router.
- local provider still works.
- external payload is safe.
- cost and fallback policies are explicit.

## Final AI Acceptance Questions

Before AI is considered product-ready, answer:

1. Does this save analyst time?
2. Is every output backed by source data?
3. Can the analyst override or reject it?
4. Does it avoid fake SEO claims?
5. Does it work on non-service websites?
6. Does it keep costs low?
7. Does local inference fail safely?
8. Can more models be added without rewriting features?

If any answer is no, AI implementation is not complete.

