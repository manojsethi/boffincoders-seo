'use client';

import { use, useEffect, useRef, useState } from 'react';
import { App, Button, Select, Skeleton, Switch, Tabs, Tag, Tooltip } from 'antd';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { PageHeader } from '../../../../../components/PageHeader';
import { SectionCard } from '../../../../../components/SectionCard';
import { StatusPill } from '../../../../../components/StatusPill';
import { EmptyState } from '../../../../../components/EmptyState';
import { TermLabel } from '../../../../../components/TermLabel';
import { InfoIcon } from '../../../../../components/InfoIcon';
import { IssueDrawer } from '../../../../../components/IssueDrawer';

type PageDetail = {
  page: {
    id: string;
    url: string;
    normalizedUrl: string;
    statusCode?: number;
    indexability?: string;
    title?: string;
    h1?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    pageRole: string;
    pageSubtype?: string;
    roleConfidence: number;
    roleConfidenceLevel?: 'high' | 'medium' | 'low' | null;
    roleSource: 'analyst' | 'ai' | 'heuristic';
    isImportant?: boolean;
    isIntentionallyNonIndexable?: boolean;
    headings: Array<{ level: number; text: string }>;
    schema: Array<Record<string, unknown>>;
    schemaSource?: 'raw-html' | 'rendered-html' | 'both' | 'none' | 'not-verified';
    schemaTypes?: string[];
    rawSchema?: Array<Record<string, unknown>>;
    renderedSchema?: Array<Record<string, unknown>>;
    schemaParseErrors?: string[];
    renderedExtractedAt?: string | null;
    renderedRecrawlReason?: string | null;
    images: Array<{ src: string; alt?: string }>;
    internalLinksOut: string[];
    internalLinksIn: number;
    lastCrawledAt?: string;
    issueCounts: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
  };
  content?: { markdown?: string; cleanText?: string; tokenEstimate?: number } | null;
  findings: Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    status: string;
    severity: string;
    category: string;
    layer?: string;
    title: string;
    observed: string;
    whyItMatters: string;
    recommendation: string;
    howToFix: string;
    evidence: Record<string, unknown>;
    evidenceSources: string[];
    confidence: number;
    confidenceLevel?: string;
    impactScore: number;
    effortEstimate: string;
    priority: string;
    groupKey?: string;
    notApplicableReason?: string;
    notVerifiedReason?: string;
    createdAt: string | null;
  }>;
  issues: Array<{
    id: string;
    ruleId: string;
    title: string;
    severity: string;
    lifecycleStatus: string;
    priority: number;
    actionPriority: string;
    category: string;
    layer?: string;
    groupKey: string | null;
  }>;
};

export default function PageDetailScreen({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}): JSX.Element {
  const { id, pageId } = use(params);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { data, isLoading, error } = useQuery<PageDetail>({
    queryKey: ['page-detail', id, pageId],
    queryFn: () => api<PageDetail>(`/projects/${id}/pages/${pageId}`),
  });

  const [drawerIssueId, setDrawerIssueId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const inferRole = useMutation({
    mutationFn: () =>
      api<{ pageRole: string; roleConfidence: number; roleConfidenceLevel: string }>(
        `/projects/${id}/pages/${pageId}/infer-role`,
        { method: 'POST' },
      ),
    onSuccess: (r) => {
      message.success(`Role re-inferred: ${r.pageRole}`);
      void qc.invalidateQueries({ queryKey: ['page-detail', id, pageId] });
      void qc.invalidateQueries({ queryKey: ['pages', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const setRole = useMutation({
    mutationFn: (pageRole: string) =>
      api<{ ok: boolean; pageRole: string }>(`/projects/${id}/pages/${pageId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ pageRole }),
      }),
    onSuccess: (r) => {
      message.success(`Role set to ${r.pageRole}`);
      void qc.invalidateQueries({ queryKey: ['page-detail', id, pageId] });
      void qc.invalidateQueries({ queryKey: ['pages', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const setFlag = useMutation({
    mutationFn: (patch: { isImportant?: boolean; isIntentionallyNonIndexable?: boolean }) =>
      api(`/projects/${id}/pages/${pageId}/flags`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['page-detail', id, pageId] });
      void qc.invalidateQueries({ queryKey: ['pages', id] });
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
          title="Failed to load page"
          description={(error as Error | null)?.message ?? 'Unknown error'}
        />
      </SectionCard>
    );
  }

  const p = data.page;
  const ACTIVE = new Set(['open', 'planned', 'in-progress', 'fixed-pending-verification']);
  const openIssues = data.issues.filter((i) => ACTIVE.has(i.lifecycleStatus));
  const inactiveIssues = data.issues.filter((i) => !ACTIVE.has(i.lifecycleStatus));

  return (
    <>
      <PageHeader
        eyebrow="Page"
        title={
          <span className="font-mono text-base font-medium tracking-tight break-all">
            {shortUrl(p.url)}
          </span>
        }
        subtitle={p.url}
        meta={
          <>
            <StatusPill value={p.pageRole} kind="state" showDot={false} />
            <StatusPill
              value={p.statusCode === 200 ? 'completed' : 'failed'}
              kind="state"
            />
            <span className="text-xs text-text-muted">
              HTTP {p.statusCode ?? '—'} · {p.indexability ?? '—'}
            </span>
            {p.roleConfidenceLevel === 'low' ? (
              <Tooltip title="Role confidence is low. Use 'Infer role' or override.">
                <Tag className="m-0">low role conf</Tag>
              </Tooltip>
            ) : null}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Select
              size="small"
              value={p.pageRole}
              style={{ minWidth: 170 }}
              loading={setRole.isPending}
              onChange={(v) => setRole.mutate(v)}
              options={[
                'home',
                'navigation-hub',
                'content-article',
                'product',
                'collection',
                'documentation',
                'pricing',
                'about',
                'contact',
                'legal',
                'utility',
                'service',
                'category',
                'unknown',
              ].map((r) => ({ label: r, value: r }))}
            />
            <Tooltip title="Re-run heuristic role inference for this page">
              <Button
                size="small"
                icon={<Sparkles size={13} />}
                loading={inferRole.isPending}
                onClick={() => inferRole.mutate()}
              >
                Infer role
              </Button>
            </Tooltip>
            {p.roleSource === 'analyst' ? (
              <Tag className="m-0">analyst override</Tag>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label={<TermLabel term="issues">Open issues</TermLabel>} value={p.issueCounts.total} />
        <Stat
          label={<TermLabel term="severity">Critical / high</TermLabel>}
          value={p.issueCounts.critical + p.issueCounts.high}
          tone={p.issueCounts.critical + p.issueCounts.high > 0 ? 'danger' : 'neutral'}
        />
        <Stat label={<TermLabel term="links-in">Links in</TermLabel>} value={p.internalLinksIn} />
        <Stat
          label={<TermLabel term="schema">Schema types</TermLabel>}
          value={
            (p.schemaTypes && p.schemaTypes.length > 0
              ? p.schemaTypes.length
              : (p.rawSchema?.length ?? 0) + (p.renderedSchema?.length ?? 0)) || 0
          }
        />
      </div>

      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 text-text-muted">
            <Switch
              size="small"
              checked={!!p.isImportant}
              loading={setFlag.isPending}
              onChange={(v) => setFlag.mutate({ isImportant: v })}
            />
            Mark page as <strong className="text-text">important</strong>
            <InfoIcon term="priority" />
          </label>
          <label className="flex items-center gap-2 text-text-muted">
            <Switch
              size="small"
              checked={!!p.isIntentionallyNonIndexable}
              loading={setFlag.isPending}
              onChange={(v) => setFlag.mutate({ isIntentionallyNonIndexable: v })}
            />
            Intentionally <strong className="text-text">non-indexable</strong>
            <InfoIcon term="noindex" />
          </label>
        </div>
      </SectionCard>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: <OverviewTab data={data} />,
          },
          {
            key: 'issues',
            label: `Issues (${openIssues.length})`,
            children: (
              <IssuesTab
                projectId={id}
                pageId={pageId}
                issues={openIssues}
                inactiveIssues={inactiveIssues}
                onOpen={(issueId) => setDrawerIssueId(issueId)}
              />
            ),
          },
          { key: 'content', label: 'Content', children: <ContentTab data={data} /> },
          { key: 'links', label: 'Links', children: <LinksTab data={data} /> },
          {
            key: 'schema',
            label: 'Schema',
            children: <SchemaTab data={data} projectId={id} pageId={pageId} />,
          },
          {
            key: 'keywords',
            label: 'Keywords',
            children: <ConnectGSCEmpty term="impressions" />,
          },
          {
            key: 'performance',
            label: 'Performance',
            children: <ConnectCWVEmpty />,
          },
          { key: 'history', label: 'History', children: <HistoryTab data={data} /> },
        ]}
      />

      <IssueDrawer
        projectId={id}
        issueId={drawerIssueId}
        open={!!drawerIssueId}
        onClose={() => setDrawerIssueId(null)}
      />
    </>
  );
}

function OverviewTab({ data }: { data: PageDetail }): JSX.Element {
  const p = data.page;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Title" className="lg:col-span-2">
          <p className="text-sm text-text">{p.title ?? '—'}</p>
        </SectionCard>
        <SectionCard title={<TermLabel term="canonical">Canonical</TermLabel>}>
          <p className="text-sm text-text break-all font-mono">{p.canonicalUrl ?? '—'}</p>
        </SectionCard>
      </div>
      <SectionCard title="Meta description">
        <p className="text-sm text-text-muted leading-relaxed">{p.metaDescription ?? '—'}</p>
      </SectionCard>
      <SectionCard title="H1">
        <p className="text-sm text-text">{p.h1 ?? '—'}</p>
      </SectionCard>
    </div>
  );
}

function IssuesTab({
  projectId,
  pageId,
  issues,
  inactiveIssues,
  onOpen,
}: {
  projectId: string;
  pageId: string;
  issues: PageDetail['issues'];
  inactiveIssues: PageDetail['issues'];
  onOpen: (id: string) => void;
}): JSX.Element {
  const renderList = (list: PageDetail['issues']): JSX.Element => (
    <ul className="divide-y divide-border">
      {list.map((i) => (
        <li
          key={i.id}
          className="px-4 py-3 hover:bg-surface-hover/40 transition-colors cursor-pointer"
          onClick={() => onOpen(i.id)}
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusPill value={i.severity} kind="severity" />
            <Tag className="m-0">{i.actionPriority}</Tag>
            <StatusPill value={i.lifecycleStatus} kind="state" />
            <Tag className="m-0">{i.category}</Tag>
          </div>
          <div className="text-sm text-text font-medium">{i.title}</div>
          <div className="text-xs text-text-subtle mt-0.5 font-mono">{i.ruleId}</div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Active issues (${issues.length})`}
        description="Open / planned / in-progress / fixed-pending-verification. Click to open the drawer."
        noPadding
      >
        {issues.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No active issues on this page"
              description="No audit rule produced an actionable issue. Re-run the audit after changes to verify."
            />
          </div>
        ) : (
          <>
            {renderList(issues)}
            <div className="px-4 py-3 border-t border-border">
              <Link
                href={`/projects/${projectId}/issues?pageId=${pageId}`}
                className="text-xs text-accent-hover hover:underline"
              >
                Open in issues table →
              </Link>
            </div>
          </>
        )}
      </SectionCard>

      {inactiveIssues.length > 0 ? (
        <SectionCard
          title={`Inactive / data gaps (${inactiveIssues.length})`}
          description="Issues that auto-resolved, were ignored / not applicable, or are blocked by a data gap (e.g. rendered schema verification not run)."
          noPadding
        >
          {renderList(inactiveIssues)}
        </SectionCard>
      ) : null}
    </div>
  );
}

function ContentTab({ data }: { data: PageDetail }): JSX.Element {
  const md = data.content?.markdown || data.content?.cleanText;
  return (
    <SectionCard
      title="Markdown content"
      description="Extracted by Crawl4AI or Turndown fallback."
    >
      {!md ? (
        <EmptyState
          title="No content extracted"
          description="Crawl4AI may have been unavailable. Run another crawl with Crawl4AI reachable."
        />
      ) : (
        <pre className="text-xs whitespace-pre-wrap max-h-[600px] overflow-auto font-mono text-text-muted">
          {md}
        </pre>
      )}
    </SectionCard>
  );
}

function LinksTab({ data }: { data: PageDetail }): JSX.Element {
  const out = data.page.internalLinksOut ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard
        title={<TermLabel term="links-in">Incoming links</TermLabel>}
        description="Internal pages linking to this URL (count)."
      >
        <div className="text-2xl font-semibold tabular-nums text-text">{data.page.internalLinksIn}</div>
        <p className="text-xs text-text-muted mt-2">
          To see the source pages, open the audit findings for orphan/coverage rules in the Issues tab.
        </p>
      </SectionCard>
      <SectionCard
        title={<TermLabel term="links-out">Outgoing links</TermLabel>}
        description={`${out.length} internal links from this page.`}
        noPadding
      >
        {out.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No internal links from this page"
              description="Dead-end pages are harder for search engines and users. Add contextual links to related pages."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-96 overflow-auto">
            {out.slice(0, 200).map((u) => (
              <li key={u} className="px-3 py-2 text-xs font-mono text-text-muted break-all">
                {u}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SchemaTab({
  data,
  projectId,
  pageId,
}: {
  data: PageDetail;
  projectId: string;
  pageId: string;
}): JSX.Element {
  const p = data.page;
  const source = p.schemaSource ?? 'not-verified';
  const raw = p.rawSchema ?? [];
  const rendered = p.renderedSchema ?? [];
  const types = p.schemaTypes ?? [];
  const parseErrors = p.schemaParseErrors ?? [];
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [renderRunId, setRenderRunId] = useState<string | null>(null);

  const startRender = useMutation({
    mutationFn: () =>
      api<{ renderRunId: string }>(`/projects/${projectId}/render-recrawl`, {
        method: 'POST',
        body: JSON.stringify({ pageIds: [pageId], reason: 'analyst-single-page' }),
      }),
    onSuccess: (r) => {
      setRenderRunId(r.renderRunId);
      message.info('Rendered recrawl queued for this page.');
    },
    onError: (err) => message.error((err as Error).message),
  });

  const runQuery = useQuery<{
    status: string;
    progressPercent: number;
    currentStep: string;
    successCount: number;
    failureCount: number;
    error?: string;
  }>({
    queryKey: ['render-run', projectId, renderRunId],
    queryFn: () => api(`/projects/${projectId}/render-runs/${renderRunId}`),
    enabled: !!renderRunId,
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | undefined)?.status;
      return s === 'completed' || s === 'failed' ? false : 2000;
    },
  });

  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    const run = runQuery.data;
    if (!run || !renderRunId) return;
    if ((run.status === 'completed' || run.status === 'failed') && lastNotified.current !== renderRunId) {
      lastNotified.current = renderRunId;
      if (run.status === 'completed') {
        message.success(`Rendered. ${run.successCount} ok / ${run.failureCount} failed.`);
      } else {
        message.error(`Render failed: ${run.error ?? 'unknown'}`);
      }
      void qc.invalidateQueries({ queryKey: ['page-detail', projectId, pageId] });
      void qc.invalidateQueries({ queryKey: ['pages', projectId] });
    }
  }, [runQuery.data, renderRunId, projectId, pageId, message, qc]);

  const renderBusy =
    startRender.isPending ||
    (runQuery.data && (runQuery.data.status === 'queued' || runQuery.data.status === 'running'));

  return (
    <div className="space-y-4">
      <SectionCard
        title={<TermLabel term="schema-source">Schema source</TermLabel>}
        description="Doc 11 §Raw Vs Rendered Evidence. Cheerio extracts JSON-LD from raw HTML; Playwright verifies after JS renders."
        actions={
          <Button
            type="primary"
            size="small"
            icon={<Sparkles size={12} />}
            loading={!!renderBusy}
            onClick={() => startRender.mutate()}
          >
            Render this page
          </Button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Source" value={source} />
          <Tile label="Raw blocks" value={String(raw.length)} />
          <Tile label="Rendered blocks" value={String(rendered.length)} />
          <Tile label="Parse errors" value={String(parseErrors.length)} />
        </div>
        {types.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {types.map((t) => (
              <Tag key={t} className="m-0">
                {t}
              </Tag>
            ))}
          </div>
        ) : null}
        {p.renderedExtractedAt ? (
          <p className="text-xs text-text-subtle mt-3">
            Rendered verification ran at {new Date(p.renderedExtractedAt).toLocaleString()}
            {p.renderedRecrawlReason ? ` · reason: ${p.renderedRecrawlReason}` : ''}.
          </p>
        ) : (
          <p className="text-xs text-text-subtle mt-3">
            Rendered verification has not run yet. Use the Pages table to bulk-render selected pages.
          </p>
        )}
        {parseErrors.length > 0 ? (
          <div className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-danger mb-1">
              Parse errors
            </div>
            <ul className="text-xs text-danger space-y-1">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Raw HTML JSON-LD"
          description={`Extracted by Cheerio from initial HTML. ${raw.length} block(s).`}
        >
          {raw.length === 0 ? (
            <EmptyState
              title="No raw JSON-LD"
              description="Cheerio did not find JSON-LD in the initial HTML. JavaScript-rendered schema requires Playwright."
            />
          ) : (
            <pre className="text-xs whitespace-pre-wrap max-h-[480px] overflow-auto font-mono text-text-muted bg-surface-muted rounded-md p-3">
              {JSON.stringify(raw, null, 2)}
            </pre>
          )}
        </SectionCard>
        <SectionCard
          title="Rendered HTML JSON-LD"
          description={`Extracted by headless Chromium after JavaScript executed. ${rendered.length} block(s).`}
        >
          {!p.renderedExtractedAt ? (
            <EmptyState
              title="Rendered verification not run"
              description="Trigger from the Pages table by selecting this page and clicking Render selected."
            />
          ) : rendered.length === 0 ? (
            <EmptyState
              title="No JSON-LD after render"
              description="Even after JavaScript executed, no JSON-LD <script> blocks were detected."
            />
          ) : (
            <pre className="text-xs whitespace-pre-wrap max-h-[480px] overflow-auto font-mono text-text-muted bg-surface-muted rounded-md p-3">
              {JSON.stringify(rendered, null, 2)}
            </pre>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="text-sm text-text font-medium tabular-nums mt-1">{value}</div>
    </div>
  );
}

function HistoryTab({ data }: { data: PageDetail }): JSX.Element {
  if (data.findings.length === 0) {
    return (
      <SectionCard>
        <EmptyState title="No history yet" description="Run an audit to populate per-page rule history." />
      </SectionCard>
    );
  }
  return (
    <SectionCard noPadding>
      <ul className="divide-y divide-border max-h-[600px] overflow-auto">
        {data.findings.map((f) => (
          <li key={f.id} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusPill value={f.severity} kind="severity" />
              <StatusPill value={f.status} kind="state" />
              <Tag className="m-0">{f.category}</Tag>
              <span className="text-xs text-text-subtle font-mono">{f.ruleId}</span>
              <span className="ml-auto text-xs text-text-subtle">
                {f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}
              </span>
            </div>
            <div className="text-sm text-text font-medium">{f.title}</div>
            {f.observed ? (
              <p className="text-xs text-text-muted mt-1">{f.observed}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ConnectGSCEmpty({ term }: { term: string }): JSX.Element {
  return (
    <SectionCard>
      <EmptyState
        title="Search Console is not connected"
        description="Connect Google Search Console to see queries, clicks, impressions, CTR, position, cannibalization, and quick wins for this page."
        icon={<InfoIcon term={term} />}
      />
    </SectionCard>
  );
}

function ConnectCWVEmpty(): JSX.Element {
  return (
    <SectionCard>
      <EmptyState
        title="Core Web Vitals not available"
        description="Enable PageSpeed Insights or wait for CrUX field data to populate LCP, INP, and CLS for this page."
        icon={<InfoIcon term="lcp" />}
      />
    </SectionCard>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'neutral' | 'danger' | 'warning';
}): JSX.Element {
  const toneClass =
    tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-text';
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || '/';
  } catch {
    return url;
  }
}
