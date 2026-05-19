import { Router } from 'express';
import { Types } from 'mongoose';
import {
  PageModel,
  PageContentModel,
  FindingModel,
  IssueModel,
  ProjectModel,
  SiteConnectionModel,
} from '../../db';
import { guessPageRole } from '../../crawler/page-role';
import { ACTIVE_LIFECYCLE_STATUSES } from '../../audit/lifecycle';
import { gscPageTotals } from '../../integrations/google/gsc';
import { ga4PageTotals } from '../../integrations/google/ga4';
import { cwvLatestByPage } from '../../integrations/google/cwv';

export const pagesRouter = Router();

type IssueCounts = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

const ZERO_COUNTS: IssueCounts = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
type TopIssue = { id: string; title: string; severity: string; priority: number };

const OPEN_LIFECYCLE = ACTIVE_LIFECYCLE_STATUSES;

function severitiesToCounts(list: string[]): IssueCounts {
  const c: IssueCounts = { ...ZERO_COUNTS };
  for (const s of list) {
    c.total += 1;
    if (s === 'critical') c.critical += 1;
    else if (s === 'high') c.high += 1;
    else if (s === 'medium') c.medium += 1;
    else if (s === 'low') c.low += 1;
    else c.info += 1;
  }
  return c;
}

/**
 * Pages list — doc 3 §"Pages Screen Requirements".
 * Joins issue counts per page + severity breakdown + top issue per page.
 * GSC/GA4/CWV columns are null until Phase D ships integrations.
 */
pagesRouter.get('/projects/:id/pages', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.role) q.pageRole = req.query.role;
    if (req.query.indexability) q.indexability = req.query.indexability;
    if (req.query.status) q.statusCode = Number(req.query.status);
    if (req.query.schemaSource) q.schemaSource = req.query.schemaSource;
    if (req.query.noRawJsonLd === '1' || req.query.noRawJsonLd === 'true') {
      q.$or = [{ rawSchema: { $size: 0 } }, { rawSchema: { $exists: false } }];
    }
    const limit = Math.min(2000, Number(req.query.limit ?? 500));

    const pages = await PageModel.find(q).limit(limit).lean();
    const pageIds = pages.map((p) => p._id);

    // Load integration metrics + connection state.
    const [project, conns] = await Promise.all([
      ProjectModel.findById(pid).select({ primaryDomain: 1 }).lean(),
      SiteConnectionModel.find({ projectId: pid, status: 'connected' }).select({ provider: 1 }).lean(),
    ]);
    const connected = new Set(conns.map((c) => c.provider));
    const [gscMap, ga4Map, cwvMap] = await Promise.all([
      connected.has('gsc') ? gscPageTotals(pid) : Promise.resolve(new Map()),
      connected.has('ga4') && project
        ? ga4PageTotals(pid, project.primaryDomain)
        : Promise.resolve(new Map()),
      cwvLatestByPage(pid),
    ]);

    const issueAgg = await IssueModel.aggregate<{
      _id: Types.ObjectId | null;
      counts: string[];
      topIssues: Array<{ id: Types.ObjectId; title: string; severity: string; priority: number }>;
    }>([
      {
        $match: {
          projectId: pid,
          pageId: { $in: pageIds },
          lifecycleStatus: { $in: OPEN_LIFECYCLE },
        },
      },
      { $sort: { priority: -1, severity: 1 } },
      {
        $group: {
          _id: '$pageId',
          counts: { $push: '$severity' },
          topIssues: {
            $push: { id: '$_id', title: '$title', severity: '$severity', priority: '$priority' },
          },
        },
      },
    ]);

    const issueByPage = new Map<
      string,
      { counts: IssueCounts; topIssue: TopIssue | null; topIssues: TopIssue[] }
    >();
    for (const row of issueAgg) {
      const id = String(row._id ?? '');
      const counts = severitiesToCounts(row.counts);
      const topIssues: TopIssue[] = (row.topIssues ?? []).slice(0, 3).map((t) => ({
        id: String(t.id),
        title: t.title ?? '',
        severity: t.severity ?? 'info',
        priority: t.priority ?? 0,
      }));
      const topIssue = topIssues[0] ?? null;
      issueByPage.set(id, { counts, topIssue, topIssues });
    }

    res.json(
      pages.map((p) => {
        const enriched = issueByPage.get(String(p._id));
        return {
          id: String(p._id),
          url: p.url,
          normalizedUrl: p.normalizedUrl,
          statusCode: p.statusCode,
          indexability: p.indexability,
          canonicalUrl: p.canonicalUrl ?? null,
          title: p.title ?? null,
          h1: p.h1 ?? null,
          pageRole: p.pageRole,
          roleConfidence: p.roleConfidence,
          roleConfidenceLevel: p.roleConfidenceLevel ?? null,
          roleSource: p.roleSource,
          isImportant: p.isImportant ?? false,
          isIntentionallyNonIndexable: p.isIntentionallyNonIndexable ?? false,
          internalLinksIn: p.internalLinksIn ?? 0,
          internalLinksOut: Array.isArray(p.internalLinksOut) ? p.internalLinksOut.length : 0,
          hasSchema:
            (Array.isArray(p.rawSchema) && p.rawSchema.length > 0) ||
            (Array.isArray(p.renderedSchema) && p.renderedSchema.length > 0),
          schemaTypeCount: Array.isArray(p.schemaTypes)
            ? p.schemaTypes.length
            : Array.isArray(p.schema)
              ? p.schema.length
              : 0,
          schemaSource: (p.schemaSource as string | undefined) ?? 'not-verified',
          schemaTypes: (p.schemaTypes as string[] | undefined) ?? [],
          rawSchemaCount: Array.isArray(p.rawSchema) ? p.rawSchema.length : 0,
          renderedSchemaCount: Array.isArray(p.renderedSchema) ? p.renderedSchema.length : 0,
          schemaParseErrorCount: Array.isArray(p.schemaParseErrors) ? p.schemaParseErrors.length : 0,
          renderedExtractedAt: p.renderedExtractedAt ?? null,
          lastCrawledAt: p.lastCrawledAt ?? null,
          issueCounts: enriched?.counts ?? ZERO_COUNTS,
          topIssue: enriched?.topIssue ?? null,
          topIssues: enriched?.topIssues ?? [],
          // Phase D integration columns — null until GSC/GA4/CWV land
          clicks: gscMap.get(p.url)?.clicks ?? gscMap.get(p.normalizedUrl)?.clicks ?? null,
          impressions: gscMap.get(p.url)?.impressions ?? gscMap.get(p.normalizedUrl)?.impressions ?? null,
          ctr: gscMap.get(p.url)?.ctr ?? gscMap.get(p.normalizedUrl)?.ctr ?? null,
          position: gscMap.get(p.url)?.position ?? gscMap.get(p.normalizedUrl)?.position ?? null,
          sessions: ga4Map.get(p.url)?.sessions ?? ga4Map.get(p.normalizedUrl)?.sessions ?? null,
          conversions:
            ga4Map.get(p.url)?.conversions ?? ga4Map.get(p.normalizedUrl)?.conversions ?? null,
          cwv: cwvMap.get(p.url) ?? cwvMap.get(p.normalizedUrl) ?? null,
        };
      }),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Page workspace — doc 3 §"Page Workspace Requirements".
 */
pagesRouter.get('/projects/:id/pages/:pageId', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.pageId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const page = await PageModel.findOne({ _id: req.params.pageId, projectId: pid }).lean();
    if (!page) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const [content, findings, issues] = await Promise.all([
      PageContentModel.findOne({ pageId: page._id }).sort({ createdAt: -1 }).lean(),
      FindingModel.find({ pageId: page._id }).sort({ createdAt: -1 }).limit(100).lean(),
      IssueModel.find({ projectId: pid, pageId: page._id })
        .sort({ priority: -1, createdAt: -1 })
        .lean(),
    ]);

    const counts = severitiesToCounts(
      issues
        .filter((i) => OPEN_LIFECYCLE.includes(i.lifecycleStatus))
        .map((i) => i.severity),
    );

    res.json({
      page: {
        ...page,
        id: String(page._id),
        issueCounts: counts,
      },
      content,
      findings: findings.map((f) => ({
        id: String(f._id),
        ruleId: f.ruleId,
        ruleName: f.ruleName,
        ruleVersion: f.ruleVersion,
        status: f.status,
        severity: f.severity,
        category: f.category,
        layer: f.layer,
        title: f.title,
        observed: f.observed,
        whyItMatters: f.whyItMatters,
        recommendation: f.recommendation,
        howToFix: f.howToFix,
        evidence: f.evidence,
        evidenceSources: f.evidenceSources,
        confidence: f.confidence,
        confidenceLevel: f.confidenceLevel,
        impactScore: f.impactScore,
        effortEstimate: f.effortEstimate,
        priority: f.priority,
        groupKey: f.groupKey,
        notApplicableReason: f.notApplicableReason,
        notVerifiedReason: f.notVerifiedReason,
        createdAt: (f as unknown as { createdAt?: Date }).createdAt ?? null,
      })),
      issues: issues.map((i) => ({
        id: String(i._id),
        ruleId: i.ruleId,
        title: i.title,
        severity: i.severity,
        lifecycleStatus: i.lifecycleStatus,
        priority: i.priority,
        actionPriority: i.actionPriority,
        category: i.category,
        layer: i.layer,
        groupKey: i.groupKey ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Analyst-triggered role refresh. Heuristic only in Phase B; AI hook lands later.
 */
pagesRouter.post('/projects/:id/pages/:pageId/infer-role', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.pageId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const page = await PageModel.findOne({ _id: req.params.pageId, projectId: pid }).lean();
    if (!page) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const role = guessPageRole(page.url ?? page.normalizedUrl ?? '', page.title ?? undefined, {
      h1: page.h1 ?? undefined,
      headings: (page.headings ?? []) as Array<{ level: number; text: string }>,
      wordCount: 0,
    });
    await PageModel.updateOne(
      { _id: page._id },
      {
        $set: {
          pageRole: role.role,
          roleConfidence: role.confidence,
          roleConfidenceLevel: role.confidenceLevel,
          roleSource: role.source,
          roleInferredAt: new Date(),
        },
      },
    );
    res.json({
      pageRole: role.role,
      roleConfidence: role.confidence,
      roleConfidenceLevel: role.confidenceLevel,
      roleSource: role.source,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Page-level analyst flags (importance / intentionally non-indexable). Used by applicability.
 */
pagesRouter.patch('/projects/:id/pages/:pageId/flags', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.pageId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const body = req.body as { isImportant?: boolean; isIntentionallyNonIndexable?: boolean };
    const update: Record<string, unknown> = {};
    if (typeof body.isImportant === 'boolean') update.isImportant = body.isImportant;
    if (typeof body.isIntentionallyNonIndexable === 'boolean')
      update.isIntentionallyNonIndexable = body.isIntentionallyNonIndexable;
    await PageModel.updateOne({ _id: req.params.pageId, projectId: pid }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Analyst override of page role. Doc 11 §"Analyst Controls" — analyst correction stays sticky
 * (`roleSource: 'analyst'`, high confidence) so role-sensitive rules trust it.
 */
const ROLE_VALUES = [
  'home',
  'navigation-hub',
  'content-article',
  'product',
  'collection',
  'documentation',
  'pricing',
  'about',
  'contact',
  'legal',
  'utility',
  'service',
  'category',
  'unknown',
];

pagesRouter.patch('/projects/:id/pages/:pageId/role', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.pageId)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const body = req.body as { pageRole?: string };
    if (!body.pageRole || !ROLE_VALUES.includes(body.pageRole)) {
      res.status(400).json({ error: 'invalid pageRole' });
      return;
    }
    await PageModel.updateOne(
      { _id: req.params.pageId, projectId: pid },
      {
        $set: {
          pageRole: body.pageRole,
          roleSource: 'analyst',
          roleConfidence: 1,
          roleConfidenceLevel: 'high',
          roleInferredAt: new Date(),
        },
      },
    );
    res.json({ ok: true, pageRole: body.pageRole, roleSource: 'analyst' });
  } catch (err) {
    next(err);
  }
});
