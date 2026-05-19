import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  OpportunityModel,
  ProjectModel,
  SiteConnectionModel,
  CwvMetricModel,
  GscRowModel,
  Ga4RowModel,
} from '../../db';
import { generateOpportunities } from '../../audit/opportunities';

export const opportunitiesRouter = Router();

const OpportunityUpdate = z.object({
  status: z
    .enum(['open', 'planned', 'in-progress', 'done', 'ignored', 'not-applicable'])
    .optional(),
  ownerType: z.enum(['seo', 'content', 'developer', 'client', 'analyst']).optional(),
  actionPriority: z.enum(['P0', 'P1', 'P2']).optional(),
  notes: z.string().max(4000).optional(),
});

opportunitiesRouter.get('/projects/:id/opportunities', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    if (req.query.type) q.type = req.query.type;
    if (req.query.pageId && Types.ObjectId.isValid(String(req.query.pageId))) {
      q.pageId = new Types.ObjectId(String(req.query.pageId));
    }
    if (req.query.goalId) q.goalId = req.query.goalId;
    if (req.query.actionPriority) q.actionPriority = req.query.actionPriority;
    const limit = Math.min(2000, Number(req.query.limit ?? 500));
    const [rows, project] = await Promise.all([
      OpportunityModel.find(q).sort({ priority: -1, impactScore: -1 }).limit(limit).lean(),
      ProjectModel.findById(pid).select({ goals: 1 }).lean(),
    ]);
    const goalById = new Map<string, { id: string; type: string; label?: string }>();
    for (const g of (project?.goals as Array<{ id: string; type: string; label?: string }> | undefined) ?? []) {
      if (g.id) goalById.set(g.id, g);
    }
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        canonicalKey: r.canonicalKey,
        type: r.type,
        title: r.title,
        pageId: r.pageId ? String(r.pageId) : null,
        pageUrl: r.pageUrl ?? null,
        keyword: r.keyword ?? null,
        goalId: r.goalId ?? null,
        goalLabel: r.goalId
          ? (goalById.get(r.goalId)?.label || goalById.get(r.goalId)?.type || null)
          : null,
        evidence: r.evidence ?? {},
        narrative: buildNarrative(r),
        impactScore: r.impactScore,
        effortEstimate: r.effortEstimate,
        confidence: r.confidence,
        confidenceLevel: r.confidenceLevel,
        priority: r.priority,
        actionPriority: r.actionPriority,
        recommendedAction: r.recommendedAction,
        sourceRules: r.sourceRules ?? [],
        sourceIssueId: r.sourceIssueId ? String(r.sourceIssueId) : null,
        status: r.status,
        ownerType: r.ownerType,
        notes: r.notes ?? '',
        firstSeenAt: r.firstSeenAt,
        lastSeenAt: r.lastSeenAt,
        createdAt: (r as unknown as { createdAt?: Date }).createdAt,
        updatedAt: (r as unknown as { updatedAt?: Date }).updatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

opportunitiesRouter.get('/projects/:id/opportunities/summary', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const byType = await OpportunityModel.aggregate([
      { $match: { projectId: pid } },
      {
        $group: {
          _id: { type: '$type', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json({ byType });
  } catch (err) {
    next(err);
  }
});

/**
 * Data coverage for opportunity generation. Reports actual evidence presence, not just
 * OAuth connection state — CWV in particular is API-key driven, not OAuth.
 */
opportunitiesRouter.get('/projects/:id/opportunities/coverage', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const [project, conns, gscCount, ga4Count, cwvCount] = await Promise.all([
      ProjectModel.findById(pid).select({ goals: 1 }).lean(),
      SiteConnectionModel.find({ projectId: pid, status: 'connected' })
        .select({ provider: 1 })
        .lean(),
      GscRowModel.countDocuments({ projectId: pid }),
      Ga4RowModel.countDocuments({ projectId: pid }),
      CwvMetricModel.countDocuments({ projectId: pid }),
    ]);
    const providers = new Set(conns.map((c) => c.provider));
    const goalsCount = ((project?.goals as unknown[] | undefined) ?? []).length;
    res.json({
      goals: { count: goalsCount, ok: goalsCount > 0 },
      gsc: { connected: providers.has('gsc'), rows: gscCount, ok: providers.has('gsc') || gscCount > 0 },
      ga4: { connected: providers.has('ga4'), rows: ga4Count, ok: providers.has('ga4') || ga4Count > 0 },
      cwv: { rows: cwvCount, ok: cwvCount > 0 },
    });
  } catch (err) {
    next(err);
  }
});

opportunitiesRouter.post('/projects/:id/opportunities/regenerate', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const result = await generateOpportunities({ projectId: req.params.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

type EvidenceRecord = Record<string, unknown>;
type OpportunityRow = {
  type: string;
  evidence?: EvidenceRecord;
  pageUrl?: string | null;
  keyword?: string | null;
  sourceRules?: string[];
};

type Narrative = {
  whyDetected: string;
  metrics: Array<{ label: string; value: string }>;
  whyItMatters: string;
  validation: string;
};

function buildNarrative(r: OpportunityRow): Narrative {
  const ev: EvidenceRecord = r.evidence ?? {};
  const num = (v: unknown): string =>
    typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
  const pct = (v: unknown): string =>
    typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '—';

  switch (r.type) {
    case 'quick-win':
      return {
        whyDetected: `Query "${r.keyword}" ranks at avg position ${num(ev.avgPosition)} with ${num(ev.impressions)} impressions — just outside top 3.`,
        metrics: [
          { label: 'Impressions (28d)', value: num(ev.impressions) },
          { label: 'Clicks', value: num(ev.clicks) },
          { label: 'CTR', value: pct(ev.ctr) },
          { label: 'Avg position', value: num(ev.avgPosition) },
        ],
        whyItMatters:
          'Pages already ranking 4-20 have proven relevance signals. Pushing into top 3 typically multiplies clicks 5-10× without new content investment.',
        validation:
          'Re-check this query in GSC after 14 days. Look for position improvement and rising CTR. Track click delta against baseline.',
      };
    case 'ctr':
      return {
        whyDetected: `Page CTR ${pct(ev.ctr)} at position ${num(ev.avgPosition)} is below the expected curve (${pct(ev.expectedCtr)}).`,
        metrics: [
          { label: 'Impressions', value: num(ev.impressions) },
          { label: 'Clicks', value: num(ev.clicks) },
          { label: 'Actual CTR', value: pct(ev.ctr) },
          { label: 'Expected CTR', value: pct(ev.expectedCtr) },
          { label: 'Position', value: num(ev.avgPosition) },
        ],
        whyItMatters:
          'Below-curve CTR means the snippet (title, meta, rich result) does not align with searcher expectations even though Google ranks you well. This is the cheapest SEO win available.',
        validation:
          'Update title + meta. Re-check CTR in GSC after 21 days. Compare against historical CTR at the same position.',
      };
    case 'wrong-page-ranking':
      return {
        whyDetected: `Analyst-preferred URL ${ev.preferredUrl} does not match GSC ranking URL ${ev.rankingUrl}.`,
        metrics: [
          { label: 'Clicks', value: num(ev.clicks) },
          { label: 'Impressions', value: num(ev.impressions) },
          { label: 'Position', value: num(ev.position) },
        ],
        whyItMatters:
          'Google is treating the wrong page as the best answer. Internal links, canonical signals, or content overlap is misdirecting authority. Fixing this consolidates ranking power on the page you actually want to convert.',
        validation:
          'Re-audit internal links. After 28 days re-check which URL appears for the query — the preferred URL should overtake or merge.',
      };
    case 'cannibalization':
      return {
        whyDetected: `Query "${r.keyword}" surfaces ${num(ev.uniquePageCount)} of your URLs at ${num(ev.impressions)} impressions.`,
        metrics: [
          { label: 'Competing URLs', value: num(ev.uniquePageCount) },
          { label: 'Combined impressions', value: num(ev.impressions) },
          { label: 'Combined clicks', value: num(ev.clicks) },
          { label: 'Avg position', value: num(ev.position) },
        ],
        whyItMatters:
          'When multiple pages compete for one query Google splits authority. A single consolidated page typically ranks meaningfully higher than the best of the competing pages.',
        validation:
          'Pick the primary URL. After consolidation + 28d, the chosen URL should be the only ranking page and impressions should grow vs the combined baseline.',
      };
    case 'conversion':
      return {
        whyDetected: `Page received ${num(ev.sessions)} organic sessions but converted only ${num(ev.conversions)} (rate ${pct(ev.convRate)}).`,
        metrics: [
          { label: 'Sessions (organic)', value: num(ev.sessions) },
          { label: 'Conversions', value: num(ev.conversions) },
          { label: 'Conversion rate', value: pct(ev.convRate) },
          { label: 'Engagement rate', value: pct(ev.engagementRate) },
        ],
        whyItMatters:
          'Traffic is already arriving — the leak is in the page experience, CTA clarity, proof signals, or intent mismatch. Fixing conversion is much cheaper than driving more traffic.',
        validation:
          'Compare 14d conversion rate before vs after the fix. A conversion rate ≥2× the previous baseline is a strong success signal.',
      };
    case 'performance':
      return {
        whyDetected: `Core Web Vitals exceed Google’s poor thresholds: LCP ${num(ev.lcp)}ms / INP ${num(ev.inp)}ms / CLS ${num(ev.cls)}.`,
        metrics: [
          { label: 'LCP (ms)', value: num(ev.lcp) },
          { label: 'INP (ms)', value: num(ev.inp) },
          { label: 'CLS', value: num(ev.cls) },
          { label: 'Lighthouse', value: num(ev.performanceScore) },
        ],
        whyItMatters:
          'Slow pages lose rankings on competitive queries and harm conversion. CWV is a confirmed Google ranking signal and a strong UX correlate.',
        validation:
          'Re-run PSI after fix. Targets: LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1. Confirm 28d field data via CrUX, not just lab.',
      };
    case 'schema':
      return {
        whyDetected: `Audit rule ${r.sourceRules?.[0] ?? ''} flagged a structured-data issue on this page.`,
        metrics: [
          { label: 'Rule', value: String(r.sourceRules?.[0] ?? '—') },
          { label: 'Severity', value: String(ev.severity ?? '—') },
        ],
        whyItMatters:
          'Schema unlocks rich results (FAQ, product, breadcrumb, organization) which lift CTR and boost AI search citability. Missing/malformed schema is a low-effort SERP win.',
        validation:
          'Validate JSON-LD with Google Rich Results Test. After deploy, re-crawl + re-audit; the issue should not regenerate.',
      };
    case 'internal-link':
      return {
        whyDetected: `Audit detected an orphan / weakly-linked page (${r.sourceRules?.[0] ?? 'rule'}).`,
        metrics: [{ label: 'Rule', value: String(r.sourceRules?.[0] ?? '—') }],
        whyItMatters:
          'Pages without contextual internal links struggle to rank regardless of content quality. Internal links concentrate authority and signal relevance to Google.',
        validation:
          'Add 3-5 contextual links from related hub/parent pages. Re-crawl: the page should show ≥3 incoming internal links and graduate from orphan status.',
      };
    case 'content-gap':
      return {
        whyDetected: `Keyword "${r.keyword}" has impressions in GSC but no mapped/crawled page on the site.`,
        metrics: [
          { label: 'Impressions', value: num(ev.impressions) },
          { label: 'Clicks', value: num(ev.clicks) },
          { label: 'Position', value: num(ev.position) },
        ],
        whyItMatters:
          'You’re showing up by accident rather than design. A dedicated target page consistently outperforms a tangential page and unlocks the full ranking ceiling for the query.',
        validation:
          'After publishing the new page + 28d, check GSC: the page should rank and impressions/clicks shift to the new URL.',
      };
    default:
      return {
        whyDetected:
          'Detected from audit rule evidence. Open the source rule for full detection logic.',
        metrics: [],
        whyItMatters: 'See recommended action.',
        validation: 'Re-run regeneration after applying the recommended action.',
      };
  }
}

opportunitiesRouter.patch('/projects/:id/opportunities/:opportunityId', async (req, res, next) => {
  try {
    if (
      !Types.ObjectId.isValid(req.params.id) ||
      !Types.ObjectId.isValid(req.params.opportunityId)
    ) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const body = OpportunityUpdate.parse(req.body);
    await OpportunityModel.updateOne(
      { _id: req.params.opportunityId, projectId: req.params.id },
      { $set: body },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
