import { Router } from 'express';
import { Types } from 'mongoose';
import {
  ProjectModel,
  CrawlRunModel,
  AuditRunModel,
  AIAnalysisModel,
  IssueModel,
  PageModel,
  ReportModel,
} from '../../db';
import { ProjectCreateInput, ProjectUpdateInput } from '@boffin/schemas';
import { createProject, syncLifecycleState, nextActionFor } from '../../domain';
import { ACTIVE_LIFECYCLE_STATUSES } from '../../audit/lifecycle';

export const projectsRouter = Router();

projectsRouter.post('/projects', async (req, res, next) => {
  try {
    const body = ProjectCreateInput.parse(req.body);
    const result = await createProject(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/projects', async (_req, res, next) => {
  try {
    const projects = await ProjectModel.find({ status: { $ne: 'archived' } })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    res.json(projects.map(toDTO));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/projects/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const project = await ProjectModel.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const state = await syncLifecycleState(project._id);
    res.json({ ...toDTO(project), lifecycleState: state, nextAction: nextActionFor(state) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/projects/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = ProjectUpdateInput.parse(req.body);
    await ProjectModel.updateOne({ _id: req.params.id }, { $set: body });
    await syncLifecycleState(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Project crawl/render settings — doc 04 §"Project-level crawl/render policy".
 */
projectsRouter.patch('/projects/:id/crawl-settings', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = req.body as {
      renderMode?: 'cheerio-only' | 'cheerio-with-playwright-fallback' | 'playwright-only';
      maxRenderedPages?: number;
      renderTimeoutMs?: number;
      renderConcurrency?: number;
      autoRenderImportantPages?: boolean;
      autoRenderSchemaNotVerified?: boolean;
      autoRenderJsSuspected?: boolean;
    };
    const validModes = ['cheerio-only', 'cheerio-with-playwright-fallback', 'playwright-only'];
    if (body.renderMode && !validModes.includes(body.renderMode)) {
      res.status(400).json({ error: 'invalid renderMode' });
      return;
    }
    const set: Record<string, unknown> = {};
    if (body.renderMode) set['crawlSettings.renderMode'] = body.renderMode;
    if (typeof body.maxRenderedPages === 'number')
      set['crawlSettings.maxRenderedPages'] = Math.min(500, Math.max(0, body.maxRenderedPages));
    if (typeof body.renderTimeoutMs === 'number')
      set['crawlSettings.renderTimeoutMs'] = Math.min(120_000, Math.max(5000, body.renderTimeoutMs));
    if (typeof body.renderConcurrency === 'number')
      set['crawlSettings.renderConcurrency'] = Math.min(8, Math.max(1, body.renderConcurrency));
    if (typeof body.autoRenderImportantPages === 'boolean')
      set['crawlSettings.autoRenderImportantPages'] = body.autoRenderImportantPages;
    if (typeof body.autoRenderSchemaNotVerified === 'boolean')
      set['crawlSettings.autoRenderSchemaNotVerified'] = body.autoRenderSchemaNotVerified;
    if (typeof body.autoRenderJsSuspected === 'boolean')
      set['crawlSettings.autoRenderJsSuspected'] = body.autoRenderJsSuspected;
    await ProjectModel.updateOne({ _id: req.params.id }, { $set: set });
    const fresh = await ProjectModel.findById(req.params.id).lean();
    res.json({ ok: true, crawlSettings: (fresh?.crawlSettings ?? null) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/projects/:id/overview', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const OPEN_LIFECYCLE = ACTIVE_LIFECYCLE_STATUSES;
    const [project, latestCrawl, latestAudit, latestAI, openIssues, latestReport, criticalCount, topIssues] =
      await Promise.all([
        ProjectModel.findById(pid).lean(),
        CrawlRunModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
        AuditRunModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
        AIAnalysisModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
        IssueModel.countDocuments({
          projectId: pid,
          lifecycleStatus: { $in: OPEN_LIFECYCLE },
        }),
        ReportModel.findOne({ projectId: pid }).sort({ createdAt: -1 }).lean(),
        IssueModel.countDocuments({
          projectId: pid,
          severity: { $in: ['critical', 'high'] },
          lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES },
        }),
        IssueModel.find({
          projectId: pid,
          lifecycleStatus: { $in: OPEN_LIFECYCLE },
        })
          .sort({ priority: -1, severity: 1 })
          .limit(5)
          .lean(),
      ]);
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const state = await syncLifecycleState(pid);
    res.json({
      project: toDTO(project),
      lifecycleState: state,
      nextAction: nextActionFor(state),
      latestCrawl: latestCrawl
        ? {
            id: String(latestCrawl._id),
            status: latestCrawl.status,
            progressPercent: latestCrawl.progressPercent,
            currentStep: latestCrawl.currentStep,
            startedAt: latestCrawl.startedAt,
            completedAt: latestCrawl.completedAt,
            diagnostics: latestCrawl.diagnostics,
            counts: latestCrawl.counts,
          }
        : null,
      latestAudit: latestAudit
        ? {
            id: String(latestAudit._id),
            status: latestAudit.status,
            progressPercent: latestAudit.progressPercent,
            currentStep: latestAudit.currentStep,
            pagesAudited: latestAudit.pagesAudited,
            layeredScores: latestAudit.layeredScores ?? {},
            statusCounts: latestAudit.statusCounts ?? {},
            severityCounts: latestAudit.severityCounts ?? {},
            dataGapCount: latestAudit.dataGapCount ?? 0,
            dataGaps: (latestAudit.dataGaps ?? []) as Array<Record<string, unknown>>,
          }
        : null,
      latestAI: latestAI
        ? {
            id: String(latestAI._id),
            status: latestAI.status,
            modelProvider: latestAI.modelProvider,
            confidence: latestAI.confidence,
            requiresAnalystReview: latestAI.requiresAnalystReview,
          }
        : null,
      issueCounts: { open: openIssues, criticalOrHigh: criticalCount },
      topIssues: await enrichTopIssues(pid, topIssues),
      latestReport: latestReport
        ? { id: String(latestReport._id), type: latestReport.type, status: latestReport.status }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

async function enrichTopIssues(
  projectId: Types.ObjectId,
  issues: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const pageIds = [
    ...new Set(issues.map((i) => (i.pageId ? String(i.pageId) : '')).filter(Boolean)),
  ].map((id) => new Types.ObjectId(id));
  const pages = pageIds.length
    ? await PageModel.find({ projectId, _id: { $in: pageIds } })
        .select({ url: 1, normalizedUrl: 1 })
        .lean()
    : [];
  const urlByPageId = new Map(pages.map((p) => [String(p._id), p.url ?? p.normalizedUrl ?? null]));
  return issues.map((i) => ({
    id: String((i as { _id: unknown })._id),
    title: i.title,
    severity: i.severity,
    category: i.category,
    layer: i.layer,
    priority: i.priority,
    actionPriority: i.actionPriority,
    pageId: i.pageId ? String(i.pageId) : null,
    affectedUrl:
      (i.pageId ? urlByPageId.get(String(i.pageId)) : null) ??
      (Array.isArray(i.affectedUrls) && i.affectedUrls.length > 0
        ? (i.affectedUrls as string[])[0]
        : null),
    affectedPageCount:
      (i.affectedPageCount as number | undefined) ??
      (Array.isArray(i.affectedUrls) ? (i.affectedUrls as unknown[]).length : 0),
    groupKey: i.groupKey ?? null,
  }));
}

function toDTO(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String((p as { _id: unknown })._id),
    slug: p.slug,
    clientName: p.clientName,
    siteName: p.siteName,
    primaryDomain: p.primaryDomain,
    allowedDomains: p.allowedDomains,
    includeSubdomains: p.includeSubdomains,
    status: p.status,
    lifecycleState: p.lifecycleState,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    lastCrawledAt: p.lastCrawledAt ?? null,
    lastAuditedAt: p.lastAuditedAt ?? null,
    lastReportedAt: p.lastReportedAt ?? null,
    nextScheduledRunAt: p.nextScheduledRunAt ?? null,
    crawlSettings: (p.crawlSettings as Record<string, unknown> | undefined) ?? {
      renderMode: 'cheerio-with-playwright-fallback',
      maxRenderedPages: 25,
      renderTimeoutMs: 30000,
      renderConcurrency: 2,
      autoRenderImportantPages: true,
      autoRenderSchemaNotVerified: false,
      autoRenderJsSuspected: false,
    },
  };
}
