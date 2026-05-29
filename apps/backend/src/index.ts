import { loadEnv } from './config/env';
import { getLogger } from './config/logger';
import { connectMongo, disconnectMongo } from './db/connect';
import { getAgenda, registerJobs } from './jobs';
import { createServer } from './http/server';
import { ProjectModel, CrawlRunModel } from './db';

const log = getLogger('main');

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  log.info('mongo connected');

  // Phase 12 backfill. Projects created before onboarding existed must not get gated into the
  // wizard. Any project that already has a completed crawl run (or `lastCrawledAt` set) is
  // treated as already-onboarded so analysts can keep working on existing data. One-shot:
  // safe to run on every boot since the filter excludes projects already marked complete.
  try {
    const r = await ProjectModel.aggregate([
      {
        $match: {
          $or: [
            { 'onboardingState.completedAt': { $exists: false } },
            { 'onboardingState.completedAt': null },
          ],
        },
      },
      {
        $lookup: {
          from: CrawlRunModel.collection.name,
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$projectId', '$$pid'] } } },
            { $limit: 1 },
          ],
          as: 'crawls',
        },
      },
      {
        $match: {
          $or: [
            { 'crawls.0': { $exists: true } },
            { lastCrawledAt: { $ne: null } },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);
    if (r.length > 0) {
      const ids = r.map((p: { _id: unknown }) => p._id);
      const now = new Date();
      await ProjectModel.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            'onboardingState.completedAt': now,
            'onboardingState.completedSteps': [1, 2, 3, 4, 5, 6, 7, 8],
            'onboardingState.currentStep': 8,
          },
        },
      );
      log.info({ count: ids.length }, 'phase 12 onboarding backfill: marked existing projects complete');
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'phase 12 onboarding backfill skipped');
  }

  const agenda = getAgenda();
  registerJobs(agenda);
  await agenda.start();
  log.info('agenda started');

  const app = createServer();
  const server = app.listen(env.BACKEND_PORT, env.BACKEND_HOST, () => {
    log.info({ port: env.BACKEND_PORT, host: env.BACKEND_HOST }, 'http listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    try {
      server.close();
      await agenda.stop();
      await disconnectMongo();
    } catch (err) {
      log.warn({ err }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});
