'use client';

import Link from 'next/link';
import { Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { StatusPill } from './StatusPill';

type RecommendationRow = {
  id: string;
  type: string;
  status: string;
  verdict: string;
  title: string;
  ownerType: string;
  priorityScore: number;
  expectedImpact: string;
  effort: string;
  sourceIssueIds: string[];
};

const OPEN_STATUSES = new Set(['draft', 'proposed', 'approved', 'planned', 'in_progress']);

export function RecommendationsTopActions({ projectId }: { projectId: string }): JSX.Element {
  const { data = [], isLoading } = useQuery<RecommendationRow[]>({
    queryKey: ['recommendations', projectId],
    queryFn: () => api<RecommendationRow[]>(`/projects/${projectId}/recommendations?limit=1000`),
  });

  const open = data.filter((r) => OPEN_STATUSES.has(r.status));
  open.sort((a, b) => b.priorityScore - a.priorityScore);
  const top = open.slice(0, 6);

  return (
    <SectionCard
      title="Recommended next actions"
      description="Highest-priority active recommendations, generated from this project’s issues + evidence. Click to open the issue drawer."
      actions={
        open.length > 0 ? (
          <Link
            href={`/projects/${projectId}/issues?rec=draft`}
            className="text-xs text-accent-hover hover:underline"
          >
            All recommendations →
          </Link>
        ) : null
      }
      noPadding
    >
      {!isLoading && top.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No active recommendations"
            description="Run an audit to surface findings — recommendations will be generated automatically with deterministic templates."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {top.map((r) => (
            <li key={r.id}>
              <Link
                href={
                  r.sourceIssueIds[0]
                    ? `/projects/${projectId}/issues?issue=${r.sourceIssueIds[0]}`
                    : `/projects/${projectId}/issues`
                }
                className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover/40"
              >
                <span className="text-[11px] tabular-nums text-text-subtle w-9 shrink-0 pt-0.5">
                  {r.priorityScore}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <Tag className="m-0">{r.type}</Tag>
                    <StatusPill value={r.status} kind="state" />
                    <StatusPill value={r.verdict} kind="state" />
                    <span className="text-[10px] uppercase text-text-subtle">{r.ownerType}</span>
                  </div>
                  <div className="text-sm text-text leading-snug">{r.title}</div>
                  <div className="text-[11px] text-text-subtle">
                    impact {r.expectedImpact} · effort {r.effort}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
