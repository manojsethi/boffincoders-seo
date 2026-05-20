import { Types } from 'mongoose';
import {
  ProjectModel,
  AuditRunModel,
  FindingModel,
  IssueModel,
  GscRowModel,
  Ga4RowModel,
  CwvMetricModel,
  OpportunityModel,
  SiteConnectionModel,
  FixPlanModel,
  ContentBriefModel,
} from '../db';
import type { ReportSection } from './initial-audit';

/**
 * Weekly / monthly progress report builder. Doc 7 §"Weekly Progress Report" + §"Monthly Progress
 * Report" and Doc 10 §"Phase 5 Done Definition". Output sections must each tell the analyst:
 *  - what changed
 *  - the underlying numbers
 *  - the action they need to take
 *
 * Sections are stored as markdown so the in-tool report viewer renders them as cards.
 */
export async function buildProgressReport(opts: {
  projectId: string;
  type: 'weekly-progress' | 'monthly-progress';
  periodStart: Date;
  periodEnd: Date;
  view: 'client' | 'internal';
}): Promise<{
  markdown: string;
  sections: ReportSection[];
  executiveSummary: string;
  sourceAuditRunIds: Types.ObjectId[];
}> {
  const projectId = new Types.ObjectId(opts.projectId);
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw new Error('Project not found');

  const [
    auditsInPeriod,
    verifiedInPeriod,
    newInPeriod,
    openHigh,
    openOpps,
    closedOppsInPeriod,
    newOppsInPeriod,
    conns,
    gscRanges,
    ga4Ranges,
    cwvLatest,
  ] = await Promise.all([
    AuditRunModel.find({
      projectId,
      completedAt: { $gte: opts.periodStart, $lte: opts.periodEnd },
      status: 'completed',
    })
      .sort({ completedAt: 1 })
      .lean(),
    IssueModel.find({ projectId, verifiedAt: { $gte: opts.periodStart, $lte: opts.periodEnd } }).lean(),
    IssueModel.find({ projectId, createdAt: { $gte: opts.periodStart, $lte: opts.periodEnd } }).lean(),
    IssueModel.find({
      projectId,
      lifecycleStatus: { $in: ['open', 'planned', 'in-progress'] },
      severity: { $in: ['critical', 'high'] },
    })
      .sort({ priority: -1 })
      .limit(15)
      .lean(),
    OpportunityModel.find({ projectId, status: 'open' }).sort({ priority: -1 }).limit(50).lean(),
    OpportunityModel.find({
      projectId,
      status: { $in: ['done', 'not-applicable'] },
      updatedAt: { $gte: opts.periodStart, $lte: opts.periodEnd },
    }).lean(),
    OpportunityModel.find({
      projectId,
      firstSeenAt: { $gte: opts.periodStart, $lte: opts.periodEnd },
    }).lean(),
    SiteConnectionModel.find({ projectId, status: 'connected' })
      .select({ provider: 1, lastSyncedAt: 1 })
      .lean(),
    GscRowModel.aggregate<{
      _id: Date;
      clicks: number;
      impressions: number;
      position: number;
      rows: number;
    }>([
      { $match: { projectId } },
      {
        $group: {
          _id: '$rangeEnd',
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          position: { $avg: '$position' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]),
    Ga4RowModel.aggregate<{
      _id: Date;
      sessions: number;
      engagedSessions: number;
      conversions: number;
      rows: number;
    }>([
      { $match: { projectId, channel: { $regex: /organic/i } } },
      {
        $group: {
          _id: '$rangeEnd',
          sessions: { $sum: '$sessions' },
          engagedSessions: { $sum: '$engagedSessions' },
          conversions: { $sum: '$conversions' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]),
    CwvMetricModel.aggregate<{
      _id: { strategy: string };
      lcp: number;
      inp: number;
      cls: number;
      poor: number;
      good: number;
      total: number;
    }>([
      { $match: { projectId } },
      { $sort: { capturedAt: -1 } },
      {
        $group: {
          _id: { pageUrl: '$pageUrl', strategy: '$strategy' },
          lcp: { $first: '$lcp' },
          inp: { $first: '$inp' },
          cls: { $first: '$cls' },
        },
      },
      {
        $group: {
          _id: { strategy: '$_id.strategy' },
          lcp: { $avg: '$lcp' },
          inp: { $avg: '$inp' },
          cls: { $avg: '$cls' },
          poor: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $gt: ['$lcp', 4000] },
                    { $gt: ['$inp', 500] },
                    { $gt: ['$cls', 0.25] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          good: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: ['$lcp', 2500] },
                    { $lte: ['$inp', 200] },
                    { $lte: ['$cls', 0.1] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const sourceAuditRunIds = auditsInPeriod.map((a) => a._id);
  const newFindingCount = await FindingModel.countDocuments({
    projectId,
    auditRunId: { $in: sourceAuditRunIds },
  });

  const goals = (project.goals as Array<{ id: string; type: string; label?: string; status?: string; target?: number; baseline?: number; kpi?: string }> | undefined) ?? [];
  const gscCur = gscRanges[0];
  const gscPrev = gscRanges[1];
  const ga4Cur = ga4Ranges[0];
  const ga4Prev = ga4Ranges[1];
  const mobCwv = cwvLatest.find((r) => r._id.strategy === 'mobile');
  const dskCwv = cwvLatest.find((r) => r._id.strategy === 'desktop');

  const delta = (cur: number | undefined, prev: number | undefined): string => {
    if (cur == null || prev == null) return '—';
    if (prev === 0) return cur === 0 ? '0%' : 'new';
    const pct = ((cur - prev) / prev) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  const sections: ReportSection[] = [];

  // 1. Period summary
  sections.push({
    key: 'period',
    title: 'Period summary',
    body: [
      `Period: **${opts.periodStart.toISOString().slice(0, 10)} → ${opts.periodEnd.toISOString().slice(0, 10)}** (${opts.type === 'weekly-progress' ? 'weekly' : 'monthly'} cadence).`,
      '',
      `Audits in period: **${auditsInPeriod.length}** · New findings: **${newFindingCount}** · Verified fixes: **${verifiedInPeriod.length}** · New issues opened: **${newInPeriod.length}**.`,
      '',
      `Opportunities — open: **${openOpps.length}**, new this period: **${newOppsInPeriod.length}**, closed this period: **${closedOppsInPeriod.length}**.`,
    ].join('\n'),
  });

  // 2. Data freshness — analyst must know whether data is stale before trusting other sections
  const fresh = (lastSyncedAt?: Date | null): string => {
    if (!lastSyncedAt) return 'never';
    const h = (Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000;
    if (h < 1) return 'just now';
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };
  const gscConn = conns.find((c) => c.provider === 'gsc');
  const ga4Conn = conns.find((c) => c.provider === 'ga4');
  sections.push({
    key: 'data-freshness',
    title: 'Data freshness',
    body: [
      `- GSC: ${gscConn ? `connected, last sync **${fresh(gscConn.lastSyncedAt)}**` : '**not connected** — search performance section is empty'}`,
      `- GA4: ${ga4Conn ? `connected, last sync **${fresh(ga4Conn.lastSyncedAt)}**` : '**not connected** — traffic + conversion sections are empty'}`,
      `- CWV: latest rows ${mobCwv || dskCwv ? `captured for **${(mobCwv?.total ?? 0) + (dskCwv?.total ?? 0)} URLs**` : '**not collected** — performance section is empty'}`,
      `- Goals: **${goals.length}** defined${goals.length === 0 ? ' — opportunity weighting is generic without goals' : ''}`,
    ].join('\n'),
  });

  // 3. Search performance movement
  if (gscCur) {
    const ctrCur = gscCur.impressions > 0 ? (gscCur.clicks / gscCur.impressions) * 100 : 0;
    const ctrPrev =
      gscPrev && gscPrev.impressions > 0 ? (gscPrev.clicks / gscPrev.impressions) * 100 : null;
    sections.push({
      key: 'search-movement',
      title: 'Search performance',
      body: [
        '| Metric | Current | Previous | Δ |',
        '| --- | --- | --- | --- |',
        `| Clicks | ${gscCur.clicks.toLocaleString()} | ${gscPrev?.clicks?.toLocaleString() ?? '—'} | ${delta(gscCur.clicks, gscPrev?.clicks)} |`,
        `| Impressions | ${gscCur.impressions.toLocaleString()} | ${gscPrev?.impressions?.toLocaleString() ?? '—'} | ${delta(gscCur.impressions, gscPrev?.impressions)} |`,
        `| CTR | ${ctrCur.toFixed(2)}% | ${ctrPrev != null ? ctrPrev.toFixed(2) + '%' : '—'} | ${delta(ctrCur, ctrPrev ?? undefined)} |`,
        `| Avg position | ${gscCur.position.toFixed(1)} | ${gscPrev ? gscPrev.position.toFixed(1) : '—'} | ${delta(gscCur.position, gscPrev?.position)} |`,
      ].join('\n'),
    });
  } else {
    sections.push({
      key: 'search-movement',
      title: 'Search performance',
      body: '_No GSC data yet. Connect Search Console on Settings → Integrations to populate this section._',
    });
  }

  // 4. Traffic + conversion movement
  if (ga4Cur) {
    const erCur = ga4Cur.sessions > 0 ? (ga4Cur.engagedSessions / ga4Cur.sessions) * 100 : 0;
    const erPrev =
      ga4Prev && ga4Prev.sessions > 0 ? (ga4Prev.engagedSessions / ga4Prev.sessions) * 100 : null;
    const crCur = ga4Cur.sessions > 0 ? (ga4Cur.conversions / ga4Cur.sessions) * 100 : 0;
    const crPrev =
      ga4Prev && ga4Prev.sessions > 0 ? (ga4Prev.conversions / ga4Prev.sessions) * 100 : null;
    sections.push({
      key: 'traffic-conversion',
      title: 'Organic traffic + conversion',
      body: [
        '| Metric | Current | Previous | Δ |',
        '| --- | --- | --- | --- |',
        `| Sessions | ${ga4Cur.sessions.toLocaleString()} | ${ga4Prev?.sessions?.toLocaleString() ?? '—'} | ${delta(ga4Cur.sessions, ga4Prev?.sessions)} |`,
        `| Engagement rate | ${erCur.toFixed(2)}% | ${erPrev != null ? erPrev.toFixed(2) + '%' : '—'} | ${delta(erCur, erPrev ?? undefined)} |`,
        `| Conversions | ${ga4Cur.conversions.toLocaleString()} | ${ga4Prev?.conversions?.toLocaleString() ?? '—'} | ${delta(ga4Cur.conversions, ga4Prev?.conversions)} |`,
        `| Conversion rate | ${crCur.toFixed(2)}% | ${crPrev != null ? crPrev.toFixed(2) + '%' : '—'} | ${delta(crCur, crPrev ?? undefined)} |`,
      ].join('\n'),
    });
  } else {
    sections.push({
      key: 'traffic-conversion',
      title: 'Organic traffic + conversion',
      body: '_No GA4 data yet. Connect GA4 on Settings → Integrations to populate this section._',
    });
  }

  // 5. CWV change
  if (mobCwv || dskCwv) {
    const lines: string[] = ['| Strategy | Pages | Good | Poor | Avg LCP | Avg INP | Avg CLS |', '| --- | --- | --- | --- | --- | --- | --- |'];
    for (const r of [mobCwv, dskCwv]) {
      if (!r) continue;
      lines.push(
        `| ${r._id.strategy} | ${r.total} | ${r.good} | ${r.poor} | ${Math.round(r.lcp)} ms | ${Math.round(r.inp)} ms | ${r.cls.toFixed(2)} |`,
      );
    }
    sections.push({ key: 'cwv', title: 'Core Web Vitals', body: lines.join('\n') });
  } else {
    sections.push({
      key: 'cwv',
      title: 'Core Web Vitals',
      body: '_No CWV data yet. Run a PSI/CWV sync from Settings → Integrations to populate this section._',
    });
  }

  // 6. Opportunity movement (top 10 open + new this period)
  const oppByType = new Map<string, number>();
  for (const o of openOpps) oppByType.set(o.type, (oppByType.get(o.type) ?? 0) + 1);
  const topOpenOpps = openOpps.slice(0, 10);
  sections.push({
    key: 'opportunities',
    title: 'Opportunities',
    body: [
      [...oppByType.entries()].map(([t, n]) => `**${t}**: ${n}`).join(' · ') || '_No open opportunities._',
      '',
      topOpenOpps.length > 0 ? '### Top open opportunities' : '',
      ...topOpenOpps.map(
        (o, i) =>
          `${i + 1}. [${o.actionPriority}] ${o.title} — priority **${o.priority}**, ${o.confidenceLevel} confidence`,
      ),
      newOppsInPeriod.length > 0 ? '' : '',
      newOppsInPeriod.length > 0 ? `### New this period (${newOppsInPeriod.length})` : '',
      ...newOppsInPeriod.slice(0, 10).map((o, i) => `${i + 1}. [${o.actionPriority}] ${o.title}`),
    ]
      .filter(Boolean)
      .join('\n'),
  });

  // 7. Goal progress
  if (goals.length > 0) {
    sections.push({
      key: 'goal-progress',
      title: 'Goal progress',
      body: goals
        .map((g) => {
          const linkedOpps = openOpps.filter((o) => o.goalId === g.id);
          return [
            `### ${g.label || g.type}`,
            `Type: **${g.type}** · Status: **${g.status ?? 'active'}**${g.kpi ? ` · KPI: **${g.kpi}**` : ''}${g.target != null ? ` · Target: **${g.target}**` : ''}${g.baseline != null ? ` · Baseline: **${g.baseline}**` : ''}`,
            `Open opportunities tied to this goal: **${linkedOpps.length}**`,
          ].join('\n');
        })
        .join('\n\n'),
    });
  } else {
    sections.push({
      key: 'goal-progress',
      title: 'Goal progress',
      body: '_No goals defined. Add goals on the Goals tab so opportunity weighting and progress reporting reflect business outcomes._',
    });
  }

  // 8. Fixes verified
  sections.push({
    key: 'fixed',
    title: 'Fixes verified',
    body:
      verifiedInPeriod.length === 0
        ? '_No fixes verified this period._'
        : verifiedInPeriod
            .slice(0, opts.view === 'client' ? 10 : 30)
            .map((i, idx) => `${idx + 1}. ${i.title} _(severity: ${i.severity})_`)
            .join('\n'),
  });

  // 8b. Fix plan progress. Doc continuation §"Reporting integration".
  // Internal view shows internalNotes + failed validations + owners. Client view hides them and
  // shows only items where clientVisible === true.
  const [activePlan, briefsApprovedInPeriod] = await Promise.all([
    FixPlanModel.findOne({ projectId, status: 'active' }).sort({ updatedAt: -1 }).lean(),
    ContentBriefModel.find({
      projectId,
      status: { $in: ['approved', 'implemented'] },
      approvedAt: { $gte: opts.periodStart, $lte: opts.periodEnd },
    })
      .select({ title: 1, targetKeyword: 1, status: 1 })
      .lean(),
  ]);
  if (activePlan) {
    const items = (activePlan.items ?? []) as Array<{
      title?: string;
      status?: string;
      validationStatus?: string;
      ownerType?: string;
      priority?: string;
      clientVisible?: boolean;
      internalNotes?: string;
      validatedAt?: Date | null;
      validationEvidence?: Record<string, unknown>;
    }>;
    const visible = items.filter((it) =>
      opts.view === 'client' ? it.clientVisible !== false : true,
    );
    const validated = visible.filter((it) => it.status === 'validated');
    const failed = visible.filter((it) => it.status === 'failed-validation');
    const inProgress = visible.filter(
      (it) => it.status === 'in-progress' || it.status === 'fixed' || it.status === 'ready-for-validation',
    );
    const planned = visible.filter((it) => it.status === 'planned');
    const inconclusive = visible.filter((it) => it.validationStatus === 'inconclusive');

    const fmtItem = (it: { title?: string; ownerType?: string; priority?: string }): string => {
      if (opts.view === 'client') return `${it.title ?? '(untitled)'}`;
      return `[${it.priority ?? 'P2'} · ${it.ownerType ?? 'analyst'}] ${it.title ?? '(untitled)'}`;
    };
    sections.push({
      key: 'fix-plan-progress',
      title: `Fix plan progress — ${activePlan.title}`,
      body: [
        `Active plan **${activePlan.title}** · ${visible.length} item${visible.length === 1 ? '' : 's'} in ${opts.view} view.`,
        '',
        `**Validated** (${validated.length}):`,
        validated.length === 0
          ? '- _none_'
          : validated.map((it) => `- ${fmtItem(it)}`).join('\n'),
        '',
        `**In progress** (${inProgress.length}):`,
        inProgress.length === 0
          ? '- _none_'
          : inProgress.map((it) => `- ${fmtItem(it)}`).join('\n'),
        '',
        `**Planned** (${planned.length}):`,
        planned.length === 0
          ? '- _none_'
          : planned.map((it) => `- ${fmtItem(it)}`).join('\n'),
        opts.view === 'internal' && failed.length > 0 ? '' : '',
        opts.view === 'internal' && failed.length > 0 ? `**Failed validation** (${failed.length}):` : '',
        opts.view === 'internal' && failed.length > 0
          ? failed
              .map((it) => {
                const reason = (it.validationEvidence as { reason?: string } | undefined)?.reason;
                return `- ${fmtItem(it)}${reason ? ` — ${reason}` : ''}`;
              })
              .join('\n')
          : '',
        opts.view === 'internal' && inconclusive.length > 0 ? '' : '',
        opts.view === 'internal' && inconclusive.length > 0
          ? `**Inconclusive validations** (${inconclusive.length}):`
          : '',
        opts.view === 'internal' && inconclusive.length > 0
          ? inconclusive
              .map((it) => {
                const reason = (it.validationEvidence as { reason?: string } | undefined)?.reason;
                return `- ${fmtItem(it)}${reason ? ` — ${reason}` : ''}`;
              })
              .join('\n')
          : '',
      ]
        .filter((s) => s !== '')
        .join('\n'),
    });
  } else {
    sections.push({
      key: 'fix-plan-progress',
      title: 'Fix plan progress',
      body: '_No active fix plan. Open the Fix plans tab and click "Generate weekly plan" to start one._',
    });
  }

  // 8c. Approved content briefs in period
  sections.push({
    key: 'approved-briefs',
    title: 'Approved content briefs',
    body:
      briefsApprovedInPeriod.length === 0
        ? '_No content briefs approved this period._'
        : briefsApprovedInPeriod
            .map(
              (b, idx) =>
                `${idx + 1}. **${b.title}** — target keyword: _${b.targetKeyword ?? '(unknown)'}_${
                  opts.view === 'internal' ? ` _(${b.status})_` : ''
                }`,
            )
            .join('\n'),
  });

  // 9. Open critical/high issues
  sections.push({
    key: 'open-critical',
    title: 'Open critical/high issues',
    body:
      openHigh.length === 0
        ? '_None open._'
        : openHigh
            .map(
              (i, idx) =>
                `${idx + 1}. [${i.severity.toUpperCase()}] ${i.title} _(priority ${i.priority})_`,
            )
            .join('\n'),
  });

  // 10. Recommended next actions — derived, not a list of every issue
  const recs: string[] = [];
  if (gscCur && gscPrev && gscCur.clicks < gscPrev.clicks * 0.9) {
    recs.push('Clicks dropped >10% vs prior period. Audit ranking declines on top pages first.');
  }
  if (ga4Cur && ga4Cur.sessions > 0 && ga4Cur.conversions / ga4Cur.sessions < 0.005) {
    recs.push('Conversion rate < 0.5%. Run a CTA + page-intent review on top landing pages.');
  }
  if (mobCwv && mobCwv.poor > 0) {
    recs.push(`Fix CWV on ${mobCwv.poor} mobile page${mobCwv.poor === 1 ? '' : 's'} (LCP/INP/CLS in poor band). Open CWV dashboard for the slowest important pages.`);
  }
  if (openHigh.length > 0) {
    recs.push(`Close the ${openHigh.length} open critical/high issue${openHigh.length === 1 ? '' : 's'} listed above before opening new work.`);
  }
  if (openOpps.length > 0) {
    const p1 = openOpps.filter((o) => o.actionPriority === 'P1').length;
    if (p1 > 0) recs.push(`Triage the ${p1} P1 opportunit${p1 === 1 ? 'y' : 'ies'} for this sprint.`);
  }
  if (goals.length === 0) {
    recs.push('Define at least one project goal so reporting can show business impact.');
  }
  sections.push({
    key: 'next-actions',
    title: 'Recommended next actions',
    body: recs.length === 0 ? '_No automatic recommendations — nothing changed dramatically in this period._' : recs.map((r, i) => `${i + 1}. ${r}`).join('\n'),
  });

  const execSummary = [
    `${opts.type === 'weekly-progress' ? 'Weekly' : 'Monthly'} progress for ${project.siteName}: `,
    gscCur ? `${gscCur.clicks.toLocaleString()} clicks (${delta(gscCur.clicks, gscPrev?.clicks)} vs prev), ` : '',
    ga4Cur ? `${ga4Cur.sessions.toLocaleString()} organic sessions (${delta(ga4Cur.sessions, ga4Prev?.sessions)}), ` : '',
    `${verifiedInPeriod.length} fixes verified, ${newInPeriod.length} new issues, ${openHigh.length} open critical/high.`,
  ].join('');

  const markdown = [
    `# ${opts.type === 'weekly-progress' ? 'Weekly' : 'Monthly'} Progress — ${project.siteName}`,
    `_${project.primaryDomain} · ${opts.periodStart.toISOString().slice(0, 10)} → ${opts.periodEnd.toISOString().slice(0, 10)} · ${opts.view} view_`,
    '',
    '## Executive summary',
    '',
    execSummary,
    '',
    ...sections.flatMap((s) => [`## ${s.title}`, '', s.body, '']),
  ].join('\n');

  return { markdown, sections, executiveSummary: execSummary, sourceAuditRunIds };
}
