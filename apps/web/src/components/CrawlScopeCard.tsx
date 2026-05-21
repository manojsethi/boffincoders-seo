'use client';

import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { StatusPill } from './StatusPill';
import { api } from '../lib/api';

/**
 * Crawl scope rules + AI suggestions + pre-crawl estimate. Phase 11.
 *
 * Mounted on `/projects/:id/settings/crawl`. The flow:
 *  1. Rule table — approve/edit/reject/disable, view matched URLs.
 *  2. "Suggest with AI" button — runs the AI task. Results land as `suggested` rules; analyst
 *     decides what to approve.
 *  3. Pre-crawl estimate — runs discovery without persisting and shows the breakdown.
 */

type Behavior = 'crawl' | 'sample' | 'exclude' | 'force_include' | 'normalize';
type PatternType = 'glob' | 'prefix' | 'regex';
type RuleStatus = 'suggested' | 'approved' | 'rejected' | 'disabled';

type Rule = {
  id: string;
  name: string;
  pattern: string;
  patternType: PatternType;
  behavior: Behavior;
  sampleLimit: number;
  priority: number;
  groupName: string;
  pageFamily: string;
  reason: string;
  source: 'system' | 'heuristic' | 'ai' | 'analyst';
  confidence: number;
  status: RuleStatus;
  normalizeStripParams: string[];
  suggestionWarning?: string;
};

type Estimate = {
  totals: {
    discovered: number;
    selected: number;
    sampled: number;
    excluded: number;
    forceIncluded: number;
    normalizedDuplicates: number;
    blockedByRobots: number;
  };
  groups: Array<{
    name: string;
    pattern: string;
    pageFamily: string;
    behavior: Behavior;
    discovered: number;
    selected: number;
    excluded: number;
    sampleLimit: number;
    examples: string[];
    confidence: number;
    source: string;
  }>;
  warnings: Array<{ severity: 'low' | 'medium' | 'high'; message: string }>;
  sampleCandidates: Array<{
    url: string;
    normalizedUrl: string;
    decision: string;
    matchedRuleName: string;
    groupName: string;
    reason: string;
    sampleReason: string;
  }>;
};

type ScopeSettings = {
  enabled: boolean;
  defaultBehavior: 'crawl' | 'sample';
  maxSamplePerGroup: number;
  aiSuggestionsEnabled: boolean;
  requireApprovalForAiRules: boolean;
};

const BEHAVIOR_OPTIONS: Array<{ value: Behavior; label: string }> = [
  { value: 'crawl', label: 'Crawl all' },
  { value: 'sample', label: 'Sample N' },
  { value: 'exclude', label: 'Exclude' },
  { value: 'force_include', label: 'Force include' },
  { value: 'normalize', label: 'Normalize' },
];

export function CrawlScopeCard({ projectId }: { projectId: string }): JSX.Element {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [matchedDrawer, setMatchedDrawer] = useState<{ rule: Rule; urls: string[] } | null>(null);

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ['scope-rules', projectId],
    queryFn: () => api<Rule[]>(`/projects/${projectId}/crawl-scope/rules`),
  });

  const { data: project } = useQuery<{ crawlScopeSettings?: ScopeSettings }>({
    queryKey: ['project', projectId],
    queryFn: () => api(`/projects/${projectId}`),
  });
  const scopeSettings = project?.crawlScopeSettings ?? {
    enabled: true,
    defaultBehavior: 'crawl' as const,
    maxSamplePerGroup: 5,
    aiSuggestionsEnabled: true,
    requireApprovalForAiRules: true,
  };

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['scope-rules', projectId] });
  };

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Rule> }) =>
      api<Rule>(`/projects/${projectId}/crawl-scope/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(),
    onError: (err) => message.error((err as Error).message),
  });

  const create = useMutation({
    mutationFn: (body: Partial<Rule>) =>
      api<Rule>(`/projects/${projectId}/crawl-scope/rules`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      message.success('Rule created');
      setCreating(false);
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/projects/${projectId}/crawl-scope/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Rule deleted');
      invalidate();
    },
  });

  const aiSuggest = useMutation({
    mutationFn: () =>
      api<{ suggestions: Rule[]; warnings: Array<{ message: string; severity: string }> }>(
        `/projects/${projectId}/crawl-scope/ai-suggest`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
    onSuccess: (r) => {
      const count = r.suggestions.length;
      message.success(
        `${count} AI suggestion${count === 1 ? '' : 's'} added — review below before approving.`,
      );
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const runEstimate = useMutation({
    mutationFn: () =>
      api<Estimate>(`/projects/${projectId}/crawl-scope/estimate`, {
        method: 'POST',
        body: JSON.stringify({ maxPages: 500 }),
      }),
    onSuccess: (r) => setEstimate(r),
    onError: (err) => message.error((err as Error).message),
  });

  const updateSettings = useMutation({
    mutationFn: (body: Partial<ScopeSettings>) =>
      api(`/projects/${projectId}/crawl-scope/settings`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const testPattern = useMutation({
    mutationFn: ({ pattern, patternType }: { pattern: string; patternType: PatternType }) =>
      api<{ totalChecked: number; matchCount: number; examples: string[] }>(
        `/projects/${projectId}/crawl-scope/test-pattern`,
        { method: 'POST', body: JSON.stringify({ pattern, patternType }) },
      ),
  });

  const visibleRules = useMemo(
    () => (statusFilter === 'all' ? rules : rules.filter((r) => r.status === statusFilter)),
    [rules, statusFilter],
  );

  const counts = useMemo(() => {
    const c = { approved: 0, suggested: 0, rejected: 0, disabled: 0 };
    for (const r of rules) c[r.status] += 1;
    return c;
  }, [rules]);

  return (
    <>
      <SectionCard
        title="Crawl scope"
        description="Pattern rules that decide which URLs get crawled fully, sampled, excluded, or force-included. Approved rules apply on the next crawl."
        className="mb-4"
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<Sparkles size={14} />}
              loading={aiSuggest.isPending}
              disabled={scopeSettings.aiSuggestionsEnabled === false}
              onClick={() => aiSuggest.mutate()}
            >
              Suggest with AI
            </Button>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setCreating(true)}
            >
              New rule
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          <span className="text-text-subtle">Status:</span>
          {(['all', 'approved', 'suggested', 'rejected', 'disabled'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded ${
                statusFilter === s
                  ? 'bg-accent-soft text-text'
                  : 'text-text-muted hover:bg-surface-hover'
              }`}
            >
              {s} {s === 'all' ? `(${rules.length})` : `(${counts[s as keyof typeof counts]})`}
            </button>
          ))}
          <span className="flex-1" />
          <span className="text-text-subtle">Default:</span>
          <Select
            size="small"
            value={scopeSettings.defaultBehavior}
            options={[
              { value: 'crawl', label: 'Crawl unmatched URLs' },
              { value: 'sample', label: 'Sample unmatched URLs' },
            ]}
            onChange={(v) => updateSettings.mutate({ defaultBehavior: v })}
          />
          <label className="flex items-center gap-1.5 text-text-muted">
            <Switch
              size="small"
              checked={scopeSettings.enabled}
              onChange={(v) => updateSettings.mutate({ enabled: v })}
            />
            Scope enabled
          </label>
          <label className="flex items-center gap-1.5 text-text-muted">
            <Switch
              size="small"
              checked={scopeSettings.aiSuggestionsEnabled}
              onChange={(v) => updateSettings.mutate({ aiSuggestionsEnabled: v })}
            />
            AI suggestions
          </label>
        </div>
        {!scopeSettings.enabled ? (
          <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle size={12} className="inline mr-1" />
            Scope is <strong>disabled</strong>. Crawls fall back to seed + sitemap only —
            approved rules, sampling, and live link filtering are bypassed.
          </div>
        ) : null}

        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={visibleRules}
          pagination={{ pageSize: 30, showSizeChanger: false }}
          columns={[
            {
              title: 'Status',
              dataIndex: 'status',
              width: 110,
              render: (s: RuleStatus) => <StatusPill value={s} kind="state" />,
            },
            {
              title: 'Group',
              dataIndex: 'groupName',
              width: 180,
              render: (g: string, r: Rule) => (
                <div>
                  <div className="text-text">{g || r.name}</div>
                  <div className="text-[10px] text-text-subtle">{r.pageFamily || '—'}</div>
                </div>
              ),
            },
            {
              title: 'Pattern',
              dataIndex: 'pattern',
              render: (p: string, r: Rule) => (
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[12px] text-text-muted">{p}</code>
                  <Tag className="m-0 text-[10px]">{r.patternType}</Tag>
                </div>
              ),
            },
            {
              title: 'Behavior',
              dataIndex: 'behavior',
              width: 130,
              render: (b: Behavior, r: Rule) => (
                <span className="flex items-center gap-1">
                  <Tag className="m-0">{b.replace('_', ' ')}</Tag>
                  {b === 'sample' ? (
                    <span className="text-text-subtle text-xs">{r.sampleLimit}</span>
                  ) : null}
                </span>
              ),
            },
            {
              title: 'Priority',
              dataIndex: 'priority',
              width: 80,
              sorter: (a, b) => a.priority - b.priority,
              render: (p: number) => <span className="tabular-nums text-xs">{p}</span>,
            },
            {
              title: 'Source',
              dataIndex: 'source',
              width: 100,
              render: (s: string, r: Rule) => (
                <span className="text-xs">
                  <Tag className="m-0">{s}</Tag>
                  <span className="text-text-subtle ml-1 tabular-nums">
                    {Math.round((r.confidence ?? 0) * 100)}%
                  </span>
                </span>
              ),
            },
            {
              title: 'Actions',
              width: 200,
              render: (_: unknown, r: Rule) => (
                <div className="flex items-center gap-1">
                  {r.status === 'suggested' ? (
                    <>
                      <Button
                        size="small"
                        icon={<Check size={12} />}
                        onClick={() =>
                          update.mutate({ id: r.id, body: { status: 'approved' } })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<X size={12} />}
                        onClick={() =>
                          update.mutate({ id: r.id, body: { status: 'rejected' } })
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="small"
                        icon={<Pencil size={12} />}
                        onClick={() => setEditing(r)}
                      />
                      <Button
                        size="small"
                        onClick={() =>
                          update.mutate({
                            id: r.id,
                            body: { status: r.status === 'disabled' ? 'approved' : 'disabled' },
                          })
                        }
                      >
                        {r.status === 'disabled' ? 'Enable' : 'Disable'}
                      </Button>
                    </>
                  )}
                  <Tooltip title="Test pattern against the latest crawl candidates">
                    <Button
                      size="small"
                      onClick={async () => {
                        const r1 = await testPattern.mutateAsync({
                          pattern: r.pattern,
                          patternType: r.patternType,
                        });
                        setMatchedDrawer({
                          rule: r,
                          urls: r1.examples,
                        });
                        if (r1.totalChecked === 0) {
                          message.info(
                            'No prior crawl candidates to test against. Run a discovery / crawl first.',
                          );
                        }
                      }}
                    >
                      View matched
                    </Button>
                  </Tooltip>
                  {r.source === 'analyst' || r.source === 'ai' ? (
                    <Popconfirm
                      title="Delete rule?"
                      onConfirm={() => remove.mutate(r.id)}
                      okType="danger"
                    >
                      <Button size="small" danger icon={<Trash2 size={12} />} />
                    </Popconfirm>
                  ) : null}
                </div>
              ),
            },
          ]}
          expandable={{
            expandedRowRender: (r) => (
              <div className="text-xs space-y-1 text-text-muted">
                <div>
                  <span className="text-text-subtle">Reason:</span> {r.reason || '—'}
                </div>
                {r.suggestionWarning ? (
                  <div className="text-amber-300">
                    <AlertTriangle size={11} className="inline mr-1" />
                    {r.suggestionWarning}
                  </div>
                ) : null}
              </div>
            ),
          }}
        />
      </SectionCard>

      {/* Pre-crawl estimate */}
      <SectionCard
        title="Pre-crawl estimate"
        description="Run discovery + apply rules without crawling — see what would actually be fetched."
        className="mb-4"
        actions={
          <Button loading={runEstimate.isPending} onClick={() => runEstimate.mutate()}>
            Run estimate
          </Button>
        }
      >
        {!estimate ? (
          <div className="text-xs text-text-subtle">
            Click "Run estimate" to discover candidates from sitemap + homepage + GSC, apply
            approved rules, and see the breakdown.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
              <Stat label="Discovered" value={estimate.totals.discovered} tone="info" />
              <Stat label="Selected" value={estimate.totals.selected} tone="success" />
              <Stat label="Sampled" value={estimate.totals.sampled} tone="info" />
              <Stat label="Excluded" value={estimate.totals.excluded} tone="warning" />
              <Stat label="Force included" value={estimate.totals.forceIncluded} tone="info" />
              <Stat label="Robots blocked" value={estimate.totals.blockedByRobots} tone="warning" />
              <Stat label="Normalized" value={estimate.totals.normalizedDuplicates} tone="info" />
            </div>

            {estimate.warnings.length > 0 ? (
              <div className="space-y-1">
                {estimate.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded border px-3 py-2 text-xs ${
                      w.severity === 'high'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                        : w.severity === 'medium'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-border bg-surface-2 text-text-muted'
                    }`}
                  >
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <Table
              rowKey={(g) => `${g.pattern}-${g.behavior}`}
              size="small"
              dataSource={estimate.groups}
              pagination={false}
              columns={[
                { title: 'Group', dataIndex: 'name', render: (n, g) => (
                  <span>
                    {n}{' '}
                    <Tag className="m-0 ml-1 text-[10px]">{g.pageFamily || 'unknown'}</Tag>
                  </span>
                ) },
                {
                  title: 'Pattern',
                  dataIndex: 'pattern',
                  render: (p: string) => <code className="text-[11px] font-mono">{p}</code>,
                },
                {
                  title: 'Behavior',
                  dataIndex: 'behavior',
                  width: 110,
                  render: (b: Behavior) => <Tag className="m-0">{b.replace('_', ' ')}</Tag>,
                },
                { title: 'Discovered', dataIndex: 'discovered', width: 100 },
                { title: 'Selected', dataIndex: 'selected', width: 90 },
                { title: 'Excluded', dataIndex: 'excluded', width: 90 },
              ]}
              expandable={{
                expandedRowRender: (g) => (
                  <ul className="text-[11px] font-mono text-text-muted space-y-0.5">
                    {g.examples.slice(0, 10).map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                ),
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* Editor modals */}
      <RuleEditor
        open={creating || !!editing}
        initial={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(body) => {
          if (editing) update.mutate({ id: editing.id, body }, { onSuccess: () => setEditing(null) });
          else create.mutate(body);
        }}
        submitting={create.isPending || update.isPending}
      />

      {/* Matched URLs drawer */}
      <Drawer
        title={matchedDrawer ? `Matched URLs · ${matchedDrawer.rule.pattern}` : ''}
        open={!!matchedDrawer}
        onClose={() => setMatchedDrawer(null)}
        width={520}
      >
        {matchedDrawer ? (
          <div>
            <div className="text-xs text-text-muted mb-2">
              {matchedDrawer.urls.length === 0
                ? 'No prior candidates matched this pattern.'
                : `${matchedDrawer.urls.length} candidates matched (showing up to 50).`}
            </div>
            <ul className="space-y-0.5 text-[11px] font-mono">
              {matchedDrawer.urls.map((u, i) => (
                <li key={i} className="text-text-muted break-all">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'success' | 'warning';
}): JSX.Element {
  const cls =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text';
  return (
    <div className="rounded bg-surface-2 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className={`tabular-nums font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function RuleEditor({
  open,
  initial,
  onClose,
  onSave,
  submitting,
}: {
  open: boolean;
  initial: Rule | null;
  onClose: () => void;
  onSave: (body: Partial<Rule>) => void;
  submitting: boolean;
}): JSX.Element {
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<PatternType>('glob');
  const [behavior, setBehavior] = useState<Behavior>('crawl');
  const [sampleLimit, setSampleLimit] = useState(5);
  const [priority, setPriority] = useState(50);
  const [groupName, setGroupName] = useState('');
  const [pageFamily, setPageFamily] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<RuleStatus>('approved');

  // Reset form when modal opens / initial changes.
  useMemo(() => {
    if (initial) {
      setName(initial.name);
      setPattern(initial.pattern);
      setPatternType(initial.patternType);
      setBehavior(initial.behavior);
      setSampleLimit(initial.sampleLimit);
      setPriority(initial.priority);
      setGroupName(initial.groupName);
      setPageFamily(initial.pageFamily);
      setReason(initial.reason);
      setStatus(initial.status);
    } else if (open) {
      setName('');
      setPattern('');
      setPatternType('glob');
      setBehavior('crawl');
      setSampleLimit(5);
      setPriority(50);
      setGroupName('');
      setPageFamily('');
      setReason('');
      setStatus('approved');
    }
  }, [initial, open]);

  return (
    <Modal
      open={open}
      title={initial ? 'Edit scope rule' : 'New scope rule'}
      onCancel={onClose}
      onOk={() =>
        onSave({
          name: name.trim() || groupName.trim() || pattern,
          pattern: pattern.trim(),
          patternType,
          behavior,
          sampleLimit,
          priority,
          groupName: groupName.trim(),
          pageFamily: pageFamily.trim(),
          reason: reason.trim(),
          status,
        })
      }
      okText={initial ? 'Save' : 'Create'}
      okButtonProps={{ disabled: !pattern.trim(), loading: submitting }}
      width={640}
    >
      <div className="space-y-3 mt-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Group name">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Pattern">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="/blog/**"
            />
          </Field>
          <Field label="Type">
            <Select
              value={patternType}
              onChange={(v) => setPatternType(v)}
              options={[
                { value: 'glob', label: 'glob' },
                { value: 'prefix', label: 'prefix' },
                { value: 'regex', label: 'regex' },
              ]}
              className="w-full"
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Behavior">
            <Select
              value={behavior}
              onChange={(v) => setBehavior(v)}
              options={BEHAVIOR_OPTIONS}
              className="w-full"
            />
          </Field>
          <Field label="Sample limit">
            <InputNumber
              min={1}
              max={500}
              value={sampleLimit}
              onChange={(v) => setSampleLimit(Number(v ?? 5))}
              disabled={behavior !== 'sample'}
              className="w-full"
            />
          </Field>
          <Field label="Priority">
            <InputNumber
              min={0}
              max={1000}
              value={priority}
              onChange={(v) => setPriority(Number(v ?? 50))}
              className="w-full"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Page family">
            <Input value={pageFamily} onChange={(e) => setPageFamily(e.target.value)} placeholder="article / product / location" />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              options={[
                { value: 'approved', label: 'approved' },
                { value: 'suggested', label: 'suggested' },
                { value: 'disabled', label: 'disabled' },
                { value: 'rejected', label: 'rejected' },
              ]}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Reason / notes">
          <Input.TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this rule? What template does it match?"
          />
        </Field>
        <div className="text-xs text-text-subtle">
          Pattern examples: <code>/blog/**</code>, <code>/products/*</code>,{' '}
          <code>/case-studies/*/details</code>, <code>?utm_*</code> (matches URLs containing
          utm_*).
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
