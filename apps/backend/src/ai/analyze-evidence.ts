import { Types } from 'mongoose';
import {
  PageModel,
  PageContentModel,
  FindingModel,
  CrawlRunModel,
  AuditRunModel,
  ProjectModel,
  AIAnalysisModel,
} from '../db';
import { getLogger } from '../config/logger';
import { routeAI } from './router';

const log = getLogger('ai:analyze-evidence');

export type AnalyzeEvidenceOptions = {
  projectId: string;
  aiAnalysisId: string;
  sourceCrawlRunId: string;
  sourceAuditRunId: string;
};

const SYSTEM_PROMPT = `You are a senior SEO analyst.

You will be given:
- crawl summary
- audit findings summary
- markdown samples of representative pages

Use ONLY the provided evidence. Do not invent facts. If evidence is insufficient,
state it. Separate observed facts from your assessment. Be specific to this site.

Return STRICT JSON with this shape (no markdown fencing):
{
  "websiteProfileSuggestion": {
    "websiteCategory": "<one of: service-business|saas|ecommerce|ngo|education|publisher|government|healthcare|local-business|marketplace|documentation|community|event|personal-brand|mixed-other>",
    "categoryConfidence": <0..1>,
    "description": "<2-3 sentence factual summary of what this site is>",
    "audienceSegments": ["..."],
    "primaryGoals": ["..."],
    "conversionActions": ["..."],
    "entityGroups": ["..."],
    "contentSections": ["..."],
    "complianceContext": "<healthcare|finance|legal|govt|none|other>",
    "markets": ["..."],
    "languages": ["..."],
    "reasoning": "<short paragraph citing evidence>"
  },
  "prioritySummary": [
    { "title": "...", "rationale": "...", "evidenceRefs": ["finding:<ruleId>", "page:<url>"] }
  ],
  "contentOpportunities": [
    { "topic": "...", "rationale": "...", "suggestedAudience": "...", "evidenceRefs": ["..."] }
  ],
  "internalLinkingOpportunities": [
    { "fromUrl": "...", "toUrl": "...", "anchorIdea": "...", "rationale": "..." }
  ],
  "geoAeoObservations": [
    { "observation": "...", "impact": "...", "evidenceRefs": ["..."] }
  ],
  "confidence": <0..1>
}`;

export async function analyzeEvidence(opts: AnalyzeEvidenceOptions): Promise<void> {
  const projectId = new Types.ObjectId(opts.projectId);
  const crawlRunId = new Types.ObjectId(opts.sourceCrawlRunId);
  const auditRunId = new Types.ObjectId(opts.sourceAuditRunId);
  const aiId = new Types.ObjectId(opts.aiAnalysisId);

  const [project, crawl, audit, pages, findings] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    CrawlRunModel.findById(crawlRunId).lean(),
    AuditRunModel.findById(auditRunId).lean(),
    PageModel.find({ projectId }).lean(),
    FindingModel.find({ projectId, auditRunId }).lean(),
  ]);
  if (!project) throw new Error('Project not found');

  const pickedPages = pickRepresentative(pages, 12);
  const pageIds = pickedPages.map((p) => p._id);
  const contents = await PageContentModel.find({
    projectId,
    crawlRunId,
    pageId: { $in: pageIds },
  }).lean();
  const contentByPage = new Map(contents.map((c) => [String(c.pageId), c]));

  const pageDigests = pickedPages.map((p) => {
    const c = contentByPage.get(String(p._id));
    const md = (c?.markdown ?? c?.cleanText ?? '').slice(0, 1500);
    return {
      url: p.url,
      role: p.pageRole,
      title: p.title,
      h1: p.h1,
      schemaTypes: (p.schema ?? [])
        .map((s) => (s as Record<string, unknown>)['@type'])
        .filter(Boolean),
      excerpt: md,
    };
  });

  const findingDigest = summarizeFindings(findings);
  const crawlDigest = {
    pagesCrawled: (crawl?.counts as { pages?: number } | undefined)?.pages ?? pages.length,
    healthStatus: (crawl?.diagnostics as Record<string, unknown> | undefined)?.healthStatus,
    sitemapStatus: (crawl?.diagnostics as Record<string, unknown> | undefined)?.sitemapStatus,
    pageRoleDistribution: (crawl?.diagnostics as Record<string, unknown> | undefined)?.pageRoleDistribution,
  };
  const auditDigest = {
    pagesAudited: audit?.pagesAudited ?? 0,
    layeredScores: audit?.layeredScores ?? {},
    statusCounts: audit?.statusCounts ?? {},
    severityCounts: audit?.severityCounts ?? {},
    dataGapCount: audit?.dataGapCount ?? 0,
  };

  const userPrompt = JSON.stringify(
    {
      site: {
        primaryDomain: project.primaryDomain,
        siteName: project.siteName,
        clientName: project.clientName,
      },
      crawl: crawlDigest,
      audit: auditDigest,
      topFindings: findingDigest.top,
      categoryCounts: findingDigest.byCategory,
      representativePages: pageDigests,
    },
    null,
    0,
  );

  let provider = '';
  let model = '';
  let cost = 0;
  let parsed: Record<string, unknown> = {};
  try {
    const res = await routeAI(
      {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        json: true,
        maxOutputTokens: 3500,
        temperature: 0.2,
        tier: 'cheap',
      },
      { allowFallback: true },
    );
    provider = res.provider;
    model = res.model;
    cost = res.costEstimateUsd;
    parsed = safeJson(res.content);
  } catch (err) {
    log.error({ err }, 'AI provider call failed');
    throw err;
  }

  await AIAnalysisModel.updateOne(
    { _id: aiId },
    {
      $set: {
        sourceCrawlRunId: crawlRunId,
        sourceAuditRunId: auditRunId,
        modelProvider: provider,
        modelName: model,
        costEstimate: cost,
        inputSummary: { pagesIncluded: pickedPages.length, findingsIncluded: findingDigest.top.length },
        websiteProfileSuggestion: (parsed.websiteProfileSuggestion as Record<string, unknown>) ?? {},
        prioritySummary: asArray(parsed.prioritySummary),
        contentOpportunities: asArray(parsed.contentOpportunities),
        internalLinkingOpportunities: asArray(parsed.internalLinkingOpportunities),
        geoAeoObservations: asArray(parsed.geoAeoObservations),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        requiresAnalystReview: true,
        status: 'completed',
      },
    },
  );
}

function pickRepresentative<T extends { pageRole?: string; url: string; _id: unknown }>(
  pages: T[],
  limit: number,
): T[] {
  if (pages.length <= limit) return pages;
  const byRole = new Map<string, T[]>();
  for (const p of pages) {
    const r = p.pageRole ?? 'unknown';
    const arr = byRole.get(r) ?? [];
    arr.push(p);
    byRole.set(r, arr);
  }
  const out: T[] = [];
  let i = 0;
  const roleArrays = [...byRole.values()];
  while (out.length < limit && roleArrays.some((a) => a.length > 0)) {
    const arr = roleArrays[i % roleArrays.length]!;
    const item = arr.shift();
    if (item) out.push(item);
    i += 1;
  }
  return out;
}

function summarizeFindings(
  findings: Array<{ ruleId: string; severity: string; category: string; title: string }>,
): {
  top: Array<{ ruleId: string; severity: string; category: string; title: string; affectedPages: number }>;
  byCategory: Record<string, number>;
} {
  const groups = new Map<string, { ruleId: string; severity: string; category: string; title: string; affectedPages: number }>();
  const byCategory: Record<string, number> = {};
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    const g = groups.get(f.ruleId);
    if (g) g.affectedPages += 1;
    else
      groups.set(f.ruleId, {
        ruleId: f.ruleId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        affectedPages: 1,
      });
  }
  const top = [...groups.values()]
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.affectedPages - a.affectedPages)
    .slice(0, 20);
  return { top, byCategory };
}

function severityWeight(s: string): number {
  return ({ critical: 100, high: 75, medium: 50, low: 25, info: 10 } as Record<string, number>)[s] ?? 0;
}

function safeJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        // fall through
      }
    }
    return {};
  }
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  return [];
}
