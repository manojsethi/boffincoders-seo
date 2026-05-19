import { Schema, model, Types } from 'mongoose';

const PageContentSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    pageId: { type: Types.ObjectId, required: true },
    crawlRunId: { type: Types.ObjectId, required: true },
    markdown: { type: String, default: '' },
    cleanText: { type: String, default: '' },
    extractionMethod: { type: String, enum: ['crawl4ai', 'turndown', 'fallback'], default: 'crawl4ai' },
    qualityScore: { type: Number, default: 0 },
    tokenEstimate: { type: Number, default: 0 },
    contentHash: { type: String },
  },
  { collection: 'page_content', timestamps: true },
);
PageContentSchema.index({ projectId: 1, pageId: 1, crawlRunId: 1 });

export const PageContentModel = model('PageContent', PageContentSchema);
