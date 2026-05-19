'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Progress, Skeleton, Tag } from 'antd';
import { Activity, AlertTriangle, FileBarChart, ListChecks } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { MetricTile } from '../../../components/MetricTile';
import { SectionCard } from '../../../components/SectionCard';
import { StatusPill } from '../../../components/StatusPill';
import { EmptyState } from '../../../components/EmptyState';
import { TermLabel } from '../../../components/TermLabel';
import { InfoIcon } from '../../../components/InfoIcon';
import { RunActions } from '../../../components/RunActions';
import { IssueDrawer } from '../../../components/IssueDrawer';
import { ChartContainer } from '../../../components/charts/ChartContainer';
import { CategoryScoresChart } from '../../../components/charts/CategoryScores';
import { useProjectOverview } from '../../../hooks/useProjectOverview';
import { OverviewDataPanel } from '../../../components/OverviewDataPanel';

export default function ProjectOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { data, isLoading, error } = useProjectOverview(id);
  const [drawerIssueId, setDrawerIssueId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SectionCard>
        <Skeleton active />
      </SectionCard>
    );
  }
  if (error || !data) {
    return (
      <SectionCard>
        <EmptyState
          title="Failed to load project"
          description={(error as Error | null)?.message ?? 'Unknown error'}
        />
      </SectionCard>
    );
  }

  const layeredScores = data.latestAudit?.layeredScores
    ? Object.entries(data.latestAudit.layeredScores).map(([category, info]) => ({
        category,
        score: info.value,
      }))
    : [];

  const crawlActive =
    data.latestCrawl?.status === 'running' || data.latestCrawl?.status === 'queued';
  const auditActive =
    data.latestAudit?.status === 'running' || data.latestAudit?.status === 'queued';
  const aiActive = data.latestAI?.status === 'running' || data.latestAI?.status === 'queued';

  return (
    <>
      <PageHeader
        eyebrow={data.project.clientName}
        title={data.project.siteName}
        subtitle={data.project.primaryDomain}
        meta={
          <>
            <StatusPill value={data.lifecycleState} kind="state" />
            {data.latestCrawl?.diagnostics ? (
              <StatusPill
                value={
                  String(
                    (data.latestCrawl.diagnostics as Record<string, unknown>).healthStatus ?? 'unknown',
                  )
                }
                kind="state"
              />
            ) : null}
          </>
        }
      />

      <SectionCard
        title={`Next: ${data.nextAction.label}`}
        description={data.nextAction.description}
        className="mb-6"
      >
        <RunActions projectId={id} lifecycleState={data.lifecycleState} />
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricTile
          label="Pages crawled"
          value={data.latestCrawl?.counts?.pages ?? 0}
          hint={
            data.latestCrawl
              ? `health: ${
                  (data.latestCrawl.diagnostics as Record<string, unknown>)?.healthStatus ?? '—'
                }`
              : 'no crawl yet'
          }
          icon={<Activity size={14} />}
        />
        <MetricTile
          label="Pages audited"
          value={data.latestAudit?.pagesAudited ?? 0}
          hint={data.latestAudit ? `status: ${data.latestAudit.status}` : 'no audit yet'}
          icon={<ListChecks size={14} />}
        />
        <MetricTile
          label="Open issues"
          value={data.issueCounts.open}
          tone={data.issueCounts.open > 0 ? 'warning' : 'neutral'}
          icon={<AlertTriangle size={14} />}
        />
        <MetricTile
          label="Critical/high"
          value={data.issueCounts.criticalOrHigh}
          tone={data.issueCounts.criticalOrHigh > 0 ? 'danger' : 'neutral'}
          icon={<FileBarChart size={14} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard
          title="Latest crawl"
          description="Fetcher coverage and discovery health."
          actions={data.latestCrawl ? <StatusPill value={data.latestCrawl.status} kind="state" /> : null}
        >
          {data.latestCrawl ? (
            <div className="space-y-3">
              {crawlActive ? (
                <div>
                  <div className="text-xs text-text-muted mb-1.5">
                    {data.latestCrawl.currentStep || 'in progress'}
                  </div>
                  <Progress percent={data.latestCrawl.progressPercent} size="small" />
                </div>
              ) : null}
              <DataGrid
                rows={[
                  [
                    'Sitemap',
                    String(
                      (data.latestCrawl.diagnostics as Record<string, unknown>)?.sitemapStatus ?? '—',
                    ),
                  ],
                  [
                    'Health',
                    String(
                      (data.latestCrawl.diagnostics as Record<string, unknown>)?.healthStatus ?? '—',
                    ),
                  ],
                  [
                    'Markdown coverage',
                    `${
                      (data.latestCrawl.diagnostics as Record<string, unknown>)?.markdownCoveragePct ?? 0
                    }%`,
                  ],
                  [
                    'Failed',
                    String(
                      (data.latestCrawl.diagnostics as Record<string, unknown>)?.failedCount ?? 0,
                    ),
                  ],
                ]}
              />
            </div>
          ) : (
            <EmptyState
              title="No crawl yet"
              description="Run the first crawl to gather pages, links, and markdown content."
            />
          )}
        </SectionCard>

        <SectionCard
          title={<TermLabel term="priority">Health scores</TermLabel>}
          description="Layered scores from the most recent audit. Missing data is excluded — see Data gaps."
          actions={data.latestAudit ? <StatusPill value={data.latestAudit.status} kind="state" /> : null}
        >
          {auditActive ? (
            <div className="mb-3">
              <div className="text-xs text-text-muted mb-1.5">
                {data.latestAudit?.currentStep || 'in progress'}
              </div>
              <Progress percent={data.latestAudit?.progressPercent ?? 0} size="small" />
            </div>
          ) : null}
          {layeredScores.length > 0 ? (
            <ChartContainer
              className="border-0 p-0 shadow-none rounded-none"
              height={Math.max(160, layeredScores.length * 22 + 24)}
            >
              <CategoryScoresChart data={layeredScores} />
            </ChartContainer>
          ) : (
            <EmptyState
              title="No audit yet"
              description="Run an audit after the first crawl completes."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard
          title={<TermLabel term="issues">Top open issues</TermLabel>}
          description="Highest-priority items needing action. Click to open the drawer."
          actions={
            <Link
              href={`/projects/${id}/issues`}
              className="text-xs text-accent-hover hover:underline"
            >
              View all →
            </Link>
          }
          noPadding
        >
          {data.topIssues.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No open issues"
                description="Either no audit has run yet, or every rule passed. Run an audit to refresh."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.topIssues.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover/40 cursor-pointer"
                  onClick={() => setDrawerIssueId(i.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusPill value={i.severity} kind="severity" />
                      <Tag className="m-0">{i.actionPriority}</Tag>
                    </div>
                    <div className="text-sm font-medium text-text truncate">{i.title}</div>
                    {i.affectedUrl ? (
                      <div className="text-[11px] text-text-subtle font-mono truncate">
                        {i.affectedUrl}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-text-subtle shrink-0 tabular-nums">{i.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={<TermLabel term="data-gap">Data gaps</TermLabel>}
          description="Rules that could not run because a data source is missing. Not SEO issues."
          noPadding
        >
          {(data.latestAudit?.dataGapCount ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No data gaps"
                description="Every rule had the data it needed. Connect more sources to expand rule coverage."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(data.latestAudit?.dataGaps ?? []).map((g) => (
                <li key={g.reason} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="m-0">{categoryFromReason(g.reason)}</Tag>
                    <span className="text-[11px] uppercase tracking-wider text-text-subtle">
                      {g.reason}
                    </span>
                    <span className="text-xs text-text-muted">
                      · {g.ruleCount} rule{g.ruleCount === 1 ? '' : 's'} affected
                    </span>
                  </div>
                  <p className="text-sm text-text">{g.description}</p>
                  <p className="text-xs text-accent-hover">{g.callToAction}</p>
                  {g.ruleIds.length > 0 ? (
                    <p className="text-[11px] text-text-subtle font-mono break-all">
                      {g.ruleIds.slice(0, 4).join(', ')}
                      {g.ruleIds.length > 4 ? ` +${g.ruleIds.length - 4}` : ''}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <OverviewDataPanel projectId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="AI analysis"
          description="Suggested website profile + priorities from real evidence."
          actions={data.latestAI ? <StatusPill value={data.latestAI.status} kind="state" /> : null}
        >
          {data.latestAI ? (
            <div className="space-y-3">
              {aiActive ? <Progress percent={50} size="small" /> : null}
              <DataGrid
                rows={[
                  ['Provider', data.latestAI.modelProvider],
                  ['Confidence', String(data.latestAI.confidence)],
                  ['Review needed', data.latestAI.requiresAnalystReview ? 'Yes' : 'No'],
                ]}
              />
            </div>
          ) : (
            <EmptyState
              title="No AI analysis yet"
              description="Run AI analysis after the first audit to suggest a website profile and priorities from evidence."
            />
          )}
        </SectionCard>
        <SectionCard
          title="Latest report"
          description="Most recent client-ready or internal report."
          actions={data.latestReport ? <StatusPill value={data.latestReport.status} kind="state" /> : null}
        >
          {data.latestReport ? (
            <DataGrid rows={[['Type', data.latestReport.type]]} />
          ) : (
            <EmptyState
              title="No report yet"
              description="Generate a client-ready report once issues are prioritized."
            />
          )}
        </SectionCard>
      </div>

      <IssueDrawer
        projectId={id}
        issueId={drawerIssueId}
        open={!!drawerIssueId}
        onClose={() => setDrawerIssueId(null)}
      />
    </>
  );
}

function categoryFromReason(reason: string): string {
  if (reason.startsWith('gsc')) return 'GSC';
  if (reason.startsWith('ga4')) return 'GA4';
  if (reason.startsWith('cwv')) return 'CWV';
  if (reason.startsWith('schema')) return 'Schema';
  if (reason.startsWith('rendered')) return 'Render';
  if (reason.startsWith('backlinks')) return 'Backlinks';
  if (reason.startsWith('citations')) return 'Citations';
  if (reason.startsWith('ai-visibility')) return 'AI';
  if (reason.startsWith('markdown')) return 'Content';
  if (reason === 'crawl-incomplete') return 'Crawl';
  return 'Other';
}

function DataGrid({ rows }: { rows: Array<[string, string]> }): JSX.Element {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-border/40 py-1.5">
          <dt className="text-[11px] uppercase tracking-wider text-text-subtle">{k}</dt>
          <dd className="text-text font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
