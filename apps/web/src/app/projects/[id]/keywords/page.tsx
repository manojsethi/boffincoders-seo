'use client';

import { use, useMemo, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { StatusPill } from '../../../../components/StatusPill';
import { TermLabel } from '../../../../components/TermLabel';

const SOURCES = ['manual', 'gsc', 'ai', 'import', 'external'];
const INTENTS = [
  'informational',
  'commercial',
  'transactional',
  'navigational',
  'local',
  'support',
  'unknown',
];
const FUNNEL = ['TOFU', 'MOFU', 'BOFU', 'retention', 'unknown'];
const STATUSES = [
  'candidate',
  'mapped',
  'unmapped',
  'wrong-page',
  'cannibalised',
  'no-target-page',
  'ignored',
];
const PRIORITIES = ['P0', 'P1', 'P2'];

type Keyword = {
  id: string;
  keyword: string;
  source: string;
  intent: string;
  funnelStage: string;
  mappedPageId: string | null;
  mappedGoalId: string | null;
  preferredUrl: string | null;
  rankingUrl: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageCount: number;
  status: string;
  priority: 'P0' | 'P1' | 'P2';
  opportunityScore: number;
  notes: string;
};

type PageRow = { id: string; url: string; isImportant?: boolean };
type Goal = { id: string; type: string; label?: string };

export default function KeywordsPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<{ status?: string; source?: string; intent?: string }>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [form] = Form.useForm<Keyword>();
  const [importOpen, setImportOpen] = useState(false);
  const [importMin, setImportMin] = useState(50);
  const [importLimit, setImportLimit] = useState(500);

  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.source) qs.set('source', filters.source);
  if (filters.intent) qs.set('intent', filters.intent);
  const filterStr = qs.toString();

  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ['keywords', id, filterStr],
    queryFn: () => api<Keyword[]>(`/projects/${id}/keywords${filterStr ? `?${filterStr}` : ''}`),
  });

  const { data: pages = [] } = useQuery<PageRow[]>({
    queryKey: ['pages-for-keywords', id],
    queryFn: () => api<PageRow[]>(`/projects/${id}/pages?limit=2000`),
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['goals', id],
    queryFn: () => api<Goal[]>(`/projects/${id}/goals`),
  });

  const { data: connections = [] } = useQuery<{ provider: string; status: string }[]>({
    queryKey: ['site-connections', id],
    queryFn: () => api<{ provider: string; status: string }[]>(`/projects/${id}/integrations`),
    retry: false,
  });
  const gscConnected = connections.some((c) => c.provider === 'gsc' && c.status === 'connected');

  const pageOptions = useMemo(
    () => pages.map((p) => ({ value: p.id, label: p.url })),
    [pages],
  );
  const goalOptions = useMemo(
    () => goals.map((g) => ({ value: g.id, label: g.label || g.type })),
    [goals],
  );

  const importGsc = useMutation({
    mutationFn: () =>
      api<{ imported: number; totalCandidates: number }>(
        `/projects/${id}/keywords/import-gsc`,
        {
          method: 'POST',
          body: JSON.stringify({ minImpressions: importMin, limit: importLimit }),
        },
      ),
    onSuccess: (r) => {
      message.success(`Imported ${r.imported} keywords from GSC`);
      setImportOpen(false);
      void qc.invalidateQueries({ queryKey: ['keywords', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const create = useMutation({
    mutationFn: (body: Partial<Keyword>) =>
      api(`/projects/${id}/keywords`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      message.success('Keyword added');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['keywords', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const update = useMutation({
    mutationFn: ({ kwId, body }: { kwId: string; body: Partial<Keyword> }) =>
      api(`/projects/${id}/keywords/${kwId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      message.success('Keyword updated');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['keywords', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (kwId: string) => api(`/projects/${id}/keywords/${kwId}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Keyword removed');
      void qc.invalidateQueries({ queryKey: ['keywords', id] });
    },
  });

  const openCreate = (): void => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      source: 'manual',
      intent: 'unknown',
      funnelStage: 'unknown',
      priority: 'P2',
    } as Keyword);
    setOpen(true);
  };
  const openEdit = (k: Keyword): void => {
    setEditing(k);
    form.setFieldsValue({ ...k } as Keyword);
    setOpen(true);
  };
  const onSubmit = async (): Promise<void> => {
    const values = (await form.validateFields()) as Partial<Keyword>;
    if (editing) update.mutate({ kwId: editing.id, body: values });
    else create.mutate(values);
  };

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={<TermLabel term="keyword">Keywords</TermLabel>}
        subtitle="Track queries, map each to its target page, label intent + funnel stage. Imported from GSC or added manually."
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<Download size={14} />}
              onClick={() => setImportOpen(true)}
              disabled={!gscConnected}
              title={gscConnected ? 'Import GSC queries' : 'Connect GSC on Settings → Integrations first'}
            >
              Import GSC
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              Add keyword
            </Button>
          </div>
        }
      />

      {!gscConnected && (
        <SectionCard className="mb-4">
          <div className="text-xs text-text-muted">
            <span className="text-text font-medium">GSC not connected.</span> Import is disabled
            until you connect Google Search Console from Settings → Integrations. You can still add
            keywords manually.
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
            placeholder="Source"
            allowClear
            value={filters.source}
            onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
            options={SOURCES.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Intent"
            allowClear
            value={filters.intent}
            onChange={(v) => setFilters((f) => ({ ...f, intent: v }))}
            options={INTENTS.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 160 }}
          />
        </div>
      </SectionCard>

      <SectionCard noPadding>
        {!isLoading && keywords.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No keywords yet"
              description={
                gscConnected
                  ? 'Import GSC queries to bootstrap candidates, or add a manual keyword to track.'
                  : 'Connect Google Search Console from Settings → Integrations to import queries, or add keywords manually.'
              }
              action={
                gscConnected ? (
                  <Button type="primary" icon={<Download size={14} />} onClick={() => setImportOpen(true)}>
                    Import from GSC
                  </Button>
                ) : (
                  <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
                    Add keyword manually
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={keywords}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 1500 }}
            columns={[
              {
                title: 'Keyword',
                dataIndex: 'keyword',
                width: 280,
                fixed: 'left',
                render: (k: string) => <span className="font-medium">{k}</span>,
              },
              {
                title: <TermLabel term="search-intent">Intent</TermLabel>,
                dataIndex: 'intent',
                width: 130,
                render: (v: string) => <Tag className="m-0">{v}</Tag>,
              },
              {
                title: <TermLabel term="funnel-stage">Funnel</TermLabel>,
                dataIndex: 'funnelStage',
                width: 100,
                render: (v: string) => <Tag className="m-0">{v}</Tag>,
              },
              { title: 'Source', dataIndex: 'source', width: 90 },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 150,
                render: (s: string) => <StatusPill value={s} kind="state" />,
              },
              {
                title: 'Impressions',
                dataIndex: 'impressions',
                width: 110,
                sorter: (a, b) => a.impressions - b.impressions,
                defaultSortOrder: 'descend',
                render: (v: number) => <span className="tabular-nums">{v.toLocaleString()}</span>,
              },
              {
                title: 'Clicks',
                dataIndex: 'clicks',
                width: 80,
                render: (v: number) => <span className="tabular-nums">{v.toLocaleString()}</span>,
              },
              {
                title: 'CTR',
                dataIndex: 'ctr',
                width: 80,
                render: (v: number) => (
                  <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
                ),
              },
              {
                title: 'Position',
                dataIndex: 'position',
                width: 90,
                render: (v: number) => (
                  <span className="tabular-nums">{v ? v.toFixed(1) : '—'}</span>
                ),
              },
              {
                title: 'Ranking URL',
                dataIndex: 'rankingUrl',
                ellipsis: true,
                render: (u: string | null) =>
                  u ? (
                    <span className="font-mono text-[11px] truncate text-text-muted">{shortUrl(u)}</span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                title: 'Mapped page',
                dataIndex: 'mappedPageId',
                width: 200,
                render: (pid: string | null) => {
                  if (!pid) return <span className="text-text-subtle">—</span>;
                  const p = pages.find((pp) => pp.id === pid);
                  return p ? (
                    <span className="font-mono text-[11px] truncate text-text-muted">
                      {shortUrl(p.url)}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  );
                },
              },
              { title: 'Priority', dataIndex: 'priority', width: 80 },
              {
                title: '',
                width: 90,
                render: (_: unknown, k: Keyword) => (
                  <div className="flex items-center gap-1">
                    <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => openEdit(k)} />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() =>
                        modal.confirm({
                          title: 'Delete keyword?',
                          okType: 'danger',
                          onOk: () => remove.mutate(k.id),
                        })
                      }
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <Modal
        open={importOpen}
        title="Import GSC queries"
        onCancel={() => setImportOpen(false)}
        onOk={() => importGsc.mutate()}
        okText="Import"
        confirmLoading={importGsc.isPending}
        okButtonProps={{ disabled: !gscConnected }}
      >
        <p className="text-sm text-text-muted mb-3">
          Aggregates GSC rows by query and keeps top results above the impression threshold. If the
          highest-impression ranking URL is in your crawl set the keyword is upserted as{' '}
          <span className="font-medium text-text">mapped</span> to that page; otherwise it stays as{' '}
          <span className="font-medium text-text">candidate</span> for analyst review.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Min impressions</label>
            <InputNumber min={0} max={100000} value={importMin} onChange={(v) => setImportMin(v ?? 50)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Limit</label>
            <InputNumber min={1} max={2000} value={importLimit} onChange={(v) => setImportLimit(v ?? 500)} className="w-full" />
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        title={editing ? 'Edit keyword' : 'Add keyword'}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={editing ? 'Save' : 'Create'}
        confirmLoading={create.isPending || update.isPending}
        width={620}
      >
        <Form form={form} layout="vertical" className="mt-3">
          <Form.Item name="keyword" label="Keyword" rules={[{ required: true }]}>
            <Input disabled={!!editing} placeholder="e.g. enterprise SEO audit" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="intent" label="Intent">
              <Select options={INTENTS.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="funnelStage" label="Funnel stage">
              <Select options={FUNNEL.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="status" label="Status">
              <Select options={STATUSES.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="priority" label="Priority">
              <Select options={PRIORITIES.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </div>
          <Form.Item name="mappedPageId" label="Mapped page (target URL on your site)">
            <Select
              showSearch
              allowClear
              options={pageOptions}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="preferredUrl" label="Preferred URL (override / external)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="mappedGoalId" label="Related goal">
            <Select allowClear options={goalOptions} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
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
