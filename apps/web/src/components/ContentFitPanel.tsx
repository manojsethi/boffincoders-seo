'use client';

import { useQuery } from '@tanstack/react-query';
import { Tag, Tooltip } from 'antd';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { api } from '../lib/api';
import { SectionCard } from './SectionCard';
import { StatusPill } from './StatusPill';
import { TermLabel } from './TermLabel';
import { AiAssistButton } from './AiAssistButton';
import { CreateBriefButton } from './CreateBriefButton';

type Analysis = {
  pageId: string;
  url?: string;
  pageRole: string | null;
  purpose: { summary: string; ctaIntent: string; confidence: number };
  keywordFits: Array<{
    id: string;
    keyword: string;
    intent: string;
    verdict: string;
    confidence: number;
    rootCauseSummary: string;
    impressions: number;
    clicks: number;
    position: number;
    rankingUrl?: string;
    recommendedActions: string[];
  }>;
  missingSections: string[];
  trustProof: { hasAuthor: boolean; hasTestimonial: boolean; hasCaseStudy: boolean; notes: string[] };
  cta: { detected: boolean; clarity: string; notes: string[] };
  internalLinks: { incoming: number; outgoing: number; weak: boolean };
  schema: { types: string[]; status: string };
  contentDepth: { wordCount: number; verdict: string };
  activeIssues: Array<{ id: string; title: string; severity: string; ruleId: string }>;
  recommendations: Array<{ id: string; title: string; status: string; priorityScore: number }>;
  verdict: string;
  reasoning: string[];
  dataGaps: string[];
};

export function ContentFitPanel({
  projectId,
  pageId,
}: {
  projectId: string;
  pageId: string;
}): JSX.Element {
  const { data, isLoading, error } = useQuery<Analysis>({
    queryKey: ['content-analysis', projectId, pageId],
    queryFn: () => api(`/projects/${projectId}/pages/${pageId}/content-analysis`),
  });

  if (isLoading) {
    return (
      <SectionCard title="Content fit" description="Computing…">
        <div className="text-xs text-text-subtle">Loading content analysis…</div>
      </SectionCard>
    );
  }
  if (error || !data) {
    return (
      <SectionCard title="Content fit">
        <div className="text-xs text-rose-400">Failed to load: {(error as Error)?.message ?? 'unknown'}</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <TermLabel term="page-fit">Content fit</TermLabel>
          <StatusPill value={data.verdict} kind="state" />
        </span>
      }
      description={data.purpose.summary}
      actions={
        <div className="flex items-center gap-1">
          <AiAssistButton
            projectId={projectId}
            taskKey="suggest-missing-sections"
            label="Suggest sections"
            sourceIds={{ pageId }}
            buildParams={() => ({
              role: data.pageRole ?? undefined,
              title: data.purpose.summary,
              h1: data.purpose.summary,
              targetKeywords: data.keywordFits.map((k) => k.keyword),
              existingHeadings: [],
              markdown: data.purpose.summary,
            })}
            renderResult={(out) => {
              const o = out as { sections: Array<{ name: string; why: string }> };
              return (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {o.sections.map((s, i) => (
                    <li key={i}>
                      <strong className="text-text">{s.name}</strong> — {s.why}
                    </li>
                  ))}
                </ul>
              );
            }}
          />
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {data.dataGaps.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <Info size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Data gaps</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {data.dataGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {data.reasoning.length > 0 && (
          <Section title="Why this verdict">
            <ul className="list-disc pl-5 space-y-0.5 text-text">
              {data.reasoning.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        {data.keywordFits.length > 0 ? (
          <Section title="Mapped keywords">
            <div className="space-y-2">
              {data.keywordFits.map((k) => (
                <div key={k.id} className="rounded border border-border bg-surface-2 p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-text">{k.keyword}</span>
                    <Tag className="m-0">{k.intent}</Tag>
                    <StatusPill value={k.verdict} kind="state" />
                    <span className="text-[10px] text-text-subtle">
                      {Math.round(k.confidence * 100)}% confidence
                    </span>
                    <span className="ml-auto">
                      <CreateBriefButton
                        projectId={projectId}
                        keywordId={k.id}
                        pageId={pageId}
                        keywordIsMapped
                        label="Brief"
                      />
                    </span>
                  </div>
                  {k.rootCauseSummary && (
                    <div className="text-text-muted mb-1">{k.rootCauseSummary}</div>
                  )}
                  <div className="text-[11px] text-text-subtle tabular-nums">
                    impressions {k.impressions.toLocaleString()} · clicks {k.clicks} · position{' '}
                    {k.position ? k.position.toFixed(1) : '—'}
                    {k.rankingUrl ? ` · ranking ${tryPath(k.rankingUrl)}` : ''}
                  </div>
                  {k.recommendedActions.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 text-text-muted">
                      {k.recommendedActions.slice(0, 3).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Mapped keywords">
            <div className="text-xs text-text-subtle">
              No keywords mapped to this page yet. Open Keywords and map a target.
            </div>
          </Section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Missing sections">
            {data.missingSections.length === 0 ? (
              <SuccessLine>No structural gaps detected.</SuccessLine>
            ) : (
              <ul className="list-disc pl-5 space-y-0.5 text-text">
                {data.missingSections.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Trust + proof">
            <ul className="space-y-0.5">
              <li>
                Author byline:{' '}
                {data.trustProof.hasAuthor ? <Check /> : <Cross />}
              </li>
              <li>
                Testimonials / reviews:{' '}
                {data.trustProof.hasTestimonial ? <Check /> : <Cross />}
              </li>
              <li>
                Case studies / results:{' '}
                {data.trustProof.hasCaseStudy ? <Check /> : <Cross />}
              </li>
              {data.trustProof.notes.map((n, i) => (
                <li key={i} className="text-amber-300">
                  {n}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="CTA fit">
            <div>
              Clarity: <Tag className="m-0">{data.cta.clarity}</Tag>{' '}
              <span className="text-text-muted">
                {data.cta.detected ? 'CTA cues detected' : 'No CTA cues detected'}
              </span>
            </div>
            {data.cta.notes.length > 0 && (
              <ul className="list-disc pl-5 mt-1 text-amber-300">
                {data.cta.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Content depth">
            <div className="flex items-center gap-2">
              <Tag className="m-0">{data.contentDepth.verdict}</Tag>
              <span className="text-text-muted">
                ~{data.contentDepth.wordCount.toLocaleString()} words
              </span>
            </div>
          </Section>

          <Section title="Internal links">
            <div className="text-text-muted">
              in {data.internalLinks.incoming} · out {data.internalLinks.outgoing}{' '}
              {data.internalLinks.weak && (
                <Tooltip title="Important page with fewer than 3 incoming internal links.">
                  <span className="text-amber-300 inline-flex items-center gap-1">
                    <AlertTriangle size={12} /> weak
                  </span>
                </Tooltip>
              )}
            </div>
          </Section>

          <Section title="Schema">
            <div className="flex items-center gap-2">
              <Tag className="m-0">{data.schema.status}</Tag>
              <span className="text-text-muted text-[11px]">
                {data.schema.types.length === 0
                  ? 'No JSON-LD types detected'
                  : data.schema.types.join(', ')}
              </span>
            </div>
          </Section>
        </div>

        {data.recommendations.length > 0 && (
          <Section title="Recommendations on this page">
            <ul className="space-y-1">
              {data.recommendations.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-xs">
                  <StatusPill value={r.status} kind="state" />
                  <span className="text-text">{r.title}</span>
                  <span className="text-text-subtle tabular-nums">{r.priorityScore}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </SectionCard>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-subtle mb-1">{title}</div>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}
function Check(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
      <CheckCircle2 size={12} /> yes
    </span>
  );
}
function Cross(): JSX.Element {
  return <span className="text-rose-400 text-xs">no</span>;
}
function SuccessLine({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
      <CheckCircle2 size={12} /> {children}
    </span>
  );
}
function tryPath(u?: string): string {
  if (!u) return '—';
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}
