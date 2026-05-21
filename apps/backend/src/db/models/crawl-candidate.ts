import { Schema, model, Types } from 'mongoose';

/**
 * Lightweight per-URL audit record from the discovery phase. Phase 11.
 *
 * We don't create full Page documents for excluded/sampled-out URLs — that would balloon the
 * pages collection. Instead each discovered URL gets one of these so the analyst can inspect:
 * "this was found, decided x, because rule y".
 */
const CrawlCandidateSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true, index: true },
    crawlRunId: { type: Types.ObjectId, required: true, index: true },
    url: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    source: {
      type: String,
      enum: ['seed', 'sitemap', 'homepage-link', 'gsc', 'link', 'analyst'],
      required: true,
    },
    matchedRuleId: { type: Types.ObjectId },
    matchedRuleName: { type: String, default: '' },
    groupName: { type: String, default: '' },
    groupPattern: { type: String, default: '' },
    decision: {
      type: String,
      enum: [
        'crawl',
        'sampled',
        'excluded',
        'force_included',
        'normalized_duplicate',
        'blocked_by_robots',
        'out_of_scope',
      ],
      required: true,
    },
    reason: { type: String, default: '' },
    sampleReason: { type: String, default: '' }, // why this URL was chosen as a sample
    selectedForCrawl: { type: Boolean, default: false },
    // sitemap-provided metadata used by sampler
    sitemapLastmod: { type: Date },
  },
  { collection: 'crawl_candidates', timestamps: true },
);
CrawlCandidateSchema.index({ projectId: 1, crawlRunId: 1, decision: 1 });
CrawlCandidateSchema.index({ projectId: 1, crawlRunId: 1, normalizedUrl: 1 }, { unique: true });

export const CrawlCandidateModel = model('CrawlCandidate', CrawlCandidateSchema);
