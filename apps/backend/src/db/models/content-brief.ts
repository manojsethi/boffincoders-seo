import { Schema, model, Types } from 'mongoose';

/**
 * Content brief. Doc continuation §"Phase 5". One brief per (project, keyword, page) unless the
 * analyst explicitly creates another version. Built from deterministic evidence (keyword fit,
 * page content analysis, GSC, project goals, audit issues) and optionally enriched by AI tasks
 * (draft-content-brief, suggest-content-outline). Analyst-approved before any content writing.
 */
const ContentBriefSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    keywordId: { type: Types.ObjectId, required: true },
    pageId: { type: Types.ObjectId },
    // Optional version tag so the analyst can create a second brief on the same target.
    version: { type: Number, default: 1 },

    title: { type: String, required: true },
    objective: { type: String, default: '' },
    audience: { type: String, default: '' },
    searchIntent: { type: String, default: 'unknown' },
    funnelStage: { type: String, default: 'unknown' },

    targetKeyword: { type: String, required: true },
    secondaryKeywords: { type: [String], default: [] },

    currentPageSummary: { type: String, default: '' },
    pageGoal: { type: String, default: '' },

    // Structural recommendations.
    titleSuggestions: { type: [String], default: [] },
    metaSuggestions: { type: [String], default: [] },
    h1Suggestion: { type: String, default: '' },
    recommendedOutline: {
      type: [{ heading: String, level: Number, points: [String] }],
      default: [],
    },
    requiredSections: { type: [{ name: String, why: String }], default: [] },
    faqSuggestions: { type: [{ question: String, answer: String }], default: [] },
    internalLinksToAdd: {
      type: [{ targetUrl: String, anchorIdea: String, rationale: String }],
      default: [],
    },
    internalLinksFrom: {
      type: [{ sourceUrl: String, anchorIdea: String, rationale: String }],
      default: [],
    },
    schemaSuggestions: { type: [String], default: [] },
    ctaRecommendation: { type: String, default: '' },
    trustProofNeeded: { type: [String], default: [] },
    whatToAvoid: { type: [String], default: [] },
    seoChecklist: { type: [String], default: [] },
    validationChecklist: { type: [String], default: [] },

    // Evidence + AI bookkeeping.
    contentGaps: { type: [String], default: [] },
    dataGaps: { type: [String], default: [] },
    evidenceRefs: {
      type: [{ kind: String, id: String, label: String }],
      default: [],
    },
    aiTaskRunIds: { type: [Types.ObjectId], default: [] },

    status: {
      type: String,
      enum: ['draft', 'analyst-review', 'approved', 'rejected', 'implemented'],
      default: 'draft',
    },
    rejectedReason: { type: String },
    approvedAt: { type: Date },
    implementedAt: { type: Date },

    ownerType: { type: String, enum: ['analyst', 'content', 'seo', 'client'], default: 'content' },
    notes: { type: String, default: '' },

    lastGeneratedAt: { type: Date },
  },
  { collection: 'content_briefs', timestamps: true },
);
ContentBriefSchema.index({ projectId: 1, keywordId: 1, pageId: 1, version: 1 }, { unique: true });
ContentBriefSchema.index({ projectId: 1, status: 1 });

export const ContentBriefModel = model('ContentBrief', ContentBriefSchema);
