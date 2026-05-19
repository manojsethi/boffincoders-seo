'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Tag } from 'antd';
import { api } from '../lib/api';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { DataFreshness } from './DataFreshness';
import { TermLabel } from './TermLabel';

type Freshness = {
  gsc: { connected: boolean; lastSyncedAt: string | null; rangeStart: string | null; rangeEnd: string | null };
  ga4: { connected: boolean; lastSyncedAt: string | null; rangeStart: string | null; rangeEnd: string | null };
  cwv: { lastCapturedAt: string | null };
  project: { goalsCount: number };
};
type OppTrend = {
  byType: Array<{ type: string; open: number; total: number }>;
  byPriority: Array<{ priority: string; count: number }>;
};

export function OverviewDataPanel({ projectId }: { projectId: string }): JSX.Element {
  const { data: fresh } = useQuery<Freshness>({
    queryKey: ['analytics-freshness', projectId],
    queryFn: () => api(`/projects/${projectId}/analytics/freshness`),
  });
  const { data: opps } = useQuery<OppTrend>({
    queryKey: ['opp-trend', projectId],
    queryFn: () => api(`/projects/${projectId}/analytics/opportunities/trend`),
  });

  const totalOpenOpps = opps?.byType.reduce((s, t) => s + t.open, 0) ?? 0;
  const topTypes = (opps?.byType ?? []).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <SectionCard
        title="Data sources"
        description="Freshness of the data powering dashboards and reports."
        actions={
          <Link
            href={`/projects/${projectId}/settings`}
            className="text-xs text-accent-hover hover:underline"
          >
            Integrations →
          </Link>
        }
      >
        <div className="space-y-2 text-xs">
          <div>
            <DataFreshness
              source="GSC"
              lastSyncedAt={fresh?.gsc.lastSyncedAt}
              rangeStart={fresh?.gsc.rangeStart}
              rangeEnd={fresh?.gsc.rangeEnd}
              notConnectedHint={!fresh?.gsc.connected ? 'Not connected' : undefined}
            />
          </div>
          <div>
            <DataFreshness
              source="GA4"
              lastSyncedAt={fresh?.ga4.lastSyncedAt}
              rangeStart={fresh?.ga4.rangeStart}
              rangeEnd={fresh?.ga4.rangeEnd}
              notConnectedHint={!fresh?.ga4.connected ? 'Not connected' : undefined}
            />
          </div>
          <div>
            <DataFreshness source="CWV" lastSyncedAt={fresh?.cwv.lastCapturedAt} />
          </div>
          {fresh && fresh.project.goalsCount === 0 && (
            <div className="text-xs text-amber-500 mt-2">
              No goals defined yet — opportunity weighting and goal-progress reporting are inactive.{' '}
              <Link href={`/projects/${projectId}/goals`} className="text-accent-hover underline">
                Add a goal →
              </Link>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={<TermLabel term="opportunity-score">Opportunities</TermLabel>}
        description={`${totalOpenOpps} open. Sorted by type — click into the Opportunities tab for the full triage view.`}
        actions={
          <Link
            href={`/projects/${projectId}/opportunities`}
            className="text-xs text-accent-hover hover:underline"
          >
            Open →
          </Link>
        }
        noPadding
      >
        {topTypes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No opportunities yet"
              description="Generate from the Opportunities tab once GSC/GA4/CWV data + audit issues are in place."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {topTypes.map((t) => (
              <li key={t.type} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-sm">{t.type}</span>
                <span className="flex items-center gap-2">
                  <Tag className="m-0">{t.open} open</Tag>
                  <span className="text-xs text-text-subtle tabular-nums">{t.total} total</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
