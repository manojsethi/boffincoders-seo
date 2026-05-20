import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import { SiteConnectionModel, CwvMetricModel } from '../../db';
import {
  callbackPath,
  createOAuthClient,
  getAuthUrl,
  type GoogleProvider,
} from '../../integrations/google/oauth';
import { getAgenda, JOB_NAMES } from '../../jobs/agenda';
import { loadEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import {
  decryptTokens,
  encryptTokens,
  TOKEN_ENCRYPTION_VERSION,
} from '../../config/encryption';

const log = getLogger('http:integrations');
export const integrationsRouter = Router();

const isProvider = (v: string): v is GoogleProvider => v === 'gsc' || v === 'ga4';

/**
 * Helper: resolve refresh token from a stored connection. Returns null with structured reason.
 */
function loadRefreshToken(encryptedTokens: string | undefined): {
  refreshToken: string | null;
  reason?: string;
} {
  if (!encryptedTokens) return { refreshToken: null, reason: 'not-authed' };
  try {
    const t = decryptTokens(encryptedTokens);
    return { refreshToken: t.refreshToken ?? null, reason: t.refreshToken ? undefined : 'no-refresh-token' };
  } catch (err) {
    log.error({ err: (err as Error).message }, 'token decrypt failed');
    return { refreshToken: null, reason: 'decrypt-failed' };
  }
}

/**
 * Provider-specific OAuth start. Matches the old app's redirect URI pattern so Google Cloud
 * Console doesn't need to change. Each provider gets its own callback path + its own scope set.
 */
function buildConnectHandler(provider: GoogleProvider) {
  return (req: import('express').Request, res: import('express').Response): void => {
    const projectId = String(req.query.projectId ?? '');
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'projectId required' });
      return;
    }
    const env = loadEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.status(500).json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured' });
      return;
    }
    const state = Buffer.from(JSON.stringify({ projectId, provider })).toString('base64url');
    res.redirect(getAuthUrl(provider, state));
  };
}

integrationsRouter.get('/api/integrations/gsc/connect', buildConnectHandler('gsc'));
integrationsRouter.get('/api/integrations/ga4/connect', buildConnectHandler('ga4'));

/**
 * Provider-specific OAuth callbacks. Fresh OAuth client per call.
 *  - Encrypt token payload at rest.
 *  - Preserve previous refresh_token when Google omits one this round.
 *  - If no new refresh_token and no previous one exists, fail clearly and stay disconnected/error.
 */
function buildCallbackHandler(provider: GoogleProvider) {
  return async (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ): Promise<void> => {
    try {
      const code = String(req.query.code ?? '');
      const state = String(req.query.state ?? '');
      if (!code || !state) {
        res.status(400).send('missing code/state');
        return;
      }
      const env = loadEnv();
      let projectId = '';
      let stateProvider = '';
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
          projectId: string;
          provider: string;
        };
        projectId = parsed.projectId;
        stateProvider = parsed.provider;
      } catch {
        res.status(400).send('invalid state');
        return;
      }
      if (!Types.ObjectId.isValid(projectId)) {
        res.status(400).send('invalid project id in state');
        return;
      }
      if (stateProvider !== provider) {
        // Route provider and state provider must agree — guards against state tampering across providers.
        res.status(400).send('state provider does not match callback');
        return;
      }

      const oauth = createOAuthClient(provider);
      const { tokens } = await oauth.getToken(code);

      // Preserve existing refresh_token when Google omits one this round.
      const existing = await SiteConnectionModel.findOne({
        projectId: new Types.ObjectId(projectId),
        provider,
      }).lean();
      let priorRefresh: string | undefined;
      if (existing?.encryptedTokens) {
        try {
          priorRefresh = decryptTokens(existing.encryptedTokens).refreshToken;
        } catch {
          priorRefresh = undefined;
        }
      }
      const refreshToken = tokens.refresh_token ?? priorRefresh;
      if (!refreshToken) {
        log.warn({ projectId, provider }, 'oauth: no refresh_token and no prior — mark error');
        await SiteConnectionModel.updateOne(
          { projectId: new Types.ObjectId(projectId), provider },
          {
            $set: {
              status: 'disconnected',
              error:
                'Google did not return a refresh_token. Revoke previous consent at https://myaccount.google.com/permissions and reconnect.',
              encryptedTokens: null,
              tokenEncryptionVersion: null,
            },
          },
          { upsert: true },
        );
        respondPopupOrRedirect(res, env.WEB_ORIGIN, {
          type: 'oauth-complete',
          provider,
          projectId,
          ok: false,
          error: 'no_refresh_token',
        });
        return;
      }

      // Resolve the Google account email so analyst can confirm which account they connected.
      // Must explicitly setCredentials — getToken returns tokens but does not always seed the
      // client for follow-up calls inside this same handler.
      let googleAccountEmail: string | undefined;
      try {
        oauth.setCredentials({
          access_token: tokens.access_token ?? undefined,
          refresh_token: refreshToken,
          expiry_date: tokens.expiry_date ?? undefined,
          scope: tokens.scope ?? undefined,
          token_type: tokens.token_type ?? undefined,
          id_token: tokens.id_token ?? undefined,
        });
        // openid id_token has email when scope `email` is granted — parse without an extra HTTP call.
        if (tokens.id_token) {
          const parts = tokens.id_token.split('.');
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(
                Buffer.from(parts[1]!, 'base64url').toString('utf8'),
              ) as { email?: string };
              if (payload.email) googleAccountEmail = payload.email;
            } catch {
              /* malformed id_token — fall through to userinfo */
            }
          }
        }
        if (!googleAccountEmail) {
          const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
          const me = await oauth2.userinfo.get({});
          googleAccountEmail = me.data.email ?? undefined;
        }
      } catch (err) {
        log.warn({ projectId, provider, err: (err as Error).message }, 'userinfo fetch failed');
      }

      const encryptedTokens = encryptTokens({
        refreshToken,
        accessToken: tokens.access_token ?? undefined,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : undefined,
        scope: tokens.scope ?? undefined,
        googleAccountEmail,
      });

      await SiteConnectionModel.updateOne(
        { projectId: new Types.ObjectId(projectId), provider },
        {
          $set: {
            status: 'setup',
            encryptedTokens,
            tokenEncryptionVersion: TOKEN_ENCRYPTION_VERSION,
            googleAccountEmail,
            error: null,
          },
          $unset: { refreshToken: '', accessToken: '', accessTokenExpiresAt: '' },
        },
        { upsert: true },
      );

      // If opened in a popup, postMessage to opener and close. Otherwise redirect to settings.
      respondPopupOrRedirect(res, env.WEB_ORIGIN, {
        type: 'oauth-complete',
        provider,
        projectId,
        ok: true,
      });
    } catch (err) {
      next(err);
    }
  };
}

function respondPopupOrRedirect(
  res: import('express').Response,
  webOrigin: string,
  payload: Record<string, unknown>,
): void {
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
  const projectId = String(payload.projectId ?? '');
  const provider = String(payload.provider ?? '');
  const err = payload.error ? `&error=${encodeURIComponent(String(payload.error))}` : '';
  const fallbackUrl = `${webOrigin}/projects/${projectId}/settings?integration=${provider}${err}`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>OAuth complete</title></head><body style="font-family:system-ui;background:#0b0b0f;color:#e8e9ef;padding:24px">
<p>Authentication complete. You can close this window.</p>
<script>
(function(){
  var msg = ${safe};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, ${JSON.stringify(webOrigin)});
      window.close();
      return;
    }
  } catch (e) { /* ignore */ }
  window.location.replace(${JSON.stringify(fallbackUrl)});
})();
</script>
</body></html>`);
}

integrationsRouter.get('/api/integrations/gsc/callback', buildCallbackHandler('gsc'));
integrationsRouter.get('/api/integrations/ga4/callback', buildCallbackHandler('ga4'));

/**
 * Property / site list for the freshly-authed connection. Fresh OAuth client per request.
 */
integrationsRouter.get('/api/integrations/:provider/properties', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    if (!isProvider(provider)) {
      res.status(400).json({ error: 'invalid provider' });
      return;
    }
    const projectId = String(req.query.projectId ?? '');
    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'projectId required' });
      return;
    }
    const conn = await SiteConnectionModel.findOne({
      projectId: new Types.ObjectId(projectId),
      provider,
    }).lean();
    const { refreshToken, reason } = loadRefreshToken(conn?.encryptedTokens ?? undefined);
    if (!refreshToken) {
      const status = reason === 'decrypt-failed' ? 500 : 400;
      res.status(status).json({
        error:
          reason === 'decrypt-failed'
            ? 'token decrypt failed — check ENCRYPTION_KEY'
            : reason === 'no-refresh-token'
              ? 'connection has no refresh token; reconnect'
              : 'connection not authed yet',
      });
      return;
    }

    const oauth = createOAuthClient(provider);
    oauth.setCredentials({ refresh_token: refreshToken });

    if (provider === 'gsc') {
      const webmasters = google.webmasters({ version: 'v3', auth: oauth });
      const sites = await webmasters.sites.list({});
      res.json({
        properties: (sites.data.siteEntry ?? []).map((s) => ({
          siteUrl: s.siteUrl,
          permissionLevel: s.permissionLevel,
        })),
      });
      return;
    }
    const admin = google.analyticsadmin({ version: 'v1beta', auth: oauth });
    const accountsRes = await admin.accountSummaries.list({});
    const props: Array<{ propertyId: string; displayName: string; account?: string }> = [];
    for (const a of accountsRes.data.accountSummaries ?? []) {
      for (const p of a.propertySummaries ?? []) {
        props.push({
          propertyId: (p.property ?? '').replace(/^properties\//, ''),
          displayName: p.displayName ?? '',
          account: a.displayName ?? '',
        });
      }
    }
    res.json({ properties: props });
  } catch (err) {
    next(err);
  }
});

const SelectBody = z.object({
  projectId: z.string(),
  siteUrl: z.string().optional(),
  ga4PropertyId: z.string().optional(),
});

integrationsRouter.post('/api/integrations/:provider/select', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    if (!isProvider(provider)) {
      res.status(400).json({ error: 'invalid provider' });
      return;
    }
    const body = SelectBody.parse(req.body);
    const set: Record<string, unknown> = { status: 'connected' };
    if (provider === 'gsc' && body.siteUrl) set.siteUrl = body.siteUrl;
    if (provider === 'ga4' && body.ga4PropertyId) set.ga4PropertyId = body.ga4PropertyId;
    await SiteConnectionModel.updateOne(
      { projectId: new Types.ObjectId(body.projectId), provider },
      { $set: set },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.get('/projects/:id/integrations', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const projectObjId = new Types.ObjectId(req.params.id);
    const conns = await SiteConnectionModel.find({ projectId: projectObjId }).lean();

    // CWV is not OAuth-backed. Synthesize a virtual integration row so the UI doesn't render
    // "Not connected" for an integration that's actually working through PageSpeed Insights.
    // Doc 5 §"CWV Requirements" + audit feedback 2026-05-18.
    const env = loadEnv();
    const hasApiKey = !!env.PAGESPEED_API_KEY;
    const [latestCwvMetric, latestCwvJob] = await Promise.all([
      CwvMetricModel.findOne({ projectId: projectObjId }).sort({ capturedAt: -1 }).select({ capturedAt: 1, error: 1 }).lean(),
      (async () => {
        const db = mongoose.connection.db;
        if (!db) return null;
        return (await db
          .collection(env.AGENDA_COLLECTION)
          .findOne(
            { name: JOB_NAMES.syncCWV, 'data.projectId': req.params.id },
            { sort: { lastRunAt: -1 } },
          )) as { lastRunAt?: Date; lastFinishedAt?: Date; failedAt?: Date; failReason?: string } | null;
      })(),
    ]);
    const cwvLastSyncedAt =
      latestCwvJob?.lastFinishedAt ??
      latestCwvMetric?.capturedAt ??
      null;
    const cwvJobFailed =
      latestCwvJob?.failedAt &&
      (!latestCwvJob.lastRunAt || latestCwvJob.failedAt >= latestCwvJob.lastRunAt);
    const cwvStatus: 'available' | 'limited' | 'error' = cwvJobFailed
      ? 'error'
      : hasApiKey
        ? 'available'
        : 'limited';
    const cwvVirtual = {
      id: 'virtual-cwv',
      provider: 'cwv' as const,
      status: cwvStatus,
      lastSyncedAt: cwvLastSyncedAt,
      error: cwvJobFailed ? latestCwvJob?.failReason ?? null : null,
      apiKeyConfigured: hasApiKey,
      virtual: true,
      description: hasApiKey
        ? 'Field/lab CWV via PageSpeed Insights with API key.'
        : 'Field/lab CWV via PageSpeed Insights (unauthenticated — strict quota).',
    };

    res.json([
      ...conns.map((c) => ({
        id: String(c._id),
        provider: c.provider,
        status: c.status,
        siteUrl: c.siteUrl,
        ga4PropertyId: c.ga4PropertyId,
        googleAccountEmail: (c as { googleAccountEmail?: string }).googleAccountEmail,
        lastSyncedAt: c.lastSyncedAt,
        error: c.error,
      })),
      cwvVirtual,
    ]);
  } catch (err) {
    next(err);
  }
});

const SyncBody = z.object({
  provider: z.enum(['gsc', 'ga4', 'cwv']),
  maxUrls: z.number().int().min(1).max(100).optional(),
});

integrationsRouter.post('/projects/:id/integrations/sync', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = SyncBody.parse(req.body);
    const jobNameByProvider = {
      gsc: JOB_NAMES.syncGSC,
      ga4: JOB_NAMES.syncGA4,
      cwv: JOB_NAMES.syncCWV,
    } as const;
    const jobName = jobNameByProvider[body.provider];

    // Reject duplicate in-flight one-off syncs. Only one-off jobs (no scheduleId) count; recurring
    // schedule wrappers may still tick separately. Doc 12 §"Cancellation must be conservative".
    //
    // Status logic must match the jobs router (Doc continuation §"Phase 1"): a locked job is
    // still running when lastFinishedAt is missing OR older than lockedAt — that finish belongs
    // to a previous attempt, so the current lock has no completion yet. Audit 2026-05-20.
    const env = loadEnv();
    const db = mongoose.connection.db;
    if (db) {
      const inFlight = await db.collection(env.AGENDA_COLLECTION).findOne({
        name: jobName,
        'data.projectId': req.params.id,
        'data.scheduleId': { $exists: false },
        $or: [
          // Running: locked, with no finish since the lock began
          {
            lockedAt: { $ne: null },
            $expr: {
              $or: [
                { $eq: ['$lastFinishedAt', null] },
                { $lt: ['$lastFinishedAt', '$lockedAt'] },
              ],
            },
          },
          // Queued: scheduled to run and not yet started, no prior finish
          { nextRunAt: { $ne: null }, lockedAt: null, lastFinishedAt: null },
        ],
      });
      if (inFlight) {
        const status = inFlight.lockedAt ? 'running' : 'queued';
        res.status(409).json({
          error: `A ${body.provider.toUpperCase()} sync is already ${status} for this project.`,
          provider: body.provider,
          status,
        });
        return;
      }
    }

    const agenda = getAgenda();
    const baseData: Record<string, unknown> = { projectId: req.params.id, trigger: 'manual' };
    if (body.provider === 'cwv') baseData.maxUrls = body.maxUrls ?? 10;
    await agenda.now(jobName, baseData);
    res.status(202).json({ queued: body.provider });
  } catch (err) {
    next(err);
  }
});

/**
/**
 * Project-scoped sync-job visibility. Reads Agenda job docs directly + returns only safe metadata.
 * Doc 05 §"Integration Self-Audit" — analysts must know whether background sync is running/failing.
 */
// Project-level job visibility moved to dedicated jobs router. Doc 12 §"Level 2".

/**
 * Disconnect a single provider — must NOT touch the other provider's record.
 */
integrationsRouter.delete('/projects/:id/integrations/:provider', async (req, res, next) => {
  try {
    if (!['gsc', 'ga4', 'cwv'].includes(req.params.provider)) {
      res.status(400).json({ error: 'invalid provider' });
      return;
    }
    await SiteConnectionModel.updateOne(
      { projectId: new Types.ObjectId(req.params.id), provider: req.params.provider },
      {
        $set: {
          status: 'disconnected',
          encryptedTokens: null,
          tokenEncryptionVersion: null,
          error: null,
          lastSyncedAt: null,
          googleAccountEmail: null,
        },
        $unset: {
          // Defensive: legacy plaintext fields from older app versions.
          refreshToken: '',
          accessToken: '',
          accessTokenExpiresAt: '',
        },
      },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Helper export for callers that want to know callback URL (e.g. analytics / docs).
export { callbackPath };
