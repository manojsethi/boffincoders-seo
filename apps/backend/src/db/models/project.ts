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

    lastCrawledAt: { type: Date },
    lastAuditedAt: { type: Date },
    lastReportedAt: { type: Date },
    nextScheduledRunAt: { type: Date },
  },
  { collection: 'projects', timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof ProjectSchema> & { _id: import('mongoose').Types.ObjectId };
export const ProjectModel = model('Project', ProjectSchema);
