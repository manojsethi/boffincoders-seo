import { Types } from 'mongoose';
import type { Job } from 'agenda';
import { AuditRunModel, ProjectModel } from '../../db';
import { getLogger } from '../../config/logger';
import { runAudit } from '../../audit';
import { syncLifecycleState } from '../../domain';

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
