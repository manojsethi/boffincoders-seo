import Link from 'next/link';
import { Button } from 'antd';
import { AlertTriangle, FolderKanban, FileText, ShieldAlert, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { MetricTile } from '../components/MetricTile';
import { SectionCard } from '../components/SectionCard';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { ChartContainer } from '../components/charts/ChartContainer';
import { LifecycleDistribution } from '../components/charts/LifecycleDistribution';

export const dynamic = 'force-dynamic';

type WorkspaceOverview = {
  activeProjectCount: number;
  projectsByState: Record<string, number>;
  failedCrawls: Array<{ id: string; projectId: string; error?: string }>;
  failedAudits: Array<{ id: string; projectId: string; error?: string }>;
  criticalIssuesByProject: Record<string, number>;
  reportsByStatus: Record<string, number>;
};

type Project = {
  id: string;
  clientName: string;
  siteName: string;
  primaryDomain: string;
  lifecycleState: string;
};

export default async function WorkspacePage(): Promise<JSX.Element> {
  let overview: WorkspaceOverview | null = null;
  let projects: Project[] = [];
  let error: string | null = null;
  try {
    [overview, projects] = await Promise.all([
      api<WorkspaceOverview>('/workspace/overview'),
      api<Project[]>('/projects'),
    ]);
  } catch (err) {
    error = (err as Error).message;
  }

  if (error || !overview) {
    return (
      <>
        <PageHeader
          eyebrow="Workspace"
          title="Daily overview"
          subtitle="One screen to see what needs attention today across every client."
        />
        <SectionCard>
          <EmptyState
            title="Backend unreachable"
            description={`API call failed: ${error}. Start MongoDB and the backend before loading the workspace.`}
            action={
              <Link href="/projects/new">
                <Button type="primary" icon={<Plus size={14} />}>
                  Create your first project
                </Button>
              </Link>
            }
          />
        </SectionCard>
      </>
    );
  }

  const lifecycleData = Object.entries(overview.projectsByState).map(([state, count]) => ({
    state,
    count,
  }));
  const totalCriticalIssues = Object.values(overview.criticalIssuesByProject).reduce(
    (a, b) => a + b,
    0,
  );
  const reportsReady = overview.reportsByStatus.ready ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Daily overview"
        subtitle="Status across every project. Things on fire, work waiting, reports ready."
        actions={
          <Link href="/projects/new">
            <Button type="primary" icon={<Plus size={14} />}>
              New project
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricTile
          label="Active projects"
          value={overview.activeProjectCount}
          icon={<FolderKanban size={14} />}
        />
        <MetricTile
          label="Failed crawls"
          value={overview.failedCrawls.length}
          tone={overview.failedCrawls.length > 0 ? 'danger' : 'neutral'}
          icon={<AlertTriangle size={14} />}
        />
        <MetricTile
          label="Failed audits"
          value={overview.failedAudits.length}
          tone={overview.failedAudits.length > 0 ? 'danger' : 'neutral'}
          icon={<ShieldAlert size={14} />}
        />
        <MetricTile
          label="Critical issues"
          value={totalCriticalIssues}
          tone={totalCriticalIssues > 0 ? 'warning' : 'neutral'}
          hint={`${reportsReady} reports ready`}
          icon={<FileText size={14} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Lifecycle distribution"
            subtitle="Where every active project sits in the SEO workflow."
            empty={lifecycleData.length === 0}
            emptyLabel="No projects yet — create one to populate."
          >
            <LifecycleDistribution data={lifecycleData} />
          </ChartContainer>
        </div>
        <SectionCard title="Reports" description="Status across the report pipeline.">
          {Object.entries(overview.reportsByStatus).length === 0 ? (
            <p className="text-xs text-text-muted">No reports yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(overview.reportsByStatus).map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-hover/50 transition-colors"
                >
                  <StatusPill value={status} kind="state" />
                  <span className="text-sm font-medium tabular-nums text-text">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent projects"
        description="Most recently updated client projects."
        actions={
          <Link href="/projects" className="text-xs text-accent-hover hover:underline">
            View all →
          </Link>
        }
        noPadding
      >
        {projects.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No projects yet"
              description="Add a client website to start crawling, auditing, and generating reports."
              action={
                <Link href="/projects/new">
                  <Button type="primary" icon={<Plus size={14} />}>
                    Create project
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {projects.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className="group relative flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover/40 transition-colors"
              >
                <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-surface-muted text-text-muted text-xs font-semibold uppercase shrink-0">
                    {p.siteName.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{p.siteName}</div>
                    <div className="text-xs text-text-muted truncate">
                      {p.clientName} · {p.primaryDomain}
                    </div>
                  </div>
                </Link>
                <StatusPill value={p.lifecycleState} kind="state" />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
