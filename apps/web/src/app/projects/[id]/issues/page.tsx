'use client';

import { Suspense, use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Select, Switch, Table, Tag } from 'antd';
import { Search } from 'lucide-react';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { StatusPill } from '../../../../components/StatusPill';
import { TermLabel } from '../../../../components/TermLabel';
import { IssueDrawer } from '../../../../components/IssueDrawer';
import { ChartContainer } from '../../../../components/charts/ChartContainer';
import { SeverityBars } from '../../../../components/charts/SeverityBars';
import { useIssues, type IssueRow } from '../../../../hooks/useIssues';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api';

type RecommendationLite = {
  id: string;
  status: string;
  verdict: string;
  ownerType: string;
  sourceIssueIds: string[];
};

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'info'];
const STATUS_OPTIONS = [
  'open',
  'planned',
  'in-progress',
  'fixed-pending-verification',
  'verified',
  'ignored',
  'not-applicable',
  'blocked-by-data-gap',
];
const SCOPE_OPTIONS = ['page', 'site'];
const PRIORITY_OPTIONS = ['P0', 'P1', 'P2'];
const INACTIVE_LIFECYCLES = new Set([
  'verified',
  'ignored',
  'not-applicable',
  'blocked-by-data-gap',
]);

function IssuesScreenInner({ id }: { id: string }): JSX.Element {
  const router = useRouter();
  const sp = useSearchParams();
  const pageIdFilter = sp?.get('pageId') ?? '';

  const qs = pageIdFilter ? `pageId=${pageIdFilter}` : '';
  const { data, isLoading, error } = useIssues(id, qs);

  const { data: recs = [] } = useQuery<RecommendationLite[]>({
    queryKey: ['recommendations', id],
    queryFn: () => api<RecommendationLite[]>(`/projects/${id}/recommendations?limit=1000`),
  });
  // First recommendation per source issue (active one wins).
  const recByIssue = useMemo(() => {
    const m = new Map<string, RecommendationLite>();
    for (const r of recs) {
      for (const iid of r.sourceIssueIds ?? []) {
        const existing = m.get(iid);
        if (!existing || existing.status === 'rejected') m.set(iid, r);
      }
    }
    return m;
  }, [recs]);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [scope, setScope] = useState<string | undefined>();
  const [priority, setPriority] = useState<string | undefined>();
  const [recStatus, setRecStatus] = useState<string | undefined>();
  const [hideInactive, setHideInactive] = useState(true);

  // Drawer state is derived directly from URL — avoids a state↔URL sync race that re-opened the
  // drawer for a frame on close (close → useEffect saw stale sp → re-set state → close again).
  const drawerIssueId = sp?.get('issue') ?? null;

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((i) => {
      if (severity && i.severity !== severity) return false;
      if (status && i.lifecycleStatus !== status) return false;
      if (scope && i.scope !== scope) return false;
      if (priority && i.actionPriority !== priority) return false;
      if (recStatus) {
        const r = recByIssue.get(i.id);
        if (recStatus === 'none' ? !!r : (r?.status ?? 'none') !== recStatus) return false;
      }
      if (hideInactive && INACTIVE_LIFECYCLES.has(i.lifecycleStatus)) return false;
      if (q) {
        const hay = `${i.title} ${i.ruleId} ${i.affectedUrl ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, severity, status, scope, priority, hideInactive, recStatus, recByIssue]);

  const severityBuckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of filtered) {
      if (INACTIVE_LIFECYCLES.has(i.lifecycleStatus)) continue;
      map.set(i.severity, (map.get(i.severity) ?? 0) + 1);
    }
    return SEVERITY_OPTIONS.filter((s) => map.has(s)).map((s) => ({
      severity: s,
      count: map.get(s) ?? 0,
    }));
  }, [filtered]);

  const openDrawer = (issueId: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.set('issue', issueId);
    router.replace(`?${url.searchParams.toString()}`, { scroll: false });
  };
  const closeDrawer = (): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete('issue');
    router.replace(`?${url.searchParams.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Issues"
        subtitle={
          pageIdFilter
            ? 'Filtered to a single page.'
            : 'Tracked issues across this project. Open the drawer to see evidence and update status.'
        }
        actions={
          pageIdFilter ? (
            <Link
              href={`/projects/${id}/issues`}
              className="text-xs text-accent-hover hover:underline"
            >
              Clear page filter →
            </Link>
          ) : null
        }
      />

      {severityBuckets.length > 0 ? (
        <div className="mb-6">
          <ChartContainer
            title={<TermLabel term="severity">Issues by severity</TermLabel>}
            subtitle="Open issues only."
            height={200}
          >
            <SeverityBars data={severityBuckets} />
          </ChartContainer>
        </div>
      ) : null}

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            prefix={<Search size={14} className="text-text-subtle" />}
            placeholder="Search title, rule, URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ minWidth: 240, flex: 1, maxWidth: 360 }}
          />
          <Select
            placeholder="Severity"
            allowClear
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS.map((s) => ({ label: s, value: s }))}
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Status"
            allowClear
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
            style={{ minWidth: 180 }}
          />
          <Select
            placeholder="Scope"
            allowClear
            value={scope}
            onChange={setScope}
            options={SCOPE_OPTIONS.map((s) => ({ label: s, value: s }))}
            style={{ minWidth: 120 }}
          />
          <Select
            placeholder="Priority"
            allowClear
            value={priority}
            onChange={setPriority}
            options={PRIORITY_OPTIONS.map((p) => ({ label: p, value: p }))}
            style={{ minWidth: 110 }}
          />
          <Select
            placeholder="Recommendation"
            allowClear
            value={recStatus}
            onChange={setRecStatus}
            options={[
              { label: 'None', value: 'none' },
              { label: 'Draft', value: 'draft' },
              { label: 'Proposed', value: 'proposed' },
              { label: 'Approved', value: 'approved' },
              { label: 'Planned', value: 'planned' },
              { label: 'In progress', value: 'in_progress' },
              { label: 'Implemented', value: 'implemented' },
              { label: 'Verified', value: 'verified' },
              { label: 'Rejected', value: 'rejected' },
            ]}
            style={{ minWidth: 150 }}
          />
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Switch size="small" checked={hideInactive} onChange={setHideInactive} />
            Hide inactive
          </label>
        </div>
      </SectionCard>

      <SectionCard noPadding>
        {error ? (
          <div className="p-4">
            <EmptyState title="Failed to load issues" description={(error as Error).message} />
          </div>
        ) : (data?.length ?? 0) === 0 && !isLoading ? (
          <div className="p-4">
            <EmptyState
              title="No issues yet"
              description="Issues are created from audit findings. Run an audit on the project overview to populate this list."
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
            onRow={(row) => ({ onClick: () => openDrawer(row.id), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: <TermLabel term="url">Affected URL</TermLabel>,
                dataIndex: 'affectedUrl',
                width: 320,
                fixed: 'left',
                ellipsis: true,
                render: (u: string | null, row: IssueRow) => {
                  // Doc 11 §"Cross-Page Rules": group issues must read as N-page issues, not a single URL.
                  if (row.scope === 'site' || row.affectedPageCount > 1) {
                    const count =
                      row.affectedPageCount > 0
                        ? row.affectedPageCount
                        : row.affectedUrls.length;
                    return (
                      <span className="text-text-muted text-xs">
                        Affects {count} pages
                        {u ? (
                          <span className="block font-mono text-[11px] text-text-subtle truncate">
                            e.g. {shortUrl(u)}
                          </span>
                        ) : null}
                      </span>
                    );
                  }
                  if (!u) return <span className="text-text-subtle">Site-level</span>;
                  return (
                    <span className="font-mono text-[12px] text-text truncate">{shortUrl(u)}</span>
                  );
                },
              },
              {
                title: <TermLabel term="severity">Severity</TermLabel>,
                dataIndex: 'severity',
                width: 110,
                render: (s: string) => <StatusPill value={s} kind="severity" />,
              },
              {
                title: <TermLabel term="action-priority">Priority</TermLabel>,
                dataIndex: 'actionPriority',
                width: 90,
                render: (p: string) => <Tag className="m-0">{p}</Tag>,
              },
              { title: 'Title', dataIndex: 'title', ellipsis: true },
              {
                title: <TermLabel term="role">Role</TermLabel>,
                dataIndex: 'pageRole',
                width: 140,
                render: (r: string | null) =>
                  r ? <Tag className="m-0">{r}</Tag> : <span className="text-text-subtle">—</span>,
              },
              { title: 'Category', dataIndex: 'category', width: 160 },
              {
                title: 'Status',
                dataIndex: 'lifecycleStatus',
                width: 200,
                render: (s: string) => <StatusPill value={s} kind="state" />,
              },
              {
                title: <TermLabel term="recommendation">Recommendation</TermLabel>,
                width: 150,
                render: (_: unknown, row: IssueRow) => {
                  const r = recByIssue.get(row.id);
                  if (!r) return <span className="text-text-subtle text-xs">—</span>;
                  return (
                    <span className="flex items-center gap-1.5">
                      <StatusPill value={r.status} kind="state" />
                      <span className="text-[10px] uppercase text-text-subtle">{r.ownerType}</span>
                    </span>
                  );
                },
              },
              {
                title: <TermLabel term="priority">Score</TermLabel>,
                dataIndex: 'priority',
                width: 90,
                sorter: (a, b) => a.priority - b.priority,
                defaultSortOrder: 'descend',
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              {
                title: <TermLabel term="impact">Impact</TermLabel>,
                dataIndex: 'impact',
                width: 90,
                render: (v: number) => <span className="tabular-nums">{v}</span>,
              },
              {
                title: <TermLabel term="effort">Effort</TermLabel>,
                dataIndex: 'effort',
                width: 100,
              },
              {
                title: 'First seen',
                dataIndex: 'firstSeenAt',
                width: 130,
                sorter: (a, b) =>
                  (a.firstSeenAt ? Date.parse(a.firstSeenAt) : 0) -
                  (b.firstSeenAt ? Date.parse(b.firstSeenAt) : 0),
                render: (v: string | null) =>
                  v ? (
                    <span className="text-xs text-text-muted tabular-nums">
                      {new Date(v).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                title: 'Last seen',
                dataIndex: 'lastSeenAt',
                width: 130,
                sorter: (a, b) =>
                  (a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0) -
                  (b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0),
                render: (v: string | null) =>
                  v ? (
                    <span className="text-xs text-text-muted tabular-nums">
                      {new Date(v).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
            ]}
          />
        )}
      </SectionCard>

      <IssueDrawer
        projectId={id}
        issueId={drawerIssueId}
        open={!!drawerIssueId}
        onClose={closeDrawer}
      />
    </>
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

export default function IssuesScreen({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <IssuesScreenInner id={id} />
    </Suspense>
  );
}
