'use client';

import { App, Button, Modal, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { StatusPill } from './StatusPill';

type Task = {
  key: string;
  label: string;
  description: string;
  affects: string[];
  riskLevel: 'low' | 'medium' | 'high';
};
type Run = {
  id: string;
  taskKey: string;
  label: string;
  dryRun: boolean;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  triggeredBy: string;
};

export function MaintenanceCard({ projectId }: { projectId: string }): JSX.Element {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [previewRun, setPreviewRun] = useState<Run | null>(null);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['maintenance-tasks', projectId],
    queryFn: () => api(`/projects/${projectId}/maintenance/tasks`),
  });
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ['maintenance-runs', projectId],
    queryFn: () => api(`/projects/${projectId}/maintenance/runs?limit=20`),
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === 'running') ? 2000 : 30000,
  });

  const run = useMutation({
    mutationFn: (vars: { taskKey: string; dryRun: boolean }) =>
      api<{ id: string; status: string; dryRun: boolean; result?: Record<string, unknown>; error?: string }>(
        `/projects/${projectId}/maintenance/run`,
        { method: 'POST', body: JSON.stringify(vars) },
      ),
    onSuccess: (res, vars) => {
      void qc.invalidateQueries({ queryKey: ['maintenance-runs', projectId] });
      // Affected queries should refetch — invalidate relevant tabs.
      void qc.invalidateQueries({ queryKey: ['keywords', projectId] });
      void qc.invalidateQueries({ queryKey: ['keyword-fits', projectId] });
      void qc.invalidateQueries({ queryKey: ['recommendations', projectId] });
      message.success(
        vars.dryRun
          ? 'Dry run complete — review preview, then apply.'
          : 'Maintenance task completed.',
      );
      // Pop the result so analyst sees what changed
      setPreviewRun({
        id: res.id,
        taskKey: vars.taskKey,
        label: tasks.find((t) => t.key === vars.taskKey)?.label ?? vars.taskKey,
        dryRun: res.dryRun,
        status: res.status as Run['status'],
        startedAt: new Date().toISOString(),
        result: res.result,
        error: res.error,
        triggeredBy: 'analyst',
      });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const trigger = (task: Task, dryRun: boolean): void => {
    if (!dryRun) {
      modal.confirm({
        title: `Run "${task.label}"?`,
        content: (
          <div className="text-xs space-y-2">
            <p>{task.description}</p>
            <p className="text-text-muted">
              Risk: <Tag>{task.riskLevel}</Tag> · Affects: {task.affects.join(', ')}
            </p>
            <p className="text-amber-400">
              This will write changes immediately. The dry-run preview shows what would change.
            </p>
          </div>
        ),
        okText: 'Apply',
        okType: 'danger',
        onOk: () => run.mutate({ taskKey: task.key, dryRun: false }),
      });
      return;
    }
    run.mutate({ taskKey: task.key, dryRun: true });
  };

  return (
    <SectionCard
      title="Maintenance"
      description="Controlled cleanup + backfill tasks. Every run is logged. Use Dry run first to preview the diff, then Apply."
      className="mt-4"
    >
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <EmptyState
            title="No maintenance tasks registered"
            description="Tasks appear here when the backend registers them."
          />
        ) : (
          tasks.map((t) => (
            <div
              key={t.key}
              className="rounded border border-border p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-text">{t.label}</span>
                    <Tag className="m-0">{t.riskLevel}</Tag>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{t.description}</p>
                  <p className="text-[11px] text-text-subtle mt-1">
                    Affects: {t.affects.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="small"
                    onClick={() => trigger(t, true)}
                    loading={run.isPending && run.variables?.taskKey === t.key && run.variables.dryRun}
                  >
                    Dry run
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircle size={14} />}
                    onClick={() => trigger(t, false)}
                    loading={run.isPending && run.variables?.taskKey === t.key && !run.variables.dryRun}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">
          Recent runs
        </div>
        {runs.length === 0 ? (
          <p className="text-xs text-text-subtle">No maintenance runs yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-hover/40 cursor-pointer"
                onClick={() => setPreviewRun(r)}
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text truncate flex items-center gap-2">
                    {r.label}
                    {r.dryRun ? <Tag className="m-0 text-[10px]">dry</Tag> : null}
                  </div>
                  <div className="text-[11px] text-text-subtle tabular-nums">
                    {new Date(r.startedAt).toLocaleString()}{' '}
                    {r.durationMs ? `· ${r.durationMs} ms` : ''}
                  </div>
                </div>
                <StatusPill value={r.status} kind="state" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!previewRun}
        title={previewRun?.label}
        onCancel={() => setPreviewRun(null)}
        footer={null}
        width={620}
      >
        {previewRun ? (
          <div className="text-sm space-y-3">
            <div className="flex items-center gap-2">
              <StatusPill value={previewRun.status} kind="state" />
              {previewRun.dryRun ? <Tag>dry run</Tag> : <Tag color="purple">applied</Tag>}
              {previewRun.durationMs ? (
                <span className="text-xs text-text-subtle">{previewRun.durationMs} ms</span>
              ) : null}
            </div>
            {previewRun.error ? (
              <div className="flex items-start gap-2 rounded bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>{previewRun.error}</div>
              </div>
            ) : null}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-subtle mb-1">
                Result
              </div>
              <pre className="text-[11px] bg-surface-2 p-2 rounded overflow-x-auto m-0">
                {JSON.stringify(previewRun.result, null, 2)}
              </pre>
            </div>
            {previewRun.dryRun && (
              <div className="text-xs text-amber-300">
                This was a dry run. Nothing was written. Click Apply on the task to commit the
                change.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </SectionCard>
  );
}
