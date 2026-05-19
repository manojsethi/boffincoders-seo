import Link from 'next/link';
import { Button, Input } from 'antd';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyState } from '../../components/EmptyState';
import { StatusPill } from '../../components/StatusPill';

export const dynamic = 'force-dynamic';

type Project = {
  id: string;
  clientName: string;
  siteName: string;
  primaryDomain: string;
  lifecycleState: string;
  lastCrawledAt: string | null;
  lastReportedAt: string | null;
};

export default async function ProjectsPage(): Promise<JSX.Element> {
  let projects: Project[] = [];
  let error: string | null = null;
  try {
    projects = await api<Project[]>('/projects');
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        subtitle="All client websites being tracked in this workspace."
        actions={
          <Link href="/projects/new">
            <Button type="primary" icon={<Plus size={14} />}>
              New project
            </Button>
          </Link>
        }
      />

      {error ? (
        <SectionCard>
          <EmptyState title="Backend unreachable" description={error} />
        </SectionCard>
      ) : projects.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="No projects yet"
            description="Create your first project to start crawling, auditing, and generating reports."
            action={
              <Link href="/projects/new">
                <Button type="primary" icon={<Plus size={14} />}>
                  Create project
                </Button>
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard noPadding>
          <div className="border-b border-border px-4 py-3">
            <Input
              prefix={<Search size={14} className="text-text-subtle" />}
              placeholder="Search projects (client-side filter coming soon)"
              disabled
            />
          </div>
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li
                key={p.id}
                className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover/40 transition-colors"
              >
                <Link
                  href={`/projects/${p.id}`}
                  className="min-w-0 flex-1 flex items-center gap-3"
                >
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
                <div className="flex items-center gap-3 text-xs text-text-subtle">
                  <span className="hidden md:inline tabular-nums">
                    {p.lastCrawledAt
                      ? `crawled ${new Date(p.lastCrawledAt).toLocaleDateString()}`
                      : 'never crawled'}
                  </span>
                  <StatusPill value={p.lifecycleState} kind="state" />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
