// Deterministic recommendation generator. Reads existing active issues + their findings + pages
// and produces analyst-ready recommendations anchored to those records.
//
// Rules:
//  - inactive issues (verified/ignored/not-applicable/blocked-by-data-gap) → skip.
//  - findings still `not_verified` (e.g. raw HTML didn't have JSON-LD but rendered hasn't run) → skip.
//  - issues that share a groupKey are folded into a single recommendation.
//  - sourceKey is stable across regens → upsert prevents duplicates.

import { Types } from 'mongoose';
import {
  IssueModel,
  FindingModel,
  PageModel,
  RecommendationModel,
} from '../db';
import { ACTIVE_LIFECYCLE_STATUSES } from '../audit/lifecycle';
import { TEMPLATES, genericTemplate, type Template } from './templates';
import { getLogger } from '../config/logger';

const log = getLogger('recommendations');

type IssueDoc = {
  _id: Types.ObjectId;
  ruleId: string;
  pageId?: Types.ObjectId;
  groupKey?: string;
  affectedUrls?: string[];
  affectedPageCount?: number;
  severity: string;
  category: string;
  title: string;
  priority: number;
  impact: number;
  effort: string;
  confidence: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  actionPriority?: 'P0' | 'P1' | 'P2';
  ownerType?: string;
  currentFindingId?: Types.ObjectId;
  latestStatus?: string;
  lifecycleStatus?: string;
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export async function generateRecommendations(opts: { projectId: string }): Promise<{
  generated: number;
  closed: number;
}> {
  const pid = new Types.ObjectId(opts.projectId);
  const issues = (await IssueModel.find({
    projectId: pid,
    lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES },
  }).lean()) as unknown as IssueDoc[];

  // Group by ruleId + groupKey when groupable; otherwise per (ruleId, pageId).
  type Bucket = { template: Template; key: string; issues: IssueDoc[] };
  const buckets = new Map<string, Bucket>();
  for (const i of issues) {
    const template = TEMPLATES[i.ruleId] ??
      genericTemplate({
        ruleId: i.ruleId,
        category: i.category,
        severity: i.severity,
        title: i.title,
        affectedCount: i.affectedPageCount ?? 1,
      });
    const bucketKey =
      template.groupable && i.groupKey
        ? `${i.ruleId}|${i.groupKey}`
        : `${i.ruleId}|${i.pageId ?? 'site'}`;
    let b = buckets.get(bucketKey);
    if (!b) {
      b = { template, key: bucketKey, issues: [] };
      buckets.set(bucketKey, b);
    }
    b.issues.push(i);
  }

  // Bulk load findings + pages we need for evidence.
  const findingIds = issues.map((i) => i.currentFindingId).filter(Boolean) as Types.ObjectId[];
  const pageIds = [
    ...new Set(issues.map((i) => i.pageId).filter(Boolean) as Types.ObjectId[]),
  ];
  const [findings, pages] = await Promise.all([
    findingIds.length > 0
      ? FindingModel.find({ _id: { $in: findingIds } })
          .select({ _id: 1, status: 1, evidence: 1, observed: 1, blockedBy: 1 })
          .lean()
      : Promise.resolve([]),
    pageIds.length > 0
      ? PageModel.find({ _id: { $in: pageIds } })
          .select({ _id: 1, url: 1, pageRole: 1, isImportant: 1 })
          .lean()
      : Promise.resolve([]),
  ]);
  const findingMap = new Map(findings.map((f) => [String(f._id), f]));
  const pageMap = new Map(pages.map((p) => [String(p._id), p]));

  let generated = 0;
  const seenSourceKeys = new Set<string>();
  const blockedSourceKeys = new Set<string>();
  for (const b of buckets.values()) {
    // Pick a representative issue for primary URL + severity max.
    const top = b.issues.reduce((best, cur) =>
      (SEVERITY_RANK[cur.severity] ?? 0) > (SEVERITY_RANK[best.severity] ?? 0) ? cur : best,
    );
    const topPage = top.pageId ? pageMap.get(String(top.pageId)) : null;
    const primaryUrl = topPage?.url ?? top.affectedUrls?.[0];

    // Skip if all linked findings are not_verified / blocked-by-data-gap — recommendation would
    // claim a fix exists when data hasn't confirmed it. Record the bucket key so any existing
    // draft/proposed recommendation can be auto-rejected (otherwise stale recs keep "add schema
    // now" alive when latest evidence reverted to not_verified).
    const blocking = b.issues.every((i) => {
      if (!i.currentFindingId) return false;
      const f = findingMap.get(String(i.currentFindingId));
      if (!f) return false;
      return f.status === 'not_verified' || (f as { blockedBy?: string[] }).blockedBy?.length;
    });
    if (blocking) {
      blockedSourceKeys.add(b.key);
      log.debug({ rule: top.ruleId, count: b.issues.length }, 'skip: all findings not_verified');
      continue;
    }

    const t = b.template;
    const affectedCount =
      top.affectedPageCount && top.affectedPageCount > 1
        ? top.affectedPageCount
        : b.issues.reduce((s, i) => s + Math.max(1, i.affectedPageCount ?? 1), 0);
    const verdict =
      t.verdictBySeverity?.[top.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'] ??
      (top.severity === 'critical' || top.severity === 'high'
        ? 'must_change'
        : top.severity === 'low'
          ? 'consider'
          : 'should_improve');

    const ctx = {
      primaryUrl,
      affectedCount,
      pageRole: topPage?.pageRole,
    };

    const sourceKey = b.key;
    // Only mark seen AFTER the blocked skip, so the auto-reject sweep treats blocked buckets the
    // same as stale ones. Audit feedback 2026-05-20.
    seenSourceKeys.add(sourceKey);

    const sourceIssueIds = b.issues.map((i) => i._id);
    const sourceFindingIds = b.issues
      .map((i) => i.currentFindingId)
      .filter(Boolean) as Types.ObjectId[];
    const pageIdsBucket = [...new Set(b.issues.map((i) => i.pageId).filter(Boolean) as Types.ObjectId[])];

    const observations = b.issues
      .map((i) => {
        const f = i.currentFindingId ? findingMap.get(String(i.currentFindingId)) : null;
        const obs =
          (f?.evidence as { observation?: string } | undefined)?.observation ??
          (f as { observed?: string } | undefined)?.observed;
        return obs ? `${primaryUrl ? '' : ''}${obs}` : null;
      })
      .filter(Boolean)
      .slice(0, 5);

    const evidence = {
      pages: pageIdsBucket.map(String),
      findings: sourceFindingIds.map(String),
      issues: sourceIssueIds.map(String),
      observations,
      sample: b.issues.slice(0, 3).map((i) => {
        const f = i.currentFindingId ? findingMap.get(String(i.currentFindingId)) : null;
        return {
          issueId: String(i._id),
          url: i.pageId ? pageMap.get(String(i.pageId))?.url : i.affectedUrls?.[0],
          severity: i.severity,
          observation: (f?.evidence as { observation?: string } | undefined)?.observation ?? null,
        };
      }),
    };

    const priorityScore = Math.min(
      100,
      Math.round(
        (SEVERITY_RANK[top.severity] ?? 0) * 20 +
          (top.impact ?? 0) * 0.4 +
          Math.min(20, affectedCount),
      ),
    );

    // Always-overwritten fields: evidence + scoring stay fresh against latest issues. Clear any
    // prior stale flag — the source is active again.
    const alwaysSet: Record<string, unknown> = {
      sourceFindingIds,
      sourceIssueIds,
      pageIds: pageIdsBucket,
      evidence,
      priorityScore,
      confidence: top.confidence ?? 0.7,
      confidenceLevel: top.confidenceLevel ?? 'medium',
      source: 'rule',
      lastGeneratedAt: new Date(),
      evidenceStaleReason: null,
      evidenceStaleAt: null,
    };
    // Analyst-editable fields: only refresh while still in draft/proposed. Once approved+ the
    // analyst's wording is authoritative. Doc continuation §"Phase 2 — no duplicate spam".
    const draftSet: Record<string, unknown> = {
      title: t.title(ctx),
      type: t.type,
      verdict,
      rootCauseSummary: t.rootCauseSummary,
      rootCause: t.rootCause,
      recommendedAction: t.recommendedAction,
      whyItMatters: t.whyItMatters,
      validationMethod: t.validationMethod,
      ownerType: t.ownerType,
      effort: t.effort,
      expectedImpact: t.expectedImpact,
    };

    // Two-step update: first upsert with always-set + insert-only fields, then conditional
    // refresh of editable text iff status is still draft/proposed.
    await RecommendationModel.updateOne(
      { projectId: pid, sourceKey },
      {
        $set: alwaysSet,
        $setOnInsert: {
          projectId: pid,
          sourceKey,
          status: 'draft',
          reportVisibility: 'both',
          ...draftSet,
        },
      },
      { upsert: true },
    );
    await RecommendationModel.updateOne(
      { projectId: pid, sourceKey, status: { $in: ['draft', 'proposed'] } },
      { $set: draftSet },
    );
    generated += 1;
  }

  // Auto-reject draft/proposed recs in two cases:
  //   1) source issue is no longer active (stale)
  //   2) source issue exists but every finding is not_verified / blocked-by-data-gap
  // We never delete — analyst may have already approved one, and the audit history matters.
  let closed = 0;
  const blockedList = [...blockedSourceKeys];
  if (blockedList.length > 0) {
    const r = await RecommendationModel.updateMany(
      {
        projectId: pid,
        source: 'rule',
        status: { $in: ['draft', 'proposed'] },
        sourceKey: { $in: blockedList },
      },
      {
        $set: {
          status: 'rejected',
          rejectedReason:
            'Latest evidence is not verified (likely needs rendered audit or extra integration).',
        },
      },
    );
    closed += r.modifiedCount ?? 0;
  }
  const ignoreKeys = new Set<string>([...seenSourceKeys, ...blockedSourceKeys]);
  const stale = await RecommendationModel.find({
    projectId: pid,
    source: 'rule',
    status: { $in: ['draft', 'proposed'] },
    sourceKey: { $nin: [...ignoreKeys] },
  })
    .select({ _id: 1 })
    .lean();
  if (stale.length > 0) {
    const r = await RecommendationModel.updateMany(
      { _id: { $in: stale.map((s) => s._id) } },
      {
        $set: {
          status: 'rejected',
          rejectedReason: 'Underlying issue no longer active.',
        },
      },
    );
    closed += r.modifiedCount ?? 0;
  }

  // Flag approved+ recommendations whose source is stale or blocked. We don't overwrite their text
  // or change status (analyst approved them) — but the card should warn the analyst to re-check.
  const APPROVED_PLUS = ['approved', 'planned', 'in_progress', 'implemented'];
  const now = new Date();
  if (blockedList.length > 0) {
    await RecommendationModel.updateMany(
      {
        projectId: pid,
        source: 'rule',
        status: { $in: APPROVED_PLUS },
        sourceKey: { $in: blockedList },
      },
      { $set: { evidenceStaleReason: 'blocked', evidenceStaleAt: now } },
    );
  }
  await RecommendationModel.updateMany(
    {
      projectId: pid,
      source: 'rule',
      status: { $in: APPROVED_PLUS },
      sourceKey: { $nin: [...ignoreKeys] },
    },
    { $set: { evidenceStaleReason: 'stale', evidenceStaleAt: now } },
  );

  log.info({ projectId: opts.projectId, generated, closed }, 'recommendations regenerated');
  return { generated, closed };
}
