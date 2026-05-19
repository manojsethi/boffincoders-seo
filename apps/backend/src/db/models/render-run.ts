import { Schema, model, Types } from 'mongoose';

/**
 * Rendered (Playwright) recrawl run. Doc 11 §"Rendered Verification Controls".
 * Tracks selective bulk render across analyst-selected pages with progress + per-page results.
 */
const RenderRunSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    pageIds: { type: [Types.ObjectId], default: [] },
    reason: { type: String, default: 'analyst-triggered' },
    status: { type: String, default: 'queued', index: true },
    triggeredBy: { type: String, default: 'analyst' },
    agendaJobId: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    progressPercent: { type: Number, default: 0 },
    currentStep: { type: String, default: '' },
    totalPages: { type: Number, default: 0 },
    completedPages: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    results: { type: [Schema.Types.Mixed], default: [] },
    rerun: {
      findingsInserted: { type: Number, default: 0 },
      issuesUpserted: { type: Number, default: 0 },
      rulesRun: { type: Number, default: 0 },
      pages: { type: Number, default: 0 },
    },
    error: { type: String },
  },
  { collection: 'render_runs', timestamps: true },
);
RenderRunSchema.index({ projectId: 1, createdAt: -1 });

export const RenderRunModel = model('RenderRun', RenderRunSchema);
