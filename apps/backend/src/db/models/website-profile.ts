import { Schema, model, Types } from 'mongoose';

const WebsiteProfileSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, unique: true },
    websiteCategory: { type: String },
    categoryConfidence: { type: Number, default: 0 },
    categorySource: { type: String, enum: ['analyst', 'ai', 'imported'] },
    description: { type: String, default: '' },
    audienceSegments: { type: [String], default: [] },
    primaryGoals: { type: [String], default: [] },
    conversionActions: { type: [String], default: [] },
    entityGroups: { type: [String], default: [] },
    contentSections: { type: [String], default: [] },
    complianceContext: { type: String, default: '' },
    markets: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    lastSuggestedAt: { type: Date },
    sourceRunId: { type: Types.ObjectId },
  },
  { collection: 'website_profiles', timestamps: true },
);

export const WebsiteProfileModel = model('WebsiteProfile', WebsiteProfileSchema);
