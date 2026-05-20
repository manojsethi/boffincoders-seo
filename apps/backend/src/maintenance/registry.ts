// Maintenance task registry. Doc continuation §"Phase 3 — controlled maintenance task".
//
// Each task is:
//   - idempotent (re-running with same input is safe)
//   - supports dryRun (returns preview without writes)
//   - returns a typed `result` object the UI renders verbatim
//
// All maintenance runs are persisted in MaintenanceRunModel so the analyst has a clear audit log.

import { Types } from 'mongoose';
import { KeywordModel } from '../db';
import { analyzeKeywordFits } from '../keyword-fit/analyze';
import { generateRecommendationsFromKeywordFit } from '../recommendations/from-keyword-fit';

export type MaintenanceTask<TParams = Record<string, unknown>, TResult = Record<string, unknown>> = {
  key: string;
  label: string;
  description: string;
  // What the task touches (used by UI to decide which tabs to refetch).
  affects: string[];
  // Safety classification — UI uses this to require confirmation.
  riskLevel: 'low' | 'medium' | 'high';
  // Run the task. If dryRun=true, must not write — return preview counts only.
  run: (ctx: { projectId: string; params: TParams; dryRun: boolean }) => Promise<TResult>;
};

/**
 * Cleanup of legacy auto-mapped GSC keywords. Pre-provenance versions of this app auto-mapped
 * GSC import rows to their ranking page; those mappings carry no analyst sign-off, so we cannot
 * trust them for content-fit recommendations.
 */
const cleanupLegacyKeywordMappings: MaintenanceTask = {
  key: 'cleanup-legacy-keyword-mappings',
  label: 'Clean up legacy GSC auto-mappings',
  description:
    'Unsets `mappedPageId` for any GSC keyword whose mapping has no analyst provenance, then recomputes keyword fit and rejects stale keyword-fit recommendations. Analyst-owned mappings are not touched.',
  affects: ['keywords', 'keyword-fit', 'recommendations'],
  riskLevel: 'medium',
  run: async ({ projectId, dryRun }) => {
    const pid = new Types.ObjectId(projectId);
    const matchQuery = {
      projectId: pid,
      source: 'gsc',
      mappedPageId: { $ne: null },
      $or: [
        { mappingSource: { $exists: false } },
        { mappingSource: null },
        { mappingSource: { $in: ['import', 'unknown'] } },
      ],
    };
    if (dryRun) {
      const preview = await KeywordModel.find(matchQuery)
        .select({ _id: 1, keyword: 1, mappedPageId: 1, mappingSource: 1 })
        .limit(50)
        .lean();
      const total = await KeywordModel.countDocuments(matchQuery);
      return {
        wouldClean: total,
        previewSample: preview.map((p) => ({
          keyword: p.keyword,
          mappedPageId: p.mappedPageId ? String(p.mappedPageId) : null,
          mappingSource: (p as { mappingSource?: string | null }).mappingSource ?? null,
        })),
        note: 'Dry run only — no writes performed. Confirm and re-run without dryRun to apply.',
      };
    }
    const r = await KeywordModel.updateMany(matchQuery, {
      $set: { mappedPageId: null, status: 'candidate', mappingSource: null, mappedAt: null },
    });
    const cleaned = r.modifiedCount ?? 0;
    const fit = await analyzeKeywordFits({ projectId });
    const recs = await generateRecommendationsFromKeywordFit({ projectId });
    return {
      cleaned,
      keywordFit: fit,
      recommendations: recs,
      note:
        cleaned === 0
          ? 'No legacy mappings found — system is already clean.'
          : `Cleared ${cleaned} mapping(s); recomputed fit + closed stale keyword-fit recommendations.`,
    };
  },
};

export const MAINTENANCE_TASKS: Record<string, MaintenanceTask> = {
  [cleanupLegacyKeywordMappings.key]: cleanupLegacyKeywordMappings,
};

export function listTasks(): Array<Omit<MaintenanceTask, 'run'>> {
  return Object.values(MAINTENANCE_TASKS).map(({ run: _, ...meta }) => meta);
}
