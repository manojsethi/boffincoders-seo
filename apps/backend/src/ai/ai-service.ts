// AI Service. Single execution path for every AI call in the product.
//
// Architecture: Feature → Task Service → AI Service → OpenRouter → validated output.
//
// Refactor 2026-05-28: collapsed the previous multi-provider router (local / OpenAI / Groq /
// Anthropic / OpenRouter cheap+premium tiers) into one OpenRouter-backed service pinned to
// `google/gemma-4-31b-it`. Product features never call OpenRouter directly — they always go
// through `runAICompletion()` so we keep a clean swap-point if we later add another provider.

import { request } from 'undici';
import { loadEnv } from '../config/env';
import { getLogger } from '../config/logger';

const log = getLogger('ai:service');

export const AI_PROVIDER = 'openrouter' as const;
export const AI_MODEL_DEFAULT = 'google/gemma-4-31b-it' as const;

export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  provider: typeof AI_PROVIDER;
  model: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  costEstimateUsd: number;
  raw?: unknown;
}

/**
 * Returns true when OpenRouter credentials are present. Callers use this for the graceful
 * "AI unavailable" flow — the product must keep working without AI keys.
 */
export function isAIAvailable(): boolean {
  return !!loadEnv().OPENROUTER_API_KEY;
}

/**
 * Single AI call. Pinned to OpenRouter + the configured model. Throws on transport/HTTP errors.
 * Schema validation lives in `task-service.ts` so this layer stays transport-only.
 */
export async function runAICompletion(
  req: AICompletionRequest,
): Promise<AICompletionResponse> {
  const env = loadEnv();
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing');
  }
  const model = env.OPENROUTER_MODEL || AI_MODEL_DEFAULT;
  log.debug({ model, json: req.json }, 'openrouter completion');

  const res = await request('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      // OpenRouter attribution headers.
      'http-referer': env.OPENROUTER_REFERER,
      'x-title': env.OPENROUTER_APP_NAME,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxOutputTokens ?? 2000,
      response_format: req.json ? { type: 'json_object' } : undefined,
    }),
    headersTimeout: 60_000,
    bodyTimeout: 180_000,
  });
  if (res.statusCode !== 200) {
    const errText = await res.body.text();
    throw new Error(`OpenRouter HTTP ${res.statusCode}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.body.json()) as Record<string, unknown>;
  const choices = data['choices'] as Array<Record<string, unknown>> | undefined;
  const content =
    (((choices?.[0]?.['message'] as Record<string, unknown>) ?? {})['content'] as string) ?? '';
  const usage = data['usage'] as Record<string, number> | undefined;
  const cost = typeof data['total_cost'] === 'number' ? (data['total_cost'] as number) : 0;
  return {
    provider: AI_PROVIDER,
    model,
    content,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    costEstimateUsd: cost,
    raw: data,
  };
}
