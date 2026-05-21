import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { IssueModel, FindingModel, PageModel, AuditRunModel, UrlGroupModel } from '../../db';
import { syncLifecycleState } from '../../domain';

/**
 * Phase 11 — Template-level context for issue drawer. If the issue is on a page that belongs
 * to a URL group (sampled or force-included), count how many sampled pages in the same group
 * carry an issue with the same ruleId. Used to render "5 of 5 sampled affected; likely
 * template-level" guidance without claiming all discovered pages are affected.
 */
async function buildTemplateContext(
  projectId: Types.ObjectId,
  issue: Record<string, unknown>,
): Promise<{
  inGroup: boolean;
  groupName: string | null;
  pattern: string | null;
  discoveredCount: number;
  sampledCount: number;
  sampledAffected: number;
  likelyTemplateLevel: boolean;
  recommendation: string;
} | null> {
  const pageId = issue.pageId as Types.ObjectId | undefined;
  if (!pageId) return null;
  const page = await PageModel.findOne({ _id: pageId, projectId })
    .select({ urlGroupName: 1, crawlScopeDecision: 1 })
    .lean();
  const groupName = (page as { urlGroupName?: string } | null)?.urlGroupName ?? null;
  if (!groupName) return null;
  const group = await UrlGroupModel.findOne({ projectId, name: groupName })
    .sort({ createdAt: -1 })
    .lean();
  // All sampled pages in the same group on this project.
  const sampledPages = await PageModel.find({
    projectId,
    urlGroupName: groupName,
    crawlScopeDecision: { $in: ['sampled', 'force_included'] },
  })
    .select({ _id: 1 })
    .lean();
  const sampledIds = sampledPages.map((p) => p._id);
  // How many of those pages have an issue with the same ruleId?
  let sampledAffected = 0;
  if (sampledIds.length > 0) {
    sampledAffected = await IssueModel.countDocuments({
      projectId,
      ruleId: issue.ruleId as string,
      pageId: { $in: sampledIds },
    });
  }
  const sampledCount = sampledIds.length;
  const likely =
    sampledCount >= 2 && sampledAffected >= Math.ceil(sampledCount * 0.6);
  const discovered = group?.discoveredCount ?? sampledCount;
  return {
    inGroup: true,
    groupName,
    pattern: group?.pattern ?? null,
    discoveredCount: discovered,
    sampledCount,
    sampledAffected,
    likelyTemplateLevel: likely,
    recommendation: likely
      ? `Detected in ${sampledAffected} of ${sampledCount} sampled pages. Likely a template-level issue — fix the ${groupName} template, then re-sample to validate.`
      : `Detected in ${sampledAffected} of ${sampledCount} sampled pages. Investigate as a per-page issue first; widen sample if more pages are affected.`,
  };
}

const PatchIssue = z.object({
  lifecycleStatus: z
    .enum([
      'open',
      'planned',
      'in-progress',
      'fixed-pending-verification',
      'verified',
      'ignored',
      'not-applicable',
      'blocked-by-data-gap',
    ])
    .optional(),
  ownerType: z.enum(['seo', 'content', 'developer', 'client', 'analyst']).optional(),
  priority: z.number().min(0).max(100).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const issuesRouter = Router();

/**
 * Issues list — doc 3 §"Issues Screen Requirements".
 * Joins minimal page info so the table can show "Affected URL" + "Page Role".
 */
issuesRouter.get('/projects/:id/issues', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const category = req.query.category as string | undefined;
    const layer = req.query.layer as string | undefined;
    const actionPriority = req.query.actionPriority as string | undefined;
    const groupKey = req.query.groupKey as string | undefined;
    const ruleId = req.query.ruleId as string | undefined;
    const pageIdFilter = req.query.pageId as string | undefined;
    if (status) q.lifecycleStatus = status;
    if (severity) q.severity = severity;
    if (category) q.category = category;
    if (layer) q.layer = layer;
    if (actionPriority) q.actionPriority = actionPriority;
    if (groupKey) q.groupKey = groupKey;
    if (ruleId) q.ruleId = ruleId;
    if (pageIdFilter && Types.ObjectId.isValid(pageIdFilter)) q.pageId = new Types.ObjectId(pageIdFilter);

    const limit = Math.min(1000, Number(req.query.limit ?? 200));
    const issues = await IssueModel.find(q).sort({ priority: -1, createdAt: -1 }).limit(limit).lean();

    const pageIds = [
      ...new Set(issues.map((i) => (i.pageId ? String(i.pageId) : '')).filter(Boolean)),
    ].map((id) => new Types.ObjectId(id));
    const pages = pageIds.length
      ? await PageModel.find({ _id: { $in: pageIds } })
          .select({ url: 1, normalizedUrl: 1, title: 1, pageRole: 1 })
          .lean()
      : [];
    const pageById = new Map(pages.map((p) => [String(p._id), p]));

    // Resolve first/last audit-run timestamps for triage context (Doc 3 §"Issues Screen Requirements")
    const auditIds = [
      ...new Set(
        issues
          .flatMap((i) => [String(i.firstSeenAuditRunId ?? ''), String(i.lastSeenAuditRunId ?? '')])
          .filter(Boolean),
      ),
    ].map((id) => new Types.ObjectId(id));
    const auditRuns = auditIds.length
      ? await AuditRunModel.find({ _id: { $in: auditIds } })
          .select({ startedAt: 1, completedAt: 1, createdAt: 1 })
          .lean()
      : [];
    const auditTsById = new Map(
      auditRuns.map((a) => [
        String(a._id),
        (a.startedAt ?? a.completedAt ?? (a as unknown as { createdAt?: Date }).createdAt) ?? null,
      ]),
    );

    res.json(
      issues.map((i) => {
        const page = i.pageId ? pageById.get(String(i.pageId)) : undefined;
        const affectedUrl =
          page?.url ??
          (i.affectedUrls && i.affectedUrls.length > 0 ? i.affectedUrls[0] : null);
        const scope: 'page' | 'site' = i.groupKey && (!page || (i.affectedUrls && i.affectedUrls.length > 1))
          ? 'site'
          : 'page';
        return {
          id: String(i._id),
          canonicalKey: i.canonicalKey,
          ruleId: i.ruleId,
          ruleVersion: i.ruleVersion,
          title: i.title,
          category: i.category,
          layer: i.layer,
          severity: i.severity,
          lifecycleStatus: i.lifecycleStatus,
          latestStatus: i.latestStatus,
          priority: i.priority,
          actionPriority: i.actionPriority,
          impact: i.impact,
          effort: i.effort,
          confidence: i.confidence,
          confidenceLevel: i.confidenceLevel,
          pageId: i.pageId ? String(i.pageId) : null,
          affectedUrl,
          affectedUrls: i.affectedUrls ?? [],
          affectedPageCount: i.affectedPageCount ?? 0,
          pageRole: page?.pageRole ?? null,
          pageTitle: page?.title ?? null,
          scope,
          groupKey: i.groupKey ?? null,
          ownerType: i.ownerType,
          verifiedAt: i.verifiedAt ?? null,
          firstSeenAuditRunId: i.firstSeenAuditRunId ? String(i.firstSeenAuditRunId) : null,
          lastSeenAuditRunId: i.lastSeenAuditRunId ? String(i.lastSeenAuditRunId) : null,
          firstSeenAt:
            (i.firstSeenAuditRunId ? auditTsById.get(String(i.firstSeenAuditRunId)) : null) ??
            (i as unknown as { createdAt?: Date }).createdAt ??
            null,
          lastSeenAt:
            (i.lastSeenAuditRunId ? auditTsById.get(String(i.lastSeenAuditRunId)) : null) ??
            (i as unknown as { updatedAt?: Date }).updatedAt ??
            null,
          notes: i.notes ?? '',
          createdAt: (i as unknown as { createdAt?: Date }).createdAt ?? null,
          updatedAt: (i as unknown as { updatedAt?: Date }).updatedAt ?? null,
        };
      }),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Issue detail — drives the drawer. Doc 3 §"Issue Detail Drawer".
 */
issuesRouter.get('/projects/:id/issues/:issueId', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.issueId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const issue = await IssueModel.findOne({ _id: req.params.issueId, projectId: pid }).lean();
    if (!issue) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const [currentFinding, history, page, related] = await Promise.all([
      issue.currentFindingId ? FindingModel.findById(issue.currentFindingId).lean() : null,
      FindingModel.find({
        projectId: pid,
        ruleId: issue.ruleId,
        ...(issue.pageId ? { pageId: issue.pageId } : {}),
        ...(issue.groupKey ? { groupKey: issue.groupKey } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      issue.pageId
        ? PageModel.findById(issue.pageId)
            .select({
              url: 1,
              title: 1,
              pageRole: 1,
              statusCode: 1,
              indexability: 1,
              canonicalUrl: 1,
              urlGroupName: 1,
              crawlScopeDecision: 1,
              sampleReason: 1,
            })
            .lean()
        : null,
      issue.groupKey
        ? IssueModel.find({
            projectId: pid,
            groupKey: issue.groupKey,
            _id: { $ne: issue._id },
          })
            .limit(30)
            .lean()
        : [],
    ]);

    res.json({
      issue: {
        id: String(issue._id),
        ruleId: issue.ruleId,
        ruleVersion: issue.ruleVersion,
        title: issue.title,
        severity: issue.severity,
        category: issue.category,
        layer: issue.layer,
        lifecycleStatus: issue.lifecycleStatus,
        latestStatus: issue.latestStatus,
        priority: issue.priority,
        actionPriority: issue.actionPriority,
        impact: issue.impact,
        effort: issue.effort,
        confidence: issue.confidence,
        confidenceLevel: issue.confidenceLevel,
        ownerType: issue.ownerType,
        pageId: issue.pageId ? String(issue.pageId) : null,
        groupKey: issue.groupKey ?? null,
        affectedUrls: issue.affectedUrls ?? [],
        affectedPageCount: issue.affectedPageCount ?? 0,
        firstSeenAuditRunId: issue.firstSeenAuditRunId ? String(issue.firstSeenAuditRunId) : null,
        lastSeenAuditRunId: issue.lastSeenAuditRunId ? String(issue.lastSeenAuditRunId) : null,
        verifiedAt: issue.verifiedAt ?? null,
        dueDate: issue.dueDate ?? null,
        notes: issue.notes ?? '',
        createdAt: (issue as unknown as { createdAt?: Date }).createdAt ?? null,
        updatedAt: (issue as unknown as { updatedAt?: Date }).updatedAt ?? null,
      },
      page: page
        ? {
            id: String(page._id),
            url: page.url,
            title: page.title ?? null,
            pageRole: page.pageRole ?? null,
            statusCode: page.statusCode ?? null,
            indexability: page.indexability ?? null,
            canonicalUrl: page.canonicalUrl ?? null,
            urlGroupName: (page as { urlGroupName?: string }).urlGroupName ?? null,
            crawlScopeDecision:
              (page as { crawlScopeDecision?: string }).crawlScopeDecision ?? 'crawl',
            sampleReason: (page as { sampleReason?: string }).sampleReason ?? '',
          }
        : null,
      templateContext: await buildTemplateContext(pid, issue),
      currentFinding: currentFinding
        ? {
            id: String(currentFinding._id),
            status: currentFinding.status,
            severity: currentFinding.severity,
            title: currentFinding.title,
            observed: currentFinding.observed,
            whyItMatters: currentFinding.whyItMatters,
            recommendation: currentFinding.recommendation,
            howToFix: currentFinding.howToFix,
            evidence: currentFinding.evidence,
            evidenceSources: currentFinding.evidenceSources,
            confidence: currentFinding.confidence,
            confidenceLevel: currentFinding.confidenceLevel,
            impactScore: currentFinding.impactScore,
            effortEstimate: currentFinding.effortEstimate,
            validationMethod: (currentFinding as { validationMethod?: string }).validationMethod ?? '',
            createdAt: (currentFinding as unknown as { createdAt?: Date }).createdAt ?? null,
            ruleVersion: currentFinding.ruleVersion,
          }
        : null,
      history: history.map((f) => ({
        id: String(f._id),
        auditRunId: String(f.auditRunId),
        status: f.status,
        severity: f.severity,
        observed: f.observed,
        createdAt: (f as unknown as { createdAt?: Date }).createdAt ?? null,
        ruleVersion: f.ruleVersion,
      })),
      relatedIssues: related.map((r) => ({
        id: String(r._id),
        title: r.title,
        severity: r.severity,
        lifecycleStatus: r.lifecycleStatus,
        affectedUrl: r.affectedUrls?.[0] ?? null,
        pageId: r.pageId ? String(r.pageId) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

issuesRouter.patch('/projects/:id/issues/:issueId', async (req, res, next) => {
  try {
    const patch = PatchIssue.parse(req.body);
    const update: Record<string, unknown> = { ...patch };
    if (patch.dueDate === null) update.dueDate = null;
    else if (patch.dueDate) update.dueDate = new Date(patch.dueDate);
    if (patch.lifecycleStatus === 'verified') update.verifiedAt = new Date();
    await IssueModel.updateOne(
      { _id: req.params.issueId, projectId: req.params.id },
      { $set: update },
    );
    await syncLifecycleState(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
