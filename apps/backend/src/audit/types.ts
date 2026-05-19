import type {
  ConfidenceLevel,
  EffortEstimate,
  FindingStatus,
  Goal,
  LayeredScoreKey,
  NotApplicableReason,
  NotVerifiedReason,
  Priority,
  ReportVisibility,
  RoleInferenceSource,
  RuleCategory,
  RuleLayer,
  RuleLifecycleStatus,
  RulePack,
  SchemaSource,
  Severity,
  WebsiteCategory,
} from '@boffin/schemas';
import type { Types } from 'mongoose';

export type EvidenceSource =
  | 'crawl'
  | 'rendered-html'
  | 'page-content'
  | 'page-snapshot'
  | 'internal-links'
  | 'sitemap'
  | 'robots'
  | 'gsc'
  | 'ga4'
  | 'cwv'
  | 'analyst-config'
  | 'ai-inference';

/**
 * Project goals passed into rule applicability/priority. Phase A reserves; Phase E populates.
 */
export type ProjectGoals = Goal[];

export type PageView = {
  _id: Types.ObjectId;
  url: string;
  normalizedUrl: string;
  statusCode?: number;
  indexability?: string;
  canonicalUrl?: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  lang?: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  headings: Array<{ level: number; text: string }>;
  schema: Array<Record<string, unknown>>;
  // Doc 11 §"Raw Vs Rendered Evidence"
  schemaSource: SchemaSource;
  schemaTypes: string[];
  rawSchema: Array<Record<string, unknown>>;
  renderedSchema: Array<Record<string, unknown>>;
  schemaParseErrors: string[];
  renderedExtractedAt?: Date;
  renderedRecrawlReason?: string;
  images: Array<{ src: string; alt?: string }>;
  internalLinksOut: string[];
  internalLinksIn: number;
  pageRole: string;
  pageSubtype?: string;
  contentHash?: string;
  cleanText: string;
  markdown: string;
  wordCount: number;

  // Phase A additions for applicability
  roleConfidence: number;
  roleConfidenceLevel?: ConfidenceLevel;
  roleSource: RoleInferenceSource;
  isImportant: boolean;
  isIntentionallyNonIndexable: boolean;

  // Phase D integration metrics (optional). Populated by loadSiteContext when sources connected.
  gsc?: { clicks: number; impressions: number; ctr: number; position: number };
  ga4?: { sessions: number; engagedSessions: number; engagementRate: number; conversions: number };
  cwv?: { lcp?: number; inp?: number; cls?: number; performanceScore?: number; capturedAt: Date };
};

export type SiteContext = {
  projectId: Types.ObjectId;
  auditRunId: Types.ObjectId;
  primaryDomain: string;
  websiteCategory?: WebsiteCategory;
  websiteCategoryApproved: boolean;
  goals: ProjectGoals;

  pages: PageView[];
  duplicateTitles: Map<string, string[]>;
  duplicateMetas: Map<string, string[]>;
  incomingLinkCount: Map<string, number>;
  sitemapAvailable: boolean;
  robotsAvailable: boolean;

  sourcesAvailable: {
    gsc: boolean;
    ga4: boolean;
    cwv: boolean;
    backlinks: boolean;
    citations: boolean;
    aiVisibility: boolean;
    renderedHtml: boolean;
  };

  ruleOverrides: {
    disabledRuleIds: string[];
    excludedPagePatterns: string[];
    includedPagePatterns: string[];
    importantPagePatterns: string[];
    intentionallyNonIndexablePatterns: string[];
  };
};

export type PageRuleContext = { page: PageView; site: SiteContext };
export type SiteRuleContext = { site: SiteContext };

/**
 * Doc 11 §"Required Rule Result Statuses". Applicability returns Applicable | NotApplicable | NotVerified
 * before evaluate runs. evaluate then returns one of the evaluation statuses.
 */
export type Applicability =
  | { kind: 'applies'; reason?: string }
  | { kind: 'not_applicable'; reason: NotApplicableReason; detail?: string }
  | { kind: 'not_verified'; reason: NotVerifiedReason; detail?: string }
  | { kind: 'needs_review'; detail: string };

/**
 * Output of a rule's evaluate() call. Engine may transform `applies` + this into a Finding.
 * Statuses `not_applicable` and `not_verified` are typically returned from applicability,
 * not evaluate — but evaluate may also bail out into them if mid-run data is missing.
 */
export type EvaluationStatus =
  | 'pass'
  | 'warning'
  | 'fail'
  | 'opportunity'
  | 'not_applicable'
  | 'not_verified'
  | 'needs_review';

export type FindingDraft = {
  status: EvaluationStatus;
  severity: Severity;
  title: string;
  observed?: string;
  whyItMatters?: string;
  recommendation?: string;
  howToFix?: string;
  evidence?: Record<string, unknown>;
  evidenceSources?: EvidenceSource[];
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  impactScore?: number;
  effortEstimate?: EffortEstimate;
  /**
   * How an analyst confirms the fix. Doc 11 §"Validation Requirements".
   * Examples: "Re-crawl + re-audit", "Render this page + re-audit", "Validate JSON-LD in Rich Results Test",
   * "Run PageSpeed Insights", "Reconnect GSC + sync".
   */
  validationMethod?: string;
  reportVisibility?: ReportVisibility;
  /** Page-level findings should set pageId; cross-page findings set affectedUrls + groupKey */
  pageId?: Types.ObjectId;
  affectedUrls?: string[];
  groupKey?: string;
  /** Engine fills these from rule definition if omitted */
  canonicalKey?: string;
  /** P0/P1/P2 hint; engine computes if omitted */
  priority?: Priority;
  notApplicableReason?: NotApplicableReason;
  notVerifiedReason?: NotVerifiedReason;
  /** When status === needs_review, render this for analyst */
  needsReviewReason?: string;
};

/**
 * Doc 11 §"Required Rule Object". Discriminated by `scope`.
 */
type RuleBase = {
  id: string;
  /** SemVer-style; bump when scoring/applicability semantics change */
  version: string;
  name: string;
  category: RuleCategory;
  layer: RuleLayer;
  pack: RulePack;
  /** Maps issues from this rule to a layered score. */
  scoresInto: LayeredScoreKey;
  description: string;
  whyItMatters: string;
  recommendationTemplate: string;
  defaultSeverity: Severity;
  defaultImpact: number;
  defaultEffort: EffortEstimate;
  /** Default validation method analyst follows to confirm the fix. */
  defaultValidationMethod?: string;
  reportVisibility: ReportVisibility;
  ownerHint?: 'seo' | 'content' | 'developer' | 'client' | 'analyst';
  lifecycle: RuleLifecycleStatus;
  /** Required upstream data. Engine returns not_verified if missing. */
  requiredInputs: ReadonlyArray<RequiredInput>;
  optionalInputs?: ReadonlyArray<RequiredInput>;
};

export type PageAuditRule = RuleBase & {
  scope: 'page';
  appliesTo: (ctx: PageRuleContext) => Applicability | Applicability[];
  evaluatePage: (ctx: PageRuleContext) => FindingDraft | null;
};

export type SiteAuditRule = RuleBase & {
  scope: 'site';
  appliesTo: (ctx: SiteRuleContext) => Applicability | Applicability[];
  evaluateSite: (ctx: SiteRuleContext) => FindingDraft[];
};

export type AuditRule = PageAuditRule | SiteAuditRule;

export type RequiredInput =
  | 'page.html'
  | 'page.rendered-html'
  | 'page.markdown'
  | 'page.headers'
  | 'page.status'
  | 'page.robots-meta'
  | 'page.headings'
  | 'page.schema'
  | 'page.internal-links'
  | 'page.images'
  | 'site.sitemap'
  | 'site.robots'
  | 'integration.gsc'
  | 'integration.ga4'
  | 'integration.cwv'
  | 'integration.backlinks'
  | 'integration.citations'
  | 'integration.ai-visibility'
  | 'project.goals'
  | 'project.websiteCategory';

export type RuleRegistry = {
  rules: AuditRule[];
  /** Lookup by id for quick override checks */
  byId: Map<string, AuditRule>;
};

/**
 * Finding as persisted. Build by combining FindingDraft + rule metadata.
 */
export type Finding = {
  ruleId: string;
  ruleVersion: string;
  ruleName: string;
  category: RuleCategory;
  layer: RuleLayer;
  pack: RulePack;
  status: FindingStatus;
  severity: Severity;
  priority: Priority;
  title: string;
  observed: string;
  whyItMatters: string;
  recommendation: string;
  howToFix: string;
  evidence: Record<string, unknown>;
  evidenceSources: EvidenceSource[];
  confidence: number;
  confidenceLevel?: ConfidenceLevel;
  impactScore: number;
  effortEstimate: EffortEstimate;
  validationMethod?: string;
  reportVisibility: ReportVisibility;
  ownerHint?: 'seo' | 'content' | 'developer' | 'client' | 'analyst';
  pageId?: Types.ObjectId;
  affectedUrls: string[];
  groupKey?: string;
  canonicalKey: string;
  appliesReason?: string;
  notApplicableReason?: NotApplicableReason;
  notVerifiedReason?: NotVerifiedReason;
  needsReviewReason?: string;
};
