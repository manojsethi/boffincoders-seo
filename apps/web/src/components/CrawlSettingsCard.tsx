'use client';

import { useEffect, useState } from 'react';
import { App, Button, InputNumber, Select, Skeleton, Switch } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionCard } from './SectionCard';
import { api } from '../lib/api';

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
  { value: 'cheerio-only', label: 'Cheerio only — fastest, no JS render' },
  { value: 'cheerio-with-playwright-fallback', label: 'Cheerio + Playwright fallback (recommended)' },
  { value: 'playwright-only', label: 'Playwright — render up to "Max rendered pages" in headless Chromium' },
];

export function CrawlSettingsCard({ projectId }: { projectId: string }): JSX.Element {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { data, isLoading } = useQuery<ProjectDTO>({
    queryKey: ['project', projectId],
    queryFn: () => api<ProjectDTO>(`/projects/${projectId}`),
  });
  const [draft, setDraft] = useState<CrawlSettings | null>(null);
  useEffect(() => {
    if (data?.crawlSettings) setDraft(data.crawlSettings);
  }, [data?.crawlSettings]);

  const save = useMutation({
    mutationFn: (patch: Partial<CrawlSettings>) =>
      api(`/projects/${projectId}/crawl-settings`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      message.success('Crawl settings saved.');
      void qc.invalidateQueries({ queryKey: ['project', projectId] });
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
              max={120000}
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
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
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
