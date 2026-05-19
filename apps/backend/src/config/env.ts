import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGODB_URI: z.string().min(1),

  BACKEND_PORT: z.coerce.number().default(7010),
  BACKEND_HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:7011'),

  AGENDA_COLLECTION: z.string().default('agendaJobs'),
  AGENDA_PROCESS_EVERY: z.string().default('30 seconds'),
  AGENDA_DEFAULT_LOCK_LIFETIME_MS: z.coerce.number().default(10 * 60 * 1000),

  CRAWL4AI_URL: z.string().default('http://localhost:11235'),
  CRAWL4AI_API_TOKEN: z.string().optional().default(''),

  AI_DEFAULT_PROVIDER: z.enum(['openrouter', 'groq', 'openai', 'anthropic', 'local']).default('openrouter'),
  AI_LOCAL_MODEL_URL: z.string().optional().default(''),
  AI_LOCAL_MODEL_NAME: z.string().default('llama3.1'),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().default(50),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL_CHEAP: z.string().default('meta-llama/llama-3.3-70b-instruct'),
  OPENROUTER_MODEL_PREMIUM: z.string().default('anthropic/claude-3.5-sonnet'),
  OPENROUTER_REFERER: z.string().optional().default('http://localhost:7011'),
  OPENROUTER_APP_NAME: z.string().optional().default('Boffin SEO v2'),
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  // Old-app pattern: per-provider callback paths derived from this base. Required to match the
  // existing Google Cloud Console OAuth client redirect URIs without manual reconfiguration.
  GOOGLE_OAUTH_REDIRECT_BASE: z.string().optional().default('http://localhost:7010'),
  PAGESPEED_API_KEY: z.string().optional().default(''),

  // AES-256-GCM secret used to encrypt OAuth tokens at rest. Required before
  // any token storage or decryption. Either a base64-encoded 32-byte key or any
  // passphrase that we scrypt-derive into a 32-byte key (matches old project).
  // Allowed to be empty at boot — token-handling code re-checks before use.
  ENCRYPTION_KEY: z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || v.length >= 8, {
      message: 'ENCRYPTION_KEY must be at least 8 chars when set',
    }),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
