import { Schema, model, Types } from 'mongoose';

/**
 * FixPlan + embedded FixPlanItem. Phase 6.
 *
 * A FixPlan is the analyst's weekly/monthly execution surface: pull approved recommendations,
 * issues, opportunities, and content briefs into one place, assign owner/priority/effort/target
 * date, then move work through planned → in-progress → fixed → ready-for-validation → validated
 * (or failed-validation / deferred). Validation must be evidence-based and pull from the same
 * underlying data the source originally came from (audit findings, CWV, GSC trends, page crawl).
 *
 * Items embed the source link so analysts can navigate back without joining; we never duplicate
 * source body text — re-render from the source so edits stay consistent.
 */

const FixPlanItemSchema = new Schema(
  {
    // Source linkage. Only one of recommendationId/issueId/opportunityId/contentBriefId is
    // expected to be set per item; manual items leave them all null.
    sourceType: {
      type: String,
      enum: ['recommendation', 'issue', 'opportunity', 'content-brief', 'manual'],
      required: true,
    },
    // Stable handle for the source so we can de-dupe; uses sourceId for non-manual items.
    sourceId: { type: String },
    recommendationId: { type: Types.ObjectId },
    issueId: { type: Types.ObjectId },
    opportunityId: { type: Types.ObjectId },
    contentBriefId: { type: Types.ObjectId },
    pageId: { type: Types.ObjectId },
    keywordId: { type: Types.ObjectId },

    title: { type: String, required: true },
    description: { type: String, default: '' },

    ownerType: {
      type: String,
      enum: ['analyst', 'seo', 'content', 'developer', 'client'],
      default: 'analyst',
    },
    assignedToUserId: { type: String },
    priority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P2' },
    impact: { type: String, enum: ['high', 'medium', 'low', 'unknown'], default: 'unknown' },
    effort: {
      type: String,
      enum: ['trivial', 'small', 'medium', 'large', 'unknown'],
      default: 'unknown',
    },

    // Lifecycle. Mirrors the doc continuation set.
    status: {
      type: String,
      enum: [
        'planned',
        'in-progress',
        'fixed',
        'ready-for-validation',
        'validated',
        'failed-validation',
        'deferred',
      ],
      default: 'planned',
    },

    expectedOutcome: { type: String, default: '' },

    // Validation. Method is the human-readable description; status is the system verdict from the
    // last `runValidation` call against latest evidence. Evidence is a JSON blob captured at the
    // time of validation so the analyst can see exactly what we looked at.
    validationMethod: { type: String, default: '' },
    validationStatus: {
      type: String,
      enum: ['not-started', 'pending', 'passed', 'failed', 'inconclusive'],
      default: 'not-started',
    },
    validationEvidence: { type: Schema.Types.Mixed, default: {} },
    validationCheckedAt: { type: Date },
    validationDataSource: { type: String }, // e.g. 'audit', 'cwv', 'gsc', 'page-crawl', 'manual'

    targetDate: { type: Date },
    completedAt: { type: Date },
    validatedAt: { type: Date },

    notes: { type: String, default: '' },
    internalNotes: { type: String, default: '' },
    clientVisible: { type: Boolean, default: true },

    addedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const FixPlanSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },

    title: { type: String, required: true },
    description: { type: String, default: '' },

    periodStart: { type: Date },
    periodEnd: { type: Date },

    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
    },
    ownerType: {
      type: String,
      enum: ['analyst', 'seo', 'content', 'developer', 'client'],
      default: 'analyst',
    },
    priority: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P1' },
    expectedImpactSummary: { type: String, default: '' },

    items: { type: [FixPlanItemSchema], default: [] },
  },
  { collection: 'fix_plans', timestamps: true },
);
FixPlanSchema.index({ projectId: 1, status: 1, createdAt: -1 });
FixPlanSchema.index({ projectId: 1, periodStart: -1 });

export const FixPlanModel = model('FixPlan', FixPlanSchema);
