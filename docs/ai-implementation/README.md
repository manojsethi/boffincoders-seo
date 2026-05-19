# Local AI Implementation Plan

This folder defines how local small language models should be used inside the SEO Analyst product.

The product should use local AI to improve analysis of already-crawled data, not to replace deterministic SEO rules or external data sources.

Initial local model targets:

- `SmolLM3-3B` via GGUF and `llama.cpp`.
- `Qwen3-4B` via GGUF and `llama.cpp`.

The architecture must allow more models later, including external APIs and serverless GPU workers such as RunPod if the product scales.

## File Sequence

Read and implement in this order:

1. `01-ai-product-principles.md`
2. `02-local-model-selection.md`
3. `03-ai-architecture-and-model-router.md`
4. `04-phase-1-llama-cpp-local-runtime.md`
5. `05-phase-2-website-profile-and-page-classification.md`
6. `06-phase-3-content-summaries-entities-and-intent.md`
7. `07-phase-4-recommendation-rewrite-and-issue-grouping.md`
8. `08-phase-5-report-assist-and-client-language.md`
9. `09-phase-6-runpod-serverless-scale-path.md`
10. `10-ai-done-definition-and-self-audit.md`

## Main Rule

AI output must be treated as assistance, not truth.

Every AI task must include:

- structured output schema.
- confidence.
- evidence references.
- source page ids or finding ids.
- fallback behavior.
- analyst-review path for low confidence.

## Existing AI Alignment Rule

The product already has an AI layer under `apps/backend/src/ai`.

Do not build a second AI system.

Future AI implementation must extend and reorganize the existing AI layer into a task-based system:

- keep one model router.
- keep one provider abstraction.
- keep one Agenda-based AI job flow.
- migrate the current broad project AI analysis into a named AI task.
- store AI task outputs with source ids, confidence, model, provider, warnings, and review status.
- avoid duplicate prompt files, duplicate provider clients, or disconnected AI result collections.

The current post-crawl/post-audit AI analysis should become one task in the new system, not a competing path.

Local models should become the default for low-risk crawled-data interpretation tasks once llama.cpp is available.

External API models should be reserved for tasks where quality matters more than cost:

- client-facing strategy language.
- final content briefs.
- content rewrite/draft generation.
- complex multi-page synthesis.
- fallback when local structured output fails.

## What Local AI Is For

Use local AI for:

- website type/profile inference.
- page role classification.
- entity/topic extraction.
- search intent classification.
- content summaries.
- issue explanation rewrite.
- grouping similar issues.
- client-friendly summaries.
- AEO/GEO content-readiness signals.

Do not use local AI as the sole authority for:

- rankings.
- keyword volume.
- backlink authority.
- SERP competitor claims.
- final client strategy.
- scoring without evidence.
