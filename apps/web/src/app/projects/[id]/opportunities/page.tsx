'use client';

import { use, useMemo, useState } from 'react';
import { App, Button, Drawer, Select, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { StatusPill } from '../../../../components/StatusPill';
import { TermLabel } from '../../../../components/TermLabel';

const TYPES = [
  'quick-win',
  'ctr',
  'content-gap',
  'cannibalization',
  'wrong-page-ranking',
  'internal-link',
  'schema',
  'conversion',
  'performance',
  'eeat-trust',
  'geo-aeo',
];
const STATUSES = ['open', 'planned', 'in-progress', 'done', 'ignored', 'not-applicable'];
const PRIORITIES = ['P0', 'P1', 'P2'];
const OWNERS = ['seo', 'content', 'developer', 'client', 'analyst'];

type Narrative = {
  whyDetected: string;
  metrics: Array<{ label: string; value: string }>;
  whyItMatters: string;
  validation: string;
};

type Opportunity = {
  id: string;
  canonicalKey: string;
  type: string;
  title: string;
  pageId: string | null;
  pageUrl: string | null;
  keyword: string | null;
  goalId: string | null;
  goalLabel: string | null;
  evidence: Record<string, unknown>;
  narrative: Narrative;
  impactScore: number;
  effortEstimate: string;
  confidence: number;
  confidenceLevel: string;
  priority: number;
  actionPriority: 'P0' | 'P1' | 'P2';
  recommendedAction: string;
  sourceRules: string[];
  sourceIssueId: string | null;
  status: string;
  ownerType: string;
  notes: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

type GoalRow = { id: string; type: string; label?: string };
type ConnRow = { provider: string; status: string };

export default function OpportunitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<{
    status?: string;
    type?: string;
    actionPriority?: string;
  }>({ status: 'open' });
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.type) qs.set('type', filters.type);
  if (filters.actionPriority) qs.set('actionPriority', filters.actionPriority);
  const filterStr = qs.toString();

  const { data: rows = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ['opportunities', id, filterStr],
    queryFn: () =>
      api<Opportunity[]>(`/projects/${id}/opportunities${filterStr ? `?${filterStr}` : ''}`),
  });

  type Coverage = {
    goals: { count: number; ok: boolean };
    gsc: { connected: boolean; rows: number; ok: boolean };
    ga4: { connected: boolean; rows: number; ok: boolean };
    cwv: { rows: number; ok: boolean };
  };
  const { data: coverage } = useQuery<Coverage>({
    queryKey: ['opp-coverage', id],
    queryFn: () => api<Coverage>(`/projects/${id}/opportunities/coverage`),
    retry: false,
  });
  // Touch the goals + connections cache so other consumers stay warm. Coverage is the
  // source-of-truth for the data-coverage panel.
  useQuery<GoalRow[]>({
    queryKey: ['goals', id],
    queryFn: () => api<GoalRow[]>(`/projects/${id}/goals`),
  });
  useQuery<ConnRow[]>({
    queryKey: ['site-connections', id],
    queryFn: () => api<ConnRow[]>(`/projects/${id}/integrations`),
    retry: false,
  });

  const missing = {
    goals: coverage ? !coverage.goals.ok : false,
    gsc: coverage ? !coverage.gsc.ok : false,
    ga4: coverage ? !coverage.ga4.ok : false,
    cwv: coverage ? !coverage.cwv.ok : false,
  };

  const regenerate = useMutation({
    mutationFn: () =>
      api<{ generated: number; deleted: number }>(`/projects/${id}/opportunities/regenerate`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      message.success(`Generated ${r.generated} opportunities (${r.deleted} stale closed)`);
      void qc.invalidateQueries({ queryKey: ['opportunities', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const update = useMutation({
    mutationFn: ({ oppId, body }: { oppId: string; body: Partial<Opportunity> }) =>
      api(`/projects/${id}/opportunities/${oppId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['opportunities', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.type, (map.get(r.type) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Opportunities"
        subtitle="Deterministic findings from GSC, GA4, CWV, audit issues, and keywords. Re-run to refresh against latest evidence."
        actions={
          <Button
            type="primary"
            icon={<RefreshCw size={14} />}
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            Regenerate
          </Button>
        }
      />

      {(missing.goals || missing.gsc || missing.ga4 || missing.cwv) && (
        <SectionCard className="mb-4">
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">
            Data coverage
          </div>
          <ul className="text-xs text-text-muted space-y-1">
            {missing.goals && (
              <li>
                <span className="text-text">Goals not set.</span> Without goals, opportunities can’t
                be weighted by business priority. Add at least one goal on the Goals tab.
              </li>
            )}
            {missing.gsc && (
              <li>
                <span className="text-text">GSC not connected.</span> Quick-win, CTR,
                wrong-page-ranking, cannibalization, and content-gap rules won’t fire. Connect on
                Settings → Integrations.
              </li>
            )}
            {missing.ga4 && (
              <li>
                <span className="text-text">GA4 not connected.</span> High-traffic-low-conversion
                opportunities are skipped.
              </li>
            )}
            {missing.cwv && (
              <li>
                <span className="text-text">No CWV data.</span> Performance opportunities won’t be
                generated.
              </li>
            )}
          </ul>
        </SectionCard>
      )}

      {byType.length > 0 && (
        <SectionCard className="mb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {byType.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setFilters((f) => ({ ...f, type: f.type === t ? undefined : t }))}
                className={`px-2 py-1 rounded border ${
                  filters.type === t ? 'border-accent text-text' : 'border-border text-text-muted'
                }`}
              >
                {t} <span className="tabular-nums ml-1">{n}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            placeholder="Status"
            allowClear
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 160 }}
          />
          <Select
            placeholder="Type"
            allowClear
            value={filters.type}
            onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
            options={TYPES.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 180 }}
          />
          <Select
            placeholder="Action priority"
            allowClear
            value={filters.actionPriority}
            onChange={(v) => setFilters((f) => ({ ...f, actionPriority: v }))}
            options={PRIORITIES.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 130 }}
          />
        </div>
      </SectionCard>

      <SectionCard noPadding>
        {!isLoading && rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No opportunities yet"
              description="Click Regenerate to compute opportunities from your GSC/GA4/CWV data + active issues + keywords. Add goals + map keywords for better targeting."
              action={
                <Button type="primary" icon={<RefreshCw size={14} />} onClick={() => regenerate.mutate()}>
                  Regenerate now
                </Button>
              }
            />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={rows}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 1400 }}
            onRow={(row) => ({
              onClick: () => setSelected(row),
              style: { cursor: 'pointer' },
            })}
            columns={[
              {
                title: 'Type',
                dataIndex: 'type',
                width: 160,
                render: (t: string) => <Tag className="m-0">{t}</Tag>,
              },
              {
                title: 'Title',
                dataIndex: 'title',
                ellipsis: true,
              },
              {
                title: 'Page / keyword',
                width: 280,
                render: (_: unknown, r: Opportunity) =>
                  r.keyword ? (
                    <span className="font-mono text-[11px] text-text-muted">"{r.keyword}"</span>
                  ) : r.pageUrl ? (
                    <span className="font-mono text-[11px] text-text-muted truncate">
                      {shortUrl(r.pageUrl)}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                title: 'Action priority',
                dataIndex: 'actionPriority',
                width: 110,
                render: (v: string) => <Tag className="m-0">{v}</Tag>,
              },
              {
                title: <TermLabel term="opportunity-score">Score</TermLabel>,
                dataIndex: 'priority',
                width: 80,
                sorter: (a, b) => a.priority - b.priority,
                defaultSortOrder: 'descend',
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              {
                title: 'Impact',
                dataIndex: 'impactScore',
                width: 80,
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              { title: 'Effort', dataIndex: 'effortEstimate', width: 90 },
              { title: 'Confidence', dataIndex: 'confidenceLevel', width: 100 },
              {
                title: 'Goal',
                dataIndex: 'goalLabel',
                width: 160,
                render: (v: string | null) =>
                  v ? <Tag className="m-0">{v}</Tag> : <span className="text-text-subtle">—</span>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 140,
                render: (s: string) => <StatusPill value={s} kind="state" />,
              },
            ]}
          />
        )}
      </SectionCard>

      <Drawer
        title={selected?.title}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={640}
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{selected.type}</Tag>
              <Tag>{selected.actionPriority}</Tag>
              <StatusPill value={selected.status} kind="state" />
              <span className="text-xs text-text-muted">
                score <span className="tabular-nums">{selected.priority}</span> · impact{' '}
                {selected.impactScore} · effort {selected.effortEstimate} · confidence{' '}
                {selected.confidenceLevel}
              </span>
            </div>

            {/* Related entities */}
            <div className="grid grid-cols-1 gap-2 p-3 bg-surface-2 rounded">
              {selected.goalLabel && (
                <Row label="Goal">
                  <Tag className="m-0">{selected.goalLabel}</Tag>
                </Row>
              )}
              {selected.pageUrl && (
                <Row label="Page">
                  <a
                    href={selected.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] text-accent-hover hover:underline break-all"
                  >
                    {selected.pageUrl}
                  </a>
                </Row>
              )}
              {selected.keyword && (
                <Row label="Keyword">
                  <span className="font-mono text-[12px]">{selected.keyword}</span>
                </Row>
              )}
              {!selected.goalLabel && !selected.pageUrl && !selected.keyword && (
                <span className="text-xs text-text-subtle">Site-level opportunity.</span>
              )}
            </div>

            {/* Why detected */}
            <Section title="Why we detected this">
              <p className="text-text leading-relaxed">{selected.narrative.whyDetected}</p>
            </Section>

            {/* Metric values */}
            {selected.narrative.metrics.length > 0 && (
              <Section title="Metrics">
                <div className="grid grid-cols-2 gap-2">
                  {selected.narrative.metrics.map((m) => (
                    <div key={m.label} className="bg-surface-2 rounded px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-text-subtle">
                        {m.label}
                      </div>
                      <div className="text-text tabular-nums font-medium">{m.value}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Why it matters */}
            <Section title="Why it matters">
              <p className="text-text leading-relaxed">{selected.narrative.whyItMatters}</p>
            </Section>

            {/* Recommended action */}
            <Section title="Recommended action">
              <p className="text-text leading-relaxed">{selected.recommendedAction}</p>
            </Section>

            {/* Validation */}
            <Section title="Validation method">
              <p className="text-text leading-relaxed">{selected.narrative.validation}</p>
            </Section>

            {/* Source rules */}
            <Section title="Source rules">
              <div className="flex flex-wrap gap-1">
                {(selected.sourceRules ?? []).map((r) => (
                  <code key={r} className="text-[11px] px-1.5 py-0.5 bg-surface-2 rounded">
                    {r}
                  </code>
                ))}
                {selected.sourceRules.length === 0 && (
                  <span className="text-text-subtle text-xs">Derived directly from data.</span>
                )}
              </div>
            </Section>

            {/* Raw evidence — collapsed for analysts; useful for dev */}
            <details className="rounded border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs text-text-muted">
                Technical evidence (JSON)
              </summary>
              <pre className="text-[11px] bg-surface-2 p-2 overflow-x-auto m-0">
                {JSON.stringify(selected.evidence, null, 2)}
              </pre>
            </details>

            {/* Triage controls */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Status
                </div>
                <Select
                  value={selected.status}
                  options={STATUSES.map((s) => ({ value: s, label: s }))}
                  className="w-full"
                  onChange={(v) => {
                    update.mutate({ oppId: selected.id, body: { status: v } });
                    setSelected({ ...selected, status: v });
                  }}
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Owner
                </div>
                <Select
                  value={selected.ownerType}
                  options={OWNERS.map((s) => ({ value: s, label: s }))}
                  className="w-full"
                  onChange={(v) => {
                    update.mutate({ oppId: selected.id, body: { ownerType: v } });
                    setSelected({ ...selected, ownerType: v });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-text-subtle w-16 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}
