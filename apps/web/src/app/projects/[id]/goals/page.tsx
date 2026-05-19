'use client';

import { use, useMemo, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { TermLabel } from '../../../../components/TermLabel';
import { StatusPill } from '../../../../components/StatusPill';

const GOAL_TYPES = [
  'generate-leads',
  'consultation-calls',
  'quote-requests',
  'ecommerce-sales',
  'donations',
  'volunteers',
  'course-applications',
  'bookings',
  'demo-requests',
  'trial-signups',
  'subscriptions',
  'documentation-adoption',
  'organic-traffic',
  'local-visibility',
  'ai-geo-visibility',
  'brand-visibility',
  'custom',
];
const PRIORITIES = ['primary', 'secondary', 'tertiary'];
const STATUSES = ['active', 'achieved', 'paused', 'archived'];

type Goal = {
  id: string;
  type: string;
  label?: string;
  priority: 'primary' | 'secondary' | 'tertiary';
  status: 'active' | 'achieved' | 'paused' | 'archived';
  conversionAction?: string;
  relatedPageIds: string[];
  relatedPagePatterns: string[];
  audience?: string;
  geography: string[];
  kpi?: string;
  baseline?: number;
  target?: number;
  deadline?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PageRow = { id: string; url: string; role?: string | null; isImportant?: boolean };

export default function GoalsPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form] = Form.useForm<Goal>();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals', id],
    queryFn: () => api<Goal[]>(`/projects/${id}/goals`),
  });

  const { data: pages = [] } = useQuery<PageRow[]>({
    queryKey: ['pages-for-goals', id],
    queryFn: () => api<PageRow[]>(`/projects/${id}/pages?limit=2000`),
  });

  const pageOptions = useMemo(
    () =>
      pages.map((p) => ({
        value: p.id,
        label: `${p.url}${p.isImportant ? ' ★' : ''}`,
      })),
    [pages],
  );

  // After any goal change opportunity weighting is stale. Regenerate in the background so the
  // Opportunities page reflects new goalLabel mappings without manual re-run.
  const regenOpps = async (): Promise<void> => {
    try {
      await api(`/projects/${id}/opportunities/regenerate`, { method: 'POST' });
      void qc.invalidateQueries({ queryKey: ['opportunities', id] });
      void qc.invalidateQueries({ queryKey: ['opp-coverage', id] });
    } catch {
      // Best-effort. Surface a soft warning but don't fail the goal mutation.
      message.warning('Goal saved, but opportunity regen failed. Re-run from the Opportunities tab.');
    }
  };

  const create = useMutation({
    mutationFn: (body: Partial<Goal>) =>
      api(`/projects/${id}/goals`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      message.success('Goal added — refreshing opportunity weighting');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['goals', id] });
      await regenOpps();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const update = useMutation({
    mutationFn: ({ goalId, body }: { goalId: string; body: Partial<Goal> }) =>
      api(`/projects/${id}/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      message.success('Goal updated — refreshing opportunity weighting');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['goals', id] });
      await regenOpps();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (goalId: string) => api(`/projects/${id}/goals/${goalId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      message.success('Goal deleted — refreshing opportunity weighting');
      void qc.invalidateQueries({ queryKey: ['goals', id] });
      await regenOpps();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const openCreate = (): void => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'secondary', status: 'active', type: 'generate-leads' } as Goal);
    setOpen(true);
  };
  const openEdit = (g: Goal): void => {
    setEditing(g);
    form.setFieldsValue({
      ...g,
      deadline: g.deadline ? g.deadline.slice(0, 10) : undefined,
    } as unknown as Goal);
    setOpen(true);
  };

  const onSubmit = async (): Promise<void> => {
    const values = await form.validateFields();
    const body: Partial<Goal> = {
      ...values,
      deadline: values.deadline ? new Date(values.deadline as unknown as string).toISOString() : undefined,
      relatedPageIds: values.relatedPageIds ?? [],
      relatedPagePatterns: values.relatedPagePatterns ?? [],
      geography: values.geography ?? [],
    };
    if (editing) update.mutate({ goalId: editing.id, body });
    else create.mutate(body);
  };

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={<TermLabel term="goal">Goals</TermLabel>}
        subtitle="Define what success looks like for this site. Goals weight audit rules and opportunity scoring."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add goal
          </Button>
        }
      />

      <SectionCard noPadding>
        {!isLoading && goals.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No goals yet"
              description="Add at least one goal so the audit can weight findings by business priority. Lead-gen, ecommerce, donations, applications, awareness — any outcome works."
              action={
                <Button type="primary" onClick={openCreate} icon={<Plus size={14} />}>
                  Add your first goal
                </Button>
              }
            />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={goals}
            pagination={false}
            columns={[
              {
                title: 'Type',
                dataIndex: 'type',
                width: 200,
                render: (t: string, g: Goal) => (
                  <span className="font-medium">{g.label || t}</span>
                ),
              },
              {
                title: 'Priority',
                dataIndex: 'priority',
                width: 110,
                render: (p: string) => <Tag className="m-0">{p}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 110,
                render: (s: string) => <StatusPill value={s} kind="state" />,
              },
              { title: 'KPI', dataIndex: 'kpi', ellipsis: true },
              {
                title: 'Target',
                dataIndex: 'target',
                width: 100,
                render: (v: number | undefined) =>
                  v != null ? <span className="tabular-nums">{v}</span> : <span className="text-text-subtle">—</span>,
              },
              {
                title: 'Pages',
                dataIndex: 'relatedPageIds',
                width: 80,
                render: (ids: string[] | undefined, g: Goal) => (
                  <span className="text-xs text-text-muted">
                    {(ids?.length ?? 0) + (g.relatedPagePatterns?.length ?? 0)}
                  </span>
                ),
              },
              {
                title: 'Deadline',
                dataIndex: 'deadline',
                width: 130,
                render: (v: string | undefined) =>
                  v ? (
                    <span className="text-xs tabular-nums">{new Date(v).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                title: '',
                width: 90,
                render: (_: unknown, g: Goal) => (
                  <div className="flex items-center gap-1">
                    <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => openEdit(g)} />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() =>
                        modal.confirm({
                          title: 'Delete goal?',
                          content: 'This removes the goal and its page mapping. Opportunity weighting will recompute on next regen.',
                          okType: 'danger',
                          onOk: () => remove.mutate(g.id),
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
        open={open}
        title={editing ? 'Edit goal' : 'Add goal'}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={editing ? 'Save' : 'Create'}
        confirmLoading={create.isPending || update.isPending}
        width={680}
      >
        <Form form={form} layout="vertical" className="mt-3">
          <Form.Item name="type" label="Goal type" rules={[{ required: true }]}>
            <Select options={GOAL_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="label" label="Label (optional, shown in UI)">
            <Input placeholder="e.g. Donations campaign Spring 2026" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
              <Select options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={STATUSES.map((p) => ({ value: p, label: p }))} />
            </Form.Item>
          </div>
          <Form.Item name="conversionAction" label="Conversion action (form name, GA4 event, etc.)">
            <Input placeholder="e.g. submit_lead_form, purchase, donate_complete" />
          </Form.Item>
          <Form.Item name="relatedPageIds" label="Related pages">
            <Select
              mode="multiple"
              options={pageOptions}
              placeholder="Select pages this goal applies to"
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
            />
          </Form.Item>
          <Form.Item
            name="relatedPagePatterns"
            label="URL patterns (regex; one per tag)"
            tooltip="e.g. /pricing, ^/products/, /contact"
          >
            <Select mode="tags" placeholder="Add regex patterns" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="audience" label="Audience">
              <Input placeholder="e.g. SMB owners in US/UK" />
            </Form.Item>
            <Form.Item name="geography" label="Geography (city/region/country)">
              <Select mode="tags" placeholder="Add geos" />
            </Form.Item>
          </div>
          <Form.Item name="kpi" label="KPI">
            <Input placeholder="e.g. Monthly form fills, Donations $, GA4 event count" />
          </Form.Item>
          <div className="grid grid-cols-3 gap-3">
            <Form.Item name="baseline" label="Baseline">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="target" label="Target">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="deadline" label="Deadline">
              <Input type="date" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
