import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { AuditRunModel, ProjectModel } from '../../db';
import { getLogger } from '../../config/logger';
import { runAudit } from '../../audit';
import { syncLifecycleState } from '../../domain';
import { generateRecommendations } from '../../recommendations/generate';
import { generateRecommendationsFromKeywordFit } from '../../recommendations/from-keyword-fit';
import { analyzeKeywordFits } from '../../keyword-fit/analyze';

const log = getLogger('jobs:audit');

export type AuditJobData = { projectId: string; auditRunId: string; crawlRunId: string };

export async function runAuditHandler(job: Job<AuditJobData>): Promise<void> {
  const { projectId, auditRunId, crawlRunId } = job.attrs.data;
  await AuditRunModel.updateOne(
    { _id: new Types.ObjectId(auditRunId) },
    { $set: { status: 'running', startedAt: new Date(), agendaJobId: String(job.attrs._id) } },
  );
  try {
    await runAudit({ projectId, auditRunId, crawlRunId });
    await AuditRunModel.updateOne(
      { _id: new Types.ObjectId(auditRunId) },
      { $set: { status: 'completed', completedAt: new Date(), progressPercent: 100 } },
    );
    await ProjectModel.updateOne(
      { _id: new Types.ObjectId(projectId) },
      { $set: { lastAuditedAt: new Date() } },
    );
    await syncLifecycleState(projectId);
    // Regenerate recommendations from the fresh active issue set. Best-effort: a regen failure
    // shouldn't bubble up and mark the audit run failed. Doc continuation §"Phase 2".
    // Keyword-fit first so recommendation generator can see fresh verdicts when it ingests them.
    try {
      const r = await analyzeKeywordFits({ projectId });
      log.info({ projectId, auditRunId, fits: r }, 'keyword fits analyzed post-audit');
    } catch (fitErr) {
      log.warn({ err: fitErr, projectId, auditRunId }, 'post-audit keyword-fit analyze failed');
    }
    try {
      const r = await generateRecommendations({ projectId });
      log.info({ projectId, auditRunId, recs: r }, 'recommendations regenerated post-audit');
    } catch (recErr) {
      log.warn({ err: recErr, projectId, auditRunId }, 'post-audit recommendation regen failed');
    }
    try {
      const r = await generateRecommendationsFromKeywordFit({ projectId });
      log.info({ projectId, auditRunId, kwRecs: r }, 'keyword-fit recommendations generated');
    } catch (recErr) {
      log.warn({ err: recErr, projectId, auditRunId }, 'post-audit keyword-fit rec generation failed');
    }
    log.info({ projectId, auditRunId }, 'audit completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, projectId, auditRunId }, 'audit failed');
    await AuditRunModel.updateOne(
      { _id: new Types.ObjectId(auditRunId) },
      { $set: { status: 'failed', completedAt: new Date(), error: msg } },
    );
    await syncLifecycleState(projectId);
    throw err;
  }
}
