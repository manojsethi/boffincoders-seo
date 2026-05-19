export type AIProvider = 'openrouter' | 'openai' | 'groq' | 'anthropic' | 'local';

export type AIRequest = {
  systemPrompt: string;
  userPrompt: string;
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  tier?: 'cheap' | 'premium';
};

export type AIResponse = {
  provider: AIProvider;
  model: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  costEstimateUsd: number;
  raw?: unknown;
};

export interface AIClient {
  provider: AIProvider;
  available(): boolean;
  complete(req: AIRequest, model: string): Promise<AIResponse>;
}
