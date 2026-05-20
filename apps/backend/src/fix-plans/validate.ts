import { Types } from 'mongoose';
import {
  IssueModel,
  FindingModel,
  RecommendationModel,
  OpportunityModel,
  ContentBriefModel,
  PageModel,
  CwvMetricModel,
  GscRowModel,
  KeywordModel,
} from '../db';

/**
 * Validation result + evidence captured at run time.
 *
 * Doc continuation §"Validation logic" — must be evidence-based. AI is never the source of
 * truth for validation. Each branch reads from the same underlying data the source originally
 * used (audit findings for rule-based work, CWV thresholds for performance work, GSC trends for
 * opportunity work, page crawl for content-brief work) and writes a structured evidence blob so
 * the analyst sees exactly what we compared.
 *
 * Status semantics:
 *  - `passed`        — evidence shows the underlying problem is gone.
 *  - `failed`        — evidence shows the problem is still present.
 *  - `inconclusive`  — data source is unavailable / never re-collected after the fix landed.
 *  - `pending`       — too early to call: action recorded but no fresh evidence yet (we mark
 *                      pending instead of failed so the analyst doesn't reopen prematurely).
 */
export type ValidationStatus = 'passed' | 'failed' | 'inconclusive' | 'pending';

export interface ValidationResult {
  status: ValidationStatus;
  dataSource: string;
  evidence: Record<string, unknown>;
  reason: string;
}

interface FixPlanItemForValidation {
  sourceType: 'recommendation' | 'issue' | 'opportunity' | 'content-brief' | 'manual';
  recommendationId?: Types.ObjectId | null;
  issueId?: Types.ObjectId | null;
  opportunityId?: Types.ObjectId | null;
  contentBriefId?: Types.ObjectId | null;
  pageId?: Types.ObjectId | null;
  keywordId?: Types.ObjectId | null;
  addedAt?: Date;
  completedAt?: Date | null;
  validationMethod?: string;
}

const CWV_THRESHOLDS = {
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
};

export async function validateFixPlanItem(
  projectId: string,
  item: FixPlanItemForValidation,
): Promise<ValidationResult> {
  const pid = new Types.ObjectId(projectId);
  // "Post-fix cutoff" — evidence older than this is stale for validation purposes.
  // Prefer completedAt (analyst marked fixed/ready-for-validation), fall back to addedAt so we
  // never validate using the same data row that produced the issue in the first place.
  const since = item.completedAt ?? item.addedAt ?? null;
  switch (item.sourceType) {
    case 'issue':
      return validateIssue(pid, item.issueId ?? null, { since });
    case 'recommendation':
      return validateRecommendation(pid, item.recommendationId ?? null, { since });
    case 'opportunity':
      return validateOpportunity(pid, item);
    case 'content-brief':
      return validateContentBrief(pid, item);
    case 'manual':
    default:
      return {
        status: 'inconclusive',
        dataSource: 'manual',
        evidence: { note: 'Manual item — analyst confirms outside the system.' },
        reason: 'Manual items have no automatic evidence. Mark validated manually if confirmed.',
      };
  }
}

async function validateIssue(
  projectId: Types.ObjectId,
  issueId: Types.ObjectId | null,
  opts: { since?: Date | null } = {},
): Promise<ValidationResult> {
  if (!issueId) {
    return {
      status: 'inconclusive',
      dataSource: 'audit',
      evidence: {},
      reason: 'No issueId linked.',
    };
  }
  const issue = await IssueModel.findOne({ _id: issueId, projectId }).lean();
  if (!issue) {
    return {
      status: 'inconclusive',
      dataSource: 'audit',
      evidence: {},
      reason: 'Source issue no longer exists.',
    };
  }
  // Look at the most recent finding for the same canonicalKey (issue auto-resolves to verified
  // when latest audit returns `pass`; but we don't depend on lifecycleStatus alone — we read the
  // raw finding row so the evidence pane shows real data).
  const latestFinding = await FindingModel.findOne({
    projectId,
    ruleId: issue.ruleId,
    ...(issue.pageId ? { pageId: issue.pageId } : { groupKey: issue.groupKey }),
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!latestFinding) {
    return {
      status: 'inconclusive',
      dataSource: 'audit',
      evidence: { issueId: String(issue._id), ruleId: issue.ruleId },
      reason: 'No audit finding found for this rule + scope. Run an audit before validating.',
    };
  }
  // Audit-trail integrity: never declare passed/failed using a finding produced before the
  // analyst marked the item complete (or before it was even added to the plan). Otherwise we
  // can mark a fix validated using the same row that originally produced the issue.
  const since = opts.since ?? null;
  const findingAt = (latestFinding as unknown as { createdAt?: Date }).createdAt ?? null;
  const stale = !!since && !!findingAt && findingAt < since;
  const fStatus = latestFinding.status;
  const evidence = {
    issueId: String(issue._id),
    ruleId: issue.ruleId,
    findingId: String(latestFinding._id),
    findingStatus: fStatus,
    findingCreatedAt: findingAt,
    findingAuditRunId: String(latestFinding.auditRunId),
    findingObserved: latestFinding.observed,
    issueLifecycleStatus: issue.lifecycleStatus,
    postFixCutoff: since,
  };
  if (stale) {
    return {
      status: 'pending',
      dataSource: 'audit',
      evidence,
      reason: `Latest audit finding (${findingAt?.toISOString?.() ?? '?'}) predates the post-fix cutoff (${since?.toISOString?.() ?? '?'}). Run a fresh audit after the work is complete before validating.`,
    };
  }
  if (fStatus === 'pass' || fStatus === 'not_applicable') {
    return {
      status: 'passed',
      dataSource: 'audit',
      evidence,
      reason: `Latest audit finding is ${fStatus}${since ? ' (captured after the post-fix cutoff)' : ''}.`,
    };
  }
  if (fStatus === 'not_verified') {
    return {
      status: 'inconclusive',
      dataSource: 'audit',
      evidence,
      reason: 'Latest finding is not_verified — data source missing (e.g. rendered HTML unavailable).',
    };
  }
  return {
    status: 'failed',
    dataSource: 'audit',
    evidence,
    reason: `Latest audit finding is still ${fStatus}. The rule still detects the problem.`,
  };
}

async function validateRecommendation(
  projectId: Types.ObjectId,
  recommendationId: Types.ObjectId | null,
  opts: { since?: Date | null } = {},
): Promise<ValidationResult> {
  if (!recommendationId) {
    return {
      status: 'inconclusive',
      dataSource: 'recommendation',
      evidence: {},
      reason: 'No recommendationId linked.',
    };
  }
  const rec = await RecommendationModel.findOne({ _id: recommendationId, projectId }).lean();
  if (!rec) {
    return {
      status: 'inconclusive',
      dataSource: 'recommendation',
      evidence: {},
      reason: 'Source recommendation no longer exists.',
    };
  }
  // Recommendations almost always trace back to issues — defer to the strongest underlying
  // evidence we can find. Take the first linked issue.
  const linkedIssueId = (rec.sourceIssueIds as unknown as Types.ObjectId[] | undefined)?.[0];
  if (linkedIssueId) {
    const r = await validateIssue(projectId, linkedIssueId, opts);
    return {
      ...r,
      evidence: { ...r.evidence, recommendationId: String(rec._id), recStatus: rec.status },
    };
  }
  // No linked issue — fall back to the recommendation's own status (analyst-managed).
  const isDone = rec.status === 'verified' || rec.status === 'implemented';
  return {
    status: isDone ? 'passed' : rec.status === 'rejected' ? 'failed' : 'pending',
    dataSource: 'recommendation',
    evidence: {
      recommendationId: String(rec._id),
      recStatus: rec.status,
      recVerdict: rec.verdict,
    },
    reason: `Recommendation status is ${rec.status}; no underlying audit evidence to verify against. Confirm manually.`,
  };
}

async function validateOpportunity(
  projectId: Types.ObjectId,
  item: FixPlanItemForValidation,
): Promise<ValidationResult> {
  const oppId = item.opportunityId;
  if (!oppId) {
    return {
      status: 'inconclusive',
      dataSource: 'opportunity',
      evidence: {},
      reason: 'No opportunityId linked.',
    };
  }
  const opp = await OpportunityModel.findOne({ _id: oppId, projectId }).lean();
  if (!opp) {
    return {
      status: 'inconclusive',
      dataSource: 'opportunity',
      evidence: {},
      reason: 'Source opportunity no longer exists.',
    };
  }
  const ev = opp.evidence as Record<string, unknown> | undefined;
  const baseEvidence = {
    opportunityId: String(opp._id),
    opportunityStatus: opp.status,
    opportunityType: opp.type,
  };

  // CWV-style opportunities: pull the latest CWV row for the page and compare to the standard
  // thresholds. This must be evidence-based — we never trust the opportunity status alone.
  if (opp.type === 'performance' && opp.pageUrl) {
    const latest = await CwvMetricModel.findOne({ projectId, pageUrl: opp.pageUrl })
      .sort({ capturedAt: -1 })
      .lean();
    if (!latest) {
      return {
        status: 'inconclusive',
        dataSource: 'cwv',
        evidence: { ...baseEvidence, pageUrl: opp.pageUrl },
        reason: 'No CWV data for this page. Run a PSI/CWV sync to validate.',
      };
    }
    // Only count CWV captured after the item entered the plan; otherwise we're staring at the
    // same numbers that produced the opportunity.
    const addedAt = item.addedAt ?? new Date(0);
    if (latest.capturedAt && latest.capturedAt < addedAt) {
      return {
        status: 'pending',
        dataSource: 'cwv',
        evidence: {
          ...baseEvidence,
          pageUrl: opp.pageUrl,
          latestCapturedAt: latest.capturedAt,
          addedAt,
        },
        reason: 'Latest CWV row is older than when this item was added. Re-run CWV before validating.',
      };
    }
    const lcpOk = latest.lcp == null || latest.lcp <= CWV_THRESHOLDS.lcpMs;
    const inpOk = latest.inp == null || latest.inp <= CWV_THRESHOLDS.inpMs;
    const clsOk = latest.cls == null || latest.cls <= CWV_THRESHOLDS.cls;
    const allOk = lcpOk && inpOk && clsOk;
    const evidence = {
      ...baseEvidence,
      pageUrl: opp.pageUrl,
      strategy: latest.strategy,
      lcp: latest.lcp,
      inp: latest.inp,
      cls: latest.cls,
      thresholds: CWV_THRESHOLDS,
      lcpOk,
      inpOk,
      clsOk,
      capturedAt: latest.capturedAt,
    };
    return allOk
      ? {
          status: 'passed',
          dataSource: 'cwv',
          evidence,
          reason: 'All CWV metrics are at or below the good threshold in the latest measurement.',
        }
      : {
          status: 'failed',
          dataSource: 'cwv',
          evidence,
          reason: `CWV still failing on latest measurement (LCP ok=${lcpOk}, INP ok=${inpOk}, CLS ok=${clsOk}).`,
        };
  }

  // GSC-trend opportunities: quick-win / ctr / wrong-page-ranking. Compare the latest GSC range
  // for the page+query against the baseline that was recorded when the opportunity was created.
  if (
    (opp.type === 'quick-win' || opp.type === 'ctr' || opp.type === 'wrong-page-ranking') &&
    opp.keyword
  ) {
    const rows = await GscRowModel.find({ projectId, query: opp.keyword })
      .sort({ rangeEnd: -1 })
      .limit(2)
      .lean();
    if (rows.length === 0) {
      return {
        status: 'inconclusive',
        dataSource: 'gsc',
        evidence: { ...baseEvidence, keyword: opp.keyword },
        reason: 'No GSC rows for this query. Sync GSC before validating.',
      };
    }
    const latest = rows[0];
    if (!latest) {
      return {
        status: 'inconclusive',
        dataSource: 'gsc',
        evidence: { ...baseEvidence, keyword: opp.keyword },
        reason: 'No GSC rows for this query. Sync GSC before validating.',
      };
    }
    const addedAt = item.addedAt ?? new Date(0);
    if (latest.rangeEnd < addedAt) {
      return {
        status: 'pending',
        dataSource: 'gsc',
        evidence: {
          ...baseEvidence,
          keyword: opp.keyword,
          latestRangeEnd: latest.rangeEnd,
          addedAt,
        },
        reason: 'Latest GSC range is older than when this item was added. Re-sync GSC before validating.',
      };
    }
    const evd = ev ?? {};
    const baselinePosition = Number(evd.avgPosition ?? evd.position ?? 0);
    const baselineCtr = Number(evd.ctr ?? 0);
    const latestCtr = latest.impressions > 0 ? latest.clicks / latest.impressions : 0;
    const evidence = {
      ...baseEvidence,
      keyword: opp.keyword,
      pageUrl: latest.pageUrl,
      baselinePosition,
      baselineCtr,
      latestPosition: latest.position,
      latestCtr,
      latestClicks: latest.clicks,
      latestImpressions: latest.impressions,
      rangeStart: latest.rangeStart,
      rangeEnd: latest.rangeEnd,
    };
    if (opp.type === 'ctr') {
      // CTR opportunity: meaningful CTR lift = better than baseline + at least 1pp absolute jump.
      if (latestCtr > baselineCtr + 0.01) {
        return {
          status: 'passed',
          dataSource: 'gsc',
          evidence,
          reason: `CTR improved from ${(baselineCtr * 100).toFixed(2)}% to ${(latestCtr * 100).toFixed(2)}%.`,
        };
      }
      return {
        status: 'failed',
        dataSource: 'gsc',
        evidence,
        reason: `CTR has not improved meaningfully (baseline ${(baselineCtr * 100).toFixed(2)}% → latest ${(latestCtr * 100).toFixed(2)}%).`,
      };
    }
    // quick-win / wrong-page-ranking: success = avg position moved into top 3 OR baseline -2.
    if (
      baselinePosition > 0 &&
      latest.position > 0 &&
      (latest.position <= 3 || latest.position <= baselinePosition - 2)
    ) {
      return {
        status: 'passed',
        dataSource: 'gsc',
        evidence,
        reason: `Position improved from ${baselinePosition.toFixed(1)} to ${latest.position.toFixed(1)}.`,
      };
    }
    return {
      status: 'failed',
      dataSource: 'gsc',
      evidence,
      reason: `Position has not moved meaningfully (baseline ${baselinePosition.toFixed(1)} → latest ${latest.position.toFixed(1)}).`,
    };
  }

  // Fallback: trust opportunity's analyst-driven status as a soft signal.
  if (opp.status === 'done') {
    return {
      status: 'passed',
      dataSource: 'opportunity',
      evidence: baseEvidence,
      reason: 'Opportunity is marked done by an analyst. Add evidence manually for a stronger validation.',
    };
  }
  if (opp.status === 'not-applicable' || opp.status === 'ignored') {
    return {
      status: 'inconclusive',
      dataSource: 'opportunity',
      evidence: baseEvidence,
      reason: `Opportunity is ${opp.status} — no validation needed.`,
    };
  }
  return {
    status: 'failed',
    dataSource: 'opportunity',
    evidence: baseEvidence,
    reason: 'Opportunity is still open. No evidence yet that the underlying signal moved.',
  };
}

async function validateContentBrief(
  projectId: Types.ObjectId,
  item: FixPlanItemForValidation,
): Promise<ValidationResult> {
  const briefId = item.contentBriefId;
  if (!briefId) {
    return {
      status: 'inconclusive',
      dataSource: 'content-brief',
      evidence: {},
      reason: 'No contentBriefId linked.',
    };
  }
  const brief = await ContentBriefModel.findOne({ _id: briefId, projectId }).lean();
  if (!brief) {
    return {
      status: 'inconclusive',
      dataSource: 'content-brief',
      evidence: {},
      reason: 'Source content brief no longer exists.',
    };
  }
  if (brief.status !== 'approved' && brief.status !== 'implemented') {
    return {
      status: 'pending',
      dataSource: 'content-brief',
      evidence: { briefId: String(brief._id), briefStatus: brief.status },
      reason: `Brief status is ${brief.status}. Validate only after approval.`,
    };
  }
  if (!brief.pageId) {
    return {
      status: 'inconclusive',
      dataSource: 'content-brief',
      evidence: { briefId: String(brief._id), briefStatus: brief.status },
      reason: 'Brief is not linked to a page — no page to crawl-check.',
    };
  }
  const page = await PageModel.findOne({ _id: brief.pageId, projectId }).lean();
  if (!page) {
    return {
      status: 'inconclusive',
      dataSource: 'content-brief',
      evidence: { briefId: String(brief._id), pageId: String(brief.pageId) },
      reason: 'Target page record no longer exists.',
    };
  }
  const approvedAt = brief.approvedAt;
  if (!approvedAt) {
    return {
      status: 'pending',
      dataSource: 'content-brief',
      evidence: { briefId: String(brief._id), briefStatus: brief.status },
      reason: 'Brief is approved but has no approvedAt timestamp.',
    };
  }
  if (!page.lastCrawledAt || page.lastCrawledAt < approvedAt) {
    return {
      status: 'pending',
      dataSource: 'content-brief',
      evidence: {
        briefId: String(brief._id),
        pageId: String(page._id),
        url: page.url,
        approvedAt,
        lastCrawledAt: page.lastCrawledAt,
      },
      reason: 'Target page has not been re-crawled after brief approval. Crawl again to validate.',
    };
  }
  // Heuristic content checks: target keyword in title OR H1, plus the brief's recommended H1 (if
  // any) actually appears. We never claim "the article ranks now" — that lives in GSC validation.
  const kw = (brief.targetKeyword || '').toLowerCase();
  const title = (page.title || '').toLowerCase();
  const h1 = (page.h1 || '').toLowerCase();
  const titleHasKw = kw.length > 0 && title.includes(kw);
  const h1HasKw = kw.length > 0 && h1.includes(kw);
  const recommendedH1 = (brief.h1Suggestion || '').toLowerCase();
  const h1MatchesRec =
    recommendedH1.length > 0 && h1.length > 0 && h1.includes(recommendedH1.slice(0, 40));
  const evidence = {
    briefId: String(brief._id),
    pageId: String(page._id),
    url: page.url,
    approvedAt,
    lastCrawledAt: page.lastCrawledAt,
    targetKeyword: brief.targetKeyword,
    pageTitle: page.title,
    pageH1: page.h1,
    titleHasKeyword: titleHasKw,
    h1HasKeyword: h1HasKw,
    h1MatchesRecommendedH1: h1MatchesRec,
  };
  if (titleHasKw && h1HasKw) {
    return {
      status: 'passed',
      dataSource: 'content-brief',
      evidence,
      reason: 'Target keyword present in title and H1 after brief approval.',
    };
  }
  if (titleHasKw || h1HasKw) {
    return {
      status: 'pending',
      dataSource: 'content-brief',
      evidence,
      reason: 'Partial implementation — keyword present in one of title/H1 only. Finish before validating.',
    };
  }
  return {
    status: 'failed',
    dataSource: 'content-brief',
    evidence,
    reason: 'Target keyword not present in title or H1 of latest crawl.',
  };
}

/**
 * Resolve a source object to a draft FixPlanItem (without saving). Used by the "add from source"
 * endpoints so we copy the source's existing owner/priority/effort defaults instead of forcing
 * the analyst to re-enter them.
 */
export async function buildItemFromSource(
  projectId: string,
  source: {
    sourceType: 'recommendation' | 'issue' | 'opportunity' | 'content-brief';
    sourceId: string;
  },
): Promise<Record<string, unknown>> {
  const pid = new Types.ObjectId(projectId);
  if (source.sourceType === 'recommendation') {
    const r = await RecommendationModel.findOne({ _id: source.sourceId, projectId: pid }).lean();
    if (!r) throw new Error('Recommendation not found');
    return {
      sourceType: 'recommendation',
      sourceId: source.sourceId,
      recommendationId: r._id,
      issueId: r.sourceIssueIds?.[0] ?? null,
      pageId: r.pageIds?.[0] ?? null,
      keywordId: r.keywordIds?.[0] ?? null,
      title: r.title,
      description: r.rootCauseSummary,
      ownerType: r.ownerType,
      priority:
        r.priorityScore >= 70 ? 'P0' : r.priorityScore >= 40 ? 'P1' : 'P2',
      impact: r.expectedImpact,
      effort: r.effort,
      expectedOutcome: r.whyItMatters,
      validationMethod: r.validationMethod,
      clientVisible: r.reportVisibility === 'client' || r.reportVisibility === 'both',
    };
  }
  if (source.sourceType === 'issue') {
    const issue = await IssueModel.findOne({ _id: source.sourceId, projectId: pid }).lean();
    if (!issue) throw new Error('Issue not found');
    return {
      sourceType: 'issue',
      sourceId: source.sourceId,
      issueId: issue._id,
      pageId: issue.pageId ?? null,
      title: issue.title,
      description: `${issue.category} · ${issue.ruleId}`,
      ownerType: issue.ownerType,
      priority: issue.actionPriority,
      effort: issue.effort,
      validationMethod: `Re-run audit; check latest finding for rule ${issue.ruleId} on this scope is pass / not_applicable.`,
      clientVisible: issue.severity === 'critical' || issue.severity === 'high',
    };
  }
  if (source.sourceType === 'opportunity') {
    const opp = await OpportunityModel.findOne({ _id: source.sourceId, projectId: pid }).lean();
    if (!opp) throw new Error('Opportunity not found');
    const kw = opp.keywordId
      ? await KeywordModel.findOne({ _id: opp.keywordId, projectId: pid })
          .select({ keyword: 1 })
          .lean()
      : null;
    const validationByType: Record<string, string> = {
      performance:
        'Re-run PSI/CWV. Latest LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1 → passed.',
      'quick-win':
        'Re-sync GSC. Latest avg position improved by ≥ 2 ranks or reached top 3 → passed.',
      ctr:
        'Re-sync GSC. Latest CTR up by at least 1 absolute percentage point vs baseline → passed.',
      'wrong-page-ranking':
        'Re-sync GSC. Latest position improved by ≥ 2 ranks → passed.',
    };
    return {
      sourceType: 'opportunity',
      sourceId: source.sourceId,
      opportunityId: opp._id,
      pageId: opp.pageId ?? null,
      keywordId: opp.keywordId ?? null,
      title: opp.title,
      description: opp.recommendedAction,
      ownerType: opp.ownerType,
      priority: opp.actionPriority,
      effort: opp.effortEstimate,
      validationMethod:
        validationByType[opp.type] ??
        'Confirm the underlying GSC/GA4/CWV signal moved before marking validated.',
      expectedOutcome: kw ? `Improve ranking + CTR for "${kw.keyword}".` : '',
      clientVisible: true,
    };
  }
  if (source.sourceType === 'content-brief') {
    const brief = await ContentBriefModel.findOne({ _id: source.sourceId, projectId: pid }).lean();
    if (!brief) throw new Error('Content brief not found');
    return {
      sourceType: 'content-brief',
      sourceId: source.sourceId,
      contentBriefId: brief._id,
      pageId: brief.pageId ?? null,
      keywordId: brief.keywordId ?? null,
      title: brief.title,
      description: brief.objective,
      ownerType: brief.ownerType,
      priority: 'P1',
      validationMethod:
        'Re-crawl target page after brief is approved. Target keyword should appear in title + H1.',
      clientVisible: true,
    };
  }
  throw new Error(`Unsupported source type: ${source.sourceType}`);
}
