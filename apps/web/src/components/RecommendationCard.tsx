'use client';

import { App, Button, Input, Modal, Select, Tag, Tooltip } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { StatusPill } from './StatusPill';
import { TermLabel } from './TermLabel';
import { AiAssistButton } from './AiAssistButton';
import { AddToFixPlanButton } from './AddToFixPlanButton';

type EvidenceSample = {
  issueId: string;
  url?: string | null;
  severity?: string | null;
  observation?: string | null;
};
type Evidence = {
  pages?: string[];
  findings?: string[];
  issues?: string[];
  observations?: string[];
  sample?: EvidenceSample[];
};

export type Recommendation = {
  id: string;
  type: string;
  status: string;
  verdict: string;
  title: string;
  rootCauseSummary: string;
  rootCause: string;
  recommendedAction: string;
  whyItMatters: string;
  validationMethod: string;
  evidence: Evidence;
  expectedImpact: string;
  effort: string;
  priorityScore: number;
  confidenceLevel: string;
  ownerType: string;
  reportVisibility: string;
  pageIds: string[];
  sourceIssueIds: string[];
  notes: string;
  rejectedReason: string | null;
  evidenceStaleReason: 'stale' | 'blocked' | null;
  evidenceStaleAt: string | null;
};

const STATUS_OPTIONS = [
  'draft',
  'proposed',
  'approved',
  'planned',
  'in_progress',
  'implemented',
  'verified',
  'rejected',
];
const OWNER_OPTIONS = ['seo', 'content', 'developer', 'client', 'analyst'];
const VISIBILITY_OPTIONS = ['internal', 'client', 'both', 'hidden'];

export function RecommendationCard({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}): JSX.Element {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations-for-issue', projectId, issueId],
    queryFn: () =>
      api<Recommendation[]>(
        `/projects/${projectId}/recommendations?issueId=${issueId}&limit=10`,
      ),
  });

  const rec = (data ?? []).find((r) => r.status !== 'rejected') ?? data?.[0] ?? null;
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['recommendations-for-issue', projectId, issueId] });
    void qc.invalidateQueries({ queryKey: ['recommendations', projectId] });
    void qc.invalidateQueries({ queryKey: ['recommendations-summary', projectId] });
  };

  const generate = useMutation({
    mutationFn: () =>
      api(`/projects/${projectId}/recommendations/regenerate`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Recommendations regenerated for this project.');
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/projects/${projectId}/recommendations/${rec!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(),
    onError: (err) => message.error((err as Error).message),
  });

  const approve = useMutation({
    mutationFn: () =>
      api(`/projects/${projectId}/recommendations/${rec!.id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Recommendation approved');
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  const reject = useMutation({
    mutationFn: (reason: string) =>
      api(`/projects/${projectId}/recommendations/${rec!.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      message.success('Recommendation rejected');
      invalidate();
    },
    onError: (err) => message.error((err as Error).message),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-subtle">
        Loading recommendation…
      </div>
    );
  }

  if (!rec) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-2 p-3">
        <div className="text-sm font-medium text-text mb-1">No recommendation yet</div>
        <p className="text-xs text-text-muted mb-2">
          No active recommendation is attached to this issue. Regenerate from rule + evidence.
        </p>
        <Button size="small" type="primary" loading={generate.isPending} onClick={() => generate.mutate()}>
          Generate
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/[0.04] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Tag color="purple" className="m-0 uppercase text-[10px]">
              Recommendation
            </Tag>
            <Tag className="m-0">{rec.type}</Tag>
            <StatusPill value={rec.status} kind="state" />
            <StatusPill value={rec.verdict} kind="state" />
          </div>
          <h3 className="text-base font-semibold text-text leading-tight">{rec.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <AiAssistButton
            projectId={projectId}
            taskKey="rewrite-recommendation"
            label="AI rewrite"
            sourceIds={{ recommendationId: rec.id }}
            buildParams={() => ({
              audience: 'analyst',
              title: rec.title,
              rootCauseSummary: rec.rootCauseSummary,
              recommendedAction: rec.recommendedAction,
              whyItMatters: rec.whyItMatters,
            })}
            renderResult={(out) => {
              const o = out as {
                title: string;
                rootCauseSummary: string;
                recommendedAction: string;
                whyItMatters: string;
              };
              return (
                <div className="space-y-2 text-sm">
                  <Field title="Title (suggested)">{o.title}</Field>
                  <Field title="Root cause summary (suggested)">{o.rootCauseSummary}</Field>
                  <Field title="Recommended action (suggested)">{o.recommendedAction}</Field>
                  <Field title="Why it matters (suggested)">{o.whyItMatters}</Field>
                </div>
              );
            }}
            onAccept={(out) => {
              const o = out as {
                title: string;
                rootCauseSummary: string;
                recommendedAction: string;
                whyItMatters: string;
              };
              update.mutate({
                title: o.title,
                rootCauseSummary: o.rootCauseSummary,
                recommendedAction: o.recommendedAction,
                whyItMatters: o.whyItMatters,
              });
            }}
          />
          <Tooltip title="Edit text">
            <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(true)} />
          </Tooltip>
        </div>
      </div>

      {rec.evidenceStaleReason ? (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              {rec.evidenceStaleReason === 'stale'
                ? 'Latest audit no longer surfaces the source issue.'
                : 'Latest audit evidence is not verified yet.'}
            </div>
            <div className="text-amber-300/80">
              Approved by an analyst, so the recommendation is kept. Re-verify before marking
              implemented.
              {rec.evidenceStaleAt
                ? ` Flagged ${new Date(rec.evidenceStaleAt).toLocaleString()}.`
                : ''}
            </div>
          </div>
        </div>
      ) : null}

      <Field title="Root cause summary">{rec.rootCauseSummary}</Field>
      {rec.rootCause && <Field title="Root cause">{rec.rootCause}</Field>}
      <Field title={<TermLabel term="recommendation-action">Recommended action</TermLabel>}>
        {rec.recommendedAction}
      </Field>
      <Field title="Why it matters">{rec.whyItMatters}</Field>
      <Field title={<TermLabel term="validation-method">Validation method</TermLabel>}>
        {rec.validationMethod}
      </Field>

      {rec.evidence?.observations && rec.evidence.observations.length > 0 && (
        <Field title="Observations">
          <ul className="list-disc pl-5 space-y-0.5 text-xs">
            {rec.evidence.observations.slice(0, 5).map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Field>
      )}

      {rec.evidence?.sample && rec.evidence.sample.length > 1 && (
        <Field title={`Affected sample (${rec.evidence.sample.length})`}>
          <ul className="text-[11px] font-mono text-text-muted space-y-0.5">
            {rec.evidence.sample.slice(0, 5).map((s, i) => (
              <li key={i}>{s.url}</li>
            ))}
          </ul>
        </Field>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label={<TermLabel term="priority">Priority</TermLabel>} value={String(rec.priorityScore)} />
        <Stat label="Impact" value={rec.expectedImpact} />
        <Stat label="Effort" value={rec.effort} />
        <Stat label="Confidence" value={rec.confidenceLevel} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Owner
          <Select
            size="small"
            value={rec.ownerType}
            options={OWNER_OPTIONS.map((o) => ({ value: o, label: o }))}
            style={{ minWidth: 120 }}
            onChange={(v) => update.mutate({ ownerType: v })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Status
          <Select
            size="small"
            value={rec.status}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 140 }}
            onChange={(v) => update.mutate({ status: v })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Report
          <Select
            size="small"
            value={rec.reportVisibility}
            options={VISIBILITY_OPTIONS.map((s) => ({ value: s, label: s }))}
            style={{ minWidth: 120 }}
            onChange={(v) => update.mutate({ reportVisibility: v })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
        <Button
          size="small"
          type="primary"
          icon={<Check size={14} />}
          disabled={rec.status === 'approved' || rec.status === 'verified'}
          loading={approve.isPending}
          onClick={() => approve.mutate()}
        >
          Approve
        </Button>
        <Button
          size="small"
          danger
          icon={<X size={14} />}
          disabled={rec.status === 'rejected'}
          loading={reject.isPending}
          onClick={() => {
            let reason = '';
            modal.confirm({
              title: 'Reject recommendation?',
              content: (
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    Reason (optional, helps the next analyst know why)
                  </p>
                  <Input.TextArea
                    rows={3}
                    placeholder="e.g. Out of scope, client decision, fixed manually"
                    onChange={(e) => {
                      reason = e.target.value;
                    }}
                  />
                </div>
              ),
              okType: 'danger',
              okText: 'Reject',
              onOk: () => reject.mutate(reason),
            });
          }}
        >
          Reject
        </Button>
        <Button
          size="small"
          loading={generate.isPending}
          onClick={() => generate.mutate()}
          title="Regenerate from latest issues + findings. Existing analyst edits + status are preserved."
        >
          Regenerate
        </Button>
        <AddToFixPlanButton
          projectId={projectId}
          sourceType="recommendation"
          sourceId={rec.id}
          label="Add to fix plan"
        />
        {rec.status === 'rejected' && rec.rejectedReason && (
          <span className="text-xs text-text-subtle">Reason: {rec.rejectedReason}</span>
        )}
      </div>

      <EditModal
        open={editing}
        rec={rec}
        onClose={() => setEditing(false)}
        onSave={(patch) => {
          update.mutate(patch);
          setEditing(false);
        }}
      />
    </div>
  );
}

function Field({ title, children }: { title: React.ReactNode; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-subtle mb-1">{title}</div>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded bg-surface-2 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="text-text text-sm">{value}</div>
    </div>
  );
}

function EditModal({
  open,
  rec,
  onClose,
  onSave,
}: {
  open: boolean;
  rec: Recommendation;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}): JSX.Element {
  const [title, setTitle] = useState(rec.title);
  const [rootCauseSummary, setRootCauseSummary] = useState(rec.rootCauseSummary);
  const [recommendedAction, setRecommendedAction] = useState(rec.recommendedAction);
  const [whyItMatters, setWhyItMatters] = useState(rec.whyItMatters);
  const [validationMethod, setValidationMethod] = useState(rec.validationMethod);

  return (
    <Modal
      open={open}
      title="Edit recommendation"
      onCancel={onClose}
      onOk={() =>
        onSave({ title, rootCauseSummary, recommendedAction, whyItMatters, validationMethod })
      }
      okText="Save"
      width={620}
    >
      <div className="space-y-3 text-sm mt-2">
        <Labeled label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Labeled>
        <Labeled label="Root cause summary">
          <Input.TextArea
            rows={2}
            value={rootCauseSummary}
            onChange={(e) => setRootCauseSummary(e.target.value)}
          />
        </Labeled>
        <Labeled label="Recommended action">
          <Input.TextArea
            rows={4}
            value={recommendedAction}
            onChange={(e) => setRecommendedAction(e.target.value)}
          />
        </Labeled>
        <Labeled label="Why it matters">
          <Input.TextArea
            rows={3}
            value={whyItMatters}
            onChange={(e) => setWhyItMatters(e.target.value)}
          />
        </Labeled>
        <Labeled label="Validation method">
          <Input.TextArea
            rows={3}
            value={validationMethod}
            onChange={(e) => setValidationMethod(e.target.value)}
          />
        </Labeled>
      </div>
    </Modal>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-subtle mb-1">{label}</div>
      {children}
    </div>
  );
}
