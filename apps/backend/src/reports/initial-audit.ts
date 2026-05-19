import { Types } from 'mongoose';
import {
  ProjectModel,
  CrawlRunModel,
  AuditRunModel,
  FindingModel,
  IssueModel,
  AIAnalysisModel,
  WebsiteProfileModel,
} from '../db';
import { ACTIVE_LIFECYCLE_STATUSES } from '../audit/lifecycle';

export type ReportSection = { key: string; title: string; body: string };

export async function buildInitialAuditReport(opts: {
  projectId: string;
  crawlRunId: string;
  auditRunId: string;
  view: 'client' | 'internal';
}): Promise<{ markdown: string; sections: ReportSection[]; executiveSummary: string }> {
  const projectId = new Types.ObjectId(opts.projectId);
  const crawlRunId = new Types.ObjectId(opts.crawlRunId);
  const auditRunId = new Types.ObjectId(opts.auditRunId);

  const [project, profile, crawl, audit, findings, issues, ai] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    WebsiteProfileModel.findOne({ projectId }).lean(),
    CrawlRunModel.findById(crawlRunId).lean(),
    AuditRunModel.findById(auditRunId).lean(),
    FindingModel.find({ projectId, auditRunId }).lean(),
    IssueModel.find({ projectId, lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES } })
      .sort({ priority: -1 })
      .limit(50)
      .lean(),
    AIAnalysisModel.findOne({ projectId, sourceAuditRunId: auditRunId }).lean(),
  ]);
  if (!project) throw new Error('Project not found');

  const profileForCtx = profile
    ? {
        websiteCategory: profile.websiteCategory ?? undefined,
        description: profile.description ?? undefined,
        markets: (profile.markets ?? []) as string[],
        languages: (profile.languages ?? []) as string[],
      }
    : null;

  const sections: ReportSection[] = [
    { key: 'site-context', title: 'Site context', body: contextSection(project, profileForCtx) },
    { key: 'crawl-summary', title: 'Crawl summary', body: crawlSection(crawl) },
    { key: 'audit-summary', title: 'Audit summary', body: auditSection(audit, findings) },
    { key: 'critical-issues', title: 'Critical issues', body: issuesSection(issues, opts.view) },
  ];
  if (ai) sections.push({ key: 'ai-observations', title: 'AI observations', body: aiSection(ai, opts.view) });
  sections.push({ key: 'next-steps', title: 'Recommended next steps', body: nextStepsSection(issues) });

  const executiveSummary = buildExecSummary(project, audit, issues);
  const markdown = renderMarkdown(project, executiveSummary, sections, opts.view);
  return { markdown, sections, executiveSummary };
}

function contextSection(
  project: { clientName: string; siteName: string; primaryDomain: string },
  profile: { websiteCategory?: string; description?: string; markets?: string[]; languages?: string[] } | null,
): string {
  const lines = [`**Client:** ${project.clientName}`, `**Site:** ${project.siteName} (${project.primaryDomain})`];
  if (profile?.websiteCategory) lines.push(`**Category:** ${profile.websiteCategory}`);
  if (profile?.description) lines.push(`**Description:** ${profile.description}`);
  if (profile?.markets?.length) lines.push(`**Markets:** ${profile.markets.join(', ')}`);
  if (profile?.languages?.length) lines.push(`**Languages:** ${profile.languages.join(', ')}`);
  return lines.join('\n\n');
}

function crawlSection(crawl: Record<string, unknown> | null): string {
  if (!crawl) return '_No crawl data available._';
  const diag = (crawl.diagnostics ?? {}) as Record<string, unknown>;
  const counts = (crawl.counts ?? {}) as Record<string, number>;
  return [
    `Pages crawled: **${counts.pages ?? 0}**`,
    `Pages with markdown extracted: **${counts.markdown ?? 0}**`,
    `Crawl health: **${diag.healthStatus ?? 'unknown'}**`,
    `Sitemap: **${diag.sitemapStatus ?? 'unknown'}**`,
    `Failed URLs: ${diag.failedCount ?? 0}`,
    `Blocked by robots: ${diag.blockedByRobotsCount ?? 0}`,
  ].join('\n\n');
}

function auditSection(
  audit: Record<string, unknown> | null,
  findings: Array<{ severity: string; category: string }>,
): string {
  if (!audit) return '_No audit data._';
  const sev = countBy(findings, (f) => f.severity);
  const cat = countBy(findings, (f) => f.category);
  return [
    `Pages audited: **${audit.pagesAudited ?? 0}**`,
    '',
    '### Findings by severity',
    Object.entries(sev).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    '',
    '### Findings by category',
    Object.entries(cat).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
  ].join('\n');
}

function issuesSection(
  issues: Array<{ title: string; severity: string; category: string; priority: number; impact: number; effort: string; confidence: number }>,
  view: 'client' | 'internal',
): string {
  if (issues.length === 0) return '_No open issues._';
  const top = issues.slice(0, view === 'client' ? 10 : 25);
  return top
    .map(
      (i, idx) =>
        `**${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}**\n\n` +
        `_Category:_ ${i.category} · _Priority:_ ${i.priority} · _Impact:_ ${i.impact} · _Effort:_ ${i.effort}` +
        (view === 'internal' ? ` · _Confidence:_ ${i.confidence}` : '') +
        '\n',
    )
    .join('\n');
}

function aiSection(ai: Record<string, unknown>, view: 'client' | 'internal'): string {
  const sections: string[] = [];
  const profileSugg = ai.websiteProfileSuggestion as Record<string, unknown> | undefined;
  if (profileSugg?.description) {
    sections.push(`**Detected category:** ${profileSugg.websiteCategory ?? 'unknown'}\n\n${profileSugg.description}`);
  }
  const priorities = (ai.prioritySummary ?? []) as Array<{ title?: string; rationale?: string }>;
  if (priorities.length > 0) {
    sections.push(
      '### AI-suggested priorities\n\n' +
        priorities
          .slice(0, view === 'client' ? 5 : 10)
          .map((p) => `- **${p.title ?? 'Untitled'}** — ${p.rationale ?? ''}`)
          .join('\n'),
    );
  }
  const opps = (ai.contentOpportunities ?? []) as Array<{ topic?: string; rationale?: string }>;
  if (opps.length > 0) {
    sections.push(
      '### Content opportunities\n\n' +
        opps
          .slice(0, view === 'client' ? 5 : 10)
          .map((o) => `- **${o.topic ?? 'Topic'}** — ${o.rationale ?? ''}`)
          .join('\n'),
    );
  }
  return sections.join('\n\n') || '_AI analysis pending or empty._';
}

function nextStepsSection(issues: Array<{ title: string; effort: string }>): string {
  if (issues.length === 0) return '- No immediate actions required.';
  return issues.slice(0, 5).map((i, idx) => `${idx + 1}. ${i.title} _(effort: ${i.effort})_`).join('\n');
}

function buildExecSummary(
  project: { clientName: string; siteName: string },
  audit: Record<string, unknown> | null,
  issues: Array<{ severity: string }>,
): string {
  const totalIssues = issues.length;
  const critical = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
  return (
    `Initial SEO audit for **${project.siteName}** (${project.clientName}). ` +
    `Audit covered ${(audit?.pagesAudited as number) ?? 0} pages and surfaced **${totalIssues} open issues**, ` +
    `of which **${critical} are critical or high priority**. ` +
    `Recommended next steps focus on the highest-priority items below.`
  );
}

function renderMarkdown(
  project: { siteName: string; primaryDomain: string },
  execSummary: string,
  sections: ReportSection[],
  view: 'client' | 'internal',
): string {
  return [
    `# Initial SEO Audit — ${project.siteName}`,
    `_${project.primaryDomain} · ${new Date().toISOString().slice(0, 10)} · ${view} view_`,
    '',
    '## Executive summary',
    '',
    execSummary,
    '',
    ...sections.flatMap((s) => [`## ${s.title}`, '', s.body, '']),
  ].join('\n');
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    const k = keyFn(i);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
