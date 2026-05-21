'use client';

import { use, useMemo, useState } from 'react';
import { App, Button, Input, Modal, Radio, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { PageHeader } from '../../../../../components/PageHeader';
import { SectionCard } from '../../../../../components/SectionCard';

type Project = {
  id: string;
  status: 'active' | 'paused' | 'archived';
  siteName: string;
  primaryDomain: string;
  archivedAt: string | null;
  archivedReason: string | null;
};

type ResetMode = 'fresh-audit-baseline' | 'performance-data' | 'execution-data' | 'full';

type ResetPreview = {
  mode: ResetMode;
  deletedPreview: Record<string, number>;
  kept: string[];
  runningJobs: { crawlRuns: number; auditRuns: number; renderRuns: number; total: number };
  schedulesActive: number;
};

const MODE_OPTIONS: Array<{
  value: ResetMode;
  label: string;
  description: string;
}> = [
  {
    value: 'fresh-audit-baseline',
    label: 'Start fresh audit baseline (default)',
    description:
      'Delete crawl, pages, audits, findings, issues, recommendations, and AI analyses. Keep goals, integrations, crawl settings, keywords, GSC/GA4/CWV, briefs, fix plans, and reports. Monitoring is paused until you re-run a crawl.',
  },
  {
    value: 'performance-data',
    label: 'Reset performance data',
    description:
      'Delete imported GSC + GA4 rows and CWV snapshots. Audit evidence stays. Use when the wrong GSC property or GA4 property was selected and you want to re-import.',
  },
  {
    value: 'execution-data',
    label: 'Reset execution data',
    description:
      'Delete recommendations, content briefs, fix plans, and opportunities. Keep crawl/audit/findings/issues + GSC/GA4/CWV. Use when you want to rebuild the execution plan but keep evidence.',
  },
  {
    value: 'full',
    label: 'Full project reset',
    description:
      'Delete almost everything in this project. Only the project name + domain remain (with optional keeps below). Use sparingly — prefer archive instead if the project may come back.',
  },
];

export default function DangerZonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const router = useRouter();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const { data: project } = useQuery<Project>({
    queryKey: ['project-shell', id],
    queryFn: () => api<Project>(`/projects/${id}`),
  });

  // ----- Archive -----
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const archive = useMutation({
    mutationFn: () =>
      api(`/projects/${id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason: archiveReason || undefined }),
      }),
    onSuccess: () => {
      message.success('Project archived. Monitoring paused; data preserved.');
      setArchiveOpen(false);
      void qc.invalidateQueries({ queryKey: ['project-shell', id] });
      void qc.invalidateQueries({ queryKey: ['projects-list'] });
    },
    onError: (err) => message.error((err as Error).message),
  });
  const restore = useMutation({
    mutationFn: () => api(`/projects/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Project restored.');
      void qc.invalidateQueries({ queryKey: ['project-shell', id] });
      void qc.invalidateQueries({ queryKey: ['projects-list'] });
    },
  });

  // ----- Reset wizard -----
  const [resetOpen, setResetOpen] = useState(false);
  const [mode, setMode] = useState<ResetMode>('fresh-audit-baseline');
  const [confirmText, setConfirmText] = useState('');
  const [cancelJobs, setCancelJobs] = useState(false);
  const [keepGoals, setKeepGoals] = useState(true);
  const [keepIntegrations, setKeepIntegrations] = useState(true);
  const [keepCrawlSettings, setKeepCrawlSettings] = useState(true);

  const preview = useQuery<ResetPreview>({
    enabled: resetOpen,
    queryKey: ['reset-preview', id, mode, { keepGoals, keepIntegrations, keepCrawlSettings }],
    queryFn: () =>
      api<ResetPreview>(`/projects/${id}/reset/preview`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          options:
            mode === 'full'
              ? { keepGoals, keepIntegrations, keepCrawlSettings, keepMonitoringSettings: false }
              : {},
        }),
      }),
  });

  const reset = useMutation({
    mutationFn: () =>
      api<{
        ok: boolean;
        mode: ResetMode;
        deleted: Record<string, number>;
        kept: string[];
        schedulesPaused: number;
        agendaJobsCancelled: number;
        nextAction: string;
      }>(`/projects/${id}/reset`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          confirmText,
          cancelRunningJobs: cancelJobs,
          options:
            mode === 'full'
              ? { keepGoals, keepIntegrations, keepCrawlSettings, keepMonitoringSettings: false }
              : {},
        }),
      }),
    onSuccess: (r) => {
      const totalDeleted = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      message.success(
        `Reset complete — ${totalDeleted} record${totalDeleted === 1 ? '' : 's'} deleted across ${Object.keys(r.deleted).length} collection${Object.keys(r.deleted).length === 1 ? '' : 's'}. ${r.nextAction}`,
      );
      setResetOpen(false);
      setConfirmText('');
      setCancelJobs(false);
      void qc.invalidateQueries();
      router.push(`/projects/${id}`);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const previewData = preview.data;
  const previewTotal = useMemo(
    () =>
      previewData
        ? Object.values(previewData.deletedPreview).reduce((a, b) => a + b, 0)
        : 0,
    [previewData],
  );
  const hasRunningJobs = (previewData?.runningJobs.total ?? 0) > 0;
  const canReset =
    confirmText === 'RESET PROJECT' && (!hasRunningJobs || cancelJobs);

  return (
    <>
      <PageHeader
        eyebrow="Project · Settings"
        title="Danger zone"
        subtitle="Reversible (archive) and destructive (reset) project actions. Read the modal text before confirming."
      />

      <SectionCard
        title="Archive project"
        description="Hide from active project lists, pause scheduled monitoring, and block manual crawls / audits / syncs / reports. Reversible."
        className="mb-4"
        actions={
          project?.status === 'archived' ? (
            <Tag color="orange">archived</Tag>
          ) : (
            <Tag color="green">active</Tag>
          )
        }
      >
        <div className="flex items-start gap-3">
          <Archive size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-text-muted space-y-2">
            <p>
              Archive when a client pauses, a project ends, or a demo project should not appear in
              daily work. Data, reports, and history stay intact and reappear after restore.
            </p>
            {project?.status === 'archived' ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                Archived
                {project.archivedAt
                  ? ` on ${new Date(project.archivedAt).toLocaleDateString()}`
                  : ''}
                . Reason: {project.archivedReason || '_none provided_'}.
              </div>
            ) : null}
          </div>
          {project?.status === 'archived' ? (
            <Button
              onClick={() =>
                modal.confirm({
                  title: 'Restore this project?',
                  content:
                    'The project will become writable again. Monitoring schedules remain paused; re-enable them on the Monitoring tab.',
                  okText: 'Restore',
                  onOk: () => restore.mutate(),
                })
              }
              loading={restore.isPending}
            >
              Restore project
            </Button>
          ) : (
            <Button
              danger
              icon={<Archive size={14} />}
              onClick={() => setArchiveOpen(true)}
            >
              Archive project
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Reset project data"
        description="Scoped, destructive resets. Pick a mode below — defaults to the safest one (fresh audit baseline)."
      >
        <div className="flex items-start gap-3">
          <RotateCcw size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-text-muted">
            <p>
              Use this after a misconfigured first crawl, the wrong domain, the wrong analytics
              property, or before re-baselining a client. The modal shows exactly what will be
              deleted and what will be kept, and requires you to type
              <code className="mx-1 rounded bg-surface-2 px-1 py-0.5">RESET PROJECT</code>
              to proceed.
            </p>
          </div>
          <Button
            danger
            icon={<AlertTriangle size={14} />}
            onClick={() => {
              setMode('fresh-audit-baseline');
              setConfirmText('');
              setCancelJobs(false);
              setResetOpen(true);
            }}
            disabled={project?.status === 'archived'}
            title={
              project?.status === 'archived'
                ? 'Restore the project before resetting.'
                : undefined
            }
          >
            Reset project data…
          </Button>
        </div>
      </SectionCard>

      {/* Archive modal */}
      <Modal
        open={archiveOpen}
        title="Archive this project?"
        onCancel={() => setArchiveOpen(false)}
        onOk={() => archive.mutate()}
        okText="Archive"
        okType="danger"
        confirmLoading={archive.isPending}
      >
        <div className="space-y-3 mt-2 text-sm">
          <p>
            This hides the project from active work and pauses scheduled monitoring. Historical
            data and reports remain available. You can restore the project at any time from this
            page.
          </p>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
              Reason (optional)
            </div>
            <Input.TextArea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              rows={2}
              maxLength={500}
              showCount
              placeholder="e.g. client paused for Q3, contract ended, demo finished"
            />
          </div>
        </div>
      </Modal>

      {/* Reset wizard */}
      <Modal
        open={resetOpen}
        title="Reset project data"
        onCancel={() => setResetOpen(false)}
        width={720}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-text-subtle">
              {hasRunningJobs && !cancelJobs
                ? `${previewData?.runningJobs.total} running job${previewData?.runningJobs.total === 1 ? '' : 's'} — tick the cancel box below to proceed.`
                : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                danger
                loading={reset.isPending}
                disabled={!canReset}
                onClick={() => reset.mutate()}
              >
                Reset now
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">
              Reset mode
            </div>
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value as ResetMode)}
              className="w-full"
            >
              <div className="space-y-2">
                {MODE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-start gap-2 rounded border border-border bg-surface-2 p-2 cursor-pointer"
                  >
                    <Radio value={o.value} />
                    <div>
                      <div className="text-text">{o.label}</div>
                      <div className="text-xs text-text-muted">{o.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Radio.Group>
          </div>

          {mode === 'full' ? (
            <div className="rounded border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-rose-200">
                Full-reset options
              </div>
              <KeepToggle label="Keep goals" checked={keepGoals} onChange={setKeepGoals} />
              <KeepToggle
                label="Keep integrations (GSC/GA4 OAuth, CWV API key)"
                checked={keepIntegrations}
                onChange={setKeepIntegrations}
              />
              <KeepToggle
                label="Keep crawl settings"
                checked={keepCrawlSettings}
                onChange={setKeepCrawlSettings}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                Will delete
              </div>
              {preview.isLoading ? (
                <div className="text-xs text-text-subtle">Loading…</div>
              ) : previewData ? (
                <ul className="text-xs space-y-0.5 max-h-[200px] overflow-y-auto pr-2">
                  {Object.entries(previewData.deletedPreview).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="text-text-muted">{k}</span>
                      <span className="tabular-nums text-rose-400">{v}</span>
                    </li>
                  ))}
                  <li className="pt-1 mt-1 border-t border-border flex items-center justify-between text-text">
                    <span className="font-medium">Total</span>
                    <span className="tabular-nums">{previewTotal}</span>
                  </li>
                </ul>
              ) : null}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                Will keep
              </div>
              {previewData ? (
                <ul className="text-xs space-y-0.5 text-text-muted">
                  {previewData.kept.map((k) => (
                    <li key={k}>· {k}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {previewData ? (
            <div className="rounded border border-border bg-surface-2 p-3 space-y-2 text-xs">
              <div>
                <span className="text-text-subtle">Active schedules:</span>{' '}
                <span className="text-text tabular-nums">
                  {previewData.schedulesActive}
                </span>{' '}
                <span className="text-text-subtle">(will be paused as part of reset)</span>
              </div>
              <div>
                <span className="text-text-subtle">Running jobs:</span>{' '}
                <span className="text-text tabular-nums">
                  {previewData.runningJobs.total}
                </span>{' '}
                <span className="text-text-subtle">
                  ({previewData.runningJobs.crawlRuns} crawl ·{' '}
                  {previewData.runningJobs.auditRuns} audit ·{' '}
                  {previewData.runningJobs.renderRuns} render)
                </span>
              </div>
              {hasRunningJobs ? (
                <label className="flex items-center gap-2 text-amber-300">
                  <input
                    type="checkbox"
                    checked={cancelJobs}
                    onChange={(e) => setCancelJobs(e.target.checked)}
                  />
                  Cancel running jobs as part of the reset
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-border pt-3">
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
              Type <code className="bg-surface-2 px-1 rounded">RESET PROJECT</code> to confirm
            </div>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET PROJECT"
              status={
                confirmText.length > 0 && confirmText !== 'RESET PROJECT' ? 'error' : ''
              }
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function KeepToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
