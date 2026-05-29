'use client';

import { App, Button, Modal, Tag, Tooltip } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { StatusPill } from './StatusPill';

type TaskResult = {
  id: string;
  taskKey: string;
  status: 'completed' | 'failed' | 'unavailable';
  provider?: string;
  model?: string;
  output: unknown;
  confidence: number;
  confidenceLevel: string;
  warnings: string[];
  needsAnalystReview: boolean;
  costEstimateUsd: number;
  error?: string;
  durationMs: number;
};

type TasksMeta = {
  tasks: Array<{ key: string; label: string; description: string; riskLevel: string }>;
  providers: string[];
  provider?: string;
  model?: string;
  available?: boolean;
};

export function AiAssistButton({
  projectId,
  taskKey,
  label,
  buildParams,
  sourceIds,
  renderResult,
  onAccept,
  size = 'small',
}: {
  projectId: string;
  taskKey: string;
  label?: string;
  buildParams: () => Record<string, unknown>;
  sourceIds?: Record<string, string>;
  renderResult: (output: unknown) => ReactNode;
  onAccept?: (output: unknown) => void;
  size?: 'small' | 'middle';
}): JSX.Element {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);

  const { data: meta } = useQuery<TasksMeta>({
    queryKey: ['ai-tasks'],
    queryFn: () => api('/ai/tasks'),
    staleTime: 60_000,
  });
  const task = meta?.tasks.find((t) => t.key === taskKey);
  const aiAvailable = (meta?.providers ?? []).length > 0;

  const run = useMutation({
    mutationFn: () =>
      api<TaskResult>(`/projects/${projectId}/ai/run`, {
        method: 'POST',
        body: JSON.stringify({ taskKey, params: buildParams(), sourceIds }),
      }),
    onSuccess: (r) => {
      setResult(r);
      setOpen(true);
      if (r.status === 'unavailable') {
        message.warning('AI is not configured. Set OPENROUTER_API_KEY in env.');
      } else if (r.status === 'failed') {
        message.error(r.error ?? 'AI task failed');
      }
    },
    onError: (err) => message.error((err as Error).message),
  });

  const accept = useMutation({
    mutationFn: (runId: string) =>
      api(`/projects/${projectId}/ai/runs/${runId}/accept`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Accepted');
      if (result?.output && onAccept) onAccept(result.output);
      setOpen(false);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const reject = useMutation({
    mutationFn: (runId: string) =>
      api(`/projects/${projectId}/ai/runs/${runId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'analyst dismissed' }),
      }),
    onSuccess: () => {
      message.info('Dismissed');
      setOpen(false);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const buttonLabel = label ?? task?.label ?? 'AI assist';
  const disabled = !aiAvailable || !task;
  const reason = !aiAvailable
    ? 'AI is not configured. Set OPENROUTER_API_KEY to enable AI features.'
    : !task
      ? 'Task not registered'
      : undefined;

  return (
    <>
      <Tooltip title={reason}>
        <Button
          size={size}
          icon={<Sparkles size={14} />}
          loading={run.isPending}
          disabled={disabled}
          onClick={() => run.mutate()}
        >
          {buttonLabel}
        </Button>
      </Tooltip>

      <Modal
        open={open}
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            {buttonLabel}
            <Tag color="purple" className="m-0 text-[10px] uppercase">
              Assistant-suggested
            </Tag>
          </span>
        }
        onCancel={() => setOpen(false)}
        footer={null}
        width={620}
        destroyOnClose
      >
        {!result ? null : result.status === 'unavailable' ? (
          <div className="flex items-start gap-2 text-sm text-amber-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              AI is not configured. Set <code>OPENROUTER_API_KEY</code> in <code>.env</code> to
              enable assist features. Backend stays usable; only AI-assisted suggestions are
              unavailable.
            </div>
          </div>
        ) : result.status === 'failed' ? (
          <div className="flex items-start gap-2 text-sm text-rose-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Task failed</div>
              <div className="text-xs text-text-muted mt-1">{result.error}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Tag>{result.provider}</Tag>
              <Tag>{result.model}</Tag>
              <StatusPill value={result.confidenceLevel} kind="state" />
              <span className="text-text-subtle">
                {Math.round(result.confidence * 100)}% confidence · {result.durationMs} ms
              </span>
              {result.costEstimateUsd > 0 ? (
                <span className="text-text-subtle">${result.costEstimateUsd.toFixed(4)}</span>
              ) : null}
            </div>
            <div className="text-[11px] text-amber-300">
              Suggested by AI. Review before applying — evidence is unchanged.
            </div>
            <div>{renderResult(result.output)}</div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                size="small"
                type="primary"
                loading={accept.isPending}
                onClick={() => accept.mutate(result.id)}
              >
                Accept + apply
              </Button>
              <Button
                size="small"
                danger
                loading={reject.isPending}
                onClick={() => reject.mutate(result.id)}
              >
                Dismiss
              </Button>
              <span className="text-[11px] text-text-subtle ml-auto">
                Audit logged · run id {result.id.slice(-6)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
