import { Types } from 'mongoose';
import { AuditRunModel, FindingModel, IssueModel } from '../db';
import { getLogger } from '../config/logger';
import type { FindingStatus, NotApplicableReason, NotVerifiedReason } from '@boffin/schemas';
import { buildCanonicalKey, checkRequiredInputs } from './applicability';
import { defaultRegistry } from './registry';
import { loadSiteContext } from './load-site-context';
import { persistFindings } from './upsert-issues';
import { buildDataGaps, computeLayeredScores } from './scoring';
import type {
  Applicability,
  AuditRule,
  Finding,
  FindingDraft,
  PageRuleContext,
  SiteRuleContext,
} from './types';

const log = getLogger('audit:runner');

export type RunAuditOptions = {
  projectId: string;
  auditRunId: string;
  crawlRunId: string;
};

export type RunAuditResult = {
  pagesAudited: number;
  rulesEvaluated: number;
  findings: number;
  issues: number;
  dataGapCount: number;
};

export async function runAudit(opts: RunAuditOptions): Promise<RunAuditResult> {
  await reportProgress(opts.auditRunId, 5, 'loading site context');
  const site = await loadSiteContext(opts);
  const registry = defaultRegistry();

  // Clear prior run's findings before re-inserting? No — findings are run-bound by auditRunId
  // and historical comparisons need them preserved. Only Issues get upserted.

  // Pre-compute important page set for priority calculations
  const importantPageIds = new Set<string>();
  for (const p of site.pages) if (p.isImportant) importantPageIds.add(p._id.toString());

  await reportProgress(opts.auditRunId, 20, 'running rule applicability');
  const findings: Finding[] = [];

  // Disabled rules (analyst overrides). Doc 11 §"Analyst Controls".
  const disabledSet = new Set(site.ruleOverrides.disabledRuleIds);

  for (const rule of registry.rules) {
    if (disabledSet.has(rule.id)) continue;
    if (rule.scope === 'page') {
      for (const page of site.pages) {
        const ctx: PageRuleContext = { page, site };
        const result = evaluatePageRule(rule, ctx);
        if (result) findings.push(buildFinding(rule, result, page._id));
      }
    } else {
      const ctx: SiteRuleContext = { site };
      const results = evaluateSiteRule(rule, ctx);
      for (const r of results) findings.push(buildFinding(rule, r));
    }
  }

  // Doc 11 + Phase B decisions:
  // - skip persisting `pass` findings; only counts go into AuditRun.statusCounts
  // - experimental rules do not produce issues + do not affect layered scores
  const statusCounts = countByStatus(findings);
  const severityCounts = countBySeverity(findings);
  const experimentalRuleIds = new Set(
    registry.rules.filter((r) => r.lifecycle === 'experimental').map((r) => r.id),
  );
  // Keep pass findings in the array — persistFindings drops them from inserts but uses them for
  // issue auto-verification (Doc 11 §"Rule Result To Issue Conversion" + re-audit verify flow).
  const persistable = findings.filter((f) => !experimentalRuleIds.has(f.ruleId));
  const experimentalFindings = findings.filter((f) => experimentalRuleIds.has(f.ruleId));

  await reportProgress(opts.auditRunId, 70, 'persisting findings');
  const persisted = await persistFindings({
    projectId: site.projectId,
    auditRunId: new Types.ObjectId(opts.auditRunId),
    findings: persistable,
    rules: registry.rules,
    importantPageIds,
  });

  // Scoring excludes experimental rule findings (still uses pass/applies semantics from full set).
  const scoringFindings = findings.filter((f) => !experimentalRuleIds.has(f.ruleId));
  const layeredScores = computeLayeredScores(scoringFindings, registry.rules.filter((r) => r.lifecycle !== 'experimental'));
  const dataGaps = buildDataGaps(scoringFindings);
  const experimentalCounts = countByStatus(experimentalFindings);

  await AuditRunModel.updateOne(
    { _id: new Types.ObjectId(opts.auditRunId) },
    {
      $set: {
        pagesAudited: site.pages.length,
        rulesEvaluated: registry.rules.length,
        findingsCreated: persisted.findingsInserted,
        issuesUpserted: persisted.issuesUpserted,
        dataGapCount: dataGaps.length,
        sourcesUsed: collectSourcesUsed(findings),
        statusCounts,
        severityCounts,
        experimentalCounts,
        layeredScores,
        dataGaps,
      },
    },
  );

  await reportProgress(opts.auditRunId, 100, 'audit complete');
  log.info(
    {
      projectId: opts.projectId,
      pages: site.pages.length,
      rules: registry.rules.length,
      findings: persisted.findingsInserted,
      issues: persisted.issuesUpserted,
      dataGaps: dataGaps.length,
    },
    'audit finished',
  );

  return {
    pagesAudited: site.pages.length,
    rulesEvaluated: registry.rules.length,
    findings: persisted.findingsInserted,
    issues: persisted.issuesUpserted,
    dataGapCount: dataGaps.length,
  };
}

function evaluatePageRule(
  rule: Extract<AuditRule, { scope: 'page' }>,
  ctx: PageRuleContext,
): FindingDraft | null {
  const apps = normaliseApplicability(rule.appliesTo(ctx));
  const blocking = apps.find((a) => a.kind !== 'applies');
  const inputCheck = checkRequiredInputs(rule, ctx);
  const earlyExit = blocking ?? inputCheck;
  if (earlyExit && earlyExit.kind !== 'applies') {
    return applicabilityToDraft(rule, earlyExit);
  }
  try {
    return rule.evaluatePage(ctx);
  } catch (err) {
    log.warn({ err, ruleId: rule.id }, 'page rule evaluation error');
    return null;
  }
}

function evaluateSiteRule(
  rule: Extract<AuditRule, { scope: 'site' }>,
  ctx: SiteRuleContext,
): FindingDraft[] {
  const apps = normaliseApplicability(rule.appliesTo(ctx));
  const blocking = apps.find((a) => a.kind !== 'applies');
  const inputCheck = checkRequiredInputs(rule, ctx);
  const earlyExit = blocking ?? inputCheck;
  if (earlyExit && earlyExit.kind !== 'applies') {
    const draft = applicabilityToDraft(rule, earlyExit);
    return draft ? [draft] : [];
  }
  try {
    return rule.evaluateSite(ctx);
  } catch (err) {
    log.warn({ err, ruleId: rule.id }, 'site rule evaluation error');
    return [];
  }
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
  // needs_review
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
  const canonicalKey = draft.canonicalKey ?? buildCanonicalKey({
    ruleId: rule.id,
    pageId: pid,
    groupKey: draft.groupKey,
  });
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
    validationMethod: draft.validationMethod ?? rule.defaultValidationMethod ?? defaultValidationFor(rule, draft),
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

function countByStatus(findings: Finding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) out[f.status] = (out[f.status] ?? 0) + 1;
  return out;
}

/**
 * Sensible default validation method when rule + draft don't specify one. Doc 11 §"Validation Requirements".
 */
function defaultValidationFor(rule: AuditRule, draft: FindingDraft): string {
  const sources = new Set(draft.evidenceSources ?? []);
  if (sources.has('rendered-html')) return 'Render this page again + re-audit; confirm the rendered evidence updated.';
  if (sources.has('gsc')) return 'Sync Google Search Console + re-audit; verify the GSC metric returned to a healthy range.';
  if (sources.has('ga4')) return 'Sync GA4 + re-audit; confirm the engagement/conversion metric updated.';
  if (sources.has('cwv')) return 'Wait for fresh CrUX data (28-day rolling) + re-run the audit.';
  if (rule.category === 'structured-data') {
    return 'Validate JSON-LD in https://search.google.com/test/rich-results then re-audit.';
  }
  if (rule.category === 'performance') return 'Run PageSpeed Insights on the page; confirm CWV pass.';
  if (rule.category === 'security-trust') return 'Re-crawl the page; confirm HTTPS + headers from the response.';
  if (rule.scope === 'site') return 'Re-crawl the site + re-audit; confirm the cross-page issue no longer fires.';
  return 'Re-crawl this URL + re-audit; confirm the finding has cleared.';
}

function countBySeverity(findings: Finding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) {
    if (f.status === 'pass' || f.status === 'not_applicable' || f.status === 'not_verified') continue;
    out[f.severity] = (out[f.severity] ?? 0) + 1;
  }
  return out;
}

function collectSourcesUsed(findings: Finding[]): string[] {
  const set = new Set<string>(['crawl']);
  for (const f of findings) for (const s of f.evidenceSources) set.add(s);
  return [...set];
}

async function reportProgress(auditRunId: string, pct: number, step: string): Promise<void> {
  await AuditRunModel.updateOne(
    { _id: new Types.ObjectId(auditRunId) },
    { $set: { progressPercent: pct, currentStep: step } },
  );
}

// Re-exports for potential callers (kept previously)
export { FindingModel, IssueModel };
