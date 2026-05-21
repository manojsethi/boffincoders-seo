import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ReportModel } from '../../db';
import { createReportDraft } from '../../domain';
import { getAgenda, JOB_NAMES } from '../../jobs';
import { requireActiveProject } from '../middleware/active-project';

const GenerateReport = z.object({
  type: z.enum(['initial-audit', 'weekly-progress', 'monthly-progress', 'verification', 'internal']),
  view: z.enum(['client', 'internal']).default('client'),
  crawlRunId: z.string().optional(),
  auditRunId: z.string().optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

export const reportsRouter = Router();

reportsRouter.post('/projects/:id/reports', requireActiveProject, async (req, res, next) => {
  try {
    const pid = String(req.params.id ?? '');
    const body = GenerateReport.parse(req.body);
    const draft = await createReportDraft({
      projectId: pid,
      type: body.type,
      view: body.view,
      crawlRunId: body.crawlRunId,
      auditRunId: body.auditRunId,
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
    });
    await getAgenda().now(JOB_NAMES.generateReport, {
      projectId: pid,
      reportId: draft.id,
      type: body.type,
      view: body.view,
      crawlRunId: body.crawlRunId ?? draft.crawlRunId,
      auditRunId: body.auditRunId ?? draft.auditRunId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });
    res.status(202).json({ reportId: draft.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes('No completed audit')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

reportsRouter.get('/projects/:id/reports', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const list = await ReportModel.find({ projectId: pid }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(
      list.map((r) => ({
        id: String(r._id),
        type: r.type,
        status: r.status,
        view: r.view,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        executiveSummary: r.executiveSummary,
        createdAt: (r as unknown as { createdAt?: Date }).createdAt,
        approvedAt: r.approvedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/projects/:id/reports/:reportId', async (req, res, next) => {
  try {
    const r = await ReportModel.findById(req.params.reportId).lean();
    if (!r) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(r);
  } catch (err) {
    next(err);
  }
});
