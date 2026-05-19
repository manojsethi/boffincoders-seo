'use client';

import { use, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../../../../lib/api';
import { PageHeader } from '../../../../../components/PageHeader';
import { SectionCard } from '../../../../../components/SectionCard';
import { EmptyState } from '../../../../../components/EmptyState';
import { KpiCard, KpiRow } from '../../../../../components/KpiCard';
import { DataFreshness } from '../../../../../components/DataFreshness';
import { TermLabel } from '../../../../../components/TermLabel';
import { ChartContainer } from '../../../../../components/charts/ChartContainer';
import { StatusPill } from '../../../../../components/StatusPill';

type Freshness = { cwv: { lastCapturedAt: string | null } };
type StrategySummary = {
  rows: number;
  errors: number;
  good: number;
  ni: number;
  poor: number;
  avgLcp: number;
  avgInp: number;
  avgCls: number;
};
type Summary = { mobile: StrategySummary; desktop: StrategySummary };
type TsRow = { day: string; strategy: 'mobile' | 'desktop'; lcp: number; inp: number; cls: number; performanceScore: number };
type SlowRow = {
  pageUrl: string;
  path: string;
  pageRole: string | null;
  isImportant: boolean;
  strategy: 'mobile' | 'desktop';
  lcp?: number;
  inp?: number;
  cls?: number;
  performanceScore?: number;
  status: 'good' | 'needs-improvement' | 'poor';
  capturedAt: string;
};
type ErrRow = { pageUrl: string; path: string; strategy: string; error: string; capturedAt: string };

export default function CwvDashboard({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { data: fresh } = useQuery<Freshness>({
    queryKey: ['analytics-freshness', id],
    queryFn: () => api(`/projects/${id}/analytics/freshness`),
  });
  const hasData = !!fresh?.cwv.lastCapturedAt;

  const { data: summary } = useQuery<Summary>({
    queryKey: ['cwv-summary', id],
    queryFn: () => api(`/projects/${id}/analytics/cwv/summary`),
    enabled: hasData,
  });
  const { data: ts = [] } = useQuery<TsRow[]>({
    queryKey: ['cwv-ts', id],
    queryFn: () => api(`/projects/${id}/analytics/cwv/timeseries`),
    enabled: hasData,
  });
  const { data: slowest = [] } = useQuery<SlowRow[]>({
    queryKey: ['cwv-slowest', id],
    queryFn: () => api(`/projects/${id}/analytics/cwv/slowest`),
    enabled: hasData,
  });
  const { data: errors = [] } = useQuery<ErrRow[]>({
    queryKey: ['cwv-errors', id],
    queryFn: () => api(`/projects/${id}/analytics/cwv/errors`),
    enabled: hasData,
  });

  const passFail = useMemo(() => {
    if (!summary) return [];
    return (['mobile', 'desktop'] as const).map((s) => ({
      strategy: s,
      Good: summary[s]?.good ?? 0,
      'Needs improvement': summary[s]?.ni ?? 0,
      Poor: summary[s]?.poor ?? 0,
    }));
  }, [summary]);

  const lcpSeries = ts.filter((r) => r.strategy === 'mobile');
  const lcpDesktop = ts.filter((r) => r.strategy === 'desktop');

  const mob = summary?.mobile;

  return (
    <>
      <PageHeader
        eyebrow="Project · Dashboards"
        title="Core Web Vitals"
        subtitle="Field/lab CWV from PSI. Higher LCP/INP/CLS = worse user experience."
        meta={<DataFreshness source="CWV" lastSyncedAt={fresh?.cwv.lastCapturedAt} />}
      />

      {!hasData ? (
        <SectionCard>
          <EmptyState
            title="No CWV data yet"
            description="Run a CWV/PageSpeed sync from Settings → Integrations. We capture LCP, INP, CLS, and the performance score per URL."
          />
        </SectionCard>
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={<TermLabel term="lcp">LCP (mobile)</TermLabel>}
              value={mob?.avgLcp}
              format="ms"
              inverse
              caption="≤ 2500 ms good"
            />
            <KpiCard
              label={<TermLabel term="inp">INP (mobile)</TermLabel>}
              value={mob?.avgInp}
              format="ms"
              inverse
              caption="≤ 200 ms good"
            />
            <KpiCard
              label={<TermLabel term="cls">CLS (mobile)</TermLabel>}
              value={mob?.avgCls}
              format="number"
              inverse
              caption="≤ 0.1 good"
            />
            <KpiCard
              label="Pages measured (mobile)"
              value={mob?.rows}
              caption={`${mob?.errors ?? 0} errors`}
            />
          </KpiRow>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartContainer
              title={<TermLabel term="cwv-pass-fail">Pass/fail distribution</TermLabel>}
              subtitle="Pages bucketed by CWV status per strategy. Hover for counts."
              height={260}
              empty={passFail.length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passFail} stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="strategy" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Good" stackId="a" fill="#10b981" />
                  <Bar dataKey="Needs improvement" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Poor" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title={<TermLabel term="lcp">LCP trend</TermLabel>}
              subtitle="Daily average LCP. Mobile + desktop where both strategies exist."
              height={260}
              empty={ts.length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="day"
                    type="category"
                    allowDuplicatedCategory={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line data={lcpSeries} dataKey="lcp" name="Mobile" stroke="#6366f1" dot={false} />
                  <Line
                    data={lcpDesktop}
                    dataKey="lcp"
                    name="Desktop"
                    stroke="#10b981"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          <SectionCard className="mb-4">
            <h3 className="text-sm font-semibold mb-3">Slowest important pages</h3>
            <p className="text-xs text-text-muted mb-3">
              Important pages sorted by LCP. Fix these first — they drive ranking and conversion.
            </p>
            <Table
              rowKey={(r) => `${r.pageUrl}|${r.strategy}`}
              size="small"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              dataSource={slowest}
              columns={[
                {
                  title: 'Page',
                  dataIndex: 'path',
                  ellipsis: true,
                  render: (p: string, r: SlowRow) => (
                    <span>
                      {r.isImportant ? <span className="text-amber-500 mr-1">★</span> : null}
                      <span className="font-mono text-[12px]">{p}</span>
                    </span>
                  ),
                },
                {
                  title: 'Role',
                  dataIndex: 'pageRole',
                  width: 130,
                  render: (r: string | null) =>
                    r ? <Tag className="m-0">{r}</Tag> : <span className="text-text-subtle">—</span>,
                },
                {
                  title: <TermLabel term="cwv-strategy">Strategy</TermLabel>,
                  dataIndex: 'strategy',
                  width: 90,
                },
                {
                  title: <TermLabel term="lcp">LCP</TermLabel>,
                  dataIndex: 'lcp',
                  width: 100,
                  render: (v: number | undefined) =>
                    v != null ? (
                      <span className="tabular-nums">{Math.round(v).toLocaleString()} ms</span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    ),
                },
                {
                  title: <TermLabel term="inp">INP</TermLabel>,
                  dataIndex: 'inp',
                  width: 90,
                  render: (v: number | undefined) =>
                    v != null ? (
                      <span className="tabular-nums">{Math.round(v).toLocaleString()} ms</span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    ),
                },
                {
                  title: <TermLabel term="cls">CLS</TermLabel>,
                  dataIndex: 'cls',
                  width: 80,
                  render: (v: number | undefined) =>
                    v != null ? <span className="tabular-nums">{v.toFixed(2)}</span> : <span className="text-text-subtle">—</span>,
                },
                {
                  title: <TermLabel term="performance-score">Perf</TermLabel>,
                  dataIndex: 'performanceScore',
                  width: 70,
                  render: (v: number | undefined) =>
                    v != null ? <span className="tabular-nums">{v}</span> : <span className="text-text-subtle">—</span>,
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  width: 130,
                  render: (s: string) => <StatusPill value={s} kind="state" />,
                },
              ]}
            />
          </SectionCard>

          {errors.length > 0 && (
            <SectionCard>
              <h3 className="text-sm font-semibold mb-2">Measurement errors</h3>
              <p className="text-xs text-text-muted mb-3">
                URLs PSI could not measure. Common causes: page blocked from PSI crawler, 4xx/5xx,
                or quota exceeded.
              </p>
              <Table
                rowKey={(r) => `${r.pageUrl}|${r.strategy}`}
                size="small"
                pagination={false}
                dataSource={errors}
                columns={[
                  { title: 'Path', dataIndex: 'path', ellipsis: true },
                  { title: <TermLabel term="cwv-strategy">Strategy</TermLabel>, dataIndex: 'strategy', width: 90 },
                  { title: 'Error', dataIndex: 'error', ellipsis: true },
                ]}
              />
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}
