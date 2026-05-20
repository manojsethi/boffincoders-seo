import { Router } from 'express';
import { Types } from 'mongoose';
import { CrawlRunModel, AuditRunModel, AIAnalysisModel } from '../../db';
import { StartCrawlInput } from '@boffin/schemas';
import { createCrawlRun, createAuditRun, createAIAnalysis } from '../../domain';
import { getAgenda, JOB_NAMES } from '../../jobs';

export const runsRouter = Router();

runsRouter.post('/projects/:id/crawl', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = StartCrawlInput.parse(req.body ?? {});
    const run = await createCrawlRun({
      projectId: id,
      mode: body.mode,
      seedUrl: body.seedUrl,
      maxPages: body.maxPages,
    });
    await getAgenda().now(body.mode === 'first' ? JOB_NAMES.runFirstCrawl : JOB_NAMES.runCrawl, {
      projectId: id,
      crawlRunId: run.id,
      triggeredBy: 'user',
    });
    res.status(202).json({ crawlRunId: run.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes('in progress')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

runsRouter.get('/projects/:id/crawl-runs', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const runs = await CrawlRunModel.find({ projectId: pid }).sort({ createdAt: -1 }).limit(20).lean();
    res.json(
      runs.map((r) => ({
        id: String(r._id),
        mode: r.mode,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        progressPercent: r.progressPercent,
        currentStep: r.currentStep,
        diagnostics: r.diagnostics,
        counts: r.counts,
        error: r.error,
      })),
    );
  } catch (err) {
    next(err);
  }
});

runsRouter.post('/projects/:id/audit', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const run = await createAuditRun({ projectId: id });
    await getAgenda().now(JOB_NAMES.runAudit, {
      projectId: id,
      auditRunId: run.id,
      crawlRunId: run.crawlRunId,
    });
    res.status(202).json({ auditRunId: run.id });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('in progress') || err.message.includes('No completed crawl'))) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

runsRouter.get('/projects/:id/audit-runs', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const runs = await AuditRunModel.find({ projectId: pid }).sort({ createdAt: -1 }).limit(20).lean();
    res.json(
      runs.map((r) => ({
        id: String(r._id),
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        progressPercent: r.progressPercent,
        currentStep: r.currentStep,
        pagesAudited: r.pagesAudited,
        rulesEvaluated: r.rulesEvaluated,
        findingsCreated: r.findingsCreated,
        issuesUpserted: r.issuesUpserted,
        dataGapCount: r.dataGapCount,
        statusCounts: r.statusCounts ?? {},
        severityCounts: r.severityCounts ?? {},
        layeredScores: r.layeredScores ?? {},
        dataGaps: r.dataGaps ?? [],
        error: r.error,
      })),
    );
  } catch (err) {
    next(err);
  }
});

runsRouter.post('/projects/:id/ai-analysis', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const run = await createAIAnalysis({ projectId: id });
    await getAgenda().now(JOB_NAMES.runAIAnalysis, {
      projectId: id,
      aiAnalysisId: run.id,
      sourceCrawlRunId: run.crawlRunId,
      sourceAuditRunId: run.auditRunId,
    });
    res.status(202).json({ aiAnalysisId: run.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes('No completed audit')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

runsRouter.get('/projects/:id/ai-analyses', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const list = await AIAnalysisModel.find({ projectId: pid }).sort({ createdAt: -1 }).limit(10).lean();
    res.json(
      list.map((a) => ({
        id: String(a._id),
        status: a.status,
        modelProvider: a.modelProvider,
        modelName: a.modelName,
        confidence: a.confidence,
        websiteProfileSuggestion: a.websiteProfileSuggestion,
        prioritySummary: a.prioritySummary,
        contentOpportunities: a.contentOpportunities,
        internalLinkingOpportunities: a.internalLinkingOpportunities,
        geoAeoObservations: a.geoAeoObservations,
        requiresAnalystReview: a.requiresAnalystReview,
        approvedAt: a.approvedAt,
        costEstimate: a.costEstimate,
        error: a.error,
        aiTaskRunId: (a as { aiTaskRunId?: unknown }).aiTaskRunId
          ? String((a as { aiTaskRunId: unknown }).aiTaskRunId)
          : null,
      })),
    );
  } catch (err) {
    next(err);
  }
});
