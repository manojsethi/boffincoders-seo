'use client';

import { App, Button, DatePicker, Drawer, Select, Skeleton, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusPill } from './StatusPill';
import { InfoIcon } from './InfoIcon';
import { TermLabel } from './TermLabel';
import { EmptyState } from './EmptyState';
import { useIssueDetail } from '../hooks/useIssues';
import { RecommendationCard } from './RecommendationCard';
import { AddToFixPlanButton } from './AddToFixPlanButton';

const LIFECYCLE_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Planned', value: 'planned' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Fixed pending verification', value: 'fixed-pending-verification' },
  { label: 'Verified', value: 'verified' },
  { label: 'Ignored', value: 'ignored' },
  { label: 'Not applicable', value: 'not-applicable' },
  { label: 'Blocked by data gap', value: 'blocked-by-data-gap' },
];

const OWNER_OPTIONS = [
  { label: 'Analyst', value: 'analyst' },
  { label: 'SEO', value: 'seo' },
  { label: 'Content', value: 'content' },
  { label: 'Developer', value: 'developer' },
  { label: 'Client', value: 'client' },
];

export function IssueDrawer({
  projectId,
  issueId,
  open,
  onClose,
}: {
  projectId: string;
  issueId: string | null;
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data, isLoading, error } = useIssueDetail(projectId, issueId);

  const updateIssue = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api(`/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      message.success('Issue updated');
      void qc.invalidateQueries({ queryKey: ['issues', projectId] });
      void qc.invalidateQueries({ queryKey: ['issue-detail', projectId, issueId] });
      void qc.invalidateQueries({ queryKey: ['project-overview', projectId] });
      void qc.invalidateQueries({ queryKey: ['pages', projectId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 80 : 720)}
      destroyOnHidden
      title={
        <span className="text-sm font-semibold">
          Issue detail
          <span className="ml-2 text-text-subtle text-xs font-normal">{data?.issue.ruleId}</span>
        </span>
      }
    >
      {isLoading ? (
        <Skeleton active />
      ) : error || !data ? (
        <EmptyState title="Failed to load issue" description={(error as Error | null)?.message ?? 'Unknown error'} />
      ) : (
        <div className="space-y-5 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusPill value={data.issue.severity} kind="severity" />
              <StatusPill value={data.issue.lifecycleStatus} kind="state" />
              <Tag className="m-0">{data.issue.actionPriority}</Tag>
              <Tag className="m-0">{data.issue.category}</Tag>
              {data.issue.layer ? <Tag className="m-0">{data.issue.layer}</Tag> : null}
            </div>
            <h2 className="text-lg font-semibold text-text leading-tight">{data.issue.title}</h2>
            {data.page ? (
              <p className="text-xs text-text-muted mt-1 font-mono break-all">
                <Link
                  href={`/projects/${projectId}/pages/${data.page.id}`}
                  className="hover:text-accent-hover hover:underline"
                >
                  {data.page.url}
                </Link>
              </p>
            ) : data.issue.affectedUrls.length > 0 ? (
              <p className="text-xs text-text-muted mt-1">
                Affects <strong>{data.issue.affectedPageCount || data.issue.affectedUrls.length}</strong>{' '}
                URLs.
              </p>
            ) : (
              <p className="text-xs text-text-muted mt-1">Site-level issue.</p>
            )}
          </div>

          {data.templateContext?.inGroup ? (
            <div
              className={`rounded border px-3 py-2 text-xs ${
                data.templateContext.likelyTemplateLevel
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-border bg-surface-2 text-text-muted'
              }`}
            >
              <div className="font-medium text-text mb-1">
                Template context · {data.templateContext.groupName}
              </div>
              <div>
                Detected in <strong>{data.templateContext.sampledAffected}</strong> of{' '}
                <strong>{data.templateContext.sampledCount}</strong> sampled pages.{' '}
                {data.templateContext.discoveredCount > data.templateContext.sampledCount ? (
                  <>
                    Group has <strong>{data.templateContext.discoveredCount}</strong> discovered
                    URLs total — only sampled pages are verified.
                  </>
                ) : null}
              </div>
              <div className="mt-1">{data.templateContext.recommendation}</div>
            </div>
          ) : null}

          {data.page?.urlGroupName && data.page.crawlScopeDecision !== 'crawl' ? (
            <div className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
              <span className="text-text-subtle">Scope:</span>{' '}
              <Tag className="m-0">{data.page.crawlScopeDecision.replace('_', ' ')}</Tag>{' '}
              {data.page.sampleReason ? <span>· {data.page.sampleReason}</span> : null}
            </div>
          ) : null}

          {issueId ? <RecommendationCard projectId={projectId} issueId={issueId} /> : null}

          <Section title="Evidence" term="evidence">
            {data.currentFinding ? (
              <>
                <KV label="Observed">{data.currentFinding.observed || '—'}</KV>
                <KV label="Source">
                  {(data.currentFinding.evidenceSources ?? []).join(', ') || '—'}
                </KV>
                {Object.keys(data.currentFinding.evidence ?? {}).length > 0 ? (
                  <pre className="text-[11px] bg-surface-muted rounded-md p-2 overflow-auto text-text-muted max-h-48">
                    {JSON.stringify(data.currentFinding.evidence, null, 2)}
                  </pre>
                ) : null}
              </>
            ) : (
              <p className="text-text-muted text-xs">No current finding attached.</p>
            )}
          </Section>

          {data.currentFinding ? (
            <>
              <Section title="Why it matters">
                <p className="text-text">{data.currentFinding.whyItMatters || '—'}</p>
              </Section>
              <Section title="How to fix">
                <p className="text-text whitespace-pre-wrap">
                  {data.currentFinding.recommendation || '—'}
                </p>
                {data.currentFinding.howToFix ? (
                  <p className="text-text-muted text-xs mt-2 whitespace-pre-wrap">
                    {data.currentFinding.howToFix}
                  </p>
                ) : null}
              </Section>
              {data.currentFinding.validationMethod ? (
                <Section title="Validation method">
                  <p className="text-text-muted text-xs whitespace-pre-wrap">
                    {data.currentFinding.validationMethod}
                  </p>
                </Section>
              ) : null}
            </>
          ) : null}

          <Section title="Priority + impact">
            <div className="grid grid-cols-2 gap-3">
              <Stat term="priority" label="Priority" value={String(data.issue.priority)} />
              <Stat term="action-priority" label="Action priority" value={data.issue.actionPriority} />
              <Stat term="impact" label="Impact" value={String(data.issue.impact)} />
              <Stat term="effort" label="Effort" value={data.issue.effort} />
              <Stat
                term="confidence"
                label="Confidence"
                value={data.issue.confidenceLevel ?? String(data.issue.confidence)}
              />
              <Stat label="Owner" value={data.issue.ownerType} />
            </div>
          </Section>

          <Section title="Controls">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Status
                <Select
                  size="small"
                  style={{ minWidth: 180 }}
                  value={data.issue.lifecycleStatus}
                  options={LIFECYCLE_OPTIONS}
                  loading={updateIssue.isPending}
                  onChange={(v) => updateIssue.mutate({ lifecycleStatus: v })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Owner
                <Select
                  size="small"
                  style={{ minWidth: 140 }}
                  value={data.issue.ownerType}
                  options={OWNER_OPTIONS}
                  loading={updateIssue.isPending}
                  onChange={(v) => updateIssue.mutate({ ownerType: v })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Due date
                <DatePicker
                  size="small"
                  value={data.issue.dueDate ? dayjs(data.issue.dueDate) : null}
                  disabled={updateIssue.isPending}
                  onChange={(d: Dayjs | null) =>
                    updateIssue.mutate({ dueDate: d ? d.toISOString() : null })
                  }
                  allowClear
                />
              </label>
            </div>
          </Section>

          {data.issue.affectedUrls.length > 1 ? (
            <Section title={`Affected URLs (${data.issue.affectedUrls.length})`} term="group-key">
              <ul className="space-y-1 max-h-48 overflow-auto text-xs font-mono">
                {data.issue.affectedUrls.slice(0, 100).map((u, idx) => (
                  <li key={`${idx}:${u}`} className="text-text-muted break-all">
                    {u}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.relatedIssues.length > 0 ? (
            <Section title="Related issues (same group)">
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.relatedIssues.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <StatusPill value={r.severity} kind="severity" />
                      <span className="truncate">{r.title}</span>
                    </span>
                    {r.pageId ? (
                      <Link
                        href={`/projects/${projectId}/pages/${r.pageId}`}
                        className="text-accent-hover hover:underline shrink-0"
                      >
                        Open page
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="History">
            {data.history.length === 0 ? (
              <p className="text-xs text-text-muted">No history yet.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-text-muted">
                    <span>
                      <span className="font-mono mr-2">{h.ruleVersion}</span>
                      {h.status}
                    </span>
                    <span>{h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="pt-2 border-t border-border flex justify-between items-center">
            {issueId ? (
              <AddToFixPlanButton projectId={projectId} sourceType="issue" sourceId={issueId} />
            ) : (
              <span />
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Section({
  title,
  term,
  children,
}: {
  title: string;
  term?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-text-subtle inline-flex items-center gap-1">
        {term ? <TermLabel term={term}>{title}</TermLabel> : title}
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-24 shrink-0 text-text-subtle">{label}</span>
      <span className="flex-1 text-text break-all">{children}</span>
    </div>
  );
}

function Stat({ label, value, term }: { label: string; value: string; term?: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[11px] uppercase tracking-wider text-text-subtle inline-flex items-center gap-1">
        {term ? <TermLabel term={term}>{label}</TermLabel> : label}
      </div>
      <div className="text-sm text-text font-medium tabular-nums mt-1">{value}</div>
    </div>
  );
}
