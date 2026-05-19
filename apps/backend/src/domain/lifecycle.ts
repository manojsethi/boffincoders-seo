import { Types } from 'mongoose';
import {
  ProjectModel,
  CrawlRunModel,
  AuditRunModel,
  AIAnalysisModel,
  WebsiteProfileModel,
  IssueModel,
  ReportModel,
} from '../db';
import type { LifecycleState } from '@boffin/schemas';

export async function deriveLifecycleState(projectId: string | Types.ObjectId): Promise<LifecycleState> {
  const pid = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
  const project = await ProjectModel.findById(pid).lean();
  if (!project) throw new Error('Project not found');
  if (!project.primaryDomain) return 'needs-setup';

  const [latestCrawl, latestAudit, ai, profile, hasOpenIssues, latestReport, fixedPending] =
    await Promise.all([
      CrawlRunModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
      AuditRunModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
      AIAnalysisModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
      WebsiteProfileModel.findOne({ projectId: pid }).lean(),
      IssueModel.exists({
        projectId: pid,
        lifecycleStatus: { $in: ['open', 'planned', 'in-progress'] },
      }),
      ReportModel.findOne({ projectId: pid, status: { $in: ['ready', 'exported', 'sent'] } })
        .sort({ createdAt: -1 })
        .lean(),
      IssueModel.exists({ projectId: pid, lifecycleStatus: 'fixed-pending-verification' }),
    ]);

  if (!latestCrawl) return 'ready-for-first-crawl';
  if (latestCrawl.status === 'running' || latestCrawl.status === 'queued') return 'crawling';
  if (latestCrawl.status === 'failed') return 'ready-for-first-crawl';

  const diag = (latestCrawl.diagnostics ?? {}) as Record<string, unknown>;
  if (diag.healthStatus === 'unreliable' || diag.healthStatus === 'needs-review') return 'crawl-needs-review';

  if (!latestAudit) return 'ready-for-initial-audit';
  if (latestAudit.status === 'running' || latestAudit.status === 'queued') return 'auditing';
  if (latestAudit.status === 'failed') return 'ready-for-initial-audit';

  if (!ai || ai.status !== 'completed') return 'ready-for-ai-analysis';
  if (!profile?.approvedAt) return 'profile-needs-review';

  if (fixedPending) return 'verification-needed';
  if (latestReport && hasOpenIssues) return 'monitoring';
  if (hasOpenIssues && !latestReport) return 'ready-to-report';
  if (latestReport) return 'monitoring';
  return 'active-issues';
}

export async function syncLifecycleState(projectId: string | Types.ObjectId): Promise<LifecycleState> {
  const state = await deriveLifecycleState(projectId);
  await ProjectModel.updateOne({ _id: projectId }, { $set: { lifecycleState: state } });
  return state;
}

export type NextAction = { label: string; command: string; description: string };

export function nextActionFor(state: LifecycleState): NextAction {
  switch (state) {
    case 'needs-setup':
      return {
        label: 'Complete setup',
        command: 'project.update',
        description: 'Add primary domain and basic site info.',
      };
    case 'ready-for-first-crawl':
      return {
        label: 'Run first crawl',
        command: 'crawl.start',
        description: 'Crawl the site to gather evidence.',
      };
    case 'crawling':
      return {
        label: 'View crawl progress',
        command: 'crawl.status',
        description: 'Crawl is currently running.',
      };
    case 'crawl-needs-review':
      return {
        label: 'Review crawl diagnostics',
        command: 'crawl.diagnostics',
        description: 'Crawl completed with warnings.',
      };
    case 'ready-for-initial-audit':
      return {
        label: 'Run initial audit',
        command: 'audit.start',
        description: 'Audit the latest crawl with deterministic rules.',
      };
    case 'auditing':
      return {
        label: 'View audit progress',
        command: 'audit.status',
        description: 'Audit is currently running.',
      };
    case 'ready-for-ai-analysis':
      return {
        label: 'Analyze website with AI',
        command: 'ai.start',
        description: 'Use AI to suggest website profile and priorities from evidence.',
      };
    case 'profile-needs-review':
      return {
        label: 'Review website profile',
        command: 'profile.review',
        description: 'Approve or edit the AI-suggested profile.',
      };
    case 'active-issues':
      return {
        label: 'Prioritize issues',
        command: 'issues.list',
        description: 'Work through prioritized issues.',
      };
    case 'ready-to-report':
      return {
        label: 'Generate initial report',
        command: 'report.generate',
        description: 'Build an initial audit report from evidence.',
      };
    case 'monitoring':
      return {
        label: 'View monitoring',
        command: 'monitoring.view',
        description: 'Active monitoring with periodic re-crawl.',
      };
    case 'verification-needed':
      return {
        label: 'Verify fixes',
        command: 'verify.start',
        description: 'Re-crawl/re-audit to verify fixed issues.',
      };
  }
}
