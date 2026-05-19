'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DatePicker, Segmented, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { Activity, AlertOctagon, AlertTriangle, Clock, RefreshCw, ServerCrash, TimerReset } from 'lucide-react';
import { api } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';
import { EmptyState } from '../../../components/EmptyState';
import { JobsTable, type Job } from '../../../components/jobs/JobsTable';
import { JobDrawer } from '../../../components/jobs/JobDrawer';
import { MetricTile } from '../../../components/MetricTile';

type Summary = {
  running: number;
  failed24h: number;
  failed7d: number;
  longRunning: number;
  stuck: number;
  scheduledToday: number;
};
type Project = { id: string; name: string };

const TYPES = ['crawl', 'audit', 'render', 'sync', 'report', 'ai', 'verification', 'monitor'];
const STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled', 'scheduled', 'stale'];
const PROVIDERS = ['gsc', 'ga4', 'cwv'];

function WorkspaceJobsInner(): JSX.Element {
  const [type, setType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [bucket, setBucket] = useState<'all' | 'running' | 'failed' | 'stuck'>('all');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (type) qs.set('type', type);
  if (status) qs.set('status', status);
  if (provider) qs.set('provider', provider);
  if (projectId) qs.set('projectId', projectId);
  if (bucket === 'running') qs.set('runningOnly', '1');
  if (bucket === 'failed') qs.set('failedOnly', '1');
  if (bucket === 'stuck') qs.set('status', 'stale');
  if (range?.[0]) qs.set('startedSince', range[0].startOf('day').toISOString());
  if (range?.[1]) qs.set('startedUntil', range[1].endOf('day').toISOString());
  qs.set('limit', '300');

  const { data: summary } = useQuery<Summary>({
    queryKey: ['jobs-summary'],
    queryFn: () => api('/jobs/summary'),
    refetchInterval: 15_000,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects-for-jobs'],
    queryFn: async () => {
      const list = await api<Array<{ id: string; siteName?: string; clientName?: string }>>(`/projects`);
      return list.map((p) => ({
        id: p.id,
        name: `${p.siteName ?? p.id}${p.clientName ? ` (${p.clientName})` : ''}`,
      }));
    },
  });

  const { data, isLoading, refetch, isFetching } = useQuery<{ jobs: Job[] }>({
    queryKey: ['ws-jobs', qs.toString()],
    queryFn: () => api(`/jobs?${qs.toString()}`),
    refetchInterval: 10_000,
  });
  const jobs = data?.jobs ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Jobs"
        subtitle="Agency-wide background job monitor. Spot stuck syncs, failed automations, and clients needing attention."
        actions={
          <Button icon={<RefreshCw size={14} />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <MetricTile
          label="Running now"
          value={summary?.running ?? 0}
          tone="neutral"
          icon={<Activity size={14} />}
        />
        <MetricTile
          label="Failed 24h"
          value={summary?.failed24h ?? 0}
          tone={(summary?.failed24h ?? 0) > 0 ? 'danger' : 'neutral'}
          icon={<AlertTriangle size={14} />}
        />
        <MetricTile
          label="Failed 7d"
          value={summary?.failed7d ?? 0}
          tone={(summary?.failed7d ?? 0) > 0 ? 'warning' : 'neutral'}
          icon={<ServerCrash size={14} />}
        />
        <MetricTile
          label="Long running (>10m)"
          value={summary?.longRunning ?? 0}
          tone={(summary?.longRunning ?? 0) > 0 ? 'warning' : 'neutral'}
          icon={<TimerReset size={14} />}
        />
        <MetricTile
          label="Stuck (>30m)"
          value={summary?.stuck ?? 0}
          tone={(summary?.stuck ?? 0) > 0 ? 'danger' : 'neutral'}
          icon={<AlertOctagon size={14} />}
        />
        <MetricTile
          label="Scheduled today"
          value={summary?.scheduledToday ?? 0}
          tone="neutral"
          icon={<Clock size={14} />}
        />
      </div>

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            size="small"
            value={bucket}
            onChange={(v) => setBucket(v as 'all' | 'running' | 'failed' | 'stuck')}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Running', value: 'running' },
              { label: 'Failed', value: 'failed' },
              { label: 'Stuck', value: 'stuck' },
            ]}
          />
          <Select
            placeholder="Project"
            showSearch
            allowClear
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ minWidth: 240 }}
          />
          <Select
            placeholder="Type"
            allowClear
            value={type}
            onChange={setType}
            options={TYPES.map((t) => ({ value: t, label: t }))}
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Status"
            allowClear
            value={status}
            onChange={setStatus}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Provider"
            allowClear
            value={provider}
            onChange={setProvider}
            options={PROVIDERS.map((p) => ({ value: p, label: p }))}
            style={{ minWidth: 120 }}
          />
          <DatePicker.RangePicker
            size="middle"
            value={range as never}
            onChange={(v) => setRange(v as [Dayjs | null, Dayjs | null] | null)}
            allowEmpty={[true, true]}
            placeholder={['Started since', 'Started until']}
          />
        </div>
      </SectionCard>

      <SectionCard noPadding>
        {!isLoading && jobs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                bucket === 'failed'
                  ? 'No failed jobs in this window'
                  : bucket === 'running'
                    ? 'No jobs running'
                    : bucket === 'stuck'
                      ? 'No stuck jobs'
                      : 'No jobs match filters'
              }
              description={
                bucket === 'failed'
                  ? 'Everything is succeeding. Stay vigilant — check Stuck.'
                  : bucket === 'running'
                    ? 'Idle. The next scheduled job will appear here when it starts.'
                    : bucket === 'stuck'
                      ? 'Nothing has been locked too long. Healthy.'
                      : 'Try removing filters or refresh to fetch latest history.'
              }
            />
          </div>
        ) : (
          <JobsTable jobs={jobs} loading={isLoading} onOpen={setOpen} showProject />
        )}
      </SectionCard>

      <JobDrawer
        jobId={open}
        open={!!open}
        onClose={() => setOpen(null)}
        invalidateKeys={[['ws-jobs'], ['jobs-summary']]}
      />
    </>
  );
}

export default function WorkspaceJobs(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <WorkspaceJobsInner />
    </Suspense>
  );
}
