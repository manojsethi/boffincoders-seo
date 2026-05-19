import { request } from 'undici';
import { loadEnv } from '../../config/env';
import type { AIClient, AIRequest, AIResponse } from '../types';

// Local OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.).
export const localClient: AIClient = {
  provider: 'local',
  available() {
    return !!loadEnv().AI_LOCAL_MODEL_URL;
  },
  async complete(req: AIRequest, model: string): Promise<AIResponse> {
    const env = loadEnv();
    if (!env.AI_LOCAL_MODEL_URL) throw new Error('AI_LOCAL_MODEL_URL not set');
    const res = await request(`${env.AI_LOCAL_MODEL_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxOutputTokens ?? 2000,
        response_format: req.json ? { type: 'json_object' } : undefined,
        stream: false,
      }),
      headersTimeout: 60_000,
      bodyTimeout: 180_000,
    });
    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      throw new Error(`Local model HTTP ${res.statusCode}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.body.json()) as Record<string, unknown>;
    const choices = data['choices'] as Array<Record<string, unknown>> | undefined;
    const content =
      (((choices?.[0]?.['message'] as Record<string, unknown>) ?? {})['content'] as string) ?? '';
    const usage = data['usage'] as Record<string, number> | undefined;
    return {
      provider: 'local',
      model,
      content,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      costEstimateUsd: 0,
      raw: data,
    };
  },
};
