import { Router } from 'express';
import { ProjectModel, IssueModel, ReportModel, CrawlRunModel, AuditRunModel } from '../../db';
import { ACTIVE_LIFECYCLE_STATUSES } from '../../audit/lifecycle';

export const workspaceRouter = Router();

workspaceRouter.get('/workspace/overview', async (_req, res, next) => {
  try {
    const [projects, failedCrawls, failedAudits, criticalIssues, reportsByStatus] = await Promise.all([
      ProjectModel.find({ status: { $ne: 'archived' } }).lean(),
      CrawlRunModel.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(20).lean(),
      AuditRunModel.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(20).lean(),
      IssueModel.aggregate([
        {
          $match: {
            severity: { $in: ['critical', 'high'] },
            lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES },
          },
        },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
      ]),
      ReportModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const byState: Record<string, number> = {};
    for (const p of projects) byState[p.lifecycleState] = (byState[p.lifecycleState] ?? 0) + 1;

    const criticalByProject = new Map(
      (criticalIssues as Array<{ _id: unknown; count: number }>).map((c) => [String(c._id), c.count]),
    );

    res.json({
      activeProjectCount: projects.length,
      projectsByState: byState,
      failedCrawls: failedCrawls.map((c) => ({
        id: String(c._id),
        projectId: String(c.projectId),
        error: c.error,
        completedAt: c.completedAt,
      })),
      failedAudits: failedAudits.map((a) => ({
        id: String(a._id),
        projectId: String(a.projectId),
        error: a.error,
        completedAt: a.completedAt,
      })),
      criticalIssuesByProject: Object.fromEntries(criticalByProject),
      reportsByStatus: Object.fromEntries(
        (reportsByStatus as Array<{ _id: string; count: number }>).map((r) => [r._id, r.count]),
      ),
    });
  } catch (err) {
    next(err);
  }
});
