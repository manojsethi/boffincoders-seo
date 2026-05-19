import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { RenderRunModel } from '../../db';
import { getLogger } from '../../config/logger';
import { renderRecrawlPages } from '../../crawler/render';
import { rerunSchemaRulesForPages } from '../../audit/rerun-schema-rules';

const log = getLogger('jobs:render');

export type RenderJobData = {
  projectId: string;
  renderRunId: string;
};

export async function runRenderHandler(job: Job<RenderJobData>): Promise<void> {
  const { projectId, renderRunId } = job.attrs.data;
  const runId = new Types.ObjectId(renderRunId);
  await RenderRunModel.updateOne(
    { _id: runId },
    { $set: { agendaJobId: String(job.attrs._id), status: 'running', startedAt: new Date() } },
  );
  const run = await RenderRunModel.findById(runId).lean();
  if (!run) throw new Error('render run not found');

  try {
    const pageIds = ((run.pageIds as unknown as Types.ObjectId[] | undefined) ?? []).map(String);
    const results = await renderRecrawlPages({
      projectId,
      pageIds,
      reason: run.reason ?? 'analyst-triggered',
      renderRunId,
    });
    const successful = results.filter((r) => r.ok).map((r) => r.pageId);

    await RenderRunModel.updateOne(
      { _id: runId },
      { $set: { currentStep: 're-running schema rules', progressPercent: 99 } },
    );

    let rerun = { findingsInserted: 0, issuesUpserted: 0, rulesRun: 0, pages: 0 };
    if (successful.length > 0) {
      rerun = await rerunSchemaRulesForPages({ projectId, pageIds: successful });
    }

    await RenderRunModel.updateOne(
      { _id: runId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          progressPercent: 100,
          currentStep: 'completed',
          results,
          rerun,
        },
      },
    );
    log.info({ projectId, renderRunId, ok: successful.length }, 'render run completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, projectId, renderRunId }, 'render run failed');
    await RenderRunModel.updateOne(
      { _id: runId },
      { $set: { status: 'failed', completedAt: new Date(), error: msg, progressPercent: 100 } },
    );
    throw err;
  }
}
