import { Schema, model, Types } from 'mongoose';

/**
 * Per-page-per-query GSC row. Doc 5 §"GSC Requirements".
 * Synced from searchanalytics.query() with dimensions ['page', 'query'].
 */
const GscRowSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    pageUrl: { type: String, required: true },
    query: { type: String, required: true },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    rangeStart: { type: Date, required: true },
    rangeEnd: { type: Date, required: true },
  },
  { collection: 'gsc_rows', timestamps: true },
);
GscRowSchema.index({ projectId: 1, pageUrl: 1 });
GscRowSchema.index({ projectId: 1, query: 1 });
GscRowSchema.index({ projectId: 1, pageUrl: 1, query: 1, rangeEnd: -1 }, { unique: true });

export const GscRowModel = model('GscRow', GscRowSchema);
