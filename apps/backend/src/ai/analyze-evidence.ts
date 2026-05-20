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
import { runTask } from './task-service';
// Ensure tasks register on import.
import './tasks';

const log = getLogger('ai:analyze-evidence');

export type AnalyzeEvidenceOptions = {
  projectId: string;
  aiAnalysisId: string;
  sourceCrawlRunId: string;
  sourceAuditRunId: string;
};

// Prompt + schema for project profile inference now live in
// `apps/backend/src/ai/tasks/index.ts` as the registered task `infer-website-profile`. This file
// is a thin shim that gathers evidence, calls `runTask`, and persists the validated output to
// AIAnalysisModel for the legacy UI. Doc continuation §"Phase 4 — one AI path".

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

  const params = {
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
  };

  // All AI usage goes through the task service. Audit-logged, schema-validated, graceful when
  // no provider is configured. Doc continuation §"Phase 4 — one AI path".
  const result = await runTask('infer-website-profile', {
    projectId: opts.projectId,
    params,
    sourceIds: {
      crawlRunId: String(crawlRunId),
      auditRunId: String(auditRunId),
      aiAnalysisId: String(aiId),
    },
  });
  if (result.status !== 'completed' || !result.output) {
    const reason =
      result.status === 'unavailable'
        ? 'no AI provider configured'
        : (result.error ?? `status=${result.status}`);
    log.error({ reason, runId: result.id }, 'website-profile inference failed');
    await AIAnalysisModel.updateOne(
      { _id: aiId },
      {
        $set: {
          sourceCrawlRunId: crawlRunId,
          sourceAuditRunId: auditRunId,
          aiTaskRunId: result.id,
          status: 'failed',
          requiresAnalystReview: true,
          error: reason,
        },
      },
    );
    // Throw so the Agenda job is also marked failed. Otherwise the job monitor would show the
    // outer Agenda job as completed while the underlying AI task failed. Audit 2026-05-20.
    throw new Error(`website-profile inference failed: ${reason}`);
  }

  const out = result.output as {
    websiteProfileSuggestion: Record<string, unknown>;
    prioritySummary?: Array<Record<string, unknown>>;
    contentOpportunities?: Array<Record<string, unknown>>;
    internalLinkingOpportunities?: Array<Record<string, unknown>>;
    geoAeoObservations?: Array<Record<string, unknown>>;
    confidence?: number;
  };

  await AIAnalysisModel.updateOne(
    { _id: aiId },
    {
      $set: {
        sourceCrawlRunId: crawlRunId,
        sourceAuditRunId: auditRunId,
        modelProvider: result.provider ?? '',
        modelName: result.model ?? '',
        costEstimate: result.costEstimateUsd,
        aiTaskRunId: result.id,
        inputSummary: { pagesIncluded: pickedPages.length, findingsIncluded: findingDigest.top.length },
        websiteProfileSuggestion: out.websiteProfileSuggestion ?? {},
        prioritySummary: asArray(out.prioritySummary),
        contentOpportunities: asArray(out.contentOpportunities),
        internalLinkingOpportunities: asArray(out.internalLinkingOpportunities),
        geoAeoObservations: asArray(out.geoAeoObservations),
        confidence: typeof out.confidence === 'number' ? out.confidence : result.confidence,
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

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  return [];
}
