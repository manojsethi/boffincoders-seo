import { Schema, model, Types } from 'mongoose';

/**
 * Audit log for controlled maintenance actions. Doc continuation §"Phase 3 — cleanup as
 * controlled maintenance task". Every run of a maintenance task creates one row, so the analyst
 * can see what was changed, when, and what the dry-run preview said.
 */
const MaintenanceRunSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    taskKey: { type: String, required: true, index: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },

    // Snapshot of the input params (sanitized).
    params: { type: Schema.Types.Mixed, default: {} },
    dryRun: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    startedAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date },
    durationMs: { type: Number },

    // The task handler writes its diff/preview here. UI renders this verbatim.
    result: { type: Schema.Types.Mixed, default: {} },
    error: { type: String },

    // Triggered-by metadata. `userId` reserved for the auth phase.
    triggeredBy: { type: String, enum: ['analyst', 'system'], default: 'analyst' },
    triggeredByUserId: { type: String },
  },
  { collection: 'maintenance_runs', timestamps: true },
);
MaintenanceRunSchema.index({ projectId: 1, taskKey: 1, startedAt: -1 });

export const MaintenanceRunModel = model('MaintenanceRun', MaintenanceRunSchema);
