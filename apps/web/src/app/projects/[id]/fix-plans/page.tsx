'use client';

import { use, useMemo, useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, RefreshCw, Sparkles, Trash2, XCircle } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { StatusPill } from '../../../../components/StatusPill';
import { TermLabel } from '../../../../components/TermLabel';

const ITEM_STATUSES = [
  'planned',
  'in-progress',
  'fixed',
  'ready-for-validation',
  'validated',
  'failed-validation',
  'deferred',
] as const;
type ItemStatus = (typeof ITEM_STATUSES)[number];

const OWNER_OPTIONS = ['analyst', 'seo', 'content', 'developer', 'client'] as const;
const PRIORITIES = ['P0', 'P1', 'P2'] as const;
const EFFORTS = ['trivial', 'small', 'medium', 'large', 'unknown'] as const;
const IMPACTS = ['high', 'medium', 'low', 'unknown'] as const;
const PLAN_STATUSES = ['draft', 'active', 'completed', 'archived'] as const;

type Item = {
  id: string;
  sourceType: 'recommendation' | 'issue' | 'opportunity' | 'content-brief' | 'manual';
  sourceId: string | null;
  recommendationId: string | null;
  issueId: string | null;
  opportunityId: string | null;
  contentBriefId: string | null;
  pageId: string | null;
  keywordId: string | null;
  title: string;
  description: string;
  ownerType: string;
  assignedToUserId: string | null;
  priority: 'P0' | 'P1' | 'P2';
  impact: string;
  effort: string;
  status: ItemStatus;
  expectedOutcome: string;
  validationMethod: string;
  validationStatus: 'not-started' | 'pending' | 'passed' | 'failed' | 'inconclusive';
  validationEvidence: Record<string, unknown>;
  validationCheckedAt: string | null;
  validationDataSource: string | null;
  targetDate: string | null;
  completedAt: string | null;
  validatedAt: string | null;
  notes: string;
  internalNotes: string;
  clientVisible: boolean;
  addedAt: string | null;
};

type Plan = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  ownerType: string;
  priority: 'P0' | 'P1' | 'P2';
  expectedImpactSummary: string;
  itemCount: number;
  items: Item[];
  createdAt: string;
  updatedAt: string;
};

export default function FixPlansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPeriod, setNewPeriod] = useState<[Dayjs, Dayjs] | null>(null);

  const plansQuery = useQuery<Plan[]>({
    queryKey: ['fix-plans', id],
    queryFn: () => api<Plan[]>(`/projects/${id}/fix-plans`),
  });

  const plans = plansQuery.data ?? [];
  const activePlanIdResolved =
    selectedPlanId ?? plans.find((p) => p.status === 'active')?.id ?? plans[0]?.id ?? null;

  const planQuery = useQuery<Plan>({
    queryKey: ['fix-plan', id, activePlanIdResolved],
    queryFn: () => api<Plan>(`/projects/${id}/fix-plans/${activePlanIdResolved}`),
    enabled: !!activePlanIdResolved,
  });

  const activePlan = planQuery.data ?? null;

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['fix-plans', id] });
    void qc.invalidateQueries({ queryKey: ['fix-plan', id] });
    void qc.invalidateQueries({ queryKey: ['fix-plans-summary', id] });
  };

  const createPlan = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Plan>(`/projects/${id}/fix-plans`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (p) => {
      message.success('Fix plan created');
      setSelectedPlanId(p.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewPeriod(null);
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const generateWeekly = useMutation({
    mutationFn: () =>
      api<Plan>(`/projects/${id}/fix-plans/generate-weekly`, { method: 'POST' }),
    onSuccess: (p) => {
      message.success(`Generated weekly draft with ${p.itemCount} item${p.itemCount === 1 ? '' : 's'}`);
      setSelectedPlanId(p.id);
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const updatePlan = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Plan>(`/projects/${id}/fix-plans/${activePlanIdResolved}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(),
    onError: (err) => message.error((err as Error).message),
  });

  const deletePlan = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; deleted: boolean; archived: boolean }>(
        `/projects/${id}/fix-plans/${activePlanIdResolved}`,
        { method: 'DELETE' },
      ),
    onSuccess: (r) => {
      message.success(r.archived ? 'Plan archived' : 'Plan deleted');
      if (r.deleted) setSelectedPlanId(null);
      invalidate();
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) =>
      api<Plan>(`/projects/${id}/fix-plans/${activePlanIdResolved}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (p, vars) => {
      invalidate();
      const updated = p.items.find((it) => it.id === vars.itemId);
      if (updated) setSelectedItem(updated);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      api(`/projects/${id}/fix-plans/${activePlanIdResolved}/items/${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      message.success('Item removed');
      setSelectedItem(null);
      invalidate();
    },
  });

  const validateItem = useMutation({
    mutationFn: (itemId: string) =>
      api<{ plan: Plan; validation: { status: string; reason: string; dataSource: string } }>(
        `/projects/${id}/fix-plans/${activePlanIdResolved}/items/${itemId}/validate`,
        { method: 'POST' },
      ),
    onSuccess: (r, itemId) => {
      message.success(`Validation: ${r.validation.status} — ${r.validation.reason}`);
      invalidate();
      const updated = r.plan.items.find((it) => it.id === itemId);
      if (updated) setSelectedItem(updated);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const addManual = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Plan>(`/projects/${id}/fix-plans/${activePlanIdResolved}/items/manual`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      message.success('Manual item added');
      setManualOpen(false);
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const filteredItems = useMemo(() => {
    if (!activePlan) return [] as Item[];
    return activePlan.items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (ownerFilter !== 'all' && it.ownerType !== ownerFilter) return false;
      return true;
    });
  }, [activePlan, statusFilter, ownerFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ItemStatus, Item[]>();
    for (const s of ITEM_STATUSES) map.set(s, []);
    for (const it of filteredItems) map.get(it.status)?.push(it);
    return map;
  }, [filteredItems]);

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={<TermLabel term="fix-plan">Fix plans</TermLabel>}
        subtitle="Pull approved work into a weekly plan. Move items through planned → in-progress → fixed → validated against latest evidence."
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<Sparkles size={14} />}
              loading={generateWeekly.isPending}
              onClick={() => generateWeekly.mutate()}
              title="Build a weekly draft from top recommendations + opportunities + briefs + open critical issues."
            >
              Generate weekly plan
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              New plan
            </Button>
          </div>
        }
      />

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-text-subtle">Plan:</span>
          <Select
            style={{ minWidth: 280 }}
            value={activePlanIdResolved ?? undefined}
            placeholder={plans.length === 0 ? 'No plans yet' : 'Select a plan'}
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.title} · ${p.status} · ${p.itemCount} items`,
            }))}
            onChange={(v) => setSelectedPlanId(v)}
            disabled={plans.length === 0}
          />
          {activePlan && (
            <>
              <Select
                value={activePlan.status}
                options={PLAN_STATUSES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => updatePlan.mutate({ status: v })}
                style={{ minWidth: 130 }}
              />
              <span className="text-text-subtle">·</span>
              <Button
                size="small"
                icon={<Trash2 size={12} />}
                danger
                onClick={() => {
                  const isEmptyDraft =
                    activePlan.status === 'draft' && activePlan.itemCount === 0;
                  modal.confirm({
                    title: isEmptyDraft ? 'Delete this empty draft?' : 'Archive this plan?',
                    content: isEmptyDraft
                      ? 'No items will be lost (the plan has none).'
                      : 'Non-empty / non-draft plans are archived instead of deleted so the execution history is preserved. The underlying recommendations / issues / opportunities / briefs are not affected.',
                    okType: 'danger',
                    okText: isEmptyDraft ? 'Delete' : 'Archive',
                    onOk: () => deletePlan.mutate(),
                  });
                }}
              >
                {activePlan.status === 'draft' && activePlan.itemCount === 0
                  ? 'Delete'
                  : 'Archive'}
              </Button>
            </>
          )}
        </div>
      </SectionCard>

      {!activePlan ? (
        <SectionCard>
          <EmptyState
            title="No active plan yet"
            description="Generate a weekly plan from your top recommendations, opportunities, briefs, and critical issues, or create one manually."
            action={
              <div className="flex items-center gap-2 justify-center">
                <Button
                  type="primary"
                  icon={<Sparkles size={14} />}
                  loading={generateWeekly.isPending}
                  onClick={() => generateWeekly.mutate()}
                >
                  Generate weekly plan
                </Button>
                <Button icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                  Create empty plan
                </Button>
              </div>
            }
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard className="mb-4">
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[240px] flex-1">
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Title
                </div>
                <Input
                  value={activePlan.title}
                  onChange={(e) => updatePlan.mutate({ title: e.target.value })}
                />
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mt-3 mb-1">
                  Description
                </div>
                <Input.TextArea
                  rows={3}
                  value={activePlan.description}
                  onChange={(e) => updatePlan.mutate({ description: e.target.value })}
                />
              </div>
              <div className="min-w-[240px]">
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Period
                </div>
                <DatePicker.RangePicker
                  value={
                    activePlan.periodStart && activePlan.periodEnd
                      ? [dayjs(activePlan.periodStart), dayjs(activePlan.periodEnd)]
                      : null
                  }
                  onChange={(range) => {
                    if (!range) return;
                    updatePlan.mutate({
                      periodStart: range[0]?.toISOString(),
                      periodEnd: range[1]?.toISOString(),
                    });
                  }}
                />
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mt-3 mb-1">
                  Owner
                </div>
                <Select
                  value={activePlan.ownerType}
                  options={OWNER_OPTIONS.map((o) => ({ value: o, label: o }))}
                  onChange={(v) => updatePlan.mutate({ ownerType: v })}
                  style={{ minWidth: 140 }}
                />
                <span className="ml-3" />
                <Select
                  value={activePlan.priority}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  onChange={(v) => updatePlan.mutate({ priority: v })}
                  style={{ minWidth: 90 }}
                />
              </div>
              <div className="min-w-[200px]">
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Counts
                </div>
                <div className="text-xs space-y-0.5">
                  {ITEM_STATUSES.map((s) => (
                    <div key={s} className="flex items-center justify-between gap-3">
                      <StatusPill value={s} kind="state" />
                      <span className="tabular-nums text-text-muted">
                        {grouped.get(s)?.length ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...ITEM_STATUSES.map((s) => ({ value: s, label: s })),
                ]}
                style={{ minWidth: 180 }}
              />
              <Select
                value={ownerFilter}
                onChange={(v) => setOwnerFilter(v)}
                options={[
                  { value: 'all', label: 'All owners' },
                  ...OWNER_OPTIONS.map((s) => ({ value: s, label: s })),
                ]}
                style={{ minWidth: 160 }}
              />
              <span className="flex-1" />
              <Button icon={<Plus size={14} />} onClick={() => setManualOpen(true)}>
                Add manual item
              </Button>
            </div>
          </SectionCard>

          <SectionCard noPadding>
            <Table
              rowKey="id"
              size="small"
              dataSource={filteredItems}
              pagination={false}
              onRow={(row) => ({ onClick: () => setSelectedItem(row), style: { cursor: 'pointer' } })}
              columns={[
                {
                  title: 'Title',
                  dataIndex: 'title',
                  ellipsis: true,
                  render: (t: string, r: Item) => (
                    <div>
                      <div className="text-text">{t}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-subtle">
                        {r.sourceType}
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  width: 180,
                  render: (s: string) => <StatusPill value={s} kind="state" />,
                },
                {
                  title: 'Owner',
                  dataIndex: 'ownerType',
                  width: 110,
                  render: (v: string, r: Item) => (
                    <Select
                      size="small"
                      variant="borderless"
                      value={v}
                      options={OWNER_OPTIONS.map((o) => ({ value: o, label: o }))}
                      onChange={(nv) =>
                        updateItem.mutate({ itemId: r.id, body: { ownerType: nv } })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{ minWidth: 100 }}
                    />
                  ),
                },
                {
                  title: 'Priority',
                  dataIndex: 'priority',
                  width: 90,
                  render: (v: string, r: Item) => (
                    <Select
                      size="small"
                      variant="borderless"
                      value={v}
                      options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                      onChange={(nv) =>
                        updateItem.mutate({ itemId: r.id, body: { priority: nv } })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  ),
                },
                {
                  title: 'Effort',
                  dataIndex: 'effort',
                  width: 100,
                  render: (v: string) => <Tag className="m-0">{v}</Tag>,
                },
                {
                  title: <TermLabel term="validation-method">Validation</TermLabel>,
                  dataIndex: 'validationStatus',
                  width: 150,
                  render: (v: string) => <StatusPill value={v} kind="state" />,
                },
                {
                  title: 'Target date',
                  dataIndex: 'targetDate',
                  width: 130,
                  render: (v: string | null) =>
                    v ? <span className="text-xs">{dayjs(v).format('YYYY-MM-DD')}</span> : <span className="text-text-subtle">—</span>,
                },
                {
                  title: 'Client visible',
                  dataIndex: 'clientVisible',
                  width: 110,
                  render: (v: boolean) =>
                    v ? <Tag color="green">visible</Tag> : <Tag>internal</Tag>,
                },
                {
                  title: '',
                  width: 130,
                  render: (_: unknown, r: Item) => (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Run validation against latest evidence">
                        <Button
                          size="small"
                          icon={<CheckCircle2 size={12} />}
                          loading={validateItem.isPending && validateItem.variables === r.id}
                          onClick={() => validateItem.mutate(r.id)}
                        >
                          Validate
                        </Button>
                      </Tooltip>
                    </div>
                  ),
                },
              ]}
            />
            {filteredItems.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No items match"
                  description="Adjust filters above, generate a weekly plan, or add items from Recommendations / Issues / Opportunities / Briefs."
                />
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* Item drawer */}
      <Drawer
        title={selectedItem?.title}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        width={640}
      >
        {selectedItem && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="m-0">{selectedItem.sourceType}</Tag>
              <StatusPill value={selectedItem.status} kind="state" />
              <StatusPill value={selectedItem.validationStatus} kind="state" />
              <span className="text-xs text-text-muted">
                {selectedItem.priority} · {selectedItem.impact} impact · {selectedItem.effort} effort
              </span>
            </div>

            {/* Source link */}
            <SourceLinks projectId={id} item={selectedItem} />

            <Field title="Description">
              <Input.TextArea
                rows={2}
                value={selectedItem.description}
                onChange={(e) =>
                  updateItem.mutate({ itemId: selectedItem.id, body: { description: e.target.value } })
                }
              />
            </Field>

            <Field title="Expected outcome">
              <Input.TextArea
                rows={2}
                value={selectedItem.expectedOutcome}
                onChange={(e) =>
                  updateItem.mutate({
                    itemId: selectedItem.id,
                    body: { expectedOutcome: e.target.value },
                  })
                }
              />
            </Field>

            <Field title={<TermLabel term="validation-method">Validation method</TermLabel>}>
              <Input.TextArea
                rows={2}
                value={selectedItem.validationMethod}
                onChange={(e) =>
                  updateItem.mutate({
                    itemId: selectedItem.id,
                    body: { validationMethod: e.target.value },
                  })
                }
              />
            </Field>

            {/* Validation evidence */}
            <Field title="Validation evidence">
              <div className="rounded border border-border bg-surface-2 p-3 text-xs space-y-1">
                <div className="flex flex-wrap gap-3">
                  <span>
                    <span className="text-text-subtle">Status:</span>{' '}
                    <StatusPill value={selectedItem.validationStatus} kind="state" />
                  </span>
                  <span>
                    <span className="text-text-subtle">Source:</span>{' '}
                    <span className="text-text">
                      {selectedItem.validationDataSource ?? '—'}
                    </span>
                  </span>
                  <span>
                    <span className="text-text-subtle">Checked:</span>{' '}
                    <span className="text-text">
                      {selectedItem.validationCheckedAt
                        ? dayjs(selectedItem.validationCheckedAt).format('YYYY-MM-DD HH:mm')
                        : '—'}
                    </span>
                  </span>
                </div>
                {(() => {
                  const ev = selectedItem.validationEvidence as { reason?: string };
                  return ev?.reason ? <div className="text-text">{ev.reason}</div> : null;
                })()}
                {Object.keys(selectedItem.validationEvidence ?? {}).length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-text-subtle">Raw evidence</summary>
                    <pre className="text-[10px] overflow-x-auto m-0 mt-1">
                      {JSON.stringify(selectedItem.validationEvidence, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="pt-1">
                  <Button
                    size="small"
                    icon={<RefreshCw size={12} />}
                    loading={
                      validateItem.isPending && validateItem.variables === selectedItem.id
                    }
                    onClick={() => validateItem.mutate(selectedItem.id)}
                  >
                    Run validation now
                  </Button>
                </div>
              </div>
            </Field>

            {/* Lifecycle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Status
                </div>
                <Select
                  value={selectedItem.status}
                  options={ITEM_STATUSES.map((s) => ({ value: s, label: s }))}
                  className="w-full"
                  onChange={(v) =>
                    updateItem.mutate({ itemId: selectedItem.id, body: { status: v } })
                  }
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Owner
                </div>
                <Select
                  value={selectedItem.ownerType}
                  options={OWNER_OPTIONS.map((o) => ({ value: o, label: o }))}
                  className="w-full"
                  onChange={(v) =>
                    updateItem.mutate({ itemId: selectedItem.id, body: { ownerType: v } })
                  }
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Priority
                </div>
                <Select
                  value={selectedItem.priority}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  className="w-full"
                  onChange={(v) =>
                    updateItem.mutate({ itemId: selectedItem.id, body: { priority: v } })
                  }
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Effort
                </div>
                <Select
                  value={selectedItem.effort}
                  options={EFFORTS.map((p) => ({ value: p, label: p }))}
                  className="w-full"
                  onChange={(v) =>
                    updateItem.mutate({ itemId: selectedItem.id, body: { effort: v } })
                  }
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Impact
                </div>
                <Select
                  value={selectedItem.impact}
                  options={IMPACTS.map((p) => ({ value: p, label: p }))}
                  className="w-full"
                  onChange={(v) =>
                    updateItem.mutate({ itemId: selectedItem.id, body: { impact: v } })
                  }
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Target date
                </div>
                <DatePicker
                  value={selectedItem.targetDate ? dayjs(selectedItem.targetDate) : null}
                  onChange={(v) =>
                    updateItem.mutate({
                      itemId: selectedItem.id,
                      body: { targetDate: v ? v.toISOString() : null },
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            <Field title="Notes (shared with client when item is client-visible)">
              <Input.TextArea
                rows={3}
                value={selectedItem.notes}
                onChange={(e) =>
                  updateItem.mutate({ itemId: selectedItem.id, body: { notes: e.target.value } })
                }
              />
            </Field>

            <Field title="Internal notes (never shown to client)">
              <Input.TextArea
                rows={3}
                value={selectedItem.internalNotes}
                onChange={(e) =>
                  updateItem.mutate({
                    itemId: selectedItem.id,
                    body: { internalNotes: e.target.value },
                  })
                }
              />
            </Field>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={selectedItem.clientVisible}
                  onChange={(e) =>
                    updateItem.mutate({
                      itemId: selectedItem.id,
                      body: { clientVisible: e.target.checked },
                    })
                  }
                />
                Visible in client report
              </label>
              <Button
                danger
                size="small"
                icon={<XCircle size={14} />}
                onClick={() =>
                  modal.confirm({
                    title: 'Remove this item?',
                    okType: 'danger',
                    onOk: () => removeItem.mutate(selectedItem.id),
                  })
                }
              >
                Remove from plan
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create plan modal */}
      <Modal
        open={createOpen}
        title="Create fix plan"
        onCancel={() => setCreateOpen(false)}
        onOk={() =>
          createPlan.mutate({
            title: newTitle.trim() || `Plan — ${dayjs().format('YYYY-MM-DD')}`,
            periodStart: newPeriod?.[0]?.toISOString(),
            periodEnd: newPeriod?.[1]?.toISOString(),
            status: 'draft',
          })
        }
        confirmLoading={createPlan.isPending}
      >
        <div className="space-y-3 mt-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">Title</div>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`Plan — ${dayjs().format('YYYY-MM-DD')}`}
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">Period</div>
            <DatePicker.RangePicker
              value={newPeriod}
              onChange={(r) => setNewPeriod(r as [Dayjs, Dayjs] | null)}
            />
          </div>
        </div>
      </Modal>

      {/* Manual item modal */}
      <ManualItemModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={(body) => addManual.mutate(body)}
        submitting={addManual.isPending}
      />
    </>
  );
}

function Field({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">{title}</div>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}

function SourceLinks({ projectId, item }: { projectId: string; item: Item }): JSX.Element | null {
  const links: Array<{ label: string; href: string }> = [];
  if (item.sourceType === 'issue' && item.issueId) {
    links.push({ label: 'Open source issue', href: `/projects/${projectId}/issues?id=${item.issueId}` });
  }
  if (item.sourceType === 'opportunity' && item.opportunityId) {
    links.push({
      label: 'Open source opportunity',
      href: `/projects/${projectId}/opportunities`,
    });
  }
  if (item.sourceType === 'content-brief' && item.contentBriefId) {
    links.push({
      label: 'Open content brief',
      href: `/projects/${projectId}/content-briefs/${item.contentBriefId}`,
    });
  }
  if (item.recommendationId) {
    links.push({
      label: 'Open recommendation issue',
      href: `/projects/${projectId}/issues${item.issueId ? `?id=${item.issueId}` : ''}`,
    });
  }
  if (item.pageId) {
    links.push({ label: 'Open page workspace', href: `/projects/${projectId}/pages/${item.pageId}` });
  }
  if (links.length === 0) return null;
  return (
    <div className="rounded border border-border bg-surface-2 p-2 flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-text-subtle">Sources</span>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="text-xs text-accent-hover hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {l.label} →
        </a>
      ))}
    </div>
  );
}

function ManualItemModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  submitting: boolean;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerType, setOwnerType] = useState<string>('analyst');
  const [priority, setPriority] = useState<string>('P2');
  const [effort, setEffort] = useState<string>('unknown');
  const [validationMethod, setValidationMethod] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  return (
    <Modal
      open={open}
      title="Add manual item"
      onCancel={onClose}
      okText="Add"
      onOk={() =>
        onSubmit({
          title,
          description,
          ownerType,
          priority,
          effort,
          validationMethod,
          clientVisible,
        })
      }
      okButtonProps={{ disabled: !title.trim(), loading: submitting }}
    >
      <div className="space-y-3 mt-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title" />
        <Input.TextArea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to happen?"
        />
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={ownerType}
            options={OWNER_OPTIONS.map((o) => ({ value: o, label: o }))}
            onChange={(v) => setOwnerType(v)}
          />
          <Select
            value={priority}
            options={PRIORITIES.map((o) => ({ value: o, label: o }))}
            onChange={(v) => setPriority(v)}
          />
          <Select
            value={effort}
            options={EFFORTS.map((o) => ({ value: o, label: o }))}
            onChange={(v) => setEffort(v)}
          />
        </div>
        <Input.TextArea
          rows={2}
          value={validationMethod}
          onChange={(e) => setValidationMethod(e.target.value)}
          placeholder="How will we know this is fixed?"
        />
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={clientVisible}
            onChange={(e) => setClientVisible(e.target.checked)}
          />
          Visible in client report
        </label>
      </div>
    </Modal>
  );
}
