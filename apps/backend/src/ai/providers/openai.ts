import OpenAI from 'openai';
import { loadEnv } from '../../config/env';
import type { AIClient, AIRequest, AIResponse } from '../types';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
};

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;
  client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export const openAIClient: AIClient = {
  provider: 'openai',
  available() {
    return !!getClient();
  },
  async complete(req: AIRequest, model: string): Promise<AIResponse> {
    const c = getClient();
    if (!c) throw new Error('OPENAI_API_KEY missing');
    const res = await c.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxOutputTokens ?? 2000,
      response_format: req.json ? { type: 'json_object' } : undefined,
    });
    const content = res.choices[0]?.message?.content ?? '';
    const usage = res.usage;
    const price = PRICING[model] ?? PRICING['gpt-4o-mini']!;
    const cost =
      (usage?.prompt_tokens ?? 0) * price.input + (usage?.completion_tokens ?? 0) * price.output;
    return {
      provider: 'openai',
      model,
      content,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      costEstimateUsd: cost,
      raw: res,
    };
  },
};
