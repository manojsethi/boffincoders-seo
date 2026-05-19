import { Agent } from 'undici';

let cached: Agent | null = null;

export function getDispatcher(): Agent {
  if (cached) return cached;
  cached = new Agent({
    connect: { timeout: 10_000 },
    keepAliveTimeout: 5_000,
    keepAliveMaxTimeout: 10_000,
  });
  return cached;
}
