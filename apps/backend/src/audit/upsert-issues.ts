import { Types } from 'mongoose';
import { ISSUE_CREATING_STATUSES } from '@boffin/schemas';
import { FindingModel, IssueModel } from '../db';
import { computeActionPriority, computePriorityScore } from './scoring';
import { ACTIVE_LIFECYCLE_STATUSES } from './lifecycle';
import type { AuditRule, Finding } from './types';

/**
 * Persist findings + upsert long-lived Issues. Doc 11 §"Rule Result To Issue Conversion".
 * - `not_applicable` and `not_verified` are persisted as findings but never create issues.
 * - `pass` is persisted (so audit history is complete) but creates no issue.
 * - All other statuses upsert an Issue keyed by canonicalKey.
 */
export async function persistFindings(opts: {
  projectId: Types.ObjectId;
  auditRunId: Types.ObjectId;
  findings: Finding[];
  rules: AuditRule[];
  importantPageIds: Set<string>;
}): Promise<{ findingsInserted: number; issuesUpserted: number }> {
  if (opts.findings.length === 0) return { findingsInserted: 0, issuesUpserted: 0 };
  const rulesById = new Map<string, AuditRule>();
  for (const r of opts.rules) rulesById.set(r.id, r);

  // Persist all non-pass findings (history). Pass findings are not stored as rows (Phase B decision)
  // but are still iterated below for auto-verification.
  const persistable = opts.findings.filter((f) => f.status !== 'pass');
  const findingDocs = persistable.map((f) => ({
    projectId: opts.projectId,
    auditRunId: opts.auditRunId,
    pageId: f.pageId,
    ruleId: f.ruleId,
    ruleVersion: f.ruleVersion,
    ruleName: f.ruleName,
    status: f.status,
    severity: f.severity,
    priority: f.priority,
    category: f.category,
    layer: f.layer,
    pack: f.pack,
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
    validationMethod: f.validationMethod,
    notApplicableReason: f.notApplicableReason,
    notVerifiedReason: f.notVerifiedReason,
    appliesReason: f.appliesReason,
    groupKey: f.groupKey,
    affectedUrls: f.affectedUrls,
    reportVisibility: f.reportVisibility,
    ownerHint: f.ownerHint,
  }));
  const inserted = await FindingModel.insertMany(findingDocs, { ordered: false });

  let upserted = 0;
  for (let i = 0; i < persistable.length; i += 1) {
    const finding = persistable[i]!;
    const findingDoc = inserted[i]!;
    if (!(ISSUE_CREATING_STATUSES as readonly string[]).includes(finding.status)) continue;

    const importantPage = finding.pageId
      ? opts.importantPageIds.has(finding.pageId.toString())
      : false;
    const priorityScore = computePriorityScore(finding, importantPage);
    const actionPriority = computeActionPriority(finding.severity, importantPage, finding.confidence);

    await IssueModel.findOneAndUpdate(
      { projectId: opts.projectId, canonicalKey: finding.canonicalKey },
      {
        $set: {
          ruleId: finding.ruleId,
          ruleVersion: finding.ruleVersion,
          pageId: finding.pageId,
          groupKey: finding.groupKey,
          affectedUrls: finding.affectedUrls,
          affectedPageCount: finding.affectedUrls.length,
          currentFindingId: findingDoc._id,
          lastSeenAuditRunId: opts.auditRunId,
          priority: priorityScore,
          actionPriority,
          impact: finding.impactScore,
          effort: finding.effortEstimate,
          confidence: finding.confidence,
          confidenceLevel: finding.confidenceLevel,
          severity: finding.severity,
          category: finding.category,
          layer: finding.layer,
          title: finding.title,
          latestStatus: finding.status,
        },
        $setOnInsert: {
          projectId: opts.projectId,
          canonicalKey: finding.canonicalKey,
          firstSeenAuditRunId: opts.auditRunId,
          lifecycleStatus: 'open',
        },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  // Doc 11 §"Rules And Reports" + Phase 1 verify flow + raw-vs-rendered evidence:
  // Sync existing issues to the latest finding outcome for their canonicalKey.
  //  - pass        → lifecycle=verified (auto-resolve)
  //  - not_verified → lifecycle=blocked-by-data-gap (NOT an active SEO issue; appears in data gaps)
  //  - not_applicable → lifecycle=not-applicable (rule doesn't apply now)
  // Issues with no matching finding this run are left alone — they weren't re-audited.
  const ACTIVE = ACTIVE_LIFECYCLE_STATUSES;
  for (const finding of opts.findings) {
    if (finding.status === 'pass') {
      await IssueModel.updateOne(
        {
          projectId: opts.projectId,
          canonicalKey: finding.canonicalKey,
          lifecycleStatus: { $in: ACTIVE },
        },
        {
          $set: {
            latestStatus: 'pass',
            lifecycleStatus: 'verified',
            verifiedAt: new Date(),
            verifiedByAuditRunId: opts.auditRunId,
          },
        },
      );
      continue;
    }
    if (finding.status === 'not_verified') {
      await IssueModel.updateOne(
        {
          projectId: opts.projectId,
          canonicalKey: finding.canonicalKey,
          lifecycleStatus: { $in: ACTIVE },
        },
        {
          $set: {
            latestStatus: 'not_verified',
            lifecycleStatus: 'blocked-by-data-gap',
            lastSeenAuditRunId: opts.auditRunId,
          },
        },
      );
      continue;
    }
    if (finding.status === 'not_applicable') {
      await IssueModel.updateOne(
        {
          projectId: opts.projectId,
          canonicalKey: finding.canonicalKey,
          lifecycleStatus: { $in: ACTIVE },
        },
        {
          $set: {
            latestStatus: 'not_applicable',
            lifecycleStatus: 'not-applicable',
            lastSeenAuditRunId: opts.auditRunId,
          },
        },
      );
    }
  }

  return { findingsInserted: inserted.length, issuesUpserted: upserted };
}
