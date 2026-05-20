// Generate recommendations from keyword-fit verdicts. Doc continuation §"Phase 3".
// Idempotent: stable `sourceKey = keyword-fit|<fitId>` so re-running doesn't duplicate.

import { Types } from 'mongoose';
import { KeywordFitModel, RecommendationModel } from '../db';
import { getLogger } from '../config/logger';

const log = getLogger('recommendations:keyword-fit');

// Verdicts that should produce active recommendations vs ones we skip.
const ACTIONABLE_VERDICTS = new Set([
  'must_improve',
  'wrong_page_ranking',
  'cannibalized',
  'create_new_page',
  'needs_target_mapping',
  'merge_or_redirect',
  'needs_minor_update',
]);

const VERDICT_META: Record<
  string,
  {
    type: 'content' | 'internal-link' | 'keyword';
    titlePrefix: string;
    rootCause: string;
    actionLead: string;
    validation: string;
    owner: 'content' | 'developer' | 'seo' | 'analyst';
    impact: 'high' | 'medium' | 'low';
    effort: 'small' | 'medium' | 'large';
    verdict: 'must_change' | 'should_improve' | 'consider' | 'monitor';
  }
> = {
  must_improve: {
    type: 'content',
    titlePrefix: 'Improve content fit',
    rootCause: 'Page ranks for the query but content + on-page signals do not match the target intent.',
    actionLead:
      'Rewrite title + H1 to include the target topic verbatim; add a dedicated section that directly answers the query; refresh meta description so the SERP snippet earns the click.',
    validation:
      'Re-crawl + verify title/H1/body include target tokens. Track GSC CTR + position over 28 days.',
    owner: 'content',
    impact: 'high',
    effort: 'medium',
    verdict: 'must_change',
  },
  wrong_page_ranking: {
    type: 'internal-link',
    titlePrefix: 'Move ranking to the right page',
    rootCause:
      'Google ranks the wrong page for this query — internal links + on-page signals are confusing Google about which URL to surface.',
    actionLead:
      'Strengthen internal links pointing at the mapped target page (3-5 contextual anchors). De-optimize the wrong-ranking page (loosen title/H1). Re-check canonical chains.',
    validation:
      'Re-crawl + GSC after 28 days. Confirm the mapped URL overtakes the wrong-ranking URL.',
    owner: 'seo',
    impact: 'high',
    effort: 'small',
    verdict: 'must_change',
  },
  cannibalized: {
    type: 'content',
    titlePrefix: 'Resolve cannibalization',
    rootCause: 'Multiple pages compete for the same query — authority is split.',
    actionLead:
      'Pick a primary page. Consolidate / canonicalize / 301 the secondary pages. Update internal links to point at the winning URL.',
    validation:
      'Re-crawl + GSC after 28 days. The chosen URL should be the only one ranking for this query.',
    owner: 'seo',
    impact: 'high',
    effort: 'medium',
    verdict: 'must_change',
  },
  create_new_page: {
    type: 'content',
    titlePrefix: 'Create new target page',
    rootCause:
      'Query has organic impressions but no mapped target page exists on the site.',
    actionLead:
      'Plan + publish a dedicated target page (or significantly expand the closest existing page). Map the keyword to it.',
    validation:
      'After publish + 28 days, the new page should accumulate impressions and rank for the query.',
    owner: 'content',
    impact: 'high',
    effort: 'large',
    verdict: 'must_change',
  },
  needs_target_mapping: {
    type: 'keyword',
    titlePrefix: 'Map target page',
    rootCause:
      'Query has organic impressions but the analyst has not chosen an intended target page yet.',
    actionLead:
      'Open the keyword and pick the intended target — confirm the current ranking URL or override with a better existing page.',
    validation:
      'After mapping + next regen, the verdict should move to good_fit / needs_minor_update / must_improve based on the chosen target.',
    owner: 'seo',
    impact: 'medium',
    effort: 'small',
    verdict: 'should_improve',
  },
  merge_or_redirect: {
    type: 'content',
    titlePrefix: 'Merge or redirect',
    rootCause: 'Two or more pages overlap; consolidation simplifies signals.',
    actionLead:
      'Pick the canonical URL, merge content, 301 the others.',
    validation:
      'Re-crawl + verify redirects + ranking consolidation.',
    owner: 'developer',
    impact: 'medium',
    effort: 'medium',
    verdict: 'should_improve',
  },
  needs_minor_update: {
    type: 'content',
    titlePrefix: 'Tune on-page signals',
    rootCause: 'Page is on-topic but missing a supporting signal (meta, heading, or section).',
    actionLead:
      'Refine meta description, add a target-query H2/H3, and ensure title carries the topic.',
    validation: 'Re-crawl + verify changes. Watch GSC CTR over 21 days.',
    owner: 'content',
    impact: 'medium',
    effort: 'small',
    verdict: 'should_improve',
  },
};

export async function generateRecommendationsFromKeywordFit(opts: {
  projectId: string;
}): Promise<{ generated: number; closed: number }> {
  const pid = new Types.ObjectId(opts.projectId);
  const fits = await KeywordFitModel.find({ projectId: pid }).lean();
  const seenSourceKeys = new Set<string>();
  let generated = 0;
  const now = new Date();
  for (const f of fits) {
    const sourceKey = `keyword-fit|${String(f._id)}`;
    if (!ACTIONABLE_VERDICTS.has(f.verdict as string)) continue;
    const meta = VERDICT_META[f.verdict as string];
    if (!meta) continue;
    seenSourceKeys.add(sourceKey);

    const priorityScore = Math.min(
      100,
      Math.round(
        (meta.impact === 'high' ? 60 : meta.impact === 'medium' ? 40 : 20) +
          Math.min(40, (f.impressions ?? 0) / 25),
      ),
    );
    const evidence: Record<string, unknown> = {
      keyword: f.keyword,
      intent: f.intent,
      verdict: f.verdict,
      gsc: {
        clicks: f.clicks ?? 0,
        impressions: f.impressions ?? 0,
        position: f.position ?? 0,
      },
      mappedPageId: f.mappedPageId ? String(f.mappedPageId) : null,
      rankingUrl: f.rankingUrl ?? null,
      observations:
        ((f.evidence as { observations?: string[] } | undefined)?.observations ?? []),
    };

    const pageIds = [f.mappedPageId, f.rankingPageId].filter(Boolean) as Types.ObjectId[];

    const alwaysSet: Record<string, unknown> = {
      keywordIds: [f.keywordId],
      pageIds,
      sourceFindingIds: [],
      sourceIssueIds: [],
      evidence,
      priorityScore,
      confidence: f.confidence ?? 0.7,
      confidenceLevel: f.confidenceLevel ?? 'medium',
      source: 'mixed',
      lastGeneratedAt: now,
      evidenceStaleReason: null,
      evidenceStaleAt: null,
    };
    const draftSet: Record<string, unknown> = {
      type: meta.type,
      title: `${meta.titlePrefix}: "${f.keyword}"`,
      verdict: meta.verdict,
      rootCauseSummary: f.rootCauseSummary || meta.rootCause,
      rootCause: meta.rootCause,
      recommendedAction:
        (f.recommendedActions ?? []).length > 0
          ? (f.recommendedActions as string[]).join('\n• ')
          : meta.actionLead,
      whyItMatters:
        'Direct mapping between user intent + best target page is the highest-leverage SEO control.',
      validationMethod: meta.validation,
      ownerType: meta.owner,
      effort: meta.effort,
      expectedImpact: meta.impact,
    };

    await RecommendationModel.updateOne(
      { projectId: pid, sourceKey },
      {
        $set: alwaysSet,
        $setOnInsert: {
          projectId: pid,
          sourceKey,
          status: 'draft',
          reportVisibility: 'both',
          ...draftSet,
        },
      },
      { upsert: true },
    );
    await RecommendationModel.updateOne(
      { projectId: pid, sourceKey, status: { $in: ['draft', 'proposed'] } },
      { $set: draftSet },
    );
    generated += 1;
  }

  // Auto-reject draft/proposed keyword-fit recs whose fit no longer says "actionable" + flag
  // approved+ as stale.
  const APPROVED_PLUS = ['approved', 'planned', 'in_progress', 'implemented'];
  const r = await RecommendationModel.updateMany(
    {
      projectId: pid,
      sourceKey: { $regex: '^keyword-fit\\|', $nin: [...seenSourceKeys] },
      status: { $in: ['draft', 'proposed'] },
    },
    { $set: { status: 'rejected', rejectedReason: 'Latest fit verdict no longer needs action.' } },
  );
  await RecommendationModel.updateMany(
    {
      projectId: pid,
      sourceKey: { $regex: '^keyword-fit\\|', $nin: [...seenSourceKeys] },
      status: { $in: APPROVED_PLUS },
    },
    { $set: { evidenceStaleReason: 'stale', evidenceStaleAt: now } },
  );

  const closed = r.modifiedCount ?? 0;
  log.info(
    { projectId: opts.projectId, generated, closed },
    'keyword-fit recommendations generated',
  );
  return { generated, closed };
}
