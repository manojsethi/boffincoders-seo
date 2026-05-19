'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { App, Button, Modal, Select, Tag, Tooltip } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { StatusPill } from '../../../../components/StatusPill';
import { EmptyState } from '../../../../components/EmptyState';
import { TermLabel } from '../../../../components/TermLabel';

type ScheduleType = 'crawl' | 'audit' | 'report' | 'integration-sync';
type Cadence = 'weekly' | 'monthly';
type Provider = 'gsc' | 'ga4' | 'cwv' | 'all';

type Schedule = {
  id: string;
  type: ScheduleType;
  cadence: Cadence | 'custom';
  enabled: boolean;
  timezone: string;
  provider: Provider;
  agendaJobName: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  agendaMissing?: boolean;
};

const TYPE_LABEL: Record<ScheduleType, string> = {
  crawl: 'Crawl',
  audit: 'Audit',
  report: 'Report',
  'integration-sync': 'Integration sync',
};

const TYPE_TO_JOBS_FILTER: Record<ScheduleType, string> = {
  crawl: 'crawl',
  audit: 'audit',
  report: 'report',
  'integration-sync': 'sync',
};

function fmtTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MonitoringPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ScheduleType>('crawl');
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [provider, setProvider] = useState<Provider>('all');

  const { data = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules', id],
    queryFn: () => api<Schedule[]>(`/projects/${id}/schedules`),
    refetchInterval: 15_000,
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/projects/${id}/schedules`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          cadence,
          ...(type === 'integration-sync' ? { provider } : {}),
        }),
      }),
    onSuccess: () => {
      message.success('Schedule created');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['schedules', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { sId: string; enabled: boolean }) =>
      api(`/projects/${id}/schedules/${vars.sId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: vars.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', id] }),
    onError: (err) => message.error((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (sId: string) => api(`/projects/${id}/schedules/${sId}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Schedule removed');
      void qc.invalidateQueries({ queryKey: ['schedules', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Monitoring"
        subtitle="Recurring crawls, audits, reports, and integration syncs. Each schedule dispatches a real underlying job on every tick — open Jobs to see the execution history."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            Add schedule
          </Button>
        }
      />

      <SectionCard
        title={`Active schedules (${data.length})`}
        description="Schedules use Agenda. Disable to stop the next run without losing history. Delete to remove permanently."
        noPadding
      >
        {!isLoading && data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No schedules yet"
              description="Add a weekly crawl, monthly audit, weekly integration sync, or weekly progress report."
              action={
                <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
                  Add your first schedule
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-text">
                        {TYPE_LABEL[s.type] ?? s.type}
                      </span>
                      <Tag className="m-0">{s.cadence}</Tag>
                      {s.type === 'integration-sync' && (
                        <Tag className="m-0">
                          provider: {s.provider === 'all' ? 'all connected' : s.provider.toUpperCase()}
                        </Tag>
                      )}
                      <StatusPill value={s.enabled ? 'enabled' : 'disabled'} kind="state" />
                      {s.agendaMissing && (
                        <Tooltip title="Agenda job missing. The schedule row exists but no recurring Agenda entry is registered. Try Disable + Enable to recreate.">
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                            <AlertTriangle size={12} />
                            Agenda entry missing
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-xs text-text-muted flex flex-wrap gap-3">
                      <span>
                        <TermLabel term="job-next-run">Next run</TermLabel>:{' '}
                        <span className="tabular-nums text-text">{fmtTime(s.nextRunAt)}</span>
                      </span>
                      <span>
                        Last run:{' '}
                        <span className="tabular-nums text-text">{fmtTime(s.lastRunAt)}</span>
                      </span>
                      <span>
                        <TermLabel term="job">Agenda job</TermLabel>:{' '}
                        <code className="text-[11px] bg-surface-2 px-1.5 py-0.5 rounded">
                          {s.agendaJobName}
                        </code>
                      </span>
                      <Link
                        href={`/projects/${id}/jobs?type=${TYPE_TO_JOBS_FILTER[s.type]}`}
                        className="text-accent-hover hover:underline"
                      >
                        View runs →
                      </Link>
                      <Link
                        href={`/projects/${id}/jobs?type=schedule`}
                        className="text-accent-hover hover:underline"
                        title="See wrapper schedule ticks (helpful when a tick failed before dispatching the underlying job)"
                      >
                        View schedule ticks →
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="small"
                      onClick={() => toggle.mutate({ sId: s.id, enabled: !s.enabled })}
                    >
                      {s.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() =>
                        modal.confirm({
                          title: 'Delete schedule?',
                          content: 'This removes the schedule and cancels its Agenda entry.',
                          okType: 'danger',
                          onOk: () => remove.mutate(s.id),
                        })
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Modal
        open={open}
        title="Add schedule"
        onCancel={() => setOpen(false)}
        onOk={() => create.mutate()}
        okText="Create"
        confirmLoading={create.isPending}
        width={520}
      >
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-text-muted mb-1">What to run</label>
            <Select
              value={type}
              onChange={(v) => setType(v)}
              className="w-full"
              options={[
                { label: 'Crawl', value: 'crawl' },
                { label: 'Audit', value: 'audit' },
                { label: 'Report (progress)', value: 'report' },
                { label: 'Integration sync', value: 'integration-sync' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Cadence</label>
            <Select
              value={cadence}
              onChange={(v) => setCadence(v)}
              className="w-full"
              options={[
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
            />
          </div>
          {type === 'integration-sync' && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Provider</label>
              <Select
                value={provider}
                onChange={(v) => setProvider(v)}
                className="w-full"
                options={[
                  { label: 'All connected integrations', value: 'all' },
                  { label: 'GSC only', value: 'gsc' },
                  { label: 'GA4 only', value: 'ga4' },
                  { label: 'CWV only', value: 'cwv' },
                ]}
              />
              <p className="text-[11px] text-text-subtle mt-1">
                &quot;All&quot; enqueues GSC, GA4, and CWV on each tick (skipping providers that aren&apos;t
                connected).
              </p>
            </div>
          )}
          <div className="text-xs text-text-subtle">
            Cadence{' '}
            <strong>
              {cadence === 'weekly' ? 'weekly' : 'monthly'}
            </strong>{' '}
            will create an Agenda entry on{' '}
            <code className="bg-surface-2 px-1 py-0.5 rounded">
              {type === 'crawl'
                ? 'project.scheduleCrawl'
                : type === 'audit'
                  ? 'project.scheduleAudit'
                  : type === 'report'
                    ? 'project.scheduleReport'
                    : 'project.scheduleSync'}
            </code>{' '}
            and dispatch the real underlying job on every tick.
          </div>
        </div>
      </Modal>
    </>
  );
}
