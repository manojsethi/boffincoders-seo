import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from '../../config/env';
import type { AIClient, AIRequest, AIResponse } from '../types';

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-latest': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
  'claude-3-5-sonnet-latest': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
};

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const env = loadEnv();
  if (!env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export const anthropicClient: AIClient = {
  provider: 'anthropic',
  available() {
    return !!getClient();
  },
  async complete(req: AIRequest, model: string): Promise<AIResponse> {
    const c = getClient();
    if (!c) throw new Error('ANTHROPIC_API_KEY missing');
    const res = await c.messages.create({
      model,
      system: req.systemPrompt + (req.json ? '\n\nRespond ONLY with valid JSON.' : ''),
      messages: [{ role: 'user', content: req.userPrompt }],
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxOutputTokens ?? 2000,
    });
    const textBlock = res.content.find((b) => b.type === 'text');
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const price = PRICING[model] ?? PRICING['claude-3-5-haiku-latest']!;
    const cost =
      (res.usage.input_tokens ?? 0) * price.input + (res.usage.output_tokens ?? 0) * price.output;
    return {
      provider: 'anthropic',
      model,
      content,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      costEstimateUsd: cost,
      raw: res,
    };
  },
};
