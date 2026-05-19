import { Types } from 'mongoose';
import { google } from 'googleapis';
import { Ga4RowModel, SiteConnectionModel } from '../../db';
import { createOAuthClient } from './oauth';
import { getLogger } from '../../config/logger';
import { decryptTokens } from '../../config/encryption';
import { backfillGoogleAccountEmail } from './account';

const log = getLogger('integrations:ga4');

export async function syncGa4(opts: {
  projectId: string;
  daysBack?: number;
}): Promise<{ rowsFetched: number; rowsPersisted: number; error?: string }> {
  const projectId = new Types.ObjectId(opts.projectId);
  const conn = await SiteConnectionModel.findOne({
    projectId,
    provider: 'ga4',
    status: 'connected',
  }).lean();
  if (!conn?.ga4PropertyId || !conn.encryptedTokens) {
    return { rowsFetched: 0, rowsPersisted: 0, error: 'ga4 not connected' };
  }
  let refreshToken: string | undefined;
  try {
    refreshToken = decryptTokens(conn.encryptedTokens).refreshToken;
  } catch (err) {
    const msg = (err as Error).message;
    log.error({ projectId: opts.projectId }, 'ga4 token decrypt failed');
    return { rowsFetched: 0, rowsPersisted: 0, error: `decrypt failed: ${msg}` };
  }
  if (!refreshToken) {
    return { rowsFetched: 0, rowsPersisted: 0, error: 'no refresh token; reconnect GA4' };
  }
  const oauth = createOAuthClient('ga4');
  oauth.setCredentials({ refresh_token: refreshToken });
  // Backfill googleAccountEmail for legacy connections created before the callback captured it.
  await backfillGoogleAccountEmail({ projectId: opts.projectId, provider: 'ga4', oauth });
  const analytics = google.analyticsdata({ version: 'v1beta', auth: oauth });

  const days = opts.daysBack ?? 28;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - days);

  try {
    const res = await analytics.properties.runReport({
      property: `properties/${conn.ga4PropertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'engagedSessions' },
          { name: 'engagementRate' },
          { name: 'conversions' },
        ],
        limit: '5000',
      },
    });
    const rows = res.data.rows ?? [];

    let persisted = 0;
    for (const r of rows) {
      const pagePath = r.dimensionValues?.[0]?.value;
      const channel = r.dimensionValues?.[1]?.value ?? 'organic';
      if (!pagePath) continue;
      const sessions = Number(r.metricValues?.[0]?.value ?? '0');
      const engagedSessions = Number(r.metricValues?.[1]?.value ?? '0');
      const engagementRate = Number(r.metricValues?.[2]?.value ?? '0');
      const conversions = Number(r.metricValues?.[3]?.value ?? '0');
      await Ga4RowModel.updateOne(
        { projectId, pagePath, channel, rangeEnd: now },
        {
          $set: {
            projectId,
            pagePath,
            channel,
            sessions,
            engagedSessions,
            engagementRate,
            conversions,
            rangeStart: start,
            rangeEnd: now,
          },
        },
        { upsert: true },
      );
      persisted += 1;
    }

    await SiteConnectionModel.updateOne(
      { _id: conn._id },
      { $set: { lastSyncedAt: new Date(), error: null } },
    );
    return { rowsFetched: rows.length, rowsPersisted: persisted };
  } catch (err) {
    log.warn({ err }, 'GA4 sync failed');
    const msg = err instanceof Error ? err.message : String(err);
    await SiteConnectionModel.updateOne({ _id: conn._id }, { $set: { error: msg } });
    return { rowsFetched: 0, rowsPersisted: 0, error: msg };
  }
}

/**
 * Organic-channel landing-page totals keyed by full URL.
 */
export async function ga4PageTotals(
  projectId: Types.ObjectId,
  primaryDomain: string,
): Promise<
  Map<string, { sessions: number; engagedSessions: number; engagementRate: number; conversions: number }>
> {
  const rows = await Ga4RowModel.aggregate<{
    _id: string;
    sessions: number;
    engagedSessions: number;
    engagementRate: number;
    conversions: number;
  }>([
    { $match: { projectId, channel: { $regex: /organic/i } } },
    {
      $group: {
        _id: '$pagePath',
        sessions: { $sum: '$sessions' },
        engagedSessions: { $sum: '$engagedSessions' },
        engagementRate: { $avg: '$engagementRate' },
        conversions: { $sum: '$conversions' },
      },
    },
  ]);
  const map = new Map<string, { sessions: number; engagedSessions: number; engagementRate: number; conversions: number }>();
  const host = primaryDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  for (const r of rows) {
    const url = r._id.startsWith('http') ? r._id : `https://${host}${r._id}`;
    map.set(url, {
      sessions: r.sessions,
      engagedSessions: r.engagedSessions,
      engagementRate: r.engagementRate ?? 0,
      conversions: r.conversions,
    });
  }
  return map;
}
