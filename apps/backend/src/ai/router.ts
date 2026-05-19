import { loadEnv } from '../config/env';
import { getLogger } from '../config/logger';
import { localClient } from './providers/local';
import { groqClient } from './providers/groq';
import { openAIClient } from './providers/openai';
import { anthropicClient } from './providers/anthropic';
import { openRouterClient } from './providers/openrouter';
import type { AIClient, AIProvider, AIRequest, AIResponse } from './types';

const log = getLogger('ai:router');

const CLIENTS: Record<AIProvider, AIClient> = {
  openrouter: openRouterClient,
  local: localClient,
  groq: groqClient,
  openai: openAIClient,
  anthropic: anthropicClient,
};

// Per-provider model picks per tier. OpenRouter models come from env (configurable).
const DEFAULT_MODELS: Record<AIProvider, { cheap: string; premium: string }> = {
  openrouter: { cheap: 'meta-llama/llama-3.3-70b-instruct', premium: 'anthropic/claude-3.5-sonnet' },
  local: { cheap: 'llama3.1', premium: 'llama3.1' },
  groq: { cheap: 'llama-3.3-70b-versatile', premium: 'llama-3.3-70b-versatile' },
  openai: { cheap: 'gpt-4o-mini', premium: 'gpt-4o' },
  anthropic: { cheap: 'claude-3-5-haiku-latest', premium: 'claude-3-5-sonnet-latest' },
};

export type RouteOptions = {
  provider?: AIProvider;
  model?: string;
  /** Allow fallback to next available provider on failure. */
  allowFallback?: boolean;
};

/**
 * Dynamic router:
 * - cheap tier: prefer env default → openrouter → groq → openai → local. Anthropic only if explicitly requested.
 * - premium tier: openrouter → openai → anthropic → groq → local.
 * - explicit `provider` overrides selection order.
 */
export async function routeAI(req: AIRequest, opts: RouteOptions = {}): Promise<AIResponse> {
  const env = loadEnv();
  const tier = req.tier ?? 'cheap';

  let order: AIProvider[];
  if (opts.provider) {
    order = [opts.provider];
  } else if (tier === 'premium') {
    order = ['openrouter', 'openai', 'anthropic', 'groq', 'local'];
  } else {
    // cheap: prefer env default first, then low-cost order, exclude anthropic unless requested.
    const preferred = (env.AI_DEFAULT_PROVIDER as AIProvider) ?? 'openrouter';
    order = uniqueFilter([preferred, 'openrouter', 'groq', 'openai', 'local']);
  }

  let lastErr: Error | null = null;
  for (const provider of order) {
    const client = CLIENTS[provider];
    if (!client.available()) continue;
    const model = opts.model ?? pickModel(provider, tier, env);
    try {
      log.debug({ provider, model, tier }, 'routing AI request');
      return await client.complete(req, model);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      log.warn({ err: lastErr.message, provider, model }, 'AI provider failed');
      if (!opts.allowFallback) throw lastErr;
    }
  }

  throw (
    lastErr ??
    new Error(
      'No AI provider available. Configure OPENROUTER_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or AI_LOCAL_MODEL_URL.',
    )
  );
}

type EnvLike = ReturnType<typeof loadEnv>;

function pickModel(
  provider: AIProvider,
  tier: 'cheap' | 'premium',
  env: EnvLike,
): string {
  if (provider === 'openrouter') {
    return tier === 'premium' ? env.OPENROUTER_MODEL_PREMIUM : env.OPENROUTER_MODEL_CHEAP;
  }
  if (provider === 'local') return env.AI_LOCAL_MODEL_NAME || DEFAULT_MODELS.local[tier];
  return DEFAULT_MODELS[provider][tier];
}

function uniqueFilter(list: AIProvider[]): AIProvider[] {
  const seen = new Set<AIProvider>();
  const out: AIProvider[] = [];
  for (const p of list) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function availableProviders(): AIProvider[] {
  return (Object.keys(CLIENTS) as AIProvider[]).filter((p) => CLIENTS[p].available());
}
