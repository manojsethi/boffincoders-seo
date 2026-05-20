'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { SectionCard } from './SectionCard';
import { StatusPill } from './StatusPill';
import { EmptyState } from './EmptyState';

type Item = {
  id: string;
  title: string;
  status: string;
  validationStatus: string;
  priority: string;
  ownerType: string;
};

type Summary = {
  activePlan: {
    id: string;
    title: string;
    status: string;
    itemCount: number;
    items: Item[];
    periodStart: string | null;
    periodEnd: string | null;
  } | null;
  drafts: Array<{ id: string; title: string }>;
  totals: { plans: number; items: number; validated: number; failed: number };
};

export function ActiveFixPlanCard({ projectId }: { projectId: string }): JSX.Element {
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ['fix-plans-summary', projectId],
    queryFn: () => api<Summary>(`/projects/${projectId}/fix-plans-summary`),
  });

  if (isLoading) {
    return (
      <SectionCard title="Active fix plan">
        <div className="text-xs text-text-subtle">Loading…</div>
      </SectionCard>
    );
  }

  const active = data?.activePlan;
  const totals = data?.totals ?? { plans: 0, items: 0, validated: 0, failed: 0 };

  if (!active) {
    return (
      <SectionCard
        title="Active fix plan"
        actions={
          <Link
            href={`/projects/${projectId}/fix-plans`}
            className="text-xs text-accent-hover hover:underline"
          >
            Open Fix plans →
          </Link>
        }
      >
        <EmptyState
          title="No active plan yet"
          description={
            data && data.drafts.length > 0
              ? `${data.drafts.length} draft${data.drafts.length === 1 ? '' : 's'} pending — review and activate one.`
              : 'Generate a weekly plan from your top recommendations, opportunities, briefs, and critical issues.'
          }
          action={
            <Link
              href={`/projects/${projectId}/fix-plans`}
              className="inline-flex items-center gap-1 rounded bg-accent text-accent-fg px-3 py-1.5 text-sm"
            >
              <ClipboardList size={14} /> Open Fix plans
            </Link>
          }
        />
      </SectionCard>
    );
  }

  const validated = active.items.filter((it) => it.status === 'validated').length;
  const inProgress = active.items.filter(
    (it) => it.status === 'in-progress' || it.status === 'fixed' || it.status === 'ready-for-validation',
  ).length;
  const planned = active.items.filter((it) => it.status === 'planned').length;
  const failed = active.items.filter((it) => it.status === 'failed-validation').length;

  const topPlanned = active.items
    .filter((it) => it.status === 'planned' || it.status === 'in-progress')
    .slice(0, 5);

  return (
    <SectionCard
      title="Active fix plan"
      actions={
        <Link
          href={`/projects/${projectId}/fix-plans`}
          className="text-xs text-accent-hover hover:underline"
        >
          Open →
        </Link>
      }
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <Link
            href={`/projects/${projectId}/fix-plans`}
            className="text-base font-semibold text-text hover:underline"
          >
            {active.title}
          </Link>
          <div className="text-xs text-text-muted mt-0.5">
            {active.periodStart && active.periodEnd
              ? `${new Date(active.periodStart).toISOString().slice(0, 10)} → ${new Date(active.periodEnd).toISOString().slice(0, 10)}`
              : 'No period set'}
            {' · '}
            {active.itemCount} item{active.itemCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="text-xs text-text-muted text-right">
          <div>{totals.plans} plan{totals.plans === 1 ? '' : 's'} total</div>
          <div className="tabular-nums">
            {totals.validated} validated · {totals.failed} failed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <Stat label="Planned" value={planned} tone="info" />
        <Stat label="In progress" value={inProgress} tone="info" />
        <Stat label="Validated" value={validated} tone="success" />
        <Stat label="Failed" value={failed} tone="danger" />
      </div>

      {topPlanned.length === 0 ? (
        <div className="text-xs text-text-subtle">All items in this plan are completed.</div>
      ) : (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-subtle mb-1">
            Next up this week
          </div>
          <ul className="space-y-1 text-xs">
            {topPlanned.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-mono text-[10px] text-text-subtle mr-1.5">{it.priority}</span>
                  {it.title}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-text-subtle">{it.ownerType}</span>
                  <StatusPill value={it.status} kind="state" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'success' | 'danger';
}): JSX.Element {
  const cls =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
      ? 'text-danger'
      : 'text-text';
  return (
    <div className="rounded bg-surface-2 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className={`tabular-nums font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
