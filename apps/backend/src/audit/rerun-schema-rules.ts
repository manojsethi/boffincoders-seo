import { Types } from 'mongoose';
import { AuditRunModel, FindingModel } from '../db';
import { defaultRegistry } from './registry';
import { loadSiteContext } from './load-site-context';
import { persistFindings } from './upsert-issues';
import { renderSensitiveRuleIds } from './rules/structured-data';
import { buildCanonicalKey, checkRequiredInputs } from './applicability';
import { buildDataGaps, computeLayeredScores } from './scoring';
import type {
  Applicability,
  AuditRule,
  Finding,
  FindingDraft,
  PageRuleContext,
} from './types';
import type { FindingStatus, NotApplicableReason, NotVerifiedReason } from '@boffin/schemas';

/**
 * After a rendered recrawl, re-evaluate render-sensitive rules for the affected pages and
 * upsert issues against the most recent audit run. New findings preserve audit history.
 */
export async function rerunSchemaRulesForPages(opts: {
  projectId: string;
  pageIds: string[];
}): Promise<{ findingsInserted: number; issuesUpserted: number; rulesRun: number; pages: number }> {
  // Pick the most recent audit run for this project so we attach findings to a real run.
  const latestAudit = await AuditRunModel.findOne({
    projectId: new Types.ObjectId(opts.projectId),
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!latestAudit) return { findingsInserted: 0, issuesUpserted: 0, rulesRun: 0, pages: 0 };

  const site = await loadSiteContext({
    projectId: opts.projectId,
    auditRunId: String(latestAudit._id),
    crawlRunId: String(latestAudit.crawlRunId),
  });
  const registry = defaultRegistry();

  const targetPageIds = new Set(opts.pageIds);
  const pagesToRun = site.pages.filter((p) => targetPageIds.has(String(p._id)));
  const rules = registry.rules.filter(
    (r) => renderSensitiveRuleIds.has(r.id) && r.scope === 'page',
  );

  const importantPageIds = new Set<string>();
  for (const p of site.pages) if (p.isImportant) importantPageIds.add(p._id.toString());

  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.scope !== 'page') continue;
    for (const page of pagesToRun) {
      const ctx: PageRuleContext = { page, site };
      const apps = normaliseApplicability(rule.appliesTo(ctx));
      const blocking = apps.find((a) => a.kind !== 'applies');
      const inputCheck = checkRequiredInputs(rule, ctx);
      const earlyExit = blocking ?? inputCheck;
      let draft: FindingDraft | null = null;
      if (earlyExit && earlyExit.kind !== 'applies') {
        draft = applicabilityToDraft(rule, earlyExit);
      } else {
        try {
          draft = rule.evaluatePage(ctx);
        } catch {
          draft = null;
        }
      }
      if (!draft) continue;
      findings.push(buildFinding(rule, draft, page._id));
    }
  }

  // Pass findings stay in the list so issue auto-verification fires in persistFindings.
  const persistable = findings;
  const auditRunObjectId = new Types.ObjectId(String(latestAudit._id));

  // Replace prior schema-rule findings for these pages so re-run reflects current state
  // (Doc 11: rerender is the new authoritative read, not an additional one).
  const ruleIdList = [...renderSensitiveRuleIds];
  const pageObjectIds = pagesToRun.map((p) => p._id);
  await FindingModel.deleteMany({
    projectId: site.projectId,
    auditRunId: auditRunObjectId,
    ruleId: { $in: ruleIdList },
    pageId: { $in: pageObjectIds },
  });

  const result = await persistFindings({
    projectId: site.projectId,
    auditRunId: auditRunObjectId,
    findings: persistable,
    rules: registry.rules,
    importantPageIds,
  });

  // Refresh AuditRun summary so Overview / data gaps reflect post-render state.
  // Pull every finding on this run (latest persisted set), recompute counts + layered scores + gaps.
  const allFindings = await FindingModel.find({
    projectId: site.projectId,
    auditRunId: auditRunObjectId,
  }).lean();
  const experimentalRuleIds = new Set(
    registry.rules.filter((r) => r.lifecycle === 'experimental').map((r) => r.id),
  );
  const scoringFindings = allFindings
    .filter((f) => !experimentalRuleIds.has(f.ruleId as string))
    .map((f) => f as unknown as Parameters<typeof computeLayeredScores>[0][number]);
  const statusCounts: Record<string, number> = {};
  const severityCounts: Record<string, number> = {};
  for (const f of allFindings) {
    const status = f.status as string;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (status === 'pass' || status === 'not_applicable' || status === 'not_verified') continue;
    const sev = f.severity as string;
    severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
  }
  const layeredScores = computeLayeredScores(
    scoringFindings,
    registry.rules.filter((r) => r.lifecycle !== 'experimental'),
  );
  const dataGaps = buildDataGaps(scoringFindings);

  await AuditRunModel.updateOne(
    { _id: auditRunObjectId },
    {
      $set: {
        statusCounts,
        severityCounts,
        layeredScores,
        dataGaps,
        dataGapCount: dataGaps.length,
      },
    },
  );

  return {
    findingsInserted: result.findingsInserted,
    issuesUpserted: result.issuesUpserted,
    rulesRun: rules.length,
    pages: pagesToRun.length,
  };
}

function normaliseApplicability(a: Applicability | Applicability[]): Applicability[] {
  return Array.isArray(a) ? a : [a];
}

function applicabilityToDraft(rule: AuditRule, a: Applicability): FindingDraft | null {
  if (a.kind === 'applies') return null;
  if (a.kind === 'not_applicable') {
    return {
      status: 'not_applicable',
      severity: 'info',
      title: rule.name,
      notApplicableReason: a.reason as NotApplicableReason,
      observed: a.detail ?? '',
    };
  }
  if (a.kind === 'not_verified') {
    return {
      status: 'not_verified',
      severity: 'info',
      title: rule.name,
      notVerifiedReason: a.reason as NotVerifiedReason,
      observed: a.detail ?? '',
    };
  }
  return {
    status: 'needs_review',
    severity: 'low',
    title: rule.name,
    needsReviewReason: a.detail,
    observed: a.detail,
  };
}

function buildFinding(rule: AuditRule, draft: FindingDraft, pageId?: Types.ObjectId): Finding {
  const pid = draft.pageId ?? pageId;
  const canonicalKey =
    draft.canonicalKey ??
    buildCanonicalKey({ ruleId: rule.id, pageId: pid, groupKey: draft.groupKey });
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    ruleName: rule.name,
    category: rule.category,
    layer: rule.layer,
    pack: rule.pack,
    status: draft.status as FindingStatus,
    severity: draft.severity,
    priority: draft.priority ?? 'P2',
    title: draft.title,
    observed: draft.observed ?? '',
    whyItMatters: draft.whyItMatters ?? rule.whyItMatters,
    recommendation: draft.recommendation ?? rule.recommendationTemplate,
    howToFix: draft.howToFix ?? '',
    evidence: draft.evidence ?? {},
    evidenceSources: draft.evidenceSources ?? [],
    confidence: draft.confidence ?? 1,
    confidenceLevel: draft.confidenceLevel,
    impactScore: draft.impactScore ?? rule.defaultImpact,
    effortEstimate: draft.effortEstimate ?? rule.defaultEffort,
    validationMethod: draft.validationMethod ?? rule.defaultValidationMethod,
    reportVisibility: draft.reportVisibility ?? rule.reportVisibility,
    ownerHint: rule.ownerHint,
    pageId: pid,
    affectedUrls: draft.affectedUrls ?? [],
    groupKey: draft.groupKey,
    canonicalKey,
    appliesReason: undefined,
    notApplicableReason: draft.notApplicableReason,
    notVerifiedReason: draft.notVerifiedReason,
    needsReviewReason: draft.needsReviewReason,
  };
}
