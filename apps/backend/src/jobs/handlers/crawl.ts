import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { CrawlRunModel, ProjectModel } from '../../db';
import { getLogger } from '../../config/logger';
import { runCrawl } from '../../crawler';
import { syncLifecycleState } from '../../domain';

const log = getLogger('jobs:crawl');

export type CrawlJobData = {
  projectId: string;
  crawlRunId: string;
  triggeredBy?: 'user' | 'schedule' | 'system';
};

export async function runCrawlHandler(job: Job<CrawlJobData>): Promise<void> {
  const { projectId, crawlRunId } = job.attrs.data;
  await CrawlRunModel.updateOne(
    { _id: new Types.ObjectId(crawlRunId) },
    { $set: { status: 'running', startedAt: new Date(), agendaJobId: String(job.attrs._id) } },
  );

  try {
    const project = await ProjectModel.findById(projectId).lean();
    if (!project) throw new Error('Project not found');
    const run = await CrawlRunModel.findById(crawlRunId).lean();
    if (!run) throw new Error('Crawl run not found');

    await runCrawl({
      projectId,
      crawlRunId,
      primaryDomain: project.primaryDomain,
      allowedDomains: project.allowedDomains ?? [],
      includeSubdomains: project.includeSubdomains ?? false,
      seedUrl: run.seedUrl ?? undefined,
      maxPages: run.maxPages ?? 200,
    });

    await CrawlRunModel.updateOne(
      { _id: new Types.ObjectId(crawlRunId) },
      { $set: { status: 'completed', completedAt: new Date(), progressPercent: 100 } },
    );
    await ProjectModel.updateOne(
      { _id: new Types.ObjectId(projectId) },
      { $set: { lastCrawledAt: new Date() } },
    );
    await syncLifecycleState(projectId);
    log.info({ projectId, crawlRunId }, 'crawl completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, projectId, crawlRunId }, 'crawl failed');
    await CrawlRunModel.updateOne(
      { _id: new Types.ObjectId(crawlRunId) },
      { $set: { status: 'failed', completedAt: new Date(), error: msg } },
    );
    await syncLifecycleState(projectId);
    throw err;
  }
}
