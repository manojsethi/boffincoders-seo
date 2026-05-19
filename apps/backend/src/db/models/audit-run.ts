import { Schema, model, Types } from 'mongoose';

/**
 * One audit execution. Stores layered scores + data gaps separately from issues.
 * Doc 11 §"Scoring Model" + §"Missing Data Must Not Penalize Blindly".
 */
const AuditRunSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    crawlRunId: { type: Types.ObjectId, required: true },
    status: { type: String, default: 'queued', index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    agendaJobId: { type: String },

    pagesAudited: { type: Number, default: 0 },
    rulesEvaluated: { type: Number, default: 0 },
    findingsCreated: { type: Number, default: 0 },
    issuesUpserted: { type: Number, default: 0 },
    dataGapCount: { type: Number, default: 0 },

    sourcesUsed: { type: [String], default: [] },

    // Status counts by FindingStatus (e.g. { pass: 12, fail: 4, not_verified: 8 })
    statusCounts: { type: Schema.Types.Mixed, default: {} },
    severityCounts: { type: Schema.Types.Mixed, default: {} },
    experimentalCounts: { type: Schema.Types.Mixed, default: {} },

    // Doc 11 layered scores. Each score is { value, contributors, missingData, notApplicable }
    layeredScores: { type: Schema.Types.Mixed, default: {} },

    // Data gaps surfaced from not_verified results. Each gap groups findings by reason.
    dataGaps: { type: [Schema.Types.Mixed], default: [] },

    error: { type: String },
    progressPercent: { type: Number, default: 0 },
    currentStep: { type: String, default: '' },
    triggeredBy: { type: String, default: 'user' },
  },
  { collection: 'audit_runs', timestamps: true },
);
AuditRunSchema.index({ projectId: 1, startedAt: -1 });

export const AuditRunModel = model('AuditRun', AuditRunSchema);
