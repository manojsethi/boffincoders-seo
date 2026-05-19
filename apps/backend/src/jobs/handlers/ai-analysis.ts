import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { AIAnalysisModel } from '../../db';
import { getLogger } from '../../config/logger';
import { analyzeEvidence } from '../../ai';
import { syncLifecycleState, applySuggestedProfile } from '../../domain';

const log = getLogger('jobs:ai');

export type AIAnalysisJobData = {
  projectId: string;
  aiAnalysisId: string;
  sourceCrawlRunId: string;
  sourceAuditRunId: string;
};

export async function runAIAnalysisHandler(job: Job<AIAnalysisJobData>): Promise<void> {
  const { projectId, aiAnalysisId, sourceCrawlRunId, sourceAuditRunId } = job.attrs.data;
  await AIAnalysisModel.updateOne(
    { _id: new Types.ObjectId(aiAnalysisId) },
    { $set: { status: 'running' } },
  );
  try {
    await analyzeEvidence({ projectId, aiAnalysisId, sourceCrawlRunId, sourceAuditRunId });
    const ai = await AIAnalysisModel.findById(aiAnalysisId).lean();
    if (ai?.websiteProfileSuggestion) {
      await applySuggestedProfile({
        projectId,
        suggestion: ai.websiteProfileSuggestion as Record<string, unknown>,
        sourceRunId: aiAnalysisId,
      });
    }
    await syncLifecycleState(projectId);
    log.info({ projectId, aiAnalysisId }, 'ai analysis completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, projectId, aiAnalysisId }, 'ai analysis failed');
    await AIAnalysisModel.updateOne(
      { _id: new Types.ObjectId(aiAnalysisId) },
      { $set: { status: 'failed', error: msg } },
    );
    await syncLifecycleState(projectId);
    throw err;
  }
}
