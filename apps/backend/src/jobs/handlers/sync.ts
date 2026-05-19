import type { Job } from 'agenda';
import mongoose, { Types } from 'mongoose';
import { getLogger } from '../../config/logger';
import { loadEnv } from '../../config/env';
import { PageModel } from '../../db';
import { syncSearchAnalytics, syncGa4, fetchCoreWebVitals } from '../../integrations';
import { recordCwv } from '../../integrations/google/cwv';

const log = getLogger('jobs:sync');

/**
 * Doc 12 §"Level 1: Project Integration Job Visibility" — when the integration call returns an
 * error, the job must visibly fail. Agenda marks the job failed when the handler throws.
 * We also write the error onto SiteConnection inside the sync helpers so the UI can surface it.
 */
export async function runSyncGSCHandler(job: Job<{ projectId: string }>): Promise<void> {
  const { projectId } = job.attrs.data;
  const res = await syncSearchAnalytics({ projectId });
  log.info(
    { projectId, rows: res.rowsFetched, persisted: res.rowsPersisted, err: res.error },
    'gsc sync',
  );
  if (res.error) throw new Error(`gsc sync failed: ${res.error}`);
}

export async function runSyncGA4Handler(job: Job<{ projectId: string }>): Promise<void> {
  const { projectId } = job.attrs.data;
  const res = await syncGa4({ projectId });
  log.info(
    { projectId, rows: res.rowsFetched, persisted: res.rowsPersisted, err: res.error },
    'ga4 sync',
  );
  if (res.error) throw new Error(`ga4 sync failed: ${res.error}`);
}

/**
 * Cooperative-cancellation check. The job monitor sets `data.cancelledAt` on the Agenda doc when
 * an analyst cancels a running job. We re-read that field between URLs so the handler stops
 * promptly without leaving partial work mid-PSI fetch. Doc 12 §"Cancellation must be conservative".
 */
async function isCancelled(job: Job<{ projectId: string }>): Promise<boolean> {
  // Agenda exposes `attrs.data` and refreshes it on save() — pull fresh via raw collection.
  const data = job.attrs.data as { cancelledAt?: Date | string };
  if (data?.cancelledAt) return true;
  const id = job.attrs._id;
  if (!id) return false;
  const coll = mongoose.connection.db?.collection(loadEnv().AGENDA_COLLECTION);
  if (!coll) return false;
  const fresh = (await coll.findOne({ _id: id }, { projection: { 'data.cancelledAt': 1 } })) as
    | { data?: { cancelledAt?: unknown } }
    | null;
  return !!fresh?.data?.cancelledAt;
}

export async function runSyncCWVHandler(
  job: Job<{ projectId: string; maxUrls?: number; strategy?: 'mobile' | 'desktop' }>,
): Promise<void> {
  const { projectId, maxUrls, strategy } = job.attrs.data;
  const pages = await PageModel.find({ projectId: new Types.ObjectId(projectId) })
    .sort({ isImportant: -1, internalLinksIn: -1 })
    .limit(maxUrls ?? 10)
    .lean();
  if (pages.length === 0) {
    log.info({ projectId }, 'cwv: no pages to sync');
    return;
  }
  let ok = 0;
  let failed = 0;
  let cancelled = false;
  const firstErrors: string[] = [];
  for (const p of pages) {
    const url = p.url ?? p.normalizedUrl;
    if (!url) continue;
    if (await isCancelled(job)) {
      cancelled = true;
      log.info({ projectId }, 'cwv: cooperative cancel observed, stopping loop');
      break;
    }
    const r = await fetchCoreWebVitals({ url, strategy });
    await recordCwv({ projectId, pageUrl: url, strategy, result: r });
    log.info({ url, lcp: r.lcp, inp: r.inp, cls: r.cls, perf: r.performanceScore, err: r.error }, 'cwv fetched');
    if (r.error) {
      failed += 1;
      if (firstErrors.length < 3) firstErrors.push(`${url}: ${r.error}`);
    } else {
      ok += 1;
    }
  }
  if (cancelled) {
    throw new Error('cwv sync cancelled by user');
  }
  const total = ok + failed;
  if (total > 0 && failed === total) {
    throw new Error(`cwv sync failed: all ${total} URLs failed. Samples: ${firstErrors.join(' | ')}`);
  }
  if (total > 0 && failed / total > 0.5) {
    throw new Error(
      `cwv sync mostly failed: ${failed}/${total} URLs failed. Samples: ${firstErrors.join(' | ')}`,
    );
  }
}
