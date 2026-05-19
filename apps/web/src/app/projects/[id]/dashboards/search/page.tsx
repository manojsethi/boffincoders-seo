'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
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
  gsc: { connected: boolean; lastSyncedAt: string | null; rangeStart: string | null; rangeEnd: string | null };
};
type Summary = {
  current: { clicks: number; impressions: number; ctr: number; avgPosition: number; rows: number; rangeEnd: string } | null;
  previous: { clicks: number; impressions: number; ctr: number; avgPosition: number; rows: number; rangeEnd: string } | null;
};
type QueryRow = { query: string; clicks: number; impressions: number; ctr: number; avgPosition: number; pageCount: number };
type PageRow = { pageUrl: string; path: string; clicks: number; impressions: number; ctr: number; avgPosition: number };
type Bucket = { bucket: string; rowCount: number; clicks: number; impressions: number };
type QuickWin = { query: string; impressions: number; clicks: number; ctr: number; avgPosition: number; topPage: string };
type LowCtr = { pageUrl: string; path: string; clicks: number; impressions: number; ctr: number; expectedCtr: number; avgPosition: number };
type Cannibal = { query: string; impressions: number; uniquePageCount: number; topPage: string; pages: string[] };

export default function SearchDashboard({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);

  const { data: fresh } = useQuery<Freshness>({
    queryKey: ['analytics-freshness', id],
    queryFn: () => api(`/projects/${id}/analytics/freshness`),
  });
  const gscConnected = !!fresh?.gsc.connected;
  const hasData = !!fresh?.gsc.rangeEnd;

  const enabled = hasData;
  const { data: summary } = useQuery<Summary>({
    queryKey: ['gsc-summary', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/summary`),
    enabled,
  });
  const { data: queries = [] } = useQuery<QueryRow[]>({
    queryKey: ['gsc-top-queries', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/top-queries?limit=25`),
    enabled,
  });
  const { data: pages = [] } = useQuery<PageRow[]>({
    queryKey: ['gsc-top-pages', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/top-pages?limit=25`),
    enabled,
  });
  const { data: buckets = [] } = useQuery<Bucket[]>({
    queryKey: ['gsc-position-buckets', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/position-buckets`),
    enabled,
  });
  const { data: quickWins = [] } = useQuery<QuickWin[]>({
    queryKey: ['gsc-quick-wins', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/quick-wins?limit=20`),
    enabled,
  });
  const { data: lowCtr = [] } = useQuery<LowCtr[]>({
    queryKey: ['gsc-low-ctr', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/low-ctr`),
    enabled,
  });
  const { data: cannibal = [] } = useQuery<Cannibal[]>({
    queryKey: ['gsc-cannibal', id],
    queryFn: () => api(`/projects/${id}/analytics/gsc/cannibalization`),
    enabled,
  });

  const cur = summary?.current ?? null;
  const prev = summary?.previous ?? null;

  const bucketsData = useMemo(
    () => buckets.map((b) => ({ bucket: b.bucket, impressions: b.impressions, clicks: b.clicks })),
    [buckets],
  );

  return (
    <>
      <PageHeader
        eyebrow="Project · Dashboards"
        title="Search Performance"
        subtitle="What Google Search Console says about visibility, clicks, and ranking opportunity."
        meta={
          <DataFreshness
            source="GSC"
            lastSyncedAt={fresh?.gsc.lastSyncedAt}
            rangeStart={fresh?.gsc.rangeStart}
            rangeEnd={fresh?.gsc.rangeEnd}
            notConnectedHint={
              !gscConnected ? 'Connect GSC on Settings → Integrations to populate this dashboard.' : undefined
            }
          />
        }
      />

      {!gscConnected || !hasData ? (
        <SectionCard>
          <EmptyState
            title={gscConnected ? 'No GSC data yet' : 'GSC not connected'}
            description={
              gscConnected
                ? 'GSC is connected but no rows are synced yet. Trigger a sync from Settings → Integrations.'
                : 'Connect Google Search Console on Settings → Integrations. The dashboard activates once the first sync completes.'
            }
            action={
              <Link
                href={`/projects/${id}/settings`}
                className="text-accent-hover hover:underline text-sm"
              >
                Open Settings → Integrations →
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <KpiRow>
            <KpiCard
              label={<TermLabel term="clicks">Clicks</TermLabel>}
              value={cur?.clicks}
              previous={prev?.clicks}
            />
            <KpiCard
              label={<TermLabel term="impressions">Impressions</TermLabel>}
              value={cur?.impressions}
              previous={prev?.impressions}
            />
            <KpiCard
              label={<TermLabel term="ctr">CTR</TermLabel>}
              value={cur?.ctr}
              previous={prev?.ctr}
              format="percent"
            />
            <KpiCard
              label={<TermLabel term="position">Avg position</TermLabel>}
              value={cur?.avgPosition}
              previous={prev?.avgPosition}
              format="position"
              inverse
            />
          </KpiRow>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <ChartContainer
              title={<TermLabel term="position">Position buckets</TermLabel>}
              subtitle="Distribution of GSC rows by ranking position. The 4-20 bucket is your quick-win zone."
              height={240}
              empty={bucketsData.length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bucketsData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="impressions" name="Impressions" fill="#6366f1" />
                  <Bar dataKey="clicks" name="Clicks" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title={<TermLabel term="quick-win-zone">Quick-win queries</TermLabel>}
              subtitle="Queries ranking 4-20 with ≥100 impressions. Highest-ROI action zone."
              height={240}
              empty={quickWins.length === 0}
              emptyLabel="No quick-win candidates above the 100-impression floor."
            >
              <div className="h-full overflow-auto -mx-1">
                <Table
                  rowKey="query"
                  size="small"
                  pagination={false}
                  dataSource={quickWins}
                  columns={[
                    { title: 'Query', dataIndex: 'query', ellipsis: true },
                    {
                      title: 'Pos',
                      dataIndex: 'avgPosition',
                      width: 60,
                      render: (v: number) => <span className="tabular-nums">{v.toFixed(1)}</span>,
                    },
                    {
                      title: 'Impr',
                      dataIndex: 'impressions',
                      width: 80,
                      render: (v: number) => (
                        <span className="tabular-nums">{v.toLocaleString()}</span>
                      ),
                    },
                    {
                      title: 'CTR',
                      dataIndex: 'ctr',
                      width: 64,
                      render: (v: number) => (
                        <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
                      ),
                    },
                  ]}
                />
              </div>
            </ChartContainer>
          </div>

          <SectionCard className="mb-4">
            <h3 className="text-sm font-semibold mb-3">
              <TermLabel term="ctr">High-impression, low-CTR pages</TermLabel>
            </h3>
            <p className="text-xs text-text-muted mb-3">
              Pages with ≥300 impressions where CTR falls below 80% of the expected curve for their
              position. Rewrite title + meta first.
            </p>
            {lowCtr.length === 0 ? (
              <div className="text-xs text-text-subtle">No pages below expected CTR.</div>
            ) : (
              <Table
                rowKey="pageUrl"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={lowCtr}
                columns={[
                  { title: 'Page', dataIndex: 'path', ellipsis: true },
                  {
                    title: 'Pos',
                    dataIndex: 'avgPosition',
                    width: 70,
                    render: (v: number) => <span className="tabular-nums">{v.toFixed(1)}</span>,
                  },
                  {
                    title: 'Impr',
                    dataIndex: 'impressions',
                    width: 100,
                    render: (v: number) => (
                      <span className="tabular-nums">{v.toLocaleString()}</span>
                    ),
                  },
                  {
                    title: 'Clicks',
                    dataIndex: 'clicks',
                    width: 80,
                    render: (v: number) => <span className="tabular-nums">{v}</span>,
                  },
                  {
                    title: 'Actual CTR',
                    dataIndex: 'ctr',
                    width: 100,
                    render: (v: number) => (
                      <span className="tabular-nums">{(v * 100).toFixed(2)}%</span>
                    ),
                  },
                  {
                    title: 'Expected',
                    dataIndex: 'expectedCtr',
                    width: 100,
                    render: (v: number) => (
                      <span className="tabular-nums text-text-subtle">
                        {(v * 100).toFixed(2)}%
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </SectionCard>

          <SectionCard className="mb-4">
            <h3 className="text-sm font-semibold mb-3">
              <TermLabel term="cannibalization">Cannibalization candidates</TermLabel>
            </h3>
            <p className="text-xs text-text-muted mb-3">
              Queries where multiple URLs receive impressions. Authority is splitting — consolidate
              or canonicalize.
            </p>
            {cannibal.length === 0 ? (
              <div className="text-xs text-text-subtle">No cannibalization detected.</div>
            ) : (
              <Table
                rowKey="query"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={cannibal}
                columns={[
                  { title: 'Query', dataIndex: 'query', ellipsis: true },
                  {
                    title: 'Impr',
                    dataIndex: 'impressions',
                    width: 110,
                    render: (v: number) => (
                      <span className="tabular-nums">{v.toLocaleString()}</span>
                    ),
                  },
                  {
                    title: 'URLs',
                    dataIndex: 'uniquePageCount',
                    width: 70,
                    render: (v: number) => <Tag className="m-0">{v}</Tag>,
                  },
                  { title: 'Top page', dataIndex: 'topPage', ellipsis: true },
                ]}
              />
            )}
          </SectionCard>

          <div className="grid lg:grid-cols-2 gap-4">
            <SectionCard noPadding>
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold">Top queries</h3>
              </div>
              <Table
                rowKey="query"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={queries}
                columns={[
                  { title: 'Query', dataIndex: 'query', ellipsis: true },
                  {
                    title: 'Impr',
                    dataIndex: 'impressions',
                    width: 90,
                    render: (v: number) => (
                      <span className="tabular-nums">{v.toLocaleString()}</span>
                    ),
                  },
                  {
                    title: 'Clicks',
                    dataIndex: 'clicks',
                    width: 70,
                    render: (v: number) => <span className="tabular-nums">{v}</span>,
                  },
                  {
                    title: 'CTR',
                    dataIndex: 'ctr',
                    width: 70,
                    render: (v: number) => (
                      <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
                    ),
                  },
                  {
                    title: 'Pos',
                    dataIndex: 'avgPosition',
                    width: 60,
                    render: (v: number) => <span className="tabular-nums">{v.toFixed(1)}</span>,
                  },
                ]}
              />
            </SectionCard>

            <SectionCard noPadding>
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold">Top landing pages</h3>
              </div>
              <Table
                rowKey="pageUrl"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                dataSource={pages}
                columns={[
                  { title: 'Page', dataIndex: 'path', ellipsis: true },
                  {
                    title: 'Impr',
                    dataIndex: 'impressions',
                    width: 90,
                    render: (v: number) => (
                      <span className="tabular-nums">{v.toLocaleString()}</span>
                    ),
                  },
                  {
                    title: 'Clicks',
                    dataIndex: 'clicks',
                    width: 70,
                    render: (v: number) => <span className="tabular-nums">{v}</span>,
                  },
                  {
                    title: 'CTR',
                    dataIndex: 'ctr',
                    width: 70,
                    render: (v: number) => (
                      <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
                    ),
                  },
                  {
                    title: 'Pos',
                    dataIndex: 'avgPosition',
                    width: 60,
                    render: (v: number) => <span className="tabular-nums">{v.toFixed(1)}</span>,
                  },
                ]}
              />
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
