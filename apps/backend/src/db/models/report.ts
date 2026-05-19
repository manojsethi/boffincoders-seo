import { Schema, model, Types } from 'mongoose';

const ReportSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    status: { type: String, default: 'draft' },
    sourceAuditRunIds: { type: [Types.ObjectId], default: [] },
    sourceCrawlRunIds: { type: [Types.ObjectId], default: [] },
    sections: { type: [{ key: String, title: String, body: String }], default: [] },
    markdown: { type: String, default: '' },
    pdfFileUrl: { type: String },
    approvedAt: { type: Date },
    view: { type: String, enum: ['client', 'internal'], default: 'internal' },
    executiveSummary: { type: String },
    error: { type: String },
  },
  { collection: 'reports', timestamps: true },
);
ReportSchema.index({ projectId: 1, periodStart: -1 });

export const ReportModel = model('Report', ReportSchema);
