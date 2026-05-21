import { Schema, model, Types } from 'mongoose';

/**
 * Crawl scope rule. Phase 11.
 *
 * Drives which URLs get fetched fully, sampled, or excluded for a project. Stored as a separate
 * collection (not embedded on Project) so we keep history, AI-suggested rules can sit in a
 * pending state, and rules can be approved/edited/rejected independently.
 *
 * Pattern types:
 *  - 'glob'   — `/blog/**`, `/products/*`, `?utm_*` style
 *  - 'prefix' — startsWith match on pathname
 *  - 'regex'  — anchored regex against pathname (use only when glob can't express it)
 *
 * Behaviors:
 *  - 'crawl'         — full crawl every match
 *  - 'sample'        — pick `sampleLimit` representative URLs per group
 *  - 'exclude'       — never fetch
 *  - 'force_include' — overrides sample/exclude (analyst-pinned URLs)
 *  - 'normalize'     — canonicalize matched query params before dedupe
 */

const CrawlScopeRuleSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    pattern: { type: String, required: true },
    patternType: {
      type: String,
      enum: ['glob', 'prefix', 'regex'],
      default: 'glob',
    },
    behavior: {
      type: String,
      enum: ['crawl', 'sample', 'exclude', 'force_include', 'normalize'],
      required: true,
    },
    sampleLimit: { type: Number, default: 5 },
    priority: { type: Number, default: 50 }, // higher beats lower; force_include uses high priority
    groupName: { type: String, default: '' },
    pageFamily: { type: String, default: '' },
    reason: { type: String, default: '' },
    source: {
      type: String,
      enum: ['system', 'heuristic', 'ai', 'analyst'],
      default: 'system',
    },
    confidence: { type: Number, default: 0.8 },
    status: {
      type: String,
      enum: ['suggested', 'approved', 'rejected', 'disabled'],
      default: 'approved',
    },
    // Normalize-only: list of query params to strip when this rule's pattern matches.
    normalizeStripParams: { type: [String], default: [] },
    // AI bookkeeping
    aiTaskRunId: { type: Types.ObjectId },
    suggestionWarning: { type: String, default: '' },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectedReason: { type: String, default: '' },
  },
  { collection: 'crawl_scope_rules', timestamps: true },
);
CrawlScopeRuleSchema.index({ projectId: 1, status: 1, priority: -1 });
CrawlScopeRuleSchema.index({ projectId: 1, source: 1 });

export const CrawlScopeRuleModel = model('CrawlScopeRule', CrawlScopeRuleSchema);
