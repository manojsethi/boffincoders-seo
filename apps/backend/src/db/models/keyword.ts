import { Schema, model, Types } from 'mongoose';

/**
 * Per-project keyword/query record. Doc 6 §"Keyword Model".
 * Source can be manual, GSC import, AI suggestion, or external provider (Phase F+).
 */
const KeywordSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    keyword: { type: String, required: true },
    source: { type: String, enum: ['manual', 'gsc', 'ai', 'import', 'external'], default: 'manual' },
    intent: {
      type: String,
      enum: ['informational', 'commercial', 'transactional', 'navigational', 'local', 'support', 'unknown'],
      default: 'unknown',
    },
    funnelStage: {
      type: String,
      enum: ['TOFU', 'MOFU', 'BOFU', 'retention', 'unknown'],
      default: 'unknown',
    },
    mappedPageId: { type: Types.ObjectId },
    mappedGoalId: { type: String },
    preferredUrl: { type: String },
    rankingUrl: { type: String },
    // Latest GSC metrics for the keyword (when available).
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    // Workflow status for analyst triage.
    status: {
      type: String,
      enum: ['candidate', 'mapped', 'unmapped', 'wrong-page', 'cannibalised', 'no-target-page', 'ignored'],
      default: 'candidate',
    },
    priority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P2' },
    opportunityScore: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { collection: 'keywords', timestamps: true },
);
KeywordSchema.index({ projectId: 1, keyword: 1 }, { unique: true });
KeywordSchema.index({ projectId: 1, status: 1 });
KeywordSchema.index({ projectId: 1, mappedPageId: 1 });

export const KeywordModel = model('Keyword', KeywordSchema);
