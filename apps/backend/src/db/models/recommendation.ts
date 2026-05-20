import { Schema, model, Types } from 'mongoose';

/**
 * Recommendation. Doc continuation §"Phase 2 Issue Recommendations" + recommendation-engine §03.
 *
 * Always anchored to existing objects (issues / findings / pages / opportunities / keywords / goals)
 * — no parallel recommendation system. Stable `sourceKey` lets generators idempotently update an
 * existing draft instead of duplicating on every audit run.
 */
const RecommendationSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    sourceKey: { type: String, required: true },

    type: {
      type: String,
      enum: [
        'technical',
        'content',
        'keyword',
        'internal-link',
        'schema',
        'conversion',
        'performance',
        'eeat-trust',
        'crawlability',
        'indexing',
        'other',
      ],
      required: true,
    },

    status: {
      type: String,
      enum: [
        'draft',
        'proposed',
        'approved',
        'planned',
        'in_progress',
        'implemented',
        'verified',
        'rejected',
      ],
      default: 'draft',
    },
    verdict: {
      type: String,
      enum: ['must_change', 'should_improve', 'consider', 'monitor', 'no_action'],
      default: 'should_improve',
    },

    title: { type: String, required: true },
    rootCauseSummary: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    recommendedAction: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },

    evidence: { type: Schema.Types.Mixed, default: {} },

    expectedImpact: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    effort: { type: String, enum: ['trivial', 'small', 'medium', 'large', 'unknown'], default: 'unknown' },
    priorityScore: { type: Number, default: 0 },
    confidence: { type: Number, default: 0.7 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },

    ownerType: {
      type: String,
      enum: ['seo', 'content', 'developer', 'client', 'analyst'],
      default: 'analyst',
    },
    assignedToUserId: { type: String },
    dueDate: { type: Date },

    validationMethod: { type: String, default: '' },
    validatedAt: { type: Date },

    source: {
      type: String,
      enum: ['rule', 'ai', 'gsc', 'ga4', 'cwv', 'analyst', 'mixed'],
      default: 'rule',
    },
    sourceFindingIds: { type: [Types.ObjectId], default: [] },
    sourceIssueIds: { type: [Types.ObjectId], default: [] },
    sourceOpportunityIds: { type: [Types.ObjectId], default: [] },
    pageIds: { type: [Types.ObjectId], default: [] },
    keywordIds: { type: [Types.ObjectId], default: [] },
    goalIds: { type: [String], default: [] },

    reportVisibility: {
      type: String,
      enum: ['internal', 'client', 'both', 'hidden'],
      default: 'both',
    },

    notes: { type: String, default: '' },
    rejectedReason: { type: String },
    lastGeneratedAt: { type: Date },
    // Evidence-staleness flag for analyst-approved+ recs. Set when the source issue is no longer
    // active or its findings reverted to not_verified, so the rec card can show a warning instead
    // of silently overwriting an analyst-approved item.
    evidenceStaleReason: { type: String, enum: ['stale', 'blocked', null], default: null },
    evidenceStaleAt: { type: Date },
  },
  { collection: 'recommendations', timestamps: true },
);
RecommendationSchema.index({ projectId: 1, sourceKey: 1 }, { unique: true });
RecommendationSchema.index({ projectId: 1, status: 1, priorityScore: -1 });
RecommendationSchema.index({ projectId: 1, type: 1 });

export const RecommendationModel = model('Recommendation', RecommendationSchema);
