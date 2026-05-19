# 02. Local Model Selection

## Goal

Choose small open models that can run on CPU with approximately:

- 8 GB RAM.
- 4 vCPU.
- `llama.cpp`.
- GGUF quantized files.

Do not assume GPU availability.

## Initial Supported Models

### Model 1: SmolLM3-3B

Use case:

- fast classification.
- page role inference.
- short summaries.
- website type labels.
- simple entity extraction.
- low-cost repeated tasks.

Why:

- small enough for CPU.
- suitable for high-volume enrichment.
- good default for lightweight structured tasks.

Recommended quantization:

- `Q4_K_M` first.
- `Q5_K_M` only if quality gain is worth memory/cpu cost.

### Model 2: Qwen3-4B

Use case:

- better structured JSON.
- website profile inference.
- intent classification.
- recommendation rewrite.
- issue grouping.
- report section draft.

Why:

- stronger reasoning than tiny models.
- still practical on CPU with quantization.
- good main local quality model.

Recommended quantization:

- `Q4_K_M` first.
- keep context controlled.

## Optional Future Model Lane

### 7B/8B Local Quality Mode

Only add later if testing proves it helps.

Possible use:

- higher-quality report drafts.
- complex issue grouping.
- strategic internal summaries.

Constraints:

- slower on 8 GB CPU.
- concurrency must be 1.
- context must be small.
- not suitable for every page.

## Model Selection Policy

Use task severity and volume:

| Task | Default Model |
|---|---|
| Page role classification | SmolLM3-3B |
| Bulk page summaries | SmolLM3-3B |
| Website profile inference | Qwen3-4B |
| Entity/topic extraction | SmolLM3-3B or Qwen3-4B |
| Search intent classification | Qwen3-4B |
| Recommendation rewrite | Qwen3-4B |
| Issue grouping | Qwen3-4B |
| Report section draft | Qwen3-4B or external fallback |

## Runtime Limits

Initial defaults:

- one local model loaded at a time.
- concurrency 1.
- context 4096 to 8192.
- temperature low for classification.
- strict JSON mode through prompting and schema validation.
- retry once with repair prompt if JSON fails.

## Model Addition Rule

Do not hardcode model names inside product tasks.

All model choices must go through the model router.

Adding a new model should require:

- provider config.
- task routing config.
- max context.
- cost estimate or local resource estimate.
- validation run.

