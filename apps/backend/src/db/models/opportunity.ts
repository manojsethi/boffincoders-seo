import { Schema, model, Types } from 'mongoose';

/**
 * Persistent opportunity. Doc 6 §"Opportunity Engine".
 * Opportunities are deterministic-rule outputs (GSC/GA4/CWV/audit/page evidence) that are stable
 * across re-generation by canonicalKey.
 */
const OpportunitySchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    canonicalKey: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'quick-win',
        'ctr',
        'content-gap',
        'cannibalization',
        'wrong-page-ranking',
        'internal-link',
        'schema',
        'conversion',
        'performance',
        'eeat-trust',
        'geo-aeo',
      ],
      required: true,
    },
    title: { type: String, required: true },
    pageId: { type: Types.ObjectId },
    pageUrl: { type: String },
    keywordId: { type: Types.ObjectId },
    keyword: { type: String },
    goalId: { type: String },
    evidence: { type: Schema.Types.Mixed, default: {} },
    impactScore: { type: Number, default: 0 },
    effortEstimate: { type: String, default: 'unknown' },
    confidence: { type: Number, default: 0 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },
    priority: { type: Number, default: 0 },
    actionPriority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P2' },
    recommendedAction: { type: String, default: '' },
    sourceRules: { type: [String], default: [] },
    sourceFindings: { type: [Types.ObjectId], default: [] },
    sourceIssueId: { type: Types.ObjectId },
    status: {
      type: String,
      enum: ['open', 'planned', 'in-progress', 'done', 'ignored', 'not-applicable'],
      default: 'open',
    },
    ownerType: {
      type: String,
      enum: ['seo', 'content', 'developer', 'client', 'analyst'],
      default: 'analyst',
    },
    notes: { type: String, default: '' },
    firstSeenAt: { type: Date },
    lastSeenAt: { type: Date },
  },
  { collection: 'opportunities', timestamps: true },
);
OpportunitySchema.index({ projectId: 1, canonicalKey: 1 }, { unique: true });
OpportunitySchema.index({ projectId: 1, status: 1, priority: -1 });
OpportunitySchema.index({ projectId: 1, type: 1 });
OpportunitySchema.index({ projectId: 1, pageId: 1 });

export const OpportunityModel = model('Opportunity', OpportunitySchema);
