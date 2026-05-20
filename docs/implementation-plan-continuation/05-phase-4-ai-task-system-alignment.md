# 05. Phase 4: AI Task System Alignment

## Purpose

Align current AI usage with the planned task-based AI system.

Do not build a second AI system.

## Must Read

- `docs/ai-implementation/README.md`
- `docs/ai-implementation/01-ai-product-principles.md`
- `docs/ai-implementation/02-local-model-selection.md`
- `docs/ai-implementation/03-ai-architecture-and-model-router.md`
- `docs/ai-implementation/04-phase-1-llama-cpp-local-runtime.md`
- `docs/ai-implementation/10-ai-done-definition-and-self-audit.md`

## Current Code To Preserve

Use existing backend AI code as the base:

- `apps/backend/src/ai/router.ts`
- `apps/backend/src/ai/providers/local.ts`
- `apps/backend/src/ai/providers/openai.ts`
- `apps/backend/src/ai/providers/groq.ts`
- `apps/backend/src/ai/providers/anthropic.ts`
- `apps/backend/src/ai/providers/openrouter.ts`
- `apps/backend/src/ai/analyze-evidence.ts`
- `apps/backend/src/jobs/handlers/ai-analysis.ts`

## Target Architecture

One path:

```text
Product feature
  -> AI Task Service
  -> Model Router
  -> Provider
  -> Validated structured result
  -> Product object
```

## Required Tasks

Introduce task definitions for:

- infer website profile.
- classify page role.
- summarize page.
- extract entities/topics.
- classify search intent.
- rewrite recommendation.
- group similar issues.
- draft report section.

## Local Model Policy

Use local llama.cpp models for:

- classification.
- summarization.
- grouping.
- extraction.
- recommendation rewrite drafts.

Use external models for:

- final content writing.
- complex strategic synthesis.
- client-facing polished copy.
- fallback after local structured output failure.

## Required Safeguards

Every AI task must store:

- task name.
- source ids.
- provider.
- model.
- confidence.
- warnings.
- schema validation status.
- needs review flag.

Do not store:

- raw secrets.
- API keys.
- huge raw prompts unless explicitly needed for debugging.

## Validation

Validate:

- local provider works through OpenAI-compatible llama.cpp endpoint.
- existing AI project analysis still works after migration.
- failed local JSON output is handled.
- low confidence tasks require analyst review.
- no duplicate AI result collections are created without reason.

