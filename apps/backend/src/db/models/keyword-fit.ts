import { Schema, model, Types } from 'mongoose';

/**
 * Persistent keyword/page fit verdict. Doc continuation §"Phase 3" + recommendation-engine §05.
 *
 * One row per (project, keyword, mappedPage|rankingPage). Re-computed deterministically from GSC
 * metrics + page metadata; analyst notes survive recompute.
 */
const KeywordFitSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    keywordId: { type: Types.ObjectId, required: true, index: true },
    keyword: { type: String, required: true },

    // Either or both may be present. If they differ, that's a wrong_page_ranking signal.
    mappedPageId: { type: Types.ObjectId },
    rankingPageId: { type: Types.ObjectId },
    rankingUrl: { type: String },

    intent: { type: String, default: 'unknown' },
    funnelStage: { type: String, default: 'unknown' },

    verdict: {
      type: String,
      enum: [
        'good_fit',
        'needs_minor_update',
        'must_improve',
        'wrong_page_ranking',
        'cannibalized',
        'create_new_page',
        'needs_target_mapping',
        'merge_or_redirect',
        'do_not_target',
        'monitor',
      ],
      default: 'monitor',
    },
    confidence: { type: Number, default: 0.5 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },

    rootCauseSummary: { type: String, default: '' },
    evidence: { type: Schema.Types.Mixed, default: {} },
    recommendedActions: { type: [String], default: [] },

    // Latest GSC snapshot when last computed.
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    competingPageCount: { type: Number, default: 1 },

    analystNotes: { type: String, default: '' },
    lastAnalyzedAt: { type: Date },
  },
  { collection: 'keyword_fits', timestamps: true },
);
KeywordFitSchema.index({ projectId: 1, keywordId: 1 }, { unique: true });
KeywordFitSchema.index({ projectId: 1, verdict: 1 });

export const KeywordFitModel = model('KeywordFit', KeywordFitSchema);
