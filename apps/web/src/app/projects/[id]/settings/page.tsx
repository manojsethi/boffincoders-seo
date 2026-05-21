'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Globe, Workflow } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { MaintenanceCard } from '../../../../components/MaintenanceCard';

type ProjectDTO = {
  id: string;
  siteName: string;
  primaryDomain: string;
  allowedDomains: string[];
  includeSubdomains: boolean;
  status: 'active' | 'paused' | 'archived';
  lifecycleState: string;
};

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { data } = useQuery<ProjectDTO>({
    queryKey: ['project', id],
    queryFn: () => api<ProjectDTO>(`/projects/${id}`),
  });

  return (
    <>
      <PageHeader
        eyebrow="Project · Settings"
        title="General settings"
        subtitle="Project metadata + links to setup areas + maintenance + the danger zone."
      />

      <SectionCard
        title="Project"
        description="Identity + status. Project name + primary domain change requires a project rename which is not yet implemented."
        className="mb-4"
      >
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Row label="Site name" value={data?.siteName} />
          <Row label="Primary domain" value={data?.primaryDomain} mono />
          <Row
            label="Allowed domains"
            value={data?.allowedDomains?.join(', ') || '—'}
            mono
          />
          <Row label="Include subdomains" value={data?.includeSubdomains ? 'yes' : 'no'} />
          <Row label="Status" value={data?.status} />
          <Row label="Lifecycle" value={data?.lifecycleState} />
        </dl>
      </SectionCard>

      <SectionCard title="Setup areas" className="mb-4">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <SetupLink
            href={`/projects/${id}/settings/integrations`}
            icon={<Globe size={14} />}
            label="Integrations"
            sub="Connect Search Console, GA4, and CrUX/PSI"
          />
          <SetupLink
            href={`/projects/${id}/settings/crawl`}
            icon={<Workflow size={14} />}
            label="Crawl settings"
            sub="Render mode + auto-render policy"
          />
        </ul>
      </SectionCard>

      <MaintenanceCard projectId={id} />

      <SectionCard
        title="Danger zone"
        description="Archive and reset live on their own page so they are harder to click accidentally."
        className="mt-4 border-rose-500/30"
        actions={
          <Link
            href={`/projects/${id}/settings/danger-zone`}
            className="inline-flex items-center gap-1 text-sm text-rose-400 hover:underline"
          >
            <AlertTriangle size={14} /> Open danger zone →
          </Link>
        }
      >
        <p className="text-xs text-text-muted">
          Archive pauses monitoring and hides the project from active lists, preserving all data
          (reversible). Reset removes selected data buckets and requires typed confirmation.
        </p>
      </SectionCard>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }): JSX.Element {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</dt>
      <dd className={`text-text ${mono ? 'font-mono text-[12px]' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

function SetupLink({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}): JSX.Element {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-2 rounded border border-border p-3 hover:bg-surface-hover"
      >
        <span className="mt-0.5 text-text-subtle">{icon}</span>
        <div>
          <div className="text-text">{label}</div>
          <div className="text-xs text-text-muted">{sub}</div>
        </div>
      </Link>
    </li>
  );
}
