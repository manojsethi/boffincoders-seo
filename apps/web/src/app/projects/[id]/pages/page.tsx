'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { App, Button, Input, Progress, Select, Switch, Table, Tag } from 'antd';
import { Search, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { StatusPill } from '../../../../components/StatusPill';
import { TermLabel } from '../../../../components/TermLabel';
import { InfoIcon } from '../../../../components/InfoIcon';
import { IssueCountPopover } from '../../../../components/IssueCountPopover';
import { usePagesTable, type PageRow } from '../../../../hooks/usePagesTable';
import { api } from '../../../../lib/api';

const ROLE_OPTIONS = [
  'home',
  'navigation-hub',
  'content-article',
  'product',
  'collection',
  'documentation',
  'pricing',
  'about',
  'contact',
  'legal',
  'utility',
  'unknown',
];

type SchemaSource = PageRow['schemaSource'];

type RenderRunDTO = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  progressPercent: number;
  currentStep: string;
  totalPages: number;
  completedPages: number;
  successCount: number;
  failureCount: number;
  rerun?: { findingsInserted: number; issuesUpserted: number; rulesRun: number; pages: number };
  error?: string;
};

const SCHEMA_SOURCE_TONE: Record<SchemaSource, string> = {
  'raw-html': 'text-success',
  'rendered-html': 'text-accent',
  'both': 'text-success',
  'none': 'text-warning',
  'not-verified': 'text-text-subtle',
};

export default function PagesScreen({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { data, isLoading, error } = usePagesTable(id);
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [hasIssuesOnly, setHasIssuesOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [hideIntentionallyNonIndexable, setHideIntentionallyNonIndexable] = useState(true);
  const [schemaNotVerifiedOnly, setSchemaNotVerifiedOnly] = useState(false);
  const [noRawJsonLdOnly, setNoRawJsonLdOnly] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const renderMutation = useMutation({
    mutationFn: (pageIds: string[]) =>
      api<{ renderRunId: string; status: string }>(`/projects/${id}/render-recrawl`, {
        method: 'POST',
        body: JSON.stringify({ pageIds, reason: 'analyst-bulk' }),
      }),
    onSuccess: (res) => {
      setActiveRunId(res.renderRunId);
      message.info(`Rendered recrawl queued (${selectedRowKeys.length} pages).`);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const runQuery = useQuery<RenderRunDTO>({
    queryKey: ['render-run', id, activeRunId],
    queryFn: () => api<RenderRunDTO>(`/projects/${id}/render-runs/${activeRunId}`),
    enabled: !!activeRunId,
    refetchInterval: (q) => {
      const status = (q.state.data as RenderRunDTO | undefined)?.status;
      return status === 'completed' || status === 'failed' ? false : 2000;
    },
  });

  const lastNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    const run = runQuery.data;
    if (!run || !activeRunId) return;
    if (run.status === 'completed' && lastNotifiedRef.current !== activeRunId) {
      lastNotifiedRef.current = activeRunId;
      message.success(
        `Rendered ${run.successCount}/${run.totalPages} pages. Issues updated: ${run.rerun?.issuesUpserted ?? 0}.`,
      );
      setSelectedRowKeys([]);
      void qc.invalidateQueries({ queryKey: ['pages', id] });
      void qc.invalidateQueries({ queryKey: ['project-overview', id] });
      void qc.invalidateQueries({ queryKey: ['issues', id] });
    }
    if (run.status === 'failed' && lastNotifiedRef.current !== activeRunId) {
      lastNotifiedRef.current = activeRunId;
      message.error(`Render run failed: ${run.error ?? 'unknown'}`);
    }
  }, [runQuery.data, activeRunId, id, message, qc]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      if (hideIntentionallyNonIndexable && p.isIntentionallyNonIndexable) return false;
      if (roleFilter && p.pageRole !== roleFilter) return false;
      if (hasIssuesOnly && p.issueCounts.total === 0) return false;
      if (criticalOnly && p.issueCounts.critical + p.issueCounts.high === 0) return false;
      if (schemaNotVerifiedOnly && p.schemaSource !== 'not-verified') return false;
      if (noRawJsonLdOnly && p.rawSchemaCount > 0) return false;
      if (q) {
        const hay = `${p.url} ${p.title ?? ''} ${p.h1 ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    data,
    search,
    roleFilter,
    hasIssuesOnly,
    criticalOnly,
    hideIntentionallyNonIndexable,
    schemaNotVerifiedOnly,
    noRawJsonLdOnly,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Pages"
        subtitle="Triage which pages need work first. Sort by issues, by criticality, or by traffic once Search Console is connected."
        meta={
          <span className="text-xs text-text-muted">
            {data ? `${filtered.length} of ${data.length} pages` : null}
          </span>
        }
      />

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            prefix={<Search size={14} className="text-text-subtle" />}
            placeholder="Search URL, title, or H1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ minWidth: 240, flex: 1, maxWidth: 360 }}
          />
          <Select
            placeholder="All roles"
            allowClear
            value={roleFilter}
            onChange={(v) => setRoleFilter(v)}
            options={ROLE_OPTIONS.map((r) => ({ label: r, value: r }))}
            style={{ minWidth: 180 }}
          />
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch size="small" checked={hasIssuesOnly} onChange={setHasIssuesOnly} />
            Has issues
          </label>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch size="small" checked={criticalOnly} onChange={setCriticalOnly} />
            Critical or high only
          </label>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch
              size="small"
              checked={hideIntentionallyNonIndexable}
              onChange={setHideIntentionallyNonIndexable}
            />
            Hide intentionally non-indexable
          </label>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch
              size="small"
              checked={schemaNotVerifiedOnly}
              onChange={setSchemaNotVerifiedOnly}
            />
            Schema not verified
          </label>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch size="small" checked={noRawJsonLdOnly} onChange={setNoRawJsonLdOnly} />
            No raw JSON-LD
          </label>
        </div>
        {selectedRowKeys.length > 0 ? (
          <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
            <span className="text-xs text-text-muted">{selectedRowKeys.length} selected</span>
            <Button
              type="primary"
              size="small"
              icon={<Sparkles size={12} />}
              loading={renderMutation.isPending}
              disabled={activeRunIsBusy(runQuery.data)}
              onClick={() => renderMutation.mutate(selectedRowKeys.map(String).slice(0, 50))}
            >
              Render selected (Playwright)
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              Clear
            </Button>
            <span className="text-[11px] text-text-subtle">
              Up to 50 pages per request. Headless Chromium. Schema rules re-run after.
            </span>
          </div>
        ) : null}
        {runQuery.data && activeRunIsBusy(runQuery.data) ? (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">
                Render run {runQuery.data.status} —{' '}
                {runQuery.data.completedPages}/{runQuery.data.totalPages} pages
                {runQuery.data.currentStep ? ` · ${runQuery.data.currentStep}` : ''}
              </span>
              <Button size="small" type="link" onClick={() => setActiveRunId(null)}>
                Hide
              </Button>
            </div>
            <Progress
              percent={runQuery.data.progressPercent}
              size="small"
              status={runQuery.data.status === 'failed' ? 'exception' : 'active'}
            />
            {runQuery.data.failureCount > 0 ? (
              <p className="text-[11px] text-warning mt-1">
                {runQuery.data.failureCount} page(s) failed — see render run history.
              </p>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard noPadding>
        {error ? (
          <div className="p-4">
            <EmptyState title="Failed to load pages" description={(error as Error).message} />
          </div>
        ) : (data?.length ?? 0) === 0 && !isLoading ? (
          <div className="p-4">
            <EmptyState
              title="No pages crawled yet"
              description="Run a crawl from the project overview to populate this list with discovered pages, content, and link graph."
            />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={filtered}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 1500 }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              preserveSelectedRowKeys: true,
            }}
            columns={[
              {
                title: <TermLabel term="url">URL</TermLabel>,
                dataIndex: 'url',
                width: 320,
                fixed: 'left',
                render: (url: string, row: PageRow) => (
                  <Link
                    href={`/projects/${id}/pages/${row.id}`}
                    className="text-text hover:text-accent-hover hover:underline tabular-nums font-mono text-[12px]"
                  >
                    {shortUrl(url)}
                  </Link>
                ),
              },
              {
                title: <TermLabel term="role">Role</TermLabel>,
                dataIndex: 'pageRole',
                width: 180,
                render: (role: string, row: PageRow) => (
                  <div className="flex items-center gap-1.5">
                    <Tag className="m-0">{role}</Tag>
                    {row.roleConfidenceLevel === 'low' ? (
                      <span className="text-[10px] uppercase tracking-wider text-text-subtle">
                        low conf
                      </span>
                    ) : null}
                    {row.isImportant ? (
                      <span title="Important page" className="text-warning">
                        ★
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                title: <TermLabel term="status">Status</TermLabel>,
                dataIndex: 'statusCode',
                width: 90,
                sorter: (a, b) => a.statusCode - b.statusCode,
                render: (c: number) => (
                  <span
                    className={
                      c === 200
                        ? 'text-success tabular-nums'
                        : c >= 500
                          ? 'text-danger tabular-nums'
                          : 'text-warning tabular-nums'
                    }
                  >
                    {c}
                  </span>
                ),
              },
              {
                title: <TermLabel term="indexability">Indexability</TermLabel>,
                dataIndex: 'indexability',
                width: 130,
              },
              {
                title: <TermLabel term="issues">Issues</TermLabel>,
                dataIndex: 'issueCounts',
                width: 110,
                sorter: (a, b) => a.issueCounts.total - b.issueCounts.total,
                defaultSortOrder: 'descend',
                render: (_v, row: PageRow) => (
                  <IssueCountPopover
                    counts={row.issueCounts}
                    topIssue={row.topIssue ?? undefined}
                    topIssues={row.topIssues ?? []}
                    pageWorkspaceHref={`/projects/${id}/pages/${row.id}`}
                    pageIssuesHref={`/projects/${id}/issues?pageId=${row.id}`}
                  />
                ),
              },
              {
                title: <TermLabel term="severity">Top issue</TermLabel>,
                dataIndex: ['topIssue', 'title'],
                width: 280,
                ellipsis: true,
                render: (_v, row: PageRow) =>
                  row.topIssue ? (
                    <Link
                      href={`/projects/${id}/issues?issue=${row.topIssue.id}`}
                      className="hover:text-accent-hover hover:underline"
                    >
                      <span className="flex items-center gap-2">
                        <StatusPill value={row.topIssue.severity} kind="severity" />
                        <span className="truncate text-text">{row.topIssue.title}</span>
                      </span>
                    </Link>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                title: <TermLabel term="links-in">Links in</TermLabel>,
                dataIndex: 'internalLinksIn',
                width: 100,
                sorter: (a, b) => a.internalLinksIn - b.internalLinksIn,
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              {
                title: <TermLabel term="links-out">Links out</TermLabel>,
                dataIndex: 'internalLinksOut',
                width: 110,
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              {
                title: <TermLabel term="schema">Schema</TermLabel>,
                dataIndex: 'schemaTypeCount',
                width: 200,
                render: (_v, row: PageRow) => <SchemaCell row={row} />,
              },
              { title: 'Title', dataIndex: 'title', ellipsis: true },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    Clicks <InfoIcon term="ctr" />
                  </span>
                ),
                dataIndex: 'clicks',
                width: 110,
                sorter: (a, b) => (a.clicks ?? 0) - (b.clicks ?? 0),
                render: (v: number | null) =>
                  v === null ? <ConnectHint label="GSC" /> : <span className="tabular-nums">{v}</span>,
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    Impressions <InfoIcon term="impressions" />
                  </span>
                ),
                dataIndex: 'impressions',
                width: 130,
                sorter: (a, b) => (a.impressions ?? 0) - (b.impressions ?? 0),
                render: (v: number | null) =>
                  v === null ? <ConnectHint label="GSC" /> : <span className="tabular-nums">{v}</span>,
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    CTR <InfoIcon term="ctr" />
                  </span>
                ),
                dataIndex: 'ctr',
                width: 100,
                sorter: (a, b) => (a.ctr ?? 0) - (b.ctr ?? 0),
                render: (v: number | null) =>
                  v === null ? (
                    <ConnectHint label="GSC" />
                  ) : (
                    <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
                  ),
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    Position <InfoIcon term="position" />
                  </span>
                ),
                dataIndex: 'position',
                width: 110,
                sorter: (a, b) => (a.position ?? 999) - (b.position ?? 999),
                render: (v: number | null) =>
                  v === null ? (
                    <ConnectHint label="GSC" />
                  ) : (
                    <span className="tabular-nums">{v.toFixed(1)}</span>
                  ),
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    Sessions <InfoIcon term="sessions" />
                  </span>
                ),
                dataIndex: 'sessions',
                width: 110,
                sorter: (a, b) => (a.sessions ?? 0) - (b.sessions ?? 0),
                render: (v: number | null) =>
                  v === null ? <ConnectHint label="GA4" /> : <span className="tabular-nums">{v}</span>,
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    Conversions <InfoIcon term="conversions" />
                  </span>
                ),
                dataIndex: 'conversions',
                width: 130,
                sorter: (a, b) => (a.conversions ?? 0) - (b.conversions ?? 0),
                render: (v: number | null) =>
                  v === null ? <ConnectHint label="GA4" /> : <span className="tabular-nums">{v}</span>,
              },
              {
                title: (
                  <span className="inline-flex items-center gap-1">
                    LCP <InfoIcon term="lcp" />
                  </span>
                ),
                dataIndex: ['cwv', 'lcp'],
                width: 110,
                render: (_v, row: PageRow) =>
                  row.cwv?.lcp != null ? (
                    <span className="tabular-nums">{Math.round(row.cwv.lcp)}ms</span>
                  ) : (
                    <ConnectHint label="CWV" />
                  ),
              },
            ]}
          />
        )}
      </SectionCard>
    </>
  );
}

function SchemaCell({ row }: { row: PageRow }): JSX.Element {
  const tone = SCHEMA_SOURCE_TONE[row.schemaSource];
  const label =
    row.schemaSource === 'not-verified'
      ? 'not verified'
      : row.schemaSource === 'none'
        ? 'none (rendered)'
        : row.schemaSource;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[11px] uppercase tracking-wider ${tone}`}>{label}</span>
      {row.schemaTypeCount > 0 ? (
        <span className="text-text tabular-nums text-xs">·{row.schemaTypeCount}</span>
      ) : null}
      {row.schemaParseErrorCount > 0 ? (
        <span className="text-danger text-[10px]" title={`${row.schemaParseErrorCount} parse errors`}>
          ⚠
        </span>
      ) : null}
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

function ConnectGSC(): JSX.Element {
  return <span className="text-[11px] text-text-subtle">Connect GSC</span>;
}

function ConnectHint({ label }: { label: string }): JSX.Element {
  return <span className="text-[11px] text-text-subtle">Connect {label}</span>;
}

function activeRunIsBusy(run: RenderRunDTO | undefined): boolean {
  if (!run) return false;
  return run.status === 'queued' || run.status === 'running';
}
