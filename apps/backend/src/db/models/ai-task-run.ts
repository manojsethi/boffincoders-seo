import { Schema, model, Types } from 'mongoose';

/**
 * Persistent audit log for every AI task call. Doc continuation §"Phase 4 — AI Task System".
 * One row per invocation. Lets the analyst see exactly which model produced what, with which
 * source ids, at what confidence — and accept or reject the result.
 *
 * We deliberately do NOT store full prompts or secrets. Source ids + prompt template version
 * are enough for reproducibility; large content lives in PageContent/Issue/etc records already.
 */
const AiTaskRunSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    taskKey: { type: String, required: true, index: true },

    // Provider + model the router selected.
    provider: { type: String },
    model: { type: String },
    promptTemplateVersion: { type: String, default: 'v1' },

    // What the task was asked to operate on. Source ids ground every output in real records.
    sourceIds: { type: Schema.Types.Mixed, default: {} },
    inputSnapshot: { type: Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'unavailable'],
      default: 'pending',
    },
    // Audit feedback 2026-05-20 — split "failed" into specific reasons so the analyst can
    // distinguish bad JSON from schema drift from provider/network outages.
    schemaValidationStatus: {
      type: String,
      enum: ['ok', 'invalid-json', 'invalid-schema', 'no-output', 'not-run', null],
      default: 'not-run',
    },
    startedAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date },
    durationMs: { type: Number },

    output: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0 },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },
    warnings: { type: [String], default: [] },

    // Estimated cost in USD per the router's cost estimate. Always-set so analytics can sum.
    costEstimateUsd: { type: Number, default: 0 },
    inputTokens: { type: Number },
    outputTokens: { type: Number },

    needsAnalystReview: { type: Boolean, default: true },
    acceptedBy: { type: String, enum: ['analyst', 'system', null], default: null },
    acceptedAt: { type: Date },
    rejectedReason: { type: String },

    error: { type: String },
  },
  { collection: 'ai_task_runs', timestamps: true },
);
AiTaskRunSchema.index({ projectId: 1, taskKey: 1, createdAt: -1 });
AiTaskRunSchema.index({ projectId: 1, 'sourceIds.pageId': 1 });
AiTaskRunSchema.index({ projectId: 1, 'sourceIds.recommendationId': 1 });

export const AiTaskRunModel = model('AiTaskRun', AiTaskRunSchema);
