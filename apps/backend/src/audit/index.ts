export { runAudit, type RunAuditOptions, type RunAuditResult } from './runner';
export { defaultRegistry, allRules } from './registry';
export { loadSiteContext } from './load-site-context';
export { persistFindings } from './upsert-issues';
export {
  APPLIES,
  buildCanonicalKey,
  checkRequiredInputs,
  firstBlocking,
  isImportantPage,
  needsReview,
  notApplicable,
  notVerified,
  pageRoleApplies,
  pageRoleConfidenceIsLow,
} from './applicability';
export {
  buildDataGaps,
  computeActionPriority,
  computeLayeredScores,
  computePriorityScore,
  emptyLayeredScores,
  layerToScoreKey,
  type DataGap,
  type LayeredScore,
} from './scoring';
export type {
  Applicability,
  AuditRule,
  EvaluationStatus,
  EvidenceSource,
  Finding,
  FindingDraft,
  PageRuleContext,
  PageView,
  ProjectGoals,
  RequiredInput,
  RuleRegistry,
  SiteContext,
  SiteRuleContext,
} from './types';
