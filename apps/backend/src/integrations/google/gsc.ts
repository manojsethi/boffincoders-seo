import { Types } from 'mongoose';
import { google } from 'googleapis';
import { getLogger } from '../../config/logger';
import { GscRowModel, SiteConnectionModel } from '../../db';
import { createOAuthClient } from './oauth';
import { decryptTokens } from '../../config/encryption';
import { backfillGoogleAccountEmail } from './account';

const log = getLogger('integrations:gsc');

export async function syncSearchAnalytics(opts: {
  projectId: string;
  daysBack?: number;
}): Promise<{ rowsFetched: number; rowsPersisted: number; error?: string }> {
  const projectId = new Types.ObjectId(opts.projectId);
  const conn = await SiteConnectionModel.findOne({
    projectId,
    provider: 'gsc',
    status: 'connected',
  }).lean();
  if (!conn || !conn.siteUrl || !conn.encryptedTokens) {
    return { rowsFetched: 0, rowsPersisted: 0, error: 'gsc not connected' };
  }
  let refreshToken: string | undefined;
  try {
    refreshToken = decryptTokens(conn.encryptedTokens).refreshToken;
  } catch (err) {
    const msg = (err as Error).message;
    log.error({ projectId: opts.projectId }, 'gsc token decrypt failed');
    return { rowsFetched: 0, rowsPersisted: 0, error: `decrypt failed: ${msg}` };
  }
  if (!refreshToken) {
    return { rowsFetched: 0, rowsPersisted: 0, error: 'no refresh token; reconnect GSC' };
  }

  const oauth = createOAuthClient('gsc');
  oauth.setCredentials({ refresh_token: refreshToken });
  await backfillGoogleAccountEmail({ projectId: opts.projectId, provider: 'gsc', oauth });
  const webmasters = google.webmasters({ version: 'v3', auth: oauth });

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (opts.daysBack ?? 28));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: conn.siteUrl,
      requestBody: {
        startDate: startStr,
        endDate: endStr,
        dimensions: ['page', 'query'],
        rowLimit: 5000,
      },
    });
    const rows = res.data.rows ?? [];

    // Persist rows. Upsert by (projectId, pageUrl, query, rangeEnd).
    let persisted = 0;
    for (const r of rows) {
      const [pageUrl, query] = r.keys ?? [];
      if (!pageUrl || !query) continue;
      await GscRowModel.updateOne(
        {
          projectId,
          pageUrl,
          query,
          rangeEnd: end,
        },
        {
          $set: {
            projectId,
            pageUrl,
            query,
            clicks: r.clicks ?? 0,
            impressions: r.impressions ?? 0,
            ctr: r.ctr ?? 0,
            position: r.position ?? 0,
            rangeStart: start,
            rangeEnd: end,
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
    log.warn({ err }, 'GSC sync failed');
    const msg = err instanceof Error ? err.message : String(err);
    await SiteConnectionModel.updateOne({ _id: conn._id }, { $set: { error: msg } });
    return { rowsFetched: 0, rowsPersisted: 0, error: msg };
  }
}

/**
 * Page-level aggregation. Returns latest synced GSC totals per pageUrl.
 */
export async function gscPageTotals(projectId: Types.ObjectId): Promise<
  Map<string, { clicks: number; impressions: number; ctr: number; position: number }>
> {
  const rows = await GscRowModel.aggregate<{
    _id: string;
    clicks: number;
    impressions: number;
    avgPosition: number;
  }>([
    { $match: { projectId } },
    {
      $group: {
        _id: '$pageUrl',
        clicks: { $sum: '$clicks' },
        impressions: { $sum: '$impressions' },
        avgPosition: { $avg: '$position' },
      },
    },
  ]);
  const map = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
  for (const r of rows) {
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    map.set(r._id, {
      clicks: r.clicks,
      impressions: r.impressions,
      ctr,
      position: r.avgPosition ?? 0,
    });
  }
  return map;
}
