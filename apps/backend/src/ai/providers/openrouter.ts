import { request } from 'undici';
import { loadEnv } from '../../config/env';
import type { AIClient, AIRequest, AIResponse } from '../types';

// OpenRouter aggregates multiple model providers behind one OpenAI-compatible API.
// Docs: https://openrouter.ai/docs
export const openRouterClient: AIClient = {
  provider: 'openrouter',
  available() {
    return !!loadEnv().OPENROUTER_API_KEY;
  },
  async complete(req: AIRequest, model: string): Promise<AIResponse> {
    const env = loadEnv();
    if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
    const res = await request('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        // OpenRouter recommends these headers for attribution / model routing.
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
    // OpenRouter returns generation cost in the response on some models.
    const cost = typeof data['total_cost'] === 'number' ? (data['total_cost'] as number) : 0;
    return {
      provider: 'openrouter',
      model,
      content,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      costEstimateUsd: cost,
      raw: data,
    };
  },
};
