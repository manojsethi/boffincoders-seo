import { Schema, model, Types } from 'mongoose';

const AIAnalysisSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    sourceCrawlRunId: { type: Types.ObjectId },
    sourceAuditRunId: { type: Types.ObjectId },
    modelProvider: { type: String, required: true },
    modelName: { type: String, required: true },
    costEstimate: { type: Number, default: 0 },
    inputSummary: { type: Schema.Types.Mixed, default: {} },
    websiteProfileSuggestion: { type: Schema.Types.Mixed, default: {} },
    prioritySummary: { type: [Schema.Types.Mixed], default: [] },
    contentOpportunities: { type: [Schema.Types.Mixed], default: [] },
    internalLinkingOpportunities: { type: [Schema.Types.Mixed], default: [] },
    geoAeoObservations: { type: [Schema.Types.Mixed], default: [] },
    confidence: { type: Number, default: 0 },
    requiresAnalystReview: { type: Boolean, default: true },
    approvedAt: { type: Date },
    status: { type: String, default: 'queued' },
    error: { type: String },
  },
  { collection: 'ai_analyses', timestamps: true },
);

export const AIAnalysisModel = model('AIAnalysis', AIAnalysisSchema);
