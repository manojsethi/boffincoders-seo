import { Schema, model, Types } from 'mongoose';

const PageSnapshotSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    pageId: { type: Types.ObjectId, required: true },
    crawlRunId: { type: Types.ObjectId, required: true },
    url: { type: String, required: true },
    statusCode: { type: Number },
    title: { type: String },
    metaDescription: { type: String },
    h1: { type: String },
    canonicalUrl: { type: String },
    indexability: { type: String },
    extracted: { type: Schema.Types.Mixed, default: {} },
    contentHash: { type: String },
    capturedAt: { type: Date, required: true },
  },
  { collection: 'page_snapshots', timestamps: true },
);
PageSnapshotSchema.index({ projectId: 1, pageId: 1, crawlRunId: 1 });

export const PageSnapshotModel = model('PageSnapshot', PageSnapshotSchema);
