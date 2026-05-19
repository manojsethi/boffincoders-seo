import { OAuth2Client } from 'google-auth-library';
import { loadEnv } from '../../config/env';

export type GoogleProvider = 'gsc' | 'ga4';

/**
 * Per-provider callback path. Matches the redirect URIs configured in Google Cloud Console.
 *   GSC: /api/integrations/gsc/callback
 *   GA4: /api/integrations/ga4/callback
 */
export function callbackPath(provider: GoogleProvider): string {
  return provider === 'gsc'
    ? '/api/integrations/gsc/callback'
    : '/api/integrations/ga4/callback';
}

export function redirectUriFor(provider: GoogleProvider): string {
  const env = loadEnv();
  const base = (env.GOOGLE_OAUTH_REDIRECT_BASE ?? '').replace(/\/$/, '');
  return `${base}${callbackPath(provider)}`;
}

/**
 * Phase-D security: never cache a singleton. Each call returns a fresh client so parallel
 * project syncs or concurrent OAuth flows can't cross-contaminate credentials.
 */
export function createOAuthClient(provider: GoogleProvider): OAuth2Client {
  const env = loadEnv();
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUriFor(provider),
  });
}

const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'openid',
  'email',
];

const GA4_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid',
  'email',
];

export function scopesFor(provider: GoogleProvider): string[] {
  return provider === 'gsc' ? GSC_SCOPES : GA4_SCOPES;
}

/**
 * Build auth URL for a single provider. Each provider has its own redirect + scopes — never bundled.
 */
export function getAuthUrl(provider: GoogleProvider, state: string): string {
  return createOAuthClient(provider).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopesFor(provider),
    state,
    include_granted_scopes: false,
  });
}
