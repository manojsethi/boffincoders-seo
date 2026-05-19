import { Schema, model, Types } from 'mongoose';

/**
 * One rule execution result for a page (or site). Doc 11 §"Required Rule Object" +
 * §"Required Rule Result Statuses". Findings are run-bound — Issues persist across runs.
 */
const FindingSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    auditRunId: { type: Types.ObjectId, required: true },
    pageId: { type: Types.ObjectId },

    ruleId: { type: String, required: true },
    ruleVersion: { type: String, default: '1.0.0' },
    ruleName: { type: String },

    // pass | warning | fail | opportunity | not_applicable | not_verified | needs_review
    status: { type: String, required: true },
    severity: { type: String, required: true },
    priority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P2' },

    category: { type: String, required: true },
    layer: { type: String },
    pack: { type: String },

    title: { type: String, required: true },
    observed: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    howToFix: { type: String, default: '' },

    // Structured evidence captured from rule execution (doc 11 §"Evidence Schema")
    evidence: { type: Schema.Types.Mixed, default: {} },
    evidenceSources: { type: [String], default: [] },

    // Numerical + categorical metadata for prioritisation
    confidence: { type: Number, default: 0 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },
    impactScore: { type: Number, default: 0 },
    effortEstimate: { type: String, default: 'unknown' },
    validationMethod: { type: String, default: '' },

    // Reasons for non-applicable / non-verified states (surfaced as data gaps)
    notApplicableReason: { type: String },
    notVerifiedReason: { type: String },
    appliesReason: { type: String },

    // Cross-page grouping (doc 11 §"Cross-Page Rules")
    groupKey: { type: String },
    affectedUrls: { type: [String], default: [] },

    reportVisibility: {
      type: String,
      enum: ['client', 'internal', 'both', 'hidden'],
      default: 'internal',
    },
    ownerHint: {
      type: String,
      enum: ['seo', 'content', 'developer', 'client', 'analyst'],
    },
  },
  { collection: 'findings', timestamps: true },
);
FindingSchema.index({ projectId: 1, auditRunId: 1 });
FindingSchema.index({ projectId: 1, ruleId: 1, status: 1 });
FindingSchema.index({ projectId: 1, auditRunId: 1, status: 1 });
FindingSchema.index({ projectId: 1, groupKey: 1 });

export const FindingModel = model('Finding', FindingSchema);
