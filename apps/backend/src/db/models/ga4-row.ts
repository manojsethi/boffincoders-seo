import { Schema, model, Types } from 'mongoose';

/**
 * Per-landing-page GA4 row (organic-channel filter applied at query time).
 * Doc 5 §"GA4 Requirements".
 */
const Ga4RowSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    pagePath: { type: String, required: true },
    channel: { type: String, default: 'organic' },
    sessions: { type: Number, default: 0 },
    engagedSessions: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    rangeStart: { type: Date, required: true },
    rangeEnd: { type: Date, required: true },
  },
  { collection: 'ga4_rows', timestamps: true },
);
Ga4RowSchema.index({ projectId: 1, pagePath: 1, channel: 1, rangeEnd: -1 }, { unique: true });

export const Ga4RowModel = model('Ga4Row', Ga4RowSchema);
