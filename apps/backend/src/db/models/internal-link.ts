import { Schema, model, Types } from 'mongoose';

const InternalLinkSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    crawlRunId: { type: Types.ObjectId, required: true },
    fromPageId: { type: Types.ObjectId, required: true },
    toUrlNormalized: { type: String, required: true },
    toPageId: { type: Types.ObjectId },
    anchorText: { type: String },
    isNofollow: { type: Boolean, default: false },
  },
  { collection: 'internal_links', timestamps: true },
);
InternalLinkSchema.index({ projectId: 1, fromPageId: 1 });
InternalLinkSchema.index({ projectId: 1, toUrlNormalized: 1 });

export const InternalLinkModel = model('InternalLink', InternalLinkSchema);
