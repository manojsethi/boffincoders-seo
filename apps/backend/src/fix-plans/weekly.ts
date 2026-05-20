import { Types } from 'mongoose';
import {
  RecommendationModel,
  OpportunityModel,
  ContentBriefModel,
  IssueModel,
} from '../db';
import { buildItemFromSource } from './validate';

/**
 * Generate a weekly fix plan draft. Pulls a deterministic mix of:
 *  - top approved/planned recommendations
 *  - top P0/P1 open opportunities
 *  - approved content briefs that have not been implemented yet
 *  - critical/high open issues
 *
 * The analyst can still edit/remove items before activating. We never auto-promote work to
 * `active` — analyst review is mandatory.
 */
export async function generateWeeklyPlanDraft(opts: {
  projectId: string;
  limitPerSource?: number;
}): Promise<{
  title: string;
  description: string;
  items: Array<Record<string, unknown>>;
  periodStart: Date;
  periodEnd: Date;
}> {
  const pid = new Types.ObjectId(opts.projectId);
  const cap = opts.limitPerSource ?? 5;

  const [recs, opps, briefs, issues] = await Promise.all([
    RecommendationModel.find({
      projectId: pid,
      status: { $in: ['approved', 'planned', 'in_progress'] },
    })
      .sort({ priorityScore: -1 })
      .limit(cap)
      .lean(),
    OpportunityModel.find({
      projectId: pid,
      status: 'open',
      actionPriority: { $in: ['P0', 'P1'] },
    })
      .sort({ priority: -1 })
      .limit(cap)
      .lean(),
    ContentBriefModel.find({
      projectId: pid,
      status: { $in: ['approved', 'analyst-review'] },
    })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
    IssueModel.find({
      projectId: pid,
      lifecycleStatus: { $in: ['open', 'planned', 'in-progress'] },
      severity: { $in: ['critical', 'high'] },
    })
      .sort({ priority: -1 })
      .limit(cap)
      .lean(),
  ]);

  const items: Array<Record<string, unknown>> = [];
  for (const r of recs) {
    items.push(
      await buildItemFromSource(opts.projectId, {
        sourceType: 'recommendation',
        sourceId: String(r._id),
      }),
    );
  }
  for (const o of opps) {
    items.push(
      await buildItemFromSource(opts.projectId, {
        sourceType: 'opportunity',
        sourceId: String(o._id),
      }),
    );
  }
  for (const b of briefs) {
    items.push(
      await buildItemFromSource(opts.projectId, {
        sourceType: 'content-brief',
        sourceId: String(b._id),
      }),
    );
  }
  for (const i of issues) {
    items.push(
      await buildItemFromSource(opts.projectId, {
        sourceType: 'issue',
        sourceId: String(i._id),
      }),
    );
  }

  // De-dupe: prefer recommendations over their underlying issues so we don't list the same
  // problem twice.
  const issueIdsCoveredByRecs = new Set(
    items.filter((x) => x.sourceType === 'recommendation' && x.issueId).map((x) => String(x.issueId)),
  );
  const filtered = items.filter(
    (x) => !(x.sourceType === 'issue' && issueIdsCoveredByRecs.has(String(x.issueId))),
  );

  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 7);

  const counts = filtered.reduce<Record<string, number>>((acc, x) => {
    const k = String(x.sourceType);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const description = [
    `Weekly draft generated from top recommendations, opportunities, approved briefs, and critical issues.`,
    `Counts: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}.`,
    `Review and remove anything that doesn't belong before activating.`,
  ].join('\n');

  const title = `Weekly fix plan — ${periodStart.toISOString().slice(0, 10)}`;

  return { title, description, items: filtered, periodStart, periodEnd };
}
