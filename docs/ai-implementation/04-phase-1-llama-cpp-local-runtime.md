# 04. Phase 1: llama.cpp Local Runtime

## Phase Goal

Add local model runtime support without changing product behavior yet.

At the end of this phase:

- `llama.cpp` server can run locally.
- backend can call it through a provider.
- model router can choose SmolLM3-3B or Qwen3-4B.
- a test endpoint/job can validate structured output.
- no SEO workflow depends on AI yet.

## Runtime Setup

Run local model through `llama-server`.

Example:

```bash
llama-server \
  -m /models/qwen3-4b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 8192 \
  -t 4
```

Alternative model:

```bash
llama-server \
  -m /models/smollm3-3b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  -c 4096 \
  -t 4
```

## Environment Variables

Suggested:

```text
LOCAL_LLM_ENABLED=true
LOCAL_LLM_DEFAULT_PROVIDER=llama
LOCAL_LLM_QWEN_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_SMOL_BASE_URL=http://127.0.0.1:8081/v1
LOCAL_LLM_TIMEOUT_MS=60000
LOCAL_LLM_MAX_CONCURRENCY=1
```

## Backend Provider

Create a local llama provider that supports:

- chat completion.
- JSON output prompt.
- timeout.
- retry.
- model metadata.

It should call OpenAI-compatible endpoint:

```text
/v1/chat/completions
```

## Health Check

Add an internal health check:

- local model reachable.
- model name returned if available.
- test prompt succeeds.
- latency measured.

Do not expose this publicly.

## Test Task

Create a minimal internal test task:

Input:

```text
Classify this page title: "About Our NGO"
```

Expected JSON:

```json
{
  "pageRole": "about",
  "confidence": 0.8
}
```

## Validation Checklist

Do not mark complete until:

- SmolLM3-3B runs through llama.cpp.
- Qwen3-4B runs through llama.cpp.
- backend can call local provider.
- invalid JSON is rejected.
- timeout works.
- backend typecheck passes.
- no production workflow depends on local AI yet.
- self-audit is written.

