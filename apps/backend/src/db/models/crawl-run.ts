import { Schema, model, Types } from 'mongoose';

const CrawlRunSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    mode: { type: String, default: 'first' },
    status: { type: String, default: 'queued', index: true },
    seedUrl: { type: String },
    maxPages: { type: Number, default: 200 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    agendaJobId: { type: String },
    triggeredBy: { type: String, default: 'user' },
    diagnostics: { type: Schema.Types.Mixed, default: {} },
    counts: { type: Schema.Types.Mixed, default: { pages: 0, markdown: 0 } },
    error: { type: String },
    progressPercent: { type: Number, default: 0 },
    currentStep: { type: String, default: '' },
  },
  { collection: 'crawl_runs', timestamps: true },
);
CrawlRunSchema.index({ projectId: 1, startedAt: -1 });

export const CrawlRunModel = model('CrawlRun', CrawlRunSchema);
