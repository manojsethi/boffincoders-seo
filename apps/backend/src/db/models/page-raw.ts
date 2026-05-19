import { Schema, model, Types } from 'mongoose';

const PageRawSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    pageId: { type: Types.ObjectId, required: true },
    crawlRunId: { type: Types.ObjectId, required: true },
    html: { type: String, default: '' },
    headers: { type: Schema.Types.Mixed, default: {} },
    statusCode: { type: Number },
    fetcher: { type: String, enum: ['cheerio', 'playwright', 'crawl4ai'] },
  },
  { collection: 'page_raw', timestamps: true },
);
PageRawSchema.index({ projectId: 1, pageId: 1, crawlRunId: 1 });

export const PageRawModel = model('PageRaw', PageRawSchema);
