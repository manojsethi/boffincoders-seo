import { z } from 'zod';

export const LifecycleStateSchema = z.enum([
  'needs-setup',
  'ready-for-first-crawl',
  'crawling',
  'crawl-needs-review',
  'ready-for-initial-audit',
  'auditing',
  'ready-for-ai-analysis',
  'profile-needs-review',
  'active-issues',
  'ready-to-report',
  'monitoring',
  'verification-needed',
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const ProjectStatusSchema = z.enum(['active', 'paused', 'archived']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const RunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'canceled']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const CrawlModeSchema = z.enum(['first', 'full', 'incremental', 'single-url', 'verification']);
export type CrawlMode = z.infer<typeof CrawlModeSchema>;

export const TriggeredBySchema = z.enum(['user', 'schedule', 'system']);
export type TriggeredBy = z.infer<typeof TriggeredBySchema>;

export const WebsiteCategorySchema = z.enum([
  'service-business',
  'saas',
  'ecommerce',
  'ngo',
  'education',
  'publisher',
  'government',
  'healthcare',
  'local-business',
  'marketplace',
  'documentation',
  'community',
  'event',
  'personal-brand',
  'mixed-other',
]);
export type WebsiteCategory = z.infer<typeof WebsiteCategorySchema>;

export const RuleCategorySchema = z.enum([
  'crawl-indexing',
  'metadata',
  'headings',
  'on-page',
  'content-quality',
  'internal-links',
  'site-architecture',
  'structured-data',
  'images',
  'performance',
  'js-rendering',
  'accessibility-seo',
  'security-trust',
  'eeat',
  'aeo',
  'geo',
  'entity-clarity',
  'conversion',
  'gsc-opportunities',
  'ga4-engagement',
  'content-decay',
  'local-seo',
  'international-seo',
  'measurement',
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

/**
 * Strategic layer rules roll up into. Powers project-level layered scores.
 * Doc 11 §"Layer".
 */
export const RuleLayerSchema = z.enum([
  'technical-foundation',
  'content-relevance',
  'trust-entity',
  'search-performance',
  'business-outcomes',
  'ai-visibility',
  'monitoring-drift',
]);
export type RuleLayer = z.infer<typeof RuleLayerSchema>;

/**
 * Rule packs decide which rules run for which project. Doc 11 §"Rule Packs".
 */
export const RulePackSchema = z.enum([
  'core',
  'business-goal',
  'website-type',
  'integration',
  'ai-visibility',
  'monitoring',
]);
export type RulePack = z.infer<typeof RulePackSchema>;

/**
 * Per-rule lifecycle. Doc 11 §"Rule Lifecycle".
 */
export const RuleLifecycleSchema = z.enum([
  'draft',
  'experimental',
  'active',
  'deprecated',
  'disabled',
]);
export type RuleLifecycleStatus = z.infer<typeof RuleLifecycleSchema>;

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Doc 11 §"Required Rule Result Statuses".
 * - pass: rule applies and passes
 * - warning: applies, moderate concern
 * - fail: applies, clear problem
 * - opportunity: no error, meaningful upside
 * - not_applicable: rule does not apply
 * - not_verified: required data missing
 * - needs_review: low confidence, analyst should decide
 */
export const FindingStatusSchema = z.enum([
  'pass',
  'warning',
  'fail',
  'opportunity',
  'not_applicable',
  'not_verified',
  'needs_review',
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

/**
 * Subset of FindingStatus that creates a persistent Issue. Doc 11 §"Rule Result To Issue Conversion".
 */
export const ISSUE_CREATING_STATUSES: readonly FindingStatus[] = [
  'fail',
  'warning',
  'opportunity',
  'needs_review',
];

/**
 * P0/P1/P2 action priority. Doc 11 §"P0 / P1 / P2 Priority Model".
 * Severity is risk; priority is action urgency. They are computed together with goals/data.
 */
export const PrioritySchema = z.enum(['P0', 'P1', 'P2']);
export type Priority = z.infer<typeof PrioritySchema>;

export const IssueLifecycleSchema = z.enum([
  'open',
  'planned',
  'in-progress',
  'fixed-pending-verification',
  'verified',
  'ignored',
  'not-applicable',
  // Doc 11 §"Raw Vs Rendered Evidence" / §"Not Verified" — issue is blocked because a required
  // data source has not been verified yet (e.g. JS-rendered schema). NOT an active SEO issue.
  'blocked-by-data-gap',
]);
export type IssueLifecycle = z.infer<typeof IssueLifecycleSchema>;

export const OwnerTypeSchema = z.enum(['seo', 'content', 'developer', 'client', 'analyst']);
export type OwnerType = z.infer<typeof OwnerTypeSchema>;

export const ReportTypeSchema = z.enum([
  'initial-audit',
  'weekly-progress',
  'monthly-progress',
  'verification',
  'internal',
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportStatusSchema = z.enum(['draft', 'ready', 'exported', 'sent']);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ScheduleTypeSchema = z.enum(['crawl', 'audit', 'report', 'integration-sync']);
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;

export const CadenceSchema = z.enum(['weekly', 'monthly', 'custom']);
export type Cadence = z.infer<typeof CadenceSchema>;

export const ReportVisibilitySchema = z.enum(['client', 'internal', 'both', 'hidden']);
export type ReportVisibility = z.infer<typeof ReportVisibilitySchema>;

export const EffortEstimateSchema = z.enum(['trivial', 'small', 'medium', 'large', 'unknown']);
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>;

/**
 * Confidence buckets used by AI-assisted findings + role inference. Doc 11 §"Confidence".
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * How a page role was inferred. Affects rule applicability + needs_review behaviour.
 */
export const RoleInferenceSourceSchema = z.enum(['heuristic', 'ai', 'analyst']);
export type RoleInferenceSource = z.infer<typeof RoleInferenceSourceSchema>;

/**
 * Why an applicability check returned not_applicable. Surfaced in UI per doc 11.
 */
export const NotApplicableReasonSchema = z.enum([
  'page-role-mismatch',
  'website-type-mismatch',
  'page-pattern-excluded',
  'page-intentionally-non-indexable',
  'page-low-importance',
  'analyst-disabled',
  'other',
]);
export type NotApplicableReason = z.infer<typeof NotApplicableReasonSchema>;

/**
 * Why a finding is not_verified — i.e., which data source is missing.
 */
export const NotVerifiedReasonSchema = z.enum([
  'gsc-not-connected',
  'ga4-not-connected',
  'cwv-unavailable',
  'backlinks-not-connected',
  'citations-not-connected',
  'ai-visibility-not-tracked',
  'rendered-html-missing',
  'markdown-missing',
  'crawl-incomplete',
  'schema-not-verified',
  'other',
]);
export type NotVerifiedReason = z.infer<typeof NotVerifiedReasonSchema>;

/**
 * Source for extracted JSON-LD / schema evidence. Doc 11 §"Raw Vs Rendered Evidence".
 */
export const SchemaSourceSchema = z.enum([
  'raw-html',
  'rendered-html',
  'both',
  'none',
  'not-verified',
]);
export type SchemaSource = z.infer<typeof SchemaSourceSchema>;

/**
 * Layered scores produced by audit. Doc 11 §"Scoring Model".
 */
export const LayeredScoreKeySchema = z.enum([
  'technical-foundation',
  'content-relevance',
  'trust-entity',
  'search-performance',
  'conversion-readiness',
  'ai-visibility',
  'integration-health',
]);
export type LayeredScoreKey = z.infer<typeof LayeredScoreKeySchema>;
