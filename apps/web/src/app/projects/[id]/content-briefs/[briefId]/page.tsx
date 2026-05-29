'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { App, Button, Input, Modal, Select, Skeleton, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { PageHeader } from '../../../../../components/PageHeader';
import { SectionCard } from '../../../../../components/SectionCard';
import { StatusPill } from '../../../../../components/StatusPill';
import { TermLabel } from '../../../../../components/TermLabel';
import { EmptyState } from '../../../../../components/EmptyState';
import { AddToFixPlanButton } from '../../../../../components/AddToFixPlanButton';

type Brief = {
  id: string;
  keywordId: string;
  pageId: string | null;
  version: number;
  title: string;
  objective: string;
  audience: string;
  searchIntent: string;
  funnelStage: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  currentPageSummary: string;
  pageGoal: string;
  titleSuggestions: string[];
  metaSuggestions: string[];
  h1Suggestion: string;
  recommendedOutline: Array<{ heading: string; level: number; points: string[] }>;
  requiredSections: Array<{ name: string; why: string }>;
  faqSuggestions: Array<{ question: string; answer: string }>;
  internalLinksToAdd: Array<{ targetUrl: string; anchorIdea: string; rationale: string }>;
  internalLinksFrom: Array<{ sourceUrl: string; anchorIdea: string; rationale: string }>;
  schemaSuggestions: string[];
  ctaRecommendation: string;
  trustProofNeeded: string[];
  whatToAvoid: string[];
  seoChecklist: string[];
  validationChecklist: string[];
  contentGaps: string[];
  dataGaps: string[];
  evidenceRefs: Array<{ kind: string; id: string; label: string }>;
  aiTaskRunIds: string[];
  status: string;
  rejectedReason: string | null;
  approvedAt: string | null;
  ownerType: string;
  notes: string;
  lastGeneratedAt: string | null;
};

const STATUSES = ['draft', 'analyst-review', 'approved', 'rejected', 'implemented'];

export default function BriefDetail({
  params,
}: {
  params: Promise<{ id: string; briefId: string }>;
}): JSX.Element {
  const { id, briefId } = use(params);
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<keyof Brief | null>(null);

  const { data, isLoading, error } = useQuery<Brief>({
    queryKey: ['content-brief', id, briefId],
    queryFn: () => api(`/projects/${id}/content-briefs/${briefId}`),
  });

  type AiRun = {
    id: string;
    taskKey: string;
    provider?: string;
    model?: string;
    status: string;
    schemaValidationStatus: string | null;
    confidence: number;
    confidenceLevel: string;
    costEstimateUsd: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    needsAnalystReview: boolean;
    acceptedBy?: string | null;
    acceptedAt?: string | null;
    error?: string;
    createdAt: string;
  };
  const aiIds = (data?.aiTaskRunIds ?? []).join(',');
  const { data: aiRuns = [] } = useQuery<AiRun[]>({
    queryKey: ['brief-ai-runs', id, briefId, aiIds],
    queryFn: () => api(`/projects/${id}/ai/runs?ids=${aiIds}&limit=50`),
    enabled: aiIds.length > 0,
  });

  const acceptRun = useMutation({
    mutationFn: (runId: string) =>
      api(`/projects/${id}/ai/runs/${runId}/accept`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Accepted');
      void qc.invalidateQueries({ queryKey: ['brief-ai-runs', id, briefId] });
    },
    onError: (err) => message.error((err as Error).message),
  });
  const rejectRun = useMutation({
    mutationFn: (runId: string) =>
      api(`/projects/${id}/ai/runs/${runId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'analyst dismissed' }),
      }),
    onSuccess: () => {
      message.info('Dismissed');
      void qc.invalidateQueries({ queryKey: ['brief-ai-runs', id, briefId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/projects/${id}/content-briefs/${briefId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-brief', id, briefId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      api(`/projects/${id}/content-briefs/${briefId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ useAI: true }),
      }),
    onSuccess: () => {
      message.success('Brief regenerated');
      void qc.invalidateQueries({ queryKey: ['content-brief', id, briefId] });
      void qc.invalidateQueries({ queryKey: ['brief-ai-runs', id, briefId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const rewrite = useMutation({
    mutationFn: (sectionKey: string) =>
      api<{ output?: { value: string }; status: string; error?: string }>(
        `/projects/${id}/content-briefs/${briefId}/rewrite-section`,
        {
          method: 'POST',
          body: JSON.stringify({ sectionKey, audience: 'analyst' }),
        },
      ),
    onSuccess: (r, sectionKey) => {
      if (r.status !== 'completed' || !r.output) {
        message.warning(`AI ${r.status}${r.error ? ': ' + r.error : ''}`);
        return;
      }
      modal.confirm({
        title: 'AI suggestion',
        content: (
          <div className="text-sm">
            <p className="text-xs text-amber-300 mb-2">Suggested — review before applying.</p>
            <p className="whitespace-pre-wrap">{r.output.value}</p>
          </div>
        ),
        okText: 'Accept + apply',
        onOk: () => update.mutate({ [sectionKey]: r.output!.value }),
      });
    },
    onError: (err) => message.error((err as Error).message),
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
          title="Failed to load brief"
          description={(error as Error | null)?.message ?? 'Unknown error'}
        />
      </SectionCard>
    );
  }

  const editable = data.status === 'draft' || data.status === 'analyst-review';

  return (
    <>
      <div className="mb-3">
        <Link
          href={`/projects/${id}/content-briefs`}
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft size={12} /> All briefs
        </Link>
      </div>

      <PageHeader
        eyebrow="Content brief"
        title={data.title}
        subtitle={data.objective}
        meta={
          <>
            <StatusPill value={data.status} kind="state" />
            <Tag className="m-0">{data.searchIntent}</Tag>
            <Tag className="m-0">{data.funnelStage}</Tag>
            <span className="text-xs text-text-muted">v{data.version}</span>
            {data.aiTaskRunIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <Sparkles size={12} /> AI assisted
              </span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Select
              size="middle"
              value={data.status}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => update.mutate({ status: v })}
              style={{ minWidth: 160 }}
            />
            <span className="text-[11px] text-text-subtle whitespace-nowrap">
              AI: Gemma 4 via OpenRouter
            </span>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => regenerate.mutate()}
              loading={regenerate.isPending}
              title="Regenerate from latest evidence. Analyst-edited text preserved once status >= analyst-review."
            >
              Regenerate
            </Button>
            <AddToFixPlanButton
              projectId={id}
              sourceType="content-brief"
              sourceId={briefId}
              size="middle"
            />
          </div>
        }
      />

      {data.dataGaps.length > 0 && (
        <SectionCard className="mb-4">
          <div className="flex items-start gap-2 text-xs text-amber-200">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Data gaps</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {data.dataGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Objective">
          <EditableText
            value={data.objective}
            editable={editable}
            onSave={(v) => update.mutate({ objective: v })}
            aiRewrite={() => rewrite.mutate('objective')}
          />
        </SectionCard>
        <SectionCard title="Audience">
          <EditableText
            value={data.audience}
            editable={editable}
            onSave={(v) => update.mutate({ audience: v })}
            aiRewrite={() => rewrite.mutate('audience')}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Title suggestions">
          {data.titleSuggestions.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {data.titleSuggestions.map((t, i) => (
                <li key={i} className="font-mono text-[12px]">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Meta description suggestions">
          {data.metaSuggestions.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {data.metaSuggestions.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="H1 suggestion" className="mb-4">
        <EditableText
          value={data.h1Suggestion}
          editable={editable}
          onSave={(v) => update.mutate({ h1Suggestion: v })}
          aiRewrite={() => rewrite.mutate('h1Suggestion')}
        />
      </SectionCard>

      <SectionCard title="Recommended outline" className="mb-4">
        {data.recommendedOutline.length === 0 ? (
          <p className="text-xs text-text-subtle">No outline yet. Regenerate with AI to populate.</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {data.recommendedOutline.map((h, i) => (
              <li key={i}>
                <div className={`font-semibold text-text ${h.level === 2 ? '' : 'pl-4'}`}>
                  H{h.level}. {h.heading}
                </div>
                {h.points.length > 0 && (
                  <ul className="list-disc pl-8 mt-1 text-text-muted text-xs">
                    {h.points.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Required sections">
          {data.requiredSections.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {data.requiredSections.map((s, i) => (
                <li key={i}>
                  <strong className="text-text">{s.name}</strong>{' '}
                  <span className="text-text-muted">— {s.why}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="FAQ ideas">
          {data.faqSuggestions.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.faqSuggestions.map((f, i) => (
                <li key={i}>
                  <div className="font-medium text-text">{f.question}</div>
                  <div className="text-text-muted text-xs">{f.answer}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Internal links to add (from this page)">
          {data.internalLinksToAdd.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.internalLinksToAdd.map((l, i) => (
                <li key={i}>
                  <span className="font-mono text-[12px] text-text">{l.targetUrl}</span>
                  {' — '}
                  <span className="text-text">{l.anchorIdea}</span>
                  <span className="text-text-muted text-xs"> · {l.rationale}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Internal links from other pages (incoming)">
          {data.internalLinksFrom.length === 0 ? (
            <p className="text-xs text-text-subtle">
              No incoming-link suggestions yet. Regenerate to surface candidate source pages from
              the crawl.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.internalLinksFrom.map((l, i) => (
                <li key={i}>
                  <span className="font-mono text-[12px] text-text">{l.sourceUrl}</span>
                  {' — '}
                  <span className="text-text">{l.anchorIdea}</span>
                  <span className="text-text-muted text-xs"> · {l.rationale}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Schema suggestions">
          {data.schemaSuggestions.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {data.schemaSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="CTA recommendation">
          <EditableText
            value={data.ctaRecommendation}
            editable={editable}
            onSave={(v) => update.mutate({ ctaRecommendation: v })}
            aiRewrite={() => rewrite.mutate('ctaRecommendation')}
          />
        </SectionCard>
        <SectionCard title="Trust + proof needed">
          {data.trustProofNeeded.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {data.trustProofNeeded.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="SEO checklist">
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {data.seoChecklist.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Validation checklist">
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {data.validationChecklist.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {aiRuns.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" /> AI runs that contributed
            </span>
          }
          className="mb-4"
        >
          <ul className="divide-y divide-border text-sm">
            {aiRuns.map((r) => (
              <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Tag className="m-0">{r.taskKey}</Tag>
                  <StatusPill value={r.status} kind="state" />
                  <StatusPill
                    value={r.schemaValidationStatus ?? 'unknown'}
                    kind="state"
                  />
                  {r.acceptedBy === 'analyst' ? (
                    <Tag color="success" className="m-0">accepted</Tag>
                  ) : r.needsAnalystReview ? (
                    <Tag color="warning" className="m-0">needs review</Tag>
                  ) : null}
                </div>
                <div className="text-[11px] text-text-muted tabular-nums flex flex-wrap gap-3">
                  <span>
                    provider <span className="text-text">{r.provider ?? '—'}</span>
                  </span>
                  <span>
                    model <span className="text-text">{r.model ?? '—'}</span>
                  </span>
                  <span>
                    confidence{' '}
                    <span className="text-text">
                      {Math.round(r.confidence * 100)}% ({r.confidenceLevel})
                    </span>
                  </span>
                  <span>
                    cost{' '}
                    <span className="text-text">${r.costEstimateUsd.toFixed(4)}</span>
                  </span>
                  {r.inputTokens || r.outputTokens ? (
                    <span>
                      tokens{' '}
                      <span className="text-text">
                        {r.inputTokens ?? '?'}/{r.outputTokens ?? '?'}
                      </span>
                    </span>
                  ) : null}
                  {r.durationMs ? <span>{r.durationMs} ms</span> : null}
                  <span className="text-text-subtle">
                    {new Date(r.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {r.error ? (
                  <div className="text-xs text-rose-400 mt-1">{r.error}</div>
                ) : null}
                {r.needsAnalystReview && r.status === 'completed' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="small"
                      onClick={() => acceptRun.mutate(r.id)}
                      loading={acceptRun.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => rejectRun.mutate(r.id)}
                      loading={rejectRun.isPending}
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Evidence" className="mb-4">
        <ul className="text-xs space-y-1">
          {data.evidenceRefs.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              <Tag className="m-0">{e.kind}</Tag>
              <span className="text-text-muted">{e.label}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {data.whatToAvoid.length > 0 && (
        <SectionCard title="What to avoid" className="mb-4">
          <ul className="list-disc pl-5 text-sm space-y-0.5 text-rose-300">
            {data.whatToAvoid.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </SectionCard>
      )}

      <EditModal
        open={!!editing}
        field={editing as keyof Brief | null}
        initial={(editing ? (data[editing] as string) : '') ?? ''}
        onCancel={() => setEditing(null)}
        onSave={(v) => {
          if (editing) update.mutate({ [editing]: v });
          setEditing(null);
        }}
      />
    </>
  );
}

function EditableText({
  value,
  editable,
  onSave,
  aiRewrite,
}: {
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
  aiRewrite?: () => void;
}): JSX.Element {
  const [v, setV] = useState(value);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div>
        <p className="text-sm text-text whitespace-pre-wrap">{value || <span className="text-text-subtle">—</span>}</p>
        {editable ? (
          <div className="mt-2 flex items-center gap-2">
            <Button size="small" onClick={() => { setV(value); setEditing(true); }}>
              Edit
            </Button>
            {aiRewrite ? (
              <Button size="small" icon={<Sparkles size={12} />} onClick={aiRewrite}>
                AI rewrite
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Input.TextArea value={v} onChange={(e) => setV(e.target.value)} rows={4} />
      <div className="flex items-center gap-2">
        <Button size="small" type="primary" onClick={() => { onSave(v); setEditing(false); }}>
          Save
        </Button>
        <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function EditModal({
  open,
  field,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  field: keyof Brief | null;
  initial: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}): JSX.Element {
  const [v, setV] = useState(initial);
  return (
    <Modal open={open} title={`Edit ${field ?? ''}`} onCancel={onCancel} onOk={() => onSave(v)}>
      <Input.TextArea value={v} onChange={(e) => setV(e.target.value)} rows={6} />
    </Modal>
  );
}
