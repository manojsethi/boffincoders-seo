// Content brief generator. Doc continuation §"Phase 5".
//
// Builds a brief from deterministic evidence (keyword + mapped page + content-fit analysis + GSC
// + project goals + active audit issues). Optionally calls AI tasks to enrich. Strict rules:
//   - One brief per (project, keyword, page, version). Re-running updates existing draft.
//   - Analyst-edited fields survive regeneration once status >= analyst-review.
//   - AI is optional. If unavailable, the brief is still useful via deterministic content.

import { Types } from 'mongoose';
import {
  ContentBriefModel,
  KeywordModel,
  PageModel,
  PageContentModel,
  KeywordFitModel,
  ProjectModel,
} from '../db';
import { analyzePageContent } from '../keyword-fit/page-analysis';
import { runTask } from '../ai';
import { getLogger } from '../config/logger';

const log = getLogger('content-briefs');

export async function generateContentBrief(opts: {
  projectId: string;
  keywordId: string;
  pageId?: string;
  useAI?: boolean;
  version?: number;
}): Promise<{ id: string; created: boolean; status: string; dataGaps: string[] }> {
  const pid = new Types.ObjectId(opts.projectId);
  const keyword = await KeywordModel.findOne({ _id: opts.keywordId, projectId: pid }).lean();
  if (!keyword) throw new Error('Keyword not found');

  // Choose target page: explicit > analyst-mapped > ranking page in crawl set.
  let pageId = opts.pageId ?? null;
  if (!pageId && keyword.mappedPageId) pageId = String(keyword.mappedPageId);
  if (!pageId && keyword.rankingPageId) pageId = String(keyword.rankingPageId);

  const page = pageId ? await PageModel.findOne({ _id: pageId, projectId: pid }).lean() : null;
  const content = pageId
    ? await PageContentModel.findOne({ projectId: pid, pageId })
        .sort({ createdAt: -1 })
        .lean()
    : null;

  const fit = await KeywordFitModel.findOne({ projectId: pid, keywordId: keyword._id }).lean();
  const project = await ProjectModel.findById(pid).lean();
  const goals = ((project?.goals as Array<{ type: string; label?: string; id?: string }> | undefined) ??
    []) as Array<{ type: string; label?: string; id?: string }>;

  // Use page content-analysis when we have a page so we can borrow missingSections + content gaps.
  const pageAnalysis = pageId
    ? await analyzePageContent({ projectId: opts.projectId, pageId }).catch(() => null)
    : null;

  // ---------- Build deterministic baseline ----------

  const dataGaps: string[] = [];
  if (!keyword.mappedPageId) dataGaps.push('No analyst-mapped target page yet.');
  if (!fit) dataGaps.push('No keyword-fit verdict — run a recompute.');
  if (!content) dataGaps.push('No crawled content for this page — re-crawl with content extraction.');
  if (!fit?.impressions || fit.impressions === 0) {
    dataGaps.push('No GSC impressions in the latest sync window for this keyword.');
  }
  if (goals.length === 0) dataGaps.push('No project goals defined — brief lacks business framing.');

  const contentGaps = [
    ...(pageAnalysis?.missingSections ?? []),
    ...(fit?.recommendedActions ?? []),
  ];

  const evidenceRefs: Array<{ kind: string; id: string; label: string }> = [];
  evidenceRefs.push({ kind: 'keyword', id: String(keyword._id), label: keyword.keyword });
  if (pageId) evidenceRefs.push({ kind: 'page', id: pageId, label: page?.url ?? '' });
  if (fit) evidenceRefs.push({ kind: 'keyword-fit', id: String(fit._id), label: fit.verdict ?? '' });
  if (pageAnalysis?.recommendations) {
    for (const r of pageAnalysis.recommendations.slice(0, 5))
      evidenceRefs.push({ kind: 'recommendation', id: r.id, label: r.title });
  }

  // ---------- Incoming-link candidates (deterministic) ----------
  // Find other crawled pages whose body covers the target tokens. Surface up to 5 as candidate
  // source pages that should add a contextual link TO the target. No AI — pure content match.
  const keywordTokens = keyword.keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2);
  const internalLinksFromList: Array<{ sourceUrl: string; anchorIdea: string; rationale: string }> = [];
  if (keywordTokens.length > 0 && pageId) {
    const candidates = await PageContentModel.aggregate<{
      pageId: Types.ObjectId;
      url?: string;
      title?: string;
      role?: string;
      text?: string;
    }>([
      { $match: { projectId: pid, pageId: { $ne: new Types.ObjectId(pageId) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$pageId', cleanText: { $first: '$cleanText' }, markdown: { $first: '$markdown' } } },
      {
        $lookup: {
          from: 'pages',
          localField: '_id',
          foreignField: '_id',
          as: 'page',
        },
      },
      { $unwind: '$page' },
      {
        $project: {
          pageId: '$_id',
          url: '$page.url',
          title: '$page.title',
          role: '$page.pageRole',
          text: { $toLower: { $ifNull: ['$cleanText', '$markdown'] } },
        },
      },
    ]);
    const scored = candidates
      .map((c) => {
        const text = c.text ?? '';
        const matches = keywordTokens.filter((t) => text.includes(t)).length;
        return { ...c, score: matches / keywordTokens.length };
      })
      .filter((c) => c.score >= 0.5 && !!c.url)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const c of scored) {
      internalLinksFromList.push({
        sourceUrl: c.url ?? '',
        anchorIdea: keyword.keyword,
        rationale: `Page already covers ${Math.round(c.score * 100)}% of target tokens${c.role ? ` (role: ${c.role})` : ''}. Add a contextual link to the target.`,
      });
    }
  }

  const baseline = {
    title: `Brief: "${keyword.keyword}" → ${page?.url ?? '(new page)'}`,
    objective:
      fit?.rootCauseSummary ??
      `Make ${page?.url ?? 'a target page'} the strongest answer for "${keyword.keyword}".`,
    audience: pageAnalysis?.purpose?.summary ?? '',
    searchIntent: keyword.intent ?? fit?.intent ?? 'unknown',
    funnelStage: keyword.funnelStage ?? 'unknown',
    targetKeyword: keyword.keyword,
    secondaryKeywords: [] as string[],
    currentPageSummary: pageAnalysis?.purpose?.summary ?? '',
    pageGoal: pageAnalysis?.purpose?.ctaIntent ?? 'unknown',
    titleSuggestions: [] as string[],
    metaSuggestions: [] as string[],
    h1Suggestion: page?.h1 ?? '',
    recommendedOutline: [] as Array<{ heading: string; level: number; points: string[] }>,
    requiredSections: (pageAnalysis?.missingSections ?? []).map((s) => ({
      name: s,
      why: 'Detected as missing on the current page by content-fit analysis.',
    })),
    faqSuggestions: [] as Array<{ question: string; answer: string }>,
    internalLinksToAdd: [] as Array<{ targetUrl: string; anchorIdea: string; rationale: string }>,
    internalLinksFrom: internalLinksFromList,
    schemaSuggestions: (pageAnalysis?.schema?.types ?? []) as string[],
    ctaRecommendation: pageAnalysis?.cta?.notes?.[0] ?? '',
    trustProofNeeded: pageAnalysis?.trustProof?.notes ?? [],
    whatToAvoid: ['Do not invent competitor lists, search volume, or SERP facts.'],
    seoChecklist: [
      'H1 covers the target keyword.',
      '<title> 50-60 chars, includes brand + topic.',
      'Meta description previews the page offer.',
      'Page has clear primary CTA.',
      'At least 3 incoming internal links from related hubs.',
    ],
    validationChecklist: [
      'Re-crawl + verify on-page changes.',
      `Track GSC position + CTR for "${keyword.keyword}" over 28 days.`,
      'Track conversion delta in GA4 over 28 days.',
    ],
  };

  // ---------- Optional AI enrichment ----------

  const aiTaskRunIds: Types.ObjectId[] = [];
  let aiSucceeded = false;
  if (opts.useAI !== false) {
    const briefInput = {
      keyword: keyword.keyword,
      secondaryKeywords: baseline.secondaryKeywords,
      intent: baseline.searchIntent,
      funnelStage: baseline.funnelStage,
      pageRole: page?.pageRole,
      pageUrl: page?.url,
      pageSummary: baseline.currentPageSummary,
      contentGaps,
      goals: goals.map((g) => ({ type: g.type, label: g.label })),
      audit: {
        missingSections: pageAnalysis?.missingSections ?? [],
        ctaClarity: pageAnalysis?.cta?.clarity,
        depth: pageAnalysis?.contentDepth?.verdict,
      },
      evidenceSnapshot: {
        gsc: {
          impressions: fit?.impressions ?? 0,
          clicks: fit?.clicks ?? 0,
          position: fit?.position ?? 0,
        },
        verdict: fit?.verdict,
      },
    };
    const draftResult = await runTask('draft-content-brief', {
      projectId: opts.projectId,
      params: briefInput,
      sourceIds: { keywordId: String(keyword._id), pageId: pageId ?? '' },
    });
    aiTaskRunIds.push(new Types.ObjectId(draftResult.id));
    if (draftResult.status === 'completed' && draftResult.output) {
      const out = draftResult.output as {
        objective: string;
        audience: string;
        titleSuggestions: string[];
        metaSuggestions: string[];
        h1: string;
        outline: Array<{ heading: string; level: number; points: string[] }>;
        requiredSections: Array<{ name: string; why: string }>;
        faqs: Array<{ question: string; answer: string }>;
        internalLinksToAdd: Array<{ targetUrl: string; anchorIdea: string; rationale: string }>;
        schemaSuggestions: string[];
        ctaRecommendation: string;
        trustProofNeeded: string[];
        whatToAvoid: string[];
        seoChecklist: string[];
        validationChecklist: string[];
      };
      baseline.objective = out.objective || baseline.objective;
      baseline.audience = out.audience || baseline.audience;
      baseline.titleSuggestions = out.titleSuggestions ?? [];
      baseline.metaSuggestions = out.metaSuggestions ?? [];
      baseline.h1Suggestion = out.h1 || baseline.h1Suggestion;
      baseline.recommendedOutline = out.outline ?? [];
      // Merge AI-suggested required sections with deterministic ones, dedupe by name.
      const seen = new Set(baseline.requiredSections.map((s) => s.name.toLowerCase()));
      for (const s of out.requiredSections ?? []) {
        if (!seen.has(s.name.toLowerCase())) baseline.requiredSections.push(s);
      }
      baseline.faqSuggestions = out.faqs ?? [];
      baseline.internalLinksToAdd = out.internalLinksToAdd ?? [];
      baseline.schemaSuggestions = [...new Set([...baseline.schemaSuggestions, ...(out.schemaSuggestions ?? [])])];
      baseline.ctaRecommendation = out.ctaRecommendation || baseline.ctaRecommendation;
      baseline.trustProofNeeded = [
        ...baseline.trustProofNeeded,
        ...(out.trustProofNeeded ?? []).filter((x) => !baseline.trustProofNeeded.includes(x)),
      ];
      baseline.whatToAvoid = [
        ...baseline.whatToAvoid,
        ...(out.whatToAvoid ?? []).filter((x) => !baseline.whatToAvoid.includes(x)),
      ];
      baseline.seoChecklist = [
        ...baseline.seoChecklist,
        ...(out.seoChecklist ?? []).filter((x) => !baseline.seoChecklist.includes(x)),
      ];
      baseline.validationChecklist = [
        ...baseline.validationChecklist,
        ...(out.validationChecklist ?? []).filter((x) => !baseline.validationChecklist.includes(x)),
      ];
      aiSucceeded = true;
    } else if (draftResult.status === 'unavailable') {
      dataGaps.push('AI assist unavailable — brief uses deterministic baseline only.');
    } else if (draftResult.status === 'failed') {
      dataGaps.push(`AI draft failed: ${draftResult.error ?? 'unknown'}.`);
    }
  }

  // ---------- Upsert (idempotent per keyword+page+version) ----------

  const version = opts.version ?? 1;
  const filter = {
    projectId: pid,
    keywordId: keyword._id,
    pageId: pageId ? new Types.ObjectId(pageId) : null,
    version,
  };
  const existing = await ContentBriefModel.findOne(filter).lean();

  // Once an analyst takes ownership (status >= analyst-review), we don't overwrite editable text.
  const ANALYST_LOCKED = ['analyst-review', 'approved', 'implemented'];
  const lockText =
    existing && ANALYST_LOCKED.includes(existing.status as string);

  const alwaysSet: Record<string, unknown> = {
    targetKeyword: baseline.targetKeyword,
    searchIntent: baseline.searchIntent,
    funnelStage: baseline.funnelStage,
    contentGaps,
    dataGaps,
    evidenceRefs,
    lastGeneratedAt: new Date(),
  };
  if (aiTaskRunIds.length > 0) {
    alwaysSet.aiTaskRunIds = [...(existing?.aiTaskRunIds ?? []), ...aiTaskRunIds];
  }
  const editableSet = {
    title: baseline.title,
    objective: baseline.objective,
    audience: baseline.audience,
    currentPageSummary: baseline.currentPageSummary,
    pageGoal: baseline.pageGoal,
    titleSuggestions: baseline.titleSuggestions,
    metaSuggestions: baseline.metaSuggestions,
    h1Suggestion: baseline.h1Suggestion,
    recommendedOutline: baseline.recommendedOutline,
    requiredSections: baseline.requiredSections,
    faqSuggestions: baseline.faqSuggestions,
    internalLinksToAdd: baseline.internalLinksToAdd,
    internalLinksFrom: baseline.internalLinksFrom,
    schemaSuggestions: baseline.schemaSuggestions,
    ctaRecommendation: baseline.ctaRecommendation,
    trustProofNeeded: baseline.trustProofNeeded,
    whatToAvoid: baseline.whatToAvoid,
    seoChecklist: baseline.seoChecklist,
    validationChecklist: baseline.validationChecklist,
    secondaryKeywords: baseline.secondaryKeywords,
  };

  const setBlock = lockText ? alwaysSet : { ...alwaysSet, ...editableSet };

  const result = await ContentBriefModel.findOneAndUpdate(
    filter,
    {
      $set: setBlock,
      $setOnInsert: {
        projectId: pid,
        keywordId: keyword._id,
        pageId: pageId ? new Types.ObjectId(pageId) : null,
        version,
        status: 'draft',
        ownerType: 'content',
        ...(lockText ? editableSet : {}),
      },
    },
    { upsert: true, new: true },
  ).lean();
  if (!result) throw new Error('Failed to upsert brief');

  log.info(
    {
      projectId: opts.projectId,
      keyword: keyword.keyword,
      pageId,
      aiSucceeded,
      created: !existing,
      lockText,
    },
    'content brief generated',
  );

  return {
    id: String(result._id),
    created: !existing,
    status: result.status as string,
    dataGaps,
  };
}
