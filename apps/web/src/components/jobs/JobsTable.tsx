'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Table, Tag, Tooltip } from 'antd';
import { StatusPill } from '../StatusPill';
import { TermLabel } from '../TermLabel';

export type Job = {
  id: string;
  agendaName: string;
  label: string;
  type: string;
  provider: string | null;
  relatedRunType: string | null;
  relatedRunId: string | null;
  projectId: string | null;
  projectName: string | null;
  trigger: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled' | 'stale';
  startedAt: string | null;
  finishedAt: string | null;
  nextRunAt: string | null;
  durationMs: number | null;
  repeatInterval: string | null;
  failReason: string | null;
  failCount: number;
  lockedAt: string | null;
};

function fmtTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

export function JobsTable({
  jobs,
  loading,
  onOpen,
  showProject = false,
}: {
  jobs: Job[];
  loading?: boolean;
  onOpen: (id: string) => void;
  showProject?: boolean;
}): JSX.Element {
  const columns = useMemo(
    () => [
      {
        title: <TermLabel term="job">Job</TermLabel>,
        dataIndex: 'label',
        width: 180,
        render: (l: string, r: Job) => (
          <span className="flex items-center gap-2">
            <span className="font-medium text-text">{l}</span>
            {r.provider ? <Tag className="m-0 uppercase text-[10px]">{r.provider}</Tag> : null}
          </span>
        ),
      },
      ...(showProject
        ? [
            {
              title: 'Project',
              dataIndex: 'projectName',
              width: 220,
              render: (n: string | null, r: Job) =>
                n && r.projectId ? (
                  <Link
                    href={`/projects/${r.projectId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-accent-hover hover:underline"
                  >
                    {n}
                  </Link>
                ) : (
                  <span className="text-text-subtle">—</span>
                ),
            },
          ]
        : []),
      {
        title: 'Status',
        dataIndex: 'status',
        width: 130,
        render: (s: string) => <StatusPill value={s} kind="state" />,
      },
      {
        title: <TermLabel term="job-trigger">Source</TermLabel>,
        dataIndex: 'trigger',
        width: 110,
        render: (t: string) => <Tag className="m-0">{t}</Tag>,
      },
      {
        title: 'Started',
        dataIndex: 'startedAt',
        width: 150,
        render: (d: string | null) => (
          <span className="text-xs tabular-nums">{fmtTime(d)}</span>
        ),
      },
      {
        title: 'Finished',
        dataIndex: 'finishedAt',
        width: 150,
        render: (d: string | null) => (
          <span className="text-xs tabular-nums">{fmtTime(d)}</span>
        ),
      },
      {
        title: <TermLabel term="job-duration">Duration</TermLabel>,
        dataIndex: 'durationMs',
        width: 100,
        render: (v: number | null) => <span className="text-xs tabular-nums">{fmtDuration(v)}</span>,
      },
      {
        title: <TermLabel term="job-next-run">Next run</TermLabel>,
        dataIndex: 'nextRunAt',
        width: 140,
        render: (d: string | null) => (
          <span className="text-xs tabular-nums text-text-muted">{fmtTime(d)}</span>
        ),
      },
      {
        title: 'Error',
        dataIndex: 'failReason',
        ellipsis: true,
        render: (e: string | null, r: Job) =>
          e ? (
            <Tooltip title={e}>
              <span className="text-xs text-rose-500">
                {e.length > 80 ? `${e.slice(0, 80)}…` : e}
                {r.failCount > 1 ? ` (${r.failCount}×)` : ''}
              </span>
            </Tooltip>
          ) : (
            <span className="text-text-subtle">—</span>
          ),
      },
    ],
    [showProject],
  );

  return (
    <Table
      rowKey="id"
      size="small"
      loading={loading}
      dataSource={jobs}
      pagination={{ pageSize: 25, showSizeChanger: false }}
      scroll={{ x: 1400 }}
      onRow={(row) => ({ onClick: () => onOpen(row.id), style: { cursor: 'pointer' } })}
      columns={columns}
    />
  );
}
