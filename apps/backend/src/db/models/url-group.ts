import { Schema, model, Types } from 'mongoose';

/**
 * URL/template group. Phase 11.
 *
 * One per distinct pattern after discovery. Carries the counts the analyst needs to understand
 * coverage: discovered vs crawled vs sampled vs excluded. `examples` keeps a handful of real URLs
 * so the UI can show "view matched URLs" without rerunning discovery.
 */
const UrlGroupSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    crawlRunId: { type: Types.ObjectId, index: true },
    name: { type: String, required: true },
    pattern: { type: String, required: true },
    pageFamily: { type: String, default: '' },
    behavior: {
      type: String,
      enum: ['crawl', 'sample', 'exclude', 'force_include', 'normalize'],
      required: true,
    },
    sampleLimit: { type: Number, default: 0 },
    discoveredCount: { type: Number, default: 0 },
    crawledCount: { type: Number, default: 0 },
    sampledCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },
    examples: { type: [String], default: [] }, // up to ~10 real URLs
    sourceRuleId: { type: Types.ObjectId },
    confidence: { type: Number, default: 0.8 },
    lastEvaluatedAt: { type: Date },
  },
  { collection: 'url_groups', timestamps: true },
);
UrlGroupSchema.index({ projectId: 1, pattern: 1 }, { unique: false });

export const UrlGroupModel = model('UrlGroup', UrlGroupSchema);
