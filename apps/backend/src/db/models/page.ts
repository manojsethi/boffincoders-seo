import { Schema, model, Types } from 'mongoose';

const PageSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    url: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    statusCode: { type: Number },
    indexability: { type: String },
    canonicalUrl: { type: String },
    title: { type: String },
    metaDescription: { type: String },
    h1: { type: String },
    lang: { type: String },
    openGraph: { type: Schema.Types.Mixed, default: {} },
    twitter: { type: Schema.Types.Mixed, default: {} },
    headings: { type: [{ level: Number, text: String }], default: [] },
    schema: { type: [Schema.Types.Mixed], default: [] },
    // Doc 11 §"Raw Vs Rendered Evidence" — schema source tracking
    schemaSource: {
      type: String,
      enum: ['raw-html', 'rendered-html', 'both', 'none', 'not-verified'],
      default: 'not-verified',
    },
    schemaTypes: { type: [String], default: [] },
    rawSchema: { type: [Schema.Types.Mixed], default: [] },
    renderedSchema: { type: [Schema.Types.Mixed], default: [] },
    schemaParseErrors: { type: [String], default: [] },
    renderedExtractedAt: { type: Date },
    renderedRecrawlReason: { type: String },
    images: { type: [{ src: String, alt: String }], default: [] },
    internalLinksOut: { type: [String], default: [] },
    internalLinksIn: { type: Number, default: 0 },
    pageRole: { type: String, default: 'unknown' },
    pageSubtype: { type: String, default: '' },
    roleConfidence: { type: Number, default: 0 },
    roleConfidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },
    roleSource: { type: String, enum: ['analyst', 'ai', 'heuristic'], default: 'heuristic' },
    roleInferredAt: { type: Date },
    businessIntent: { type: String },
    isImportant: { type: Boolean, default: false },
    isIntentionallyNonIndexable: { type: Boolean, default: false },
    lastCrawledAt: { type: Date },
    lastCrawlRunId: { type: Types.ObjectId, index: true },
    contentHash: { type: String },
    // Phase 11 — crawl-scope provenance. Used by audit + UI to explain template-level findings
    // (e.g. "sampled 5 of 412" / "template-level issue, validate by re-sampling").
    crawlScopeDecision: {
      type: String,
      enum: ['crawl', 'sampled', 'force_included'],
      default: 'crawl',
    },
    urlGroupId: { type: Types.ObjectId },
    urlGroupName: { type: String },
    scopeRuleId: { type: Types.ObjectId },
    sampleReason: { type: String, default: '' },
  },
  { collection: 'pages', timestamps: true },
);
PageSchema.index({ projectId: 1, normalizedUrl: 1 }, { unique: true });
PageSchema.index({ projectId: 1, pageRole: 1 });

export const PageModel = model('Page', PageSchema);
