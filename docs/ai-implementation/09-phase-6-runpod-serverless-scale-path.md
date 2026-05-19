# 09. Phase 6: RunPod Serverless Scale Path

## Phase Goal

Prepare the AI architecture so local CPU inference can later scale to serverless GPU providers such as RunPod without rewriting product workflows.

Do not implement RunPod first.

Start local. Add RunPod only when:

- local inference is too slow.
- agency usage grows.
- batch jobs create queue delays.
- larger models are justified.
- report quality needs a stronger model.

## Architecture Principle

RunPod should be just another provider behind the model router.

```text
AI Task Service
  |
  v
Model Router
  | local task
  v
llama.cpp local

Model Router
  | scale/high-quality task
  v
RunPod serverless endpoint
```

No product feature should call RunPod directly.

## RunPod Provider Responsibilities

Provider should support:

- request payload conversion.
- timeout.
- retry.
- cost estimate.
- model metadata.
- error normalization.
- structured output validation.

## Which Tasks Might Move To RunPod

Good candidates:

- report section drafting.
- issue grouping for large audits.
- website profile inference for very large sites.
- content strategy summaries.
- future content briefs.

Keep local:

- page role classification.
- quick summaries.
- entity extraction.
- low-risk repeated tasks.

## Data Privacy

Before sending to RunPod:

- strip secrets.
- strip OAuth data.
- strip personal user info.
- minimize page content.
- send only needed excerpts.
- log source ids, not full prompt where possible.

## Cost Controls

Add:

- per-project AI budget.
- per-task provider policy.
- max context.
- max pages per batch.
- analyst-triggered high-quality mode.

## Provider Policy Example

```json
{
  "task": "draft_report_section",
  "defaultProvider": "local-qwen3",
  "fallbackProvider": "runpod-medium",
  "requiresApprovalForFallback": true,
  "maxInputTokens": 12000
}
```

## Validation Checklist

Do not mark complete until:

- RunPod provider is behind model router.
- local provider still works.
- task routing is configurable.
- external payload excludes secrets.
- fallback is explicit.
- costs are logged.
- self-audit is written.

