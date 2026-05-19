'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { App, Button, Dropdown, Modal, Select } from 'antd';
import type { MenuProps } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { StatusPill } from '../../../../components/StatusPill';
import { EmptyState } from '../../../../components/EmptyState';

type Report = {
  id: string;
  type: string;
  status: string;
  view: string;
  executiveSummary?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
};

type AuditRun = { id: string; status: string; completedAt?: string };
type CrawlRun = { id: string; status: string; completedAt?: string };

const REPORT_LABELS: Record<string, { label: string; desc: string }> = {
  'initial-audit': {
    label: 'Initial audit report',
    desc: 'Baseline SEO health from the latest crawl + audit. Use to kick off engagements.',
  },
  'weekly-progress': {
    label: 'Weekly progress report',
    desc: 'Operational view: new issues, fixes verified, traffic + keyword movement.',
  },
  'monthly-progress': {
    label: 'Monthly progress report',
    desc: 'Client-friendly review of goal progress, trend, wins, risks, next month plan.',
  },
  verification: {
    label: 'Verification report',
    desc: 'Before/after evidence after fixes — proves what shipped.',
  },
  internal: {
    label: 'Internal note',
    desc: 'Free-form internal report for analyst use.',
  },
};

export default function ReportsList({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [progressOpen, setProgressOpen] = useState<'weekly-progress' | 'monthly-progress' | null>(null);
  const [view, setView] = useState<'client' | 'internal'>('internal');

  const { data, isLoading } = useQuery<Report[]>({
    queryKey: ['reports', id],
    queryFn: () => api<Report[]>(`/projects/${id}/reports`),
    refetchInterval: (q) => {
      const inProgress = q.state.data?.some((r) => r.status === 'draft');
      return inProgress ? 3_000 : 30_000;
    },
  });

  const { data: audits = [] } = useQuery<AuditRun[]>({
    queryKey: ['audit-runs', id],
    queryFn: () => api<AuditRun[]>(`/projects/${id}/audit-runs?limit=5`),
  });
  const { data: crawls = [] } = useQuery<CrawlRun[]>({
    queryKey: ['crawl-runs', id],
    queryFn: () => api<CrawlRun[]>(`/projects/${id}/crawl-runs?limit=5`),
  });
  const latestAudit = audits.find((a) => a.status === 'completed');
  const latestCrawl = crawls.find((c) => c.status === 'completed');

  const generate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ reportId: string }>(`/projects/${id}/reports`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      message.success('Report generation started');
      setProgressOpen(null);
      void qc.invalidateQueries({ queryKey: ['reports', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const startInitial = (): void => {
    if (!latestAudit || !latestCrawl) {
      message.warning('Need a completed crawl + audit run before generating the initial report.');
      return;
    }
    generate.mutate({
      type: 'initial-audit',
      view,
      crawlRunId: latestCrawl.id,
      auditRunId: latestAudit.id,
    });
  };

  const startProgress = (kind: 'weekly-progress' | 'monthly-progress'): void => {
    const end = new Date();
    const start = new Date(end.getTime() - (kind === 'weekly-progress' ? 7 : 30) * 86400_000);
    generate.mutate({
      type: kind,
      view,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
  };

  const items: MenuProps['items'] = [
    {
      key: 'initial-audit',
      label: REPORT_LABELS['initial-audit'].label,
      onClick: startInitial,
    },
    {
      key: 'weekly-progress',
      label: REPORT_LABELS['weekly-progress'].label,
      onClick: () => setProgressOpen('weekly-progress'),
    },
    {
      key: 'monthly-progress',
      label: REPORT_LABELS['monthly-progress'].label,
      onClick: () => setProgressOpen('monthly-progress'),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Reports"
        subtitle="In-tool internal and client-ready deliverables. PDF export is deferred — these stay browser-readable."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={view}
              onChange={(v) => setView(v)}
              options={[
                { value: 'internal', label: 'Internal view' },
                { value: 'client', label: 'Client view' },
              ]}
              style={{ minWidth: 140 }}
            />
            <Dropdown menu={{ items }} trigger={['click']}>
              <Button type="primary" icon={<Plus size={14} />}>
                Generate report
              </Button>
            </Dropdown>
          </div>
        }
      />

      <SectionCard noPadding>
        {(data?.length ?? 0) === 0 && !isLoading ? (
          <div className="p-4">
            <EmptyState
              title="No reports yet"
              description="Generate an initial audit report once a crawl + audit have completed, or start a weekly/monthly progress report from the dropdown above."
              icon={<FileText size={18} />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data?.map((r) => {
              const meta = REPORT_LABELS[r.type] ?? { label: r.type, desc: '' };
              return (
                <li key={r.id} className="hover:bg-surface-hover/40 transition-colors">
                  <Link
                    href={`/projects/${id}/reports/${r.id}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted text-text-muted shrink-0">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text">{meta.label}</span>
                        <span className="text-xs text-text-subtle">{r.view} view</span>
                        {r.periodStart && r.periodEnd && (
                          <span className="text-xs text-text-subtle">
                            · {new Date(r.periodStart).toLocaleDateString()} → {new Date(r.periodEnd).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-muted line-clamp-2 leading-snug">
                        {r.executiveSummary?.slice(0, 220) ?? meta.desc}
                      </p>
                      <div className="text-xs text-text-subtle mt-1">
                        Created {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </div>
                    </div>
                    <StatusPill value={r.status} kind="state" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Modal
        open={!!progressOpen}
        title={progressOpen ? REPORT_LABELS[progressOpen].label : ''}
        onCancel={() => setProgressOpen(null)}
        onOk={() => progressOpen && startProgress(progressOpen)}
        okText="Generate"
        confirmLoading={generate.isPending}
      >
        <p className="text-sm text-text-muted">
          {progressOpen ? REPORT_LABELS[progressOpen].desc : ''}
        </p>
        <p className="text-xs text-text-subtle mt-3">
          Period: last {progressOpen === 'weekly-progress' ? '7' : '30'} days. We’ll bundle issue
          movement + GSC/GA4 deltas + opportunities into the report sections.
        </p>
      </Modal>
    </>
  );
}
