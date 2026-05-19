import { Schema, model, Types } from 'mongoose';

/**
 * Per-page CWV snapshot (CrUX field data via PageSpeed Insights). Doc 5 §"CWV Requirements".
 */
const CwvMetricSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    pageUrl: { type: String, required: true },
    strategy: { type: String, enum: ['mobile', 'desktop'], default: 'mobile' },
    lcp: { type: Number },
    inp: { type: Number },
    cls: { type: Number },
    performanceScore: { type: Number },
    capturedAt: { type: Date, default: () => new Date() },
    source: { type: String, default: 'psi' },
    error: { type: String },
  },
  { collection: 'cwv_metrics', timestamps: true },
);
CwvMetricSchema.index({ projectId: 1, pageUrl: 1, strategy: 1, capturedAt: -1 });

export const CwvMetricModel = model('CwvMetric', CwvMetricSchema);
