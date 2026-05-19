# 03. AI Architecture And Model Router

## Goal

Keep Node/Express as the product backend and use `llama.cpp` as an inference service.

Do not move core product logic out of Node.js.

## Recommended Architecture

```text
apps/backend
  |
  | task request
  v
AI Task Service
  |
  | chooses provider/model
  v
Model Router
  |
  | HTTP request
  v
llama.cpp server
  |
  v
GGUF model
```

## Why llama.cpp Server

Use `llama-server`, not direct Node bindings initially.

Reasons:

- simpler deployment.
- fewer native Node build issues.
- OpenAI-compatible HTTP API.
- model can be swapped outside app code.
- backend stays responsible for prompts, schemas, persistence, and permissions.

## Avoid Initially

Do not start with:

- shelling out to `llama-cli` for every request.
- direct `node-llama-cpp` embedding.
- Python microservice unless a future ML need appears.
- background model loading inside Express process.

## Backend Structure

Recommended structure:

```text
apps/backend/src/ai
  model-router.ts
  task-registry.ts
  types.ts
  providers
    llama-local.provider.ts
    openai.provider.ts
    groq.provider.ts
    anthropic.provider.ts
    runpod.provider.ts
  tasks
    infer-website-profile.ts
    classify-page-role.ts
    summarize-page.ts
    extract-entities.ts
    classify-intent.ts
    rewrite-recommendation.ts
    group-issues.ts
    draft-report-section.ts
  schemas
    website-profile.schema.ts
    page-role.schema.ts
    page-summary.schema.ts
    entity-extraction.schema.ts
    recommendation.schema.ts
```

Use existing `apps/backend/src/ai` as the base.

## Current Code Alignment

The current code already has:

- `apps/backend/src/ai/router.ts`
- `apps/backend/src/ai/providers/local.ts`
- `apps/backend/src/ai/providers/openai.ts`
- `apps/backend/src/ai/providers/groq.ts`
- `apps/backend/src/ai/providers/anthropic.ts`
- `apps/backend/src/ai/providers/openrouter.ts`
- `apps/backend/src/ai/analyze-evidence.ts`

Do not replace these by creating a disconnected AI module.

Refactor them into the desired shape:

- `router.ts` may become or wrap `model-router.ts`.
- `providers/local.ts` should support llama.cpp through the existing OpenAI-compatible HTTP endpoint.
- `analyze-evidence.ts` should become a named task such as `analyze-project-evidence` or be split into smaller tasks.
- existing provider env support should be preserved unless intentionally renamed across code and docs.
- existing AI analysis data should either be migrated or intentionally retired if local development data is wiped.

The target is one AI execution path:

```text
Feature request
  -> AI Task Service
  -> Model Router
  -> Provider
  -> Validated Task Result
  -> Product model / recommendation / report
```

There must not be:

- separate local-AI-only code paths.
- separate external-AI-only code paths.
- one prompt calling `routeAI` directly while another task system bypasses it.
- AI-generated recommendations stored separately from the recommendation engine.

## Model Router Responsibilities

The model router must:

- select provider.
- select model.
- apply task-specific limits.
- enforce timeout.
- enforce max input size.
- log safe metadata.
- hide secrets.
- validate output schema.
- retry repair once if structured output fails.
- return confidence and warnings.

## Provider Types

### Local Llama Provider

Calls:

```text
POST http://localhost:8080/v1/chat/completions
```

### External API Provider

Optional fallback for:

- high-value report draft.
- complex strategic synthesis.
- failed local structured output.

### RunPod Provider

Future scale path.

Should behave like a provider, not a new product architecture.

## Task Request Shape

Every AI task should have:

```json
{
  "task": "classify_page_role",
  "projectId": "...",
  "sourceIds": ["pageId"],
  "input": {},
  "preferredProvider": "local",
  "maxCost": "low",
  "needsReview": false
}
```

## Task Result Shape

Every AI task should return:

```json
{
  "task": "classify_page_role",
  "provider": "local-llama",
  "model": "qwen3-4b-q4",
  "status": "success",
  "confidence": 0.82,
  "sourceIds": ["pageId"],
  "output": {},
  "warnings": [],
  "needsAnalystReview": false
}
```

## Storage Rules

Store:

- task name.
- provider.
- model.
- source ids.
- output.
- confidence.
- warnings.
- created timestamp.

Do not store:

- raw secrets.
- external provider API keys.
- unnecessary full prompts if they contain large page content.

For debugging, store prompt template version and source ids instead of massive raw prompts.

## Queueing

Use Agenda jobs for batch AI work.

Examples:

- `project.aiInferProfile`
- `project.aiClassifyPages`
- `project.aiSummarizePages`
- `project.aiGroupIssues`

For local CPU inference:

- concurrency 1.
- avoid running during heavy crawl/render if CPU constrained.
- allow analyst-triggered single-page jobs.

## Fallback Strategy

If local model fails:

1. retry once with JSON repair prompt.
2. mark task `needs_review`.
3. optionally route to external model if task is configured as high value.

Do not silently accept malformed output.
