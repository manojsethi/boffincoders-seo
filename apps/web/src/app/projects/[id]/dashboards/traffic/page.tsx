'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Table } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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

type Freshness = {
  ga4: { connected: boolean; lastSyncedAt: string | null; rangeStart: string | null; rangeEnd: string | null };
};
type Summary = {
  current: {
    sessions: number;
    engagedSessions: number;
    engagementRate: number;
    conversions: number;
    conversionRate: number;
    rows: number;
    rangeEnd: string;
  } | null;
  previous: Summary['current'];
};
type LandingRow = {
  path: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
  conversionRate: number;
};
type Channel = { channel: string; sessions: number; engagedSessions: number; conversions: number };

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

export default function TrafficDashboard({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { data: fresh } = useQuery<Freshness>({
    queryKey: ['analytics-freshness', id],
    queryFn: () => api(`/projects/${id}/analytics/freshness`),
  });
  const ga4Connected = !!fresh?.ga4.connected;
  const hasData = !!fresh?.ga4.rangeEnd;
  const enabled = hasData;

  const { data: summary } = useQuery<Summary>({
    queryKey: ['ga4-summary', id],
    queryFn: () => api(`/projects/${id}/analytics/ga4/summary`),
    enabled,
  });
  const { data: landing = [] } = useQuery<LandingRow[]>({
    queryKey: ['ga4-top-landing', id],
    queryFn: () => api(`/projects/${id}/analytics/ga4/top-landing-pages?limit=25`),
    enabled,
  });
  const { data: lowConv = [] } = useQuery<LandingRow[]>({
    queryKey: ['ga4-low-conv', id],
    queryFn: () => api(`/projects/${id}/analytics/ga4/low-conversion`),
    enabled,
  });
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['ga4-channels', id],
    queryFn: () => api(`/projects/${id}/analytics/ga4/channel-breakdown`),
    enabled,
  });

  const cur = summary?.current ?? null;
  const prev = summary?.previous ?? null;

  const channelChart = useMemo(
    () =>
      channels.map((c) => ({
        channel: c.channel || '(unset)',
        sessions: c.sessions,
        conversions: c.conversions,
      })),
    [channels],
  );

  return (
    <>
      <PageHeader
        eyebrow="Project · Dashboards"
        title="Traffic"
        subtitle="GA4 organic landing-page performance and conversion."
        meta={
          <DataFreshness
            source="GA4"
            lastSyncedAt={fresh?.ga4.lastSyncedAt}
            rangeStart={fresh?.ga4.rangeStart}
            rangeEnd={fresh?.ga4.rangeEnd}
            notConnectedHint={!ga4Connected ? 'Connect GA4 to populate this dashboard.' : undefined}
          />
        }
      />

      {!ga4Connected || !hasData ? (
        <SectionCard>
          <EmptyState
            title={ga4Connected ? 'No GA4 data yet' : 'GA4 not connected'}
            description={
              ga4Connected
                ? 'GA4 is connected but no rows are synced yet. Trigger a sync from Settings → Integrations.'
                : 'Connect GA4 on Settings → Integrations. The dashboard activates once the first sync completes.'
            }
            action={
              <Link href={`/projects/${id}/settings`} className="text-accent-hover hover:underline text-sm">
                Open Settings → Integrations →
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={<TermLabel term="sessions">Organic sessions</TermLabel>}
              value={cur?.sessions}
              previous={prev?.sessions}
            />
            <KpiCard
              label={<TermLabel term="engagement-rate">Engagement rate</TermLabel>}
              value={cur?.engagementRate}
              previous={prev?.engagementRate}
              format="percent"
            />
            <KpiCard
              label={<TermLabel term="conversions">Conversions</TermLabel>}
              value={cur?.conversions}
              previous={prev?.conversions}
            />
            <KpiCard
              label={<TermLabel term="conversion-rate">Conversion rate</TermLabel>}
              value={cur?.conversionRate}
              previous={prev?.conversionRate}
              format="percent"
            />
          </KpiRow>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartContainer
              title={<TermLabel term="channel">Channel breakdown</TermLabel>}
              subtitle="Sessions by acquisition channel. Validates whether the organic story matches what GSC implies."
              height={260}
              empty={channelChart.length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelChart}
                    dataKey="sessions"
                    nameKey="channel"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={1}
                  >
                    {channelChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title="High-traffic, low-conversion pages"
              subtitle="≥100 organic sessions with conversion rate < 1%. Audit CTA, intent match, proof signals."
              height={260}
              empty={lowConv.length === 0}
              emptyLabel="No low-conversion landing pages above the traffic floor."
            >
              <div className="h-full overflow-auto -mx-1">
                <Table
                  rowKey="path"
                  size="small"
                  pagination={false}
                  dataSource={lowConv}
                  columns={[
                    { title: 'Path', dataIndex: 'path', ellipsis: true },
                    {
                      title: 'Sessions',
                      dataIndex: 'sessions',
                      width: 90,
                      render: (v: number) => (
                        <span className="tabular-nums">{v.toLocaleString()}</span>
                      ),
                    },
                    {
                      title: <TermLabel term="conversion-rate">CR</TermLabel>,
                      dataIndex: 'conversionRate',
                      width: 70,
                      render: (v: number) => (
                        <span className="tabular-nums">{(v * 100).toFixed(2)}%</span>
                      ),
                    },
                  ]}
                />
              </div>
            </ChartContainer>
          </div>

          <SectionCard className="mb-4">
            <h3 className="text-sm font-semibold mb-3">Top organic landing pages</h3>
            <Table
              rowKey="path"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              dataSource={landing}
              columns={[
                { title: 'Path', dataIndex: 'path', ellipsis: true },
                {
                  title: <TermLabel term="sessions">Sessions</TermLabel>,
                  dataIndex: 'sessions',
                  width: 110,
                  render: (v: number) => <span className="tabular-nums">{v.toLocaleString()}</span>,
                },
                {
                  title: 'Engaged',
                  dataIndex: 'engagedSessions',
                  width: 100,
                  render: (v: number) => <span className="tabular-nums">{v.toLocaleString()}</span>,
                },
                {
                  title: <TermLabel term="engagement-rate">Eng. rate</TermLabel>,
                  dataIndex: 'engagementRate',
                  width: 100,
                  render: (v: number) => <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>,
                },
                {
                  title: <TermLabel term="conversions">Conv.</TermLabel>,
                  dataIndex: 'conversions',
                  width: 80,
                  render: (v: number) => <span className="tabular-nums">{v}</span>,
                },
                {
                  title: <TermLabel term="conversion-rate">CR</TermLabel>,
                  dataIndex: 'conversionRate',
                  width: 70,
                  render: (v: number) => <span className="tabular-nums">{(v * 100).toFixed(2)}%</span>,
                },
              ]}
            />
          </SectionCard>

          <ChartContainer
            title="Channel sessions vs conversions"
            subtitle="Compares raw session volume with conversion volume per channel."
            height={260}
            empty={channelChart.length === 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sessions" name="Sessions" fill="#6366f1" />
                <Bar dataKey="conversions" name="Conversions" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </>
      )}
    </>
  );
}
