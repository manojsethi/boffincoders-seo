'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Button, Empty, Segmented, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { PageHeader } from '../../../../../components/PageHeader';
import { SectionCard } from '../../../../../components/SectionCard';
import { StatusPill } from '../../../../../components/StatusPill';
import { EmptyState } from '../../../../../components/EmptyState';
import { MarkdownBlock } from '../../../../../components/MarkdownBlock';

type ReportSection = { key: string; title: string; body: string };
type Report = {
  _id: string;
  type: string;
  status: string;
  view: 'client' | 'internal';
  periodStart?: string;
  periodEnd?: string;
  sourceCrawlRunIds?: string[];
  sourceAuditRunIds?: string[];
  sections?: ReportSection[];
  markdown?: string;
  executiveSummary?: string;
  approvedAt?: string;
  error?: string;
};

const TYPE_LABEL: Record<string, string> = {
  'initial-audit': 'Initial audit report',
  'weekly-progress': 'Weekly progress report',
  'monthly-progress': 'Monthly progress report',
  verification: 'Verification report',
  internal: 'Internal note',
};

const INTERNAL_KEYS = new Set(['internal-notes', 'data-gaps', 'rule-coverage']);

export default function ReportDetail({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}): JSX.Element {
  const { id, reportId } = use(params);
  const [scope, setScope] = useState<'all' | 'client'>('all');

  const { data, isLoading, error } = useQuery<Report>({
    queryKey: ['report', id, reportId],
    queryFn: () => api<Report>(`/projects/${id}/reports/${reportId}`),
    refetchInterval: (q) => (q.state.data?.status === 'draft' ? 3_000 : false),
  });

  if (isLoading) {
    return (
      <SectionCard>
        <Skeleton active />
      </SectionCard>
    );
  }
  if (error || !data) {
    return (
      <SectionCard>
        <EmptyState
          title="Failed to load report"
          description={(error as Error | null)?.message ?? 'Unknown error'}
        />
      </SectionCard>
    );
  }

  const sections = data.sections ?? [];
  const visibleSections =
    scope === 'client' ? sections.filter((s) => !INTERNAL_KEYS.has(s.key)) : sections;

  return (
    <>
      <div className="mb-3">
        <Link
          href={`/projects/${id}/reports`}
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft size={12} /> All reports
        </Link>
      </div>
      <PageHeader
        eyebrow="Report"
        title={TYPE_LABEL[data.type] ?? data.type}
        subtitle={data.executiveSummary}
        meta={
          <>
            <StatusPill value={data.status} kind="state" />
            <StatusPill value={data.view} kind="state" />
            {data.periodStart && data.periodEnd && (
              <span className="text-xs text-text-muted">
                Period: {new Date(data.periodStart).toLocaleDateString()} →{' '}
                {new Date(data.periodEnd).toLocaleDateString()}
              </span>
            )}
            {data.approvedAt && (
              <span className="text-xs text-emerald-500">
                Approved {new Date(data.approvedAt).toLocaleDateString()}
              </span>
            )}
          </>
        }
        actions={
          <Segmented
            size="small"
            value={scope}
            onChange={(v) => setScope(v as 'all' | 'client')}
            options={[
              { label: 'Internal view', value: 'all' },
              { label: 'Client-only', value: 'client' },
            ]}
          />
        }
      />

      {data.status === 'draft' && (
        <SectionCard className="mb-4">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Skeleton.Avatar size={14} active />
            Report is generating… this page will refresh automatically.
          </div>
        </SectionCard>
      )}

      {data.error && (
        <SectionCard className="mb-4">
          <div className="text-sm text-rose-500">
            <strong>Report failed:</strong> {data.error}
          </div>
        </SectionCard>
      )}

      {visibleSections.length === 0 ? (
        <SectionCard>
          <Empty
            description={
              data.status === 'draft'
                ? 'Report not yet rendered.'
                : 'No sections in this report.'
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {visibleSections.map((s) => (
            <SectionCard key={s.key}>
              <h2 className="text-base font-semibold text-text mb-3">{s.title}</h2>
              {s.body ? (
                <MarkdownBlock body={s.body} />
              ) : (
                <div className="text-xs text-text-subtle">No data for this section.</div>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-text-subtle">
          {sections.length - visibleSections.length > 0
            ? `${sections.length - visibleSections.length} internal-only sections hidden in client view.`
            : ''}
        </span>
        <Button
          size="small"
          onClick={() => window.print()}
          title="Print or save to PDF from the browser dialog"
        >
          Print view
        </Button>
      </div>
    </>
  );
}
