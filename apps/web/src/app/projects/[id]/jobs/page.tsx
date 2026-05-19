'use client';

import { Suspense, use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DatePicker, Segmented, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { EmptyState } from '../../../../components/EmptyState';
import { JobsTable, type Job } from '../../../../components/jobs/JobsTable';
import { JobDrawer } from '../../../../components/jobs/JobDrawer';

const TYPES = ['crawl', 'audit', 'render', 'sync', 'report', 'ai', 'verification', 'monitor'];
const STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled', 'scheduled', 'stale'];
const PROVIDERS = ['gsc', 'ga4', 'cwv'];

function ProjectJobsInner({ id }: { id: string }): JSX.Element {
  const sp = useSearchParams();
  const initial = sp?.get('type') ?? undefined;
  const [type, setType] = useState<string | undefined>(initial);
  const [status, setStatus] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
  const [bucket, setBucket] = useState<'all' | 'running' | 'failed'>('all');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (type) qs.set('type', type);
  if (status) qs.set('status', status);
  if (provider) qs.set('provider', provider);
  if (bucket === 'running') qs.set('runningOnly', '1');
  if (bucket === 'failed') qs.set('failedOnly', '1');
  if (range?.[0]) qs.set('startedSince', range[0].startOf('day').toISOString());
  if (range?.[1]) qs.set('startedUntil', range[1].endOf('day').toISOString());
  qs.set('limit', '200');

  const { data, isLoading, refetch, isFetching } = useQuery<{ jobs: Job[] }>({
    queryKey: ['project-jobs', id, qs.toString()],
    queryFn: () => api(`/projects/${id}/jobs?${qs.toString()}`),
    refetchInterval: 10_000,
  });
  const jobs = data?.jobs ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Jobs"
        subtitle="Crawls, audits, syncs, reports and verifications powered by Agenda. Tracks status, progress, and failure reasons."
        actions={
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => refetch()}
            loading={isFetching}
          >
            Refresh
          </Button>
        }
      />

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            size="small"
            value={bucket}
            onChange={(v) => setBucket(v as 'all' | 'running' | 'failed')}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Running', value: 'running' },
              { label: 'Failed', value: 'failed' },
            ]}
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
                  ? 'No failed jobs'
                  : bucket === 'running'
                    ? 'No jobs running'
                    : 'No jobs yet'
              }
              description={
                bucket === 'failed'
                  ? 'Nothing has failed in the visible window. Healthy.'
                  : bucket === 'running'
                    ? 'Nothing is in flight right now.'
                    : 'Run a crawl, audit, or sync — execution history appears here.'
              }
            />
          </div>
        ) : (
          <JobsTable jobs={jobs} loading={isLoading} onOpen={setOpen} />
        )}
      </SectionCard>

      <JobDrawer
        jobId={open}
        open={!!open}
        onClose={() => setOpen(null)}
        invalidateKeys={[['project-jobs', id]]}
      />
    </>
  );
}

export default function ProjectJobsPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ProjectJobsInner id={id} />
    </Suspense>
  );
}
