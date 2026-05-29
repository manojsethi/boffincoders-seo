import { Schema, model, type InferSchemaType } from 'mongoose';

const ProjectSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    clientName: { type: String, required: true },
    siteName: { type: String, required: true },
    primaryDomain: { type: String, required: true },
    allowedDomains: { type: [String], default: [] },
    includeSubdomains: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    archivedAt: { type: Date },
    archivedReason: { type: String },
    archivedBy: { type: String }, // reserved for auth phase
    lifecycleState: { type: String, default: 'needs-setup' },

    // Phase A reserves slot. Goals UX lands in Phase E.
    goals: { type: [Schema.Types.Mixed], default: [] },

    // Analyst rule controls (doc 11 §"Analyst Controls"). Phase A reserves slot.
    ruleOverrides: {
      type: new Schema(
        {
          disabledRuleIds: { type: [String], default: [] },
          excludedPagePatterns: { type: [String], default: [] },
          includedPagePatterns: { type: [String], default: [] },
          importantPagePatterns: { type: [String], default: [] },
          intentionallyNonIndexablePatterns: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Doc 04 §"Project-level crawl/render policy". Cheerio default.
    crawlSettings: {
      type: new Schema(
        {
          renderMode: {
            type: String,
            enum: ['cheerio-only', 'cheerio-with-playwright-fallback', 'playwright-only'],
            default: 'cheerio-with-playwright-fallback',
          },
          maxRenderedPages: { type: Number, default: 25 },
          renderTimeoutMs: { type: Number, default: 30000 },
          renderConcurrency: { type: Number, default: 2 },
          // Auto-fallback triggers — when render is needed without analyst action.
          autoRenderImportantPages: { type: Boolean, default: true },
          autoRenderSchemaNotVerified: { type: Boolean, default: false },
          autoRenderJsSuspected: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Phase 11. Project-level toggles for crawl scope; per-rule details live in
    // `CrawlScopeRuleModel`. Defaults keep the feature opt-in friendly: enabled true, sample
    // default 5, AI suggestions require approval.
    crawlScopeSettings: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: true },
          defaultBehavior: { type: String, enum: ['crawl', 'sample'], default: 'crawl' },
          maxSamplePerGroup: { type: Number, default: 5 },
          aiSuggestionsEnabled: { type: Boolean, default: true },
          requireApprovalForAiRules: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    // Phase 12. Onboarding state. Stored on Project to avoid a parallel model. Tracks step
    // progress + lightweight objective + analyst notes. Once `completedAt` is set, the project
    // shell stops gating navigation through onboarding.
    onboardingState: {
      type: new Schema(
        {
          currentStep: { type: Number, default: 1 },
          completedSteps: { type: [Number], default: [] },
          completedAt: { type: Date },
          startedAt: { type: Date, default: () => new Date() },
          // Lightweight objective (later promoted to Goals).
          primaryObjective: { type: String, default: '' },
          secondaryObjectives: { type: [String], default: [] },
          objectiveNotes: { type: String, default: '' },
          // Profile draft fields captured during step 2 (mirror what WebsiteProfile stores).
          websiteType: { type: String, default: '' },
          websiteTypeCustom: { type: String, default: '' },
          websiteDescription: { type: String, default: '' },
          primaryAudience: { type: String, default: '' },
          country: { type: String, default: '' },
          primaryLanguage: { type: String, default: '' },
          // Snapshot of seed-keyword + important-page counts so the review step doesn't refetch.
          seedKeywordCount: { type: Number, default: 0 },
          importantPageCount: { type: Number, default: 0 },
          crawlPreset: {
            type: String,
            enum: ['light', 'standard', 'full', 'custom'],
            default: 'standard',
          },
          maxPages: { type: Number, default: 200 },
          skipIntegrations: { type: Boolean, default: false },
          handleDocuments: {
            type: String,
            enum: ['crawl', 'sample', 'exclude'],
            default: 'sample',
          },
          notes: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    lastCrawledAt: { type: Date },
    lastAuditedAt: { type: Date },
    lastReportedAt: { type: Date },
    nextScheduledRunAt: { type: Date },
  },
  { collection: 'projects', timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof ProjectSchema> & { _id: import('mongoose').Types.ObjectId };
export const ProjectModel = model('Project', ProjectSchema);
