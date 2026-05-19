'use client';

import Link from 'next/link';
import { App, Button, Drawer, Skeleton, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Square } from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../SectionCard';
import { StatusPill } from '../StatusPill';
import { TermLabel } from '../TermLabel';
import type { Job } from './JobsTable';

type RelatedRun = {
  type: 'crawl' | 'audit' | 'render' | 'report';
  id: string;
  status?: string;
  progressPercent?: number;
  currentStep?: string;
  reportType?: string;
};

type JobDetail = Job & { relatedRun: RelatedRun | null };

const RETRY_SAFE_TYPES = new Set(['sync']); // type from JobsTable
const RUNNING_CANCEL_SAFE_PROVIDERS = new Set(['cwv']);

export function JobDrawer({
  jobId,
  open,
  onClose,
  invalidateKeys,
}: {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
  invalidateKeys: string[][];
}): JSX.Element {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<JobDetail>({
    queryKey: ['job', jobId],
    queryFn: () => api(`/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  });

  const invalidateAll = (): void => {
    invalidateKeys.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
    void qc.invalidateQueries({ queryKey: ['job', jobId] });
  };

  const retry = useMutation({
    mutationFn: () => api(`/jobs/${jobId}/retry`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Job retried');
      invalidateAll();
    },
    onError: (err) => message.error((err as Error).message),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/jobs/${jobId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Job cancelled');
      invalidateAll();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const canRetry = !!data && data.status === 'failed' && RETRY_SAFE_TYPES.has(data.type);
  const canCancelQueued = !!data && (data.status === 'queued' || data.status === 'scheduled');
  const canCancelRunning =
    !!data && data.status === 'running' && data.provider != null && RUNNING_CANCEL_SAFE_PROVIDERS.has(data.provider);

  const friendlyError = (e: string | null, provider: string | null): string | null => {
    if (!e) return null;
    const lower = e.toLowerCase();
    if (lower.includes('invalid_grant') || lower.includes('token has been expired')) {
      return 'OAuth token expired — reconnect the integration on Settings → Integrations.';
    }
    if (lower.includes('permissiondenied') || lower.includes('access denied') || lower.includes('forbidden')) {
      return `${provider?.toUpperCase() ?? 'Provider'} denied access. Confirm the Google account has access to the selected property.`;
    }
    if (lower.includes('quota')) {
      return 'PageSpeed quota exceeded. Wait for reset or add a valid API key.';
    }
    if (lower.includes('timeout')) {
      return 'Operation timed out. Reduce scope (URL count) or check network/firewall.';
    }
    return e;
  };

  return (
    <Drawer
      title={data?.label ?? 'Job'}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={data.status} kind="state" />
            {data.provider && <Tag className="m-0 uppercase">{data.provider}</Tag>}
            <Tag className="m-0">{data.trigger}</Tag>
            {data.failCount > 0 && <Tag color="error">{data.failCount}× failed</Tag>}
          </div>

          {data.failReason && (
            <SectionCard>
              <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                Failure reason
              </div>
              <p className="text-rose-500 text-sm">
                {friendlyError(data.failReason, data.provider)}
              </p>
              {data.failReason !== friendlyError(data.failReason, data.provider) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-subtle">Raw error</summary>
                  <pre className="text-[11px] bg-surface-2 p-2 rounded mt-1 overflow-x-auto">
                    {data.failReason}
                  </pre>
                </details>
              )}
            </SectionCard>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Job type" value={data.type} />
            <Field label="Provider" value={data.provider ?? '—'} />
            <Field label="Started" value={fmtDate(data.startedAt)} />
            <Field label="Finished" value={fmtDate(data.finishedAt)} />
            <Field label={<TermLabel term="job-duration">Duration</TermLabel>} value={fmtDur(data.durationMs)} />
            <Field label={<TermLabel term="job-next-run">Next run</TermLabel>} value={fmtDate(data.nextRunAt)} />
            <Field label={<TermLabel term="job-schedule">Repeat</TermLabel>} value={data.repeatInterval ?? '—'} />
            <Field label={<TermLabel term="job-lock">Locked at</TermLabel>} value={fmtDate(data.lockedAt)} />
          </div>

          {data.relatedRun && (
            <SectionCard>
              <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">
                Related run
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Tag>{data.relatedRun.type}</Tag>
                {data.relatedRun.status && <StatusPill value={data.relatedRun.status} kind="state" />}
                {data.relatedRun.progressPercent != null && (
                  <span className="text-xs tabular-nums">{data.relatedRun.progressPercent}%</span>
                )}
              </div>
              {data.relatedRun.currentStep && (
                <div className="text-xs text-text-muted mb-2">Step: {data.relatedRun.currentStep}</div>
              )}
              {data.projectId && (
                <RelatedRunLink
                  projectId={data.projectId}
                  run={data.relatedRun}
                  onNavigate={onClose}
                />
              )}
            </SectionCard>
          )}

          {data.projectId && (
            <div className="text-xs">
              <Link
                href={`/projects/${data.projectId}`}
                className="text-accent-hover hover:underline"
                onClick={onClose}
              >
                Open project →
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button
              size="small"
              icon={<RotateCcw size={14} />}
              disabled={!canRetry}
              loading={retry.isPending}
              onClick={() => retry.mutate()}
              title={canRetry ? 'Retry this job' : 'Retry only available for failed sync jobs'}
            >
              Retry
            </Button>
            <Button
              size="small"
              danger
              icon={<Square size={14} />}
              disabled={!canCancelQueued && !canCancelRunning}
              loading={cancel.isPending}
              onClick={() => {
                modal.confirm({
                  title: `Cancel ${data.label}?`,
                  content:
                    data.status === 'running'
                      ? 'This will mark the running job as cancelled. Partial data may remain. Continue?'
                      : 'This will remove the next scheduled run for this job.',
                  okType: 'danger',
                  okText: 'Cancel job',
                  onOk: () => cancel.mutate(),
                });
              }}
              title={
                canCancelQueued || canCancelRunning
                  ? 'Cancel this job'
                  : data.status === 'running'
                    ? 'Running cancel not supported for this job type'
                    : 'Job is already in a terminal state'
              }
            >
              Cancel
            </Button>
            {!canRetry && data.status === 'failed' && (
              <span className="text-[11px] text-text-subtle">
                Retry only for sync jobs. For crawl/audit/report, re-run from the project page.
              </span>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/**
 * Maps a related run type to the closest existing project screen. There aren't dedicated
 * crawl/audit/render run pages yet, so we route to the nearest analyst destination:
 *   crawl  → project monitoring (latest crawl health)
 *   audit  → issues list (audit produces issues; filter by source audit run when supported)
 *   render → pages list (rendered output lands per page)
 *   report → report detail
 */
function RelatedRunLink({
  projectId,
  run,
  onNavigate,
}: {
  projectId: string;
  run: RelatedRun;
  onNavigate: () => void;
}): JSX.Element {
  const link = (() => {
    switch (run.type) {
      case 'report':
        return { href: `/projects/${projectId}/reports/${run.id}`, label: 'Open report →' };
      case 'crawl':
        return { href: `/projects/${projectId}/monitoring`, label: 'Open crawl health →' };
      case 'audit':
        return { href: `/projects/${projectId}/issues`, label: 'Open issues →' };
      case 'render':
        return { href: `/projects/${projectId}/pages`, label: 'Open pages →' };
      default:
        return null;
    }
  })();
  if (!link) return <span className="text-xs text-text-subtle">No drilldown screen yet.</span>;
  return (
    <Link
      href={link.href}
      className="text-xs text-accent-hover hover:underline"
      onClick={onNavigate}
    >
      {link.label}
    </Link>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }): JSX.Element {
  return (
    <div className="bg-surface-2 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="text-text">{value}</div>
    </div>
  );
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}
function fmtDur(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}
