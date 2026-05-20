'use client';

import { use, useEffect, useState } from 'react';
import { App, Button, InputNumber, Select, Skeleton, Switch } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { MaintenanceCard } from '../../../../components/MaintenanceCard';
import { api } from '../../../../lib/api';

type CrawlSettings = {
  renderMode: 'cheerio-only' | 'cheerio-with-playwright-fallback' | 'playwright-only';
  maxRenderedPages: number;
  renderTimeoutMs: number;
  renderConcurrency: number;
  autoRenderImportantPages: boolean;
  autoRenderSchemaNotVerified: boolean;
  autoRenderJsSuspected: boolean;
};

type ProjectDTO = {
  id: string;
  crawlSettings: CrawlSettings;
};

const MODE_OPTIONS = [
  {
    value: 'cheerio-only',
    label: 'Cheerio only — fastest, no JS render',
  },
  {
    value: 'cheerio-with-playwright-fallback',
    label: 'Cheerio + Playwright fallback (recommended)',
  },
  {
    value: 'playwright-only',
    label: 'Playwright — render up to "Max rendered pages" in headless Chromium',
  },
];

export default function ProjectSettings({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery<ProjectDTO>({
    queryKey: ['project', id],
    queryFn: () => api<ProjectDTO>(`/projects/${id}`),
  });

  const [draft, setDraft] = useState<CrawlSettings | null>(null);
  useEffect(() => {
    if (data?.crawlSettings) setDraft(data.crawlSettings);
  }, [data?.crawlSettings]);

  const save = useMutation({
    mutationFn: (patch: Partial<CrawlSettings>) =>
      api(`/projects/${id}/crawl-settings`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      message.success('Crawl settings saved.');
      void qc.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  if (isLoading || !draft) {
    return (
      <SectionCard>
        <Skeleton active />
      </SectionCard>
    );
  }

  const update = <K extends keyof CrawlSettings>(key: K, value: CrawlSettings[K]): void => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const renderCost =
    draft.renderMode === 'cheerio-only'
      ? 'Fastest. No JS rendering. Schema rules will return not_verified for pages with JS-injected schema until you manually render them.'
      : draft.renderMode === 'playwright-only'
        ? `Renders up to ${draft.maxRenderedPages} pages in headless Chromium after Cheerio crawl completes (~${draft.renderTimeoutMs / 1000}s per page). Remaining pages stay Cheerio-only.`
        : `Recommended. Cheerio crawls everything; Playwright renders up to ${draft.maxRenderedPages} selected pages based on the toggles below.`;

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Settings"
        subtitle="Crawl + render policy. Doc 04 §Project-level crawl/render policy."
      />

      <SectionCard
        title="Crawl + render mode"
        description={renderCost}
        className="mb-4"
        actions={
          <Button
            type="primary"
            size="small"
            loading={save.isPending}
            onClick={() => save.mutate(draft)}
          >
            Save changes
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Render mode">
            <Select
              value={draft.renderMode}
              options={MODE_OPTIONS}
              style={{ width: '100%' }}
              onChange={(v: CrawlSettings['renderMode']) => update('renderMode', v)}
            />
          </Field>
          <Field label="Max rendered pages per run">
            <InputNumber
              value={draft.maxRenderedPages}
              min={0}
              max={500}
              style={{ width: '100%' }}
              onChange={(v) => update('maxRenderedPages', Number(v ?? 0))}
            />
          </Field>
          <Field label="Render timeout (ms)">
            <InputNumber
              value={draft.renderTimeoutMs}
              min={5000}
              max={120_000}
              step={1000}
              style={{ width: '100%' }}
              onChange={(v) => update('renderTimeoutMs', Number(v ?? 30000))}
            />
          </Field>
          <Field label="Render concurrency (parallel Chromium tabs)">
            <InputNumber
              value={draft.renderConcurrency}
              min={1}
              max={8}
              style={{ width: '100%' }}
              onChange={(v) => update('renderConcurrency', Number(v ?? 2))}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Auto-render triggers"
        description="When Cheerio crawl completes, automatically render these subsets in Chromium."
      >
        <div className="space-y-3">
          <Toggle
            label="Important pages (home, pricing, product, isImportant=true)"
            checked={draft.autoRenderImportantPages}
            onChange={(v) => update('autoRenderImportantPages', v)}
          />
          <Toggle
            label="Pages with no raw JSON-LD (auto-verify schema)"
            checked={draft.autoRenderSchemaNotVerified}
            onChange={(v) => update('autoRenderSchemaNotVerified', v)}
            hint="Costs more crawl time but eliminates the schema-not-verified data gap."
          />
          <Toggle
            label="Pages that look JS-rendered (SPA shell heuristic)"
            checked={draft.autoRenderJsSuspected}
            onChange={(v) => update('autoRenderJsSuspected', v)}
            hint="Pages with <80 words of extracted text AND no raw JSON-LD are rendered to recover hydrated content."
          />
        </div>
      </SectionCard>

      <IntegrationsCard projectId={id} />
      <MaintenanceCard projectId={id} />
    </>
  );
}

type Connection = {
  id: string;
  provider: 'gsc' | 'ga4' | 'cwv';
  status: 'connected' | 'setup' | 'disconnected' | 'available' | 'limited' | 'error' | string;
  siteUrl?: string;
  ga4PropertyId?: string;
  googleAccountEmail?: string;
  lastSyncedAt?: string;
  error?: string | null;
  virtual?: boolean;
  apiKeyConfigured?: boolean;
  description?: string;
};

type JobRow = {
  id: string;
  type: string;
  provider?: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  startedAt: string | null;
  finishedAt: string | null;
  nextRunAt: string | null;
  failReason: string | null;
  failCount: number;
};

type GoogleProperty = {
  siteUrl?: string;
  permissionLevel?: string;
  propertyId?: string;
  displayName?: string;
  account?: string;
};

function IntegrationsCard({ projectId }: { projectId: string }): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: conns } = useQuery<Connection[]>({
    queryKey: ['integrations', projectId],
    queryFn: () => api<Connection[]>(`/projects/${projectId}/integrations`),
    refetchInterval: 5000,
  });

  const { data: jobsData } = useQuery<{ jobs: JobRow[] }>({
    queryKey: ['integration-jobs', projectId],
    queryFn: () => api<{ jobs: JobRow[] }>(`/projects/${projectId}/jobs?type=sync`),
    refetchInterval: 4000,
  });

  // Latest job per provider — prioritize ACTIVE jobs over older completed ones so the UI doesn't
  // claim an integration is idle while a manual sync just queued. Doc continuation §"Phase 1"
  // priority order: running > queued > scheduled > failed > completed > cancelled > stale.
  const STATUS_RANK: Record<string, number> = {
    running: 6,
    queued: 5,
    scheduled: 4,
    failed: 3,
    completed: 2,
    cancelled: 1,
    stale: 1,
  };
  const latestByType = new Map<string, JobRow>();
  for (const j of jobsData?.jobs ?? []) {
    const key = j.provider ? `${j.provider}-sync` : j.type;
    const existing = latestByType.get(key);
    if (!existing) {
      latestByType.set(key, j);
      continue;
    }
    const rankNew = STATUS_RANK[j.status] ?? 0;
    const rankOld = STATUS_RANK[existing.status] ?? 0;
    if (rankNew > rankOld) {
      latestByType.set(key, j);
      continue;
    }
    if (rankNew === rankOld) {
      // Tie-break by recency: prefer the more recently scheduled/started job.
      const a = Date.parse(j.finishedAt ?? j.startedAt ?? j.nextRunAt ?? '') || 0;
      const b = Date.parse(existing.finishedAt ?? existing.startedAt ?? existing.nextRunAt ?? '') || 0;
      if (a > b) latestByType.set(key, j);
    }
  }

  const sync = useMutation({
    mutationFn: (provider: 'gsc' | 'ga4' | 'cwv') =>
      api(`/projects/${projectId}/integrations/sync`, {
        method: 'POST',
        body: JSON.stringify({ provider }),
      }),
    onSuccess: (_d, provider) => {
      message.success(`${provider.toUpperCase()} sync queued.`);
      // Immediately refetch so the freshly-queued job replaces the previous completed one in the
      // UI before the 4s poll fires.
      void qc.invalidateQueries({ queryKey: ['integration-jobs', projectId] });
      void qc.invalidateQueries({ queryKey: ['integrations', projectId] });
    },
    onError: (err) => message.error((err as Error).message),
  });
  // Provider currently in mutation-pending state. Used to disable the button before the next
  // job-list refetch lands.
  const pendingProvider = sync.isPending ? (sync.variables as 'gsc' | 'ga4' | 'cwv') : null;

  const disconnect = useMutation({
    mutationFn: (provider: string) =>
      api(`/projects/${projectId}/integrations/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Disconnected.');
      void qc.invalidateQueries({ queryKey: ['integrations', projectId] });
    },
  });

  const byProvider = new Map((conns ?? []).map((c) => [c.provider, c] as const));
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7010';

  // Listen for popup OAuth completion.
  useEffect(() => {
    const expectedOrigin = new URL(apiBase).origin;
    const onMessage = (ev: MessageEvent): void => {
      if (ev.origin !== expectedOrigin) return;
      const data = ev.data as { type?: string; provider?: string; ok?: boolean; error?: string } | null;
      if (!data || data.type !== 'oauth-complete') return;
      if (data.ok) {
        message.success(`${(data.provider ?? '').toUpperCase()} connected. Pick a property to finish.`);
      } else {
        message.error(`OAuth failed: ${data.error ?? 'unknown'}`);
      }
      void qc.invalidateQueries({ queryKey: ['integrations', projectId] });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [apiBase, qc, projectId, message]);

  const openAuthPopup = (provider: 'gsc' | 'ga4'): void => {
    const url = `${apiBase}/api/integrations/${provider}/connect?projectId=${projectId}`;
    const w = 600;
    const h = 720;
    const dualLeft = window.screenLeft ?? 0;
    const dualTop = window.screenTop ?? 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const left = dualLeft + (width - w) / 2;
    const top = dualTop + (height - h) / 2;
    const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const popup = window.open(url, 'boffin-oauth', features);
    if (!popup) {
      // Popup blocked — fall back to full navigation.
      window.location.assign(url);
    }
  };

  return (
    <SectionCard
      title="Integrations"
      description="Connect Search Console, GA4, and CrUX/PSI to enable data-driven rules + opportunity findings."
      className="mt-4"
      actions={
        <a
          href={`/projects/${projectId}/jobs?type=sync`}
          className="text-xs text-accent-hover hover:underline"
        >
          All sync jobs →
        </a>
      }
    >
      <div className="space-y-3">
        <Row
          label="Google Search Console"
          provider="gsc"
          projectId={projectId}
          apiBase={apiBase}
          conn={byProvider.get('gsc')}
          latestJob={latestByType.get('gsc-sync')}
          onConnect={() => openAuthPopup('gsc')}
          onSync={() => sync.mutate('gsc')}
          onDisconnect={() => disconnect.mutate('gsc')}
          onSelected={() => qc.invalidateQueries({ queryKey: ['integrations', projectId] })}
          mutationPending={pendingProvider === 'gsc' || pendingProvider === 'ga4' || pendingProvider === 'cwv' ? pendingProvider : null}
        />
        <Row
          label="Google Analytics 4"
          provider="ga4"
          projectId={projectId}
          apiBase={apiBase}
          conn={byProvider.get('ga4')}
          latestJob={latestByType.get('ga4-sync')}
          onConnect={() => openAuthPopup('ga4')}
          onSync={() => sync.mutate('ga4')}
          onDisconnect={() => disconnect.mutate('ga4')}
          onSelected={() => qc.invalidateQueries({ queryKey: ['integrations', projectId] })}
          mutationPending={pendingProvider === 'gsc' || pendingProvider === 'ga4' || pendingProvider === 'cwv' ? pendingProvider : null}
        />
        <Row
          label="Core Web Vitals (CrUX / PSI)"
          provider="cwv"
          projectId={projectId}
          apiBase={apiBase}
          conn={byProvider.get('cwv')}
          latestJob={latestByType.get('cwv-sync')}
          onConnect={null}
          onSync={() => sync.mutate('cwv')}
          onDisconnect={() => disconnect.mutate('cwv')}
          onSelected={() => undefined}
          mutationPending={pendingProvider}
        />
      </div>
    </SectionCard>
  );
}

function Row({
  label,
  provider,
  projectId,
  apiBase,
  conn,
  latestJob,
  onConnect,
  onSync,
  onDisconnect,
  onSelected,
  mutationPending,
}: {
  label: string;
  provider: 'gsc' | 'ga4' | 'cwv';
  projectId: string;
  apiBase: string;
  conn?: Connection;
  latestJob?: JobRow;
  onConnect: (() => void) | null;
  onSync: () => void;
  onDisconnect: () => void;
  onSelected: () => void;
  mutationPending: 'gsc' | 'ga4' | 'cwv' | null;
}): JSX.Element {
  const status = conn?.status ?? 'disconnected';
  const isOauthProvider = provider === 'gsc' || provider === 'ga4';
  const needsSetup = isOauthProvider && status === 'setup';
  const connected = status === 'connected';
  const isCwvVirtual = provider === 'cwv';
  // CWV uses available/limited/error rather than OAuth-style states.
  const cwvSyncable = isCwvVirtual && (status === 'available' || status === 'limited');
  // "Active" = job will produce data or already is. Scheduled wrappers don't block manual sync.
  const jobActive =
    latestJob?.status === 'queued' || latestJob?.status === 'running';
  // Mutation pending for this provider — disable immediately even before next refetch.
  const mutating = mutationPending === provider;
  const inFlight = jobActive || mutating;
  const buttonLabel = mutating
    ? 'Sync queued'
    : latestJob?.status === 'running'
      ? 'Sync running…'
      : latestJob?.status === 'queued'
        ? 'Sync queued'
        : 'Sync now';

  return (
    <div className="flex items-start justify-between gap-3 border border-border rounded-md p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="text-xs text-text-muted mt-0.5">
          {conn ? (
            <>
              Status: <span className="text-text">{status}</span>
              {conn.googleAccountEmail ? ` · account ${conn.googleAccountEmail}` : ''}
              {conn.siteUrl ? ` · ${conn.siteUrl}` : ''}
              {conn.ga4PropertyId ? ` · property ${conn.ga4PropertyId}` : ''}
              {isCwvVirtual && conn.apiKeyConfigured === false
                ? ' · no API key — limited PSI quota'
                : ''}
              {conn.lastSyncedAt
                ? ` · last sync ${new Date(conn.lastSyncedAt).toLocaleString()}`
                : ''}
            </>
          ) : (
            'Not connected'
          )}
        </div>
        {isCwvVirtual && conn?.description ? (
          <div className="text-[11px] text-text-subtle mt-0.5">{conn.description}</div>
        ) : null}
        {conn?.error ? (
          <div className="text-xs text-danger mt-1 break-all">Error: {conn.error}</div>
        ) : null}

        {latestJob ? <JobStatusLine job={latestJob} /> : null}

        {needsSetup && (provider === 'gsc' || provider === 'ga4') ? (
          <PropertyPicker
            apiBase={apiBase}
            projectId={projectId}
            provider={provider}
            onSelected={onSelected}
          />
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {/* OAuth providers: Connect only when nothing/disconnected. */}
        {isOauthProvider && onConnect && (!conn || status === 'disconnected') ? (
          <Button size="small" type="primary" onClick={onConnect}>
            Connect
          </Button>
        ) : null}

        {/* Re-auth (force consent again) when in setup or connected — useful when token expired. */}
        {isOauthProvider && onConnect && (needsSetup || connected) ? (
          <Button size="small" onClick={onConnect}>
            Re-auth
          </Button>
        ) : null}

        {/* Sync only after property selected. CWV is always syncable. */}
        {(connected || cwvSyncable) ? (
          <Button
            size="small"
            onClick={onSync}
            disabled={inFlight}
            loading={mutating}
            title={
              inFlight
                ? mutating
                  ? 'Queueing sync…'
                  : `Sync already ${latestJob?.status}; new run available after it finishes.`
                : undefined
            }
          >
            {buttonLabel}
          </Button>
        ) : null}

        {(connected || needsSetup) ? (
          <Button size="small" danger onClick={onDisconnect}>
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PropertyPicker({
  apiBase,
  projectId,
  provider,
  onSelected,
}: {
  apiBase: string;
  projectId: string;
  provider: 'gsc' | 'ga4';
  onSelected: () => void;
}): JSX.Element {
  const { message } = App.useApp();
  const { data, isLoading, error, refetch } = useQuery<{ properties: GoogleProperty[] }>({
    queryKey: ['integrations-properties', projectId, provider],
    queryFn: () =>
      api<{ properties: GoogleProperty[] }>(
        `/api/integrations/${provider}/properties?projectId=${projectId}`,
      ),
  });
  const [picked, setPicked] = useState<string | undefined>(undefined);

  const select = useMutation({
    mutationFn: (value: string) =>
      api(`/api/integrations/${provider}/select`, {
        method: 'POST',
        body: JSON.stringify(
          provider === 'gsc'
            ? { projectId, siteUrl: value }
            : { projectId, ga4PropertyId: value },
        ),
      }),
    onSuccess: () => {
      message.success(`${provider.toUpperCase()} property selected. Connection ready.`);
      onSelected();
    },
    onError: (err) => message.error((err as Error).message),
  });

  if (isLoading) {
    return (
      <div className="text-xs text-text-subtle mt-2">Loading {provider.toUpperCase()} properties…</div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-danger mt-2">
        Failed to list properties: {(error as Error).message}{' '}
        <Button size="small" type="link" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  const props = data?.properties ?? [];
  const options = props.map((p) => {
    if (provider === 'gsc') {
      return { label: `${p.siteUrl ?? '?'} (${p.permissionLevel ?? '—'})`, value: p.siteUrl ?? '' };
    }
    return {
      label: `${p.displayName ?? p.propertyId} ${p.account ? `· ${p.account}` : ''}`.trim(),
      value: p.propertyId ?? '',
    };
  });

  return (
    <div className="mt-2 flex items-center gap-2">
      <Select
        placeholder={`Pick a ${provider.toUpperCase()} ${provider === 'gsc' ? 'site' : 'property'}`}
        style={{ minWidth: 320 }}
        options={options}
        value={picked}
        onChange={setPicked}
        showSearch
        optionFilterProp="label"
      />
      <Button
        size="small"
        type="primary"
        disabled={!picked}
        loading={select.isPending}
        onClick={() => picked && select.mutate(picked)}
      >
        Use this property
      </Button>
    </div>
  );
}

function JobStatusLine({ job }: { job: JobRow }): JSX.Element {
  const tone =
    job.status === 'failed'
      ? 'text-danger'
      : job.status === 'running'
        ? 'text-accent-hover'
        : job.status === 'queued'
          ? 'text-warning'
          : 'text-text-muted';
  const duration =
    job.startedAt && job.finishedAt
      ? `${Math.max(0, Math.round((Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000))}s`
      : null;
  return (
    <div className="mt-1.5 text-[11px] text-text-subtle flex flex-wrap gap-x-2">
      <span>
        Last sync: <span className={tone}>{job.status}</span>
      </span>
      {job.startedAt ? (
        <span>started {new Date(job.startedAt).toLocaleString()}</span>
      ) : null}
      {job.finishedAt ? <span>· finished {new Date(job.finishedAt).toLocaleString()}</span> : null}
      {duration ? <span>· {duration}</span> : null}
      {job.failCount > 0 ? <span>· {job.failCount} failures</span> : null}
      {job.failReason ? (
        <span className="block w-full text-danger break-all">reason: {job.failReason}</span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm text-text">{label}</div>
        {hint ? <div className="text-xs text-text-muted mt-0.5">{hint}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} size="small" />
    </div>
  );
}
