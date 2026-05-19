import { request } from 'undici';
import { loadEnv } from '../../config/env';
import type { AIClient, AIRequest, AIResponse } from '../types';

export const groqClient: AIClient = {
  provider: 'groq',
  available() {
    return !!loadEnv().GROQ_API_KEY;
  },
  async complete(req: AIRequest, model: string): Promise<AIResponse> {
    const env = loadEnv();
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY missing');
    const res = await request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GROQ_API_KEY}`,
        'content-type': 'application/json',
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
      bodyTimeout: 120_000,
    });
    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      throw new Error(`Groq HTTP ${res.statusCode}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.body.json()) as Record<string, unknown>;
    const choices = data['choices'] as Array<Record<string, unknown>> | undefined;
    const content =
      (((choices?.[0]?.['message'] as Record<string, unknown>) ?? {})['content'] as string) ?? '';
    const usage = data['usage'] as Record<string, number> | undefined;
    return {
      provider: 'groq',
      model,
      content,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      costEstimateUsd: 0,
      raw: data,
    };
  },
};
