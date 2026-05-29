'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Steps,
  Switch,
  Tag,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Play, Save } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { CrawlScopeCard } from '../../../../components/CrawlScopeCard';
import { IntegrationsCard } from '../../../../components/IntegrationsCard';
import { TermLabel } from '../../../../components/TermLabel';

/**
 * Phase 12 onboarding wizard — steps 2 through 8 (step 1 lives at /projects/new).
 *
 * Design:
 *  - Each step renders into the same shell so the analyst always sees the same stepper.
 *  - Persistence is per-step. We do not autosave mid-keystroke; "Continue" or "Save & start later"
 *    saves explicitly. This avoids partial-data flicker if the analyst abandons mid-step.
 *  - All persistence reuses existing models (Project.onboardingState, WebsiteProfile,
 *    KeywordModel, CrawlScopeRuleModel). No parallel onboarding-only data system.
 *  - "Start first crawl" calls the existing /projects/:id/crawl endpoint after marking
 *    onboarding complete.
 */

type OnboardingState = {
  currentStep?: number;
  completedSteps?: number[];
  completedAt?: string | null;
  primaryObjective?: string;
  secondaryObjectives?: string[];
  objectiveNotes?: string;
  websiteType?: string;
  websiteTypeCustom?: string;
  websiteDescription?: string;
  primaryAudience?: string;
  country?: string;
  primaryLanguage?: string;
  seedKeywordCount?: number;
  importantPageCount?: number;
  crawlPreset?: 'light' | 'standard' | 'full' | 'custom';
  maxPages?: number;
  skipIntegrations?: boolean;
  handleDocuments?: 'crawl' | 'sample' | 'exclude';
  notes?: string;
};

type Project = {
  id: string;
  clientName: string;
  siteName: string;
  primaryDomain: string;
  includeSubdomains: boolean;
  onboardingState?: OnboardingState;
  crawlSettings?: {
    renderMode: string;
    maxRenderedPages: number;
    renderTimeoutMs: number;
    renderConcurrency: number;
    autoRenderImportantPages: boolean;
    autoRenderSchemaNotVerified: boolean;
    autoRenderJsSuspected: boolean;
  };
  crawlScopeSettings?: {
    enabled: boolean;
    defaultBehavior: 'crawl' | 'sample';
    maxSamplePerGroup: number;
  };
};

const WEBSITE_TYPES = [
  { value: 'service', label: 'Service business' },
  { value: 'saas', label: 'SaaS / product' },
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'local', label: 'Local business' },
  { value: 'ngo', label: 'NGO / nonprofit' },
  { value: 'education', label: 'Education' },
  { value: 'publisher', label: 'Publisher / blog' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'government', label: 'Government / public sector' },
  { value: 'b2b', label: 'B2B company' },
  { value: 'docs', label: 'Documentation / knowledge base' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'other', label: 'Other / custom' },
];

const OBJECTIVES = [
  { value: 'leads', label: 'Get more leads' },
  { value: 'rankings', label: 'Improve rankings' },
  { value: 'traffic', label: 'Increase organic traffic' },
  { value: 'technical', label: 'Fix technical SEO' },
  { value: 'local', label: 'Improve local visibility' },
  { value: 'content', label: 'Improve content quality' },
  { value: 'recover', label: 'Recover lost traffic' },
  { value: 'roadmap', label: 'Prepare SEO roadmap' },
  { value: 'conversion', label: 'Improve conversion from organic' },
  { value: 'geo-aeo', label: 'Improve AI / AEO / GEO visibility' },
  { value: 'custom', label: 'Custom objective' },
];

const STEPS = [
  { key: 'profile', title: 'Website profile' },
  { key: 'objective', title: 'Client objective' },
  { key: 'keywords', title: 'Seed keywords' },
  { key: 'pages', title: 'Important pages' },
  { key: 'crawl', title: 'Crawl setup' },
  { key: 'integrations', title: 'Integrations' },
  { key: 'review', title: 'Review & start' },
];

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const router = useRouter();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => api<Project>(`/projects/${id}`),
  });

  // Step index 0..6 maps to wizard steps 2..8 (step 1 lives at /projects/new). After project
  // creation the analyst lands here on step index 0 unless the saved state says otherwise.
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (project?.onboardingState?.currentStep && project.onboardingState.currentStep > 1) {
      setStepIdx(Math.min(STEPS.length - 1, project.onboardingState.currentStep - 2));
    }
  }, [project?.onboardingState?.currentStep]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ onboardingState: OnboardingState }>(`/projects/${id}/onboarding`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const complete = useMutation({
    mutationFn: () =>
      api(`/projects/${id}/onboarding/complete`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const startCrawl = useMutation({
    mutationFn: (maxPages: number) =>
      api<{ crawlRunId: string }>(`/projects/${id}/crawl`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'first', maxPages }),
      }),
  });

  const goNext = async (stepNum: number, body: Record<string, unknown>): Promise<void> => {
    await patch.mutateAsync({ markStepComplete: stepNum, ...body });
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const goBack = (): void => setStepIdx((i) => Math.max(0, i - 1));

  const saveAndExit = async (stepNum: number, body: Record<string, unknown>): Promise<void> => {
    await patch.mutateAsync(body).catch(() => {});
    if (stepNum) {
      // Save step without marking it complete so analyst can return later.
      await patch.mutateAsync({ currentStep: stepNum }).catch(() => {});
    }
    router.push(`/projects/${id}`);
  };

  const finishAndStart = async (start: boolean): Promise<void> => {
    try {
      await complete.mutateAsync();
      if (start) {
        // Audit round 3 fix #2: refetch project so we read the analyst's confirmed maxPages
        // rather than a stale React Query cache value left over from before step 6 persisted.
        const fresh = await qc.fetchQuery<Project>({
          queryKey: ['project', id],
          queryFn: () => api<Project>(`/projects/${id}`),
          staleTime: 0,
        });
        const cap = Math.min(2000, Math.max(1, fresh?.onboardingState?.maxPages ?? 200));
        await startCrawl.mutateAsync(cap);
        message.success(`Onboarding complete — first crawl queued (cap ${cap}).`);
      } else {
        message.success('Onboarding complete — start the crawl from the project overview.');
      }
      router.push(`/projects/${id}`);
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  if (isLoading || !project) {
    return (
      <SectionCard>
        <div className="text-text-subtle text-sm">Loading project…</div>
      </SectionCard>
    );
  }

  const onbo = project.onboardingState ?? {};

  // If onboarding already complete, send analyst to the project overview rather than re-running
  // the wizard. Analyst can still visit /onboarding manually if they want to.
  const alreadyComplete = !!onbo.completedAt;

  return (
    <>
      <PageHeader
        eyebrow={`Onboarding · ${project.siteName}`}
        title={`Step ${stepIdx + 2} of 8 — ${STEPS[stepIdx]?.title ?? ''}`}
        subtitle={
          alreadyComplete
            ? 'Onboarding already complete — you can edit any step or jump to the project overview.'
            : 'Each step shapes how the first crawl + audit run. Skip-safe steps say so explicitly.'
        }
        actions={
          <Button
            onClick={() => router.push(`/projects/${id}`)}
            icon={<ArrowLeft size={14} />}
          >
            Open project overview
          </Button>
        }
      />

      <SectionCard className="mb-4">
        <Steps
          size="small"
          current={stepIdx}
          onChange={(v) => setStepIdx(v)}
          items={STEPS.map((s) => ({ title: s.title }))}
        />
      </SectionCard>

      {stepIdx === 0 && (
        <StepProfile
          project={project}
          state={onbo}
          onContinue={(body) => goNext(2, body)}
          onSaveExit={(body) => saveAndExit(2, body)}
          busy={patch.isPending}
        />
      )}
      {stepIdx === 1 && (
        <StepObjective
          state={onbo}
          onContinue={(body) => goNext(3, body)}
          onSaveExit={(body) => saveAndExit(3, body)}
          onBack={goBack}
          busy={patch.isPending}
        />
      )}
      {stepIdx === 2 && (
        <StepKeywords
          projectId={id}
          state={onbo}
          onContinue={() => goNext(4, {})}
          onBack={goBack}
          onSaveExit={() => saveAndExit(4, {})}
        />
      )}
      {stepIdx === 3 && (
        <StepImportantPages
          projectId={id}
          state={onbo}
          onContinue={() => goNext(5, {})}
          onBack={goBack}
          onSaveExit={() => saveAndExit(5, {})}
        />
      )}
      {stepIdx === 4 && (
        <StepCrawlSetup
          projectId={id}
          project={project}
          state={onbo}
          onContinue={(body) => goNext(6, body)}
          onBack={goBack}
          onSaveExit={(body) => saveAndExit(6, body)}
          busy={patch.isPending}
        />
      )}
      {stepIdx === 5 && (
        <StepIntegrations
          projectId={id}
          state={onbo}
          onContinue={(body) => goNext(7, body)}
          onBack={goBack}
          onSaveExit={(body) => saveAndExit(7, body)}
          busy={patch.isPending}
        />
      )}
      {stepIdx === 6 && (
        <StepReview
          project={project}
          state={onbo}
          onBack={goBack}
          onStart={() => finishAndStart(true)}
          onSaveLater={() => finishAndStart(false)}
          busy={complete.isPending || startCrawl.isPending}
        />
      )}
    </>
  );
}

// ----------------------------- Step 2: profile -----------------------------

function StepProfile({
  project,
  state,
  onContinue,
  onSaveExit,
  busy,
}: {
  project: Project;
  state: OnboardingState;
  onContinue: (body: Record<string, unknown>) => Promise<void>;
  onSaveExit: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}): JSX.Element {
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      websiteType: state.websiteType || 'service',
      websiteTypeCustom: state.websiteTypeCustom || '',
      websiteDescription: state.websiteDescription || '',
      primaryAudience: state.primaryAudience || '',
    });
  }, [state, form]);

  return (
    <SectionCard
      title="Website profile"
      description="Helps the audit avoid treating every site like a service business. You can refine this after the first crawl + AI analysis."
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onContinue(values)}
      >
        <div className="text-xs text-text-muted mb-2">
          Site: <strong>{project.siteName}</strong> ·{' '}
          <code className="font-mono">{project.primaryDomain}</code>
        </div>
        <Form.Item label="Website type" name="websiteType" rules={[{ required: true }]}>
          <Select options={WEBSITE_TYPES} />
        </Form.Item>
        <Form.Item shouldUpdate noStyle>
          {() =>
            form.getFieldValue('websiteType') === 'other' ? (
              <Form.Item
                label="Custom website type"
                name="websiteTypeCustom"
                rules={[{ required: true, message: 'Describe the website type' }]}
              >
                <Input placeholder="e.g. Faith-based community site" />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item
          label="One-line description"
          name="websiteDescription"
          extra="What the site does, who it's for. Optional."
        >
          <Input.TextArea rows={2} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item label="Primary audience" name="primaryAudience">
          <Input placeholder="e.g. B2B engineering leaders / patients / donors / students" />
        </Form.Item>
        <ActionsRow
          busy={busy}
          onSaveExit={() => onSaveExit(form.getFieldsValue())}
          submitLabel="Continue"
        />
      </Form>
    </SectionCard>
  );
}

// ----------------------------- Step 3: objective -----------------------------

function StepObjective({
  state,
  onContinue,
  onSaveExit,
  onBack,
  busy,
}: {
  state: OnboardingState;
  onContinue: (body: Record<string, unknown>) => Promise<void>;
  onSaveExit: (body: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  busy: boolean;
}): JSX.Element {
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      primaryObjective: state.primaryObjective || 'leads',
      secondaryObjectives: state.secondaryObjectives || [],
      objectiveNotes: state.objectiveNotes || '',
    });
  }, [state, form]);

  return (
    <SectionCard
      title="Client objective"
      description="Helps prioritize findings by the client's actual business need. Lightweight — full Goals can be added later."
    >
      <Form form={form} layout="vertical" onFinish={(v) => onContinue(v)}>
        <Form.Item
          label="Primary objective"
          name="primaryObjective"
          rules={[{ required: true }]}
        >
          <Select options={OBJECTIVES} />
        </Form.Item>
        <Form.Item label="Secondary objectives" name="secondaryObjectives">
          <Select
            mode="multiple"
            options={OBJECTIVES}
            placeholder="Optional — pick any that also apply"
          />
        </Form.Item>
        <Form.Item label="Notes from kickoff call" name="objectiveNotes">
          <Input.TextArea
            rows={4}
            placeholder="e.g. Client wants more qualified B2B leads for Node.js + AI automation services. Focus on India + US."
            maxLength={2000}
            showCount
          />
        </Form.Item>
        <ActionsRow
          busy={busy}
          onBack={onBack}
          onSaveExit={() => onSaveExit(form.getFieldsValue())}
          submitLabel="Continue"
        />
      </Form>
    </SectionCard>
  );
}

// ----------------------------- Step 4: keywords -----------------------------

type SeedRow = {
  keyword: string;
  priority: 'P0' | 'P1' | 'P2';
  intent:
    | 'informational'
    | 'commercial'
    | 'transactional'
    | 'navigational'
    | 'local'
    | 'support'
    | 'unknown';
  targetUrl: string;
};

const INTENT_OPTIONS = [
  { value: 'unknown', label: 'unknown' },
  { value: 'informational', label: 'informational' },
  { value: 'commercial', label: 'commercial' },
  { value: 'transactional', label: 'transactional' },
  { value: 'navigational', label: 'navigational' },
  { value: 'local', label: 'local' },
  { value: 'support', label: 'support' },
];

function StepKeywords({
  projectId,
  state,
  onContinue,
  onBack,
  onSaveExit,
}: {
  projectId: string;
  state: OnboardingState;
  onContinue: () => Promise<void>;
  onBack: () => void;
  onSaveExit: () => Promise<void>;
}): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<SeedRow[]>([]);

  // Parse the textarea into structured rows. We don't blow away existing rows the analyst may
  // have edited — only new keywords appear at the bottom; analyst can clear-all to start over.
  const parseAndMerge = (): void => {
    const parsed = raw
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && k.length < 200);
    const seenLower = new Set(rows.map((r) => r.keyword.toLowerCase()));
    const next: SeedRow[] = [...rows];
    for (const k of parsed) {
      const lk = k.toLowerCase();
      if (seenLower.has(lk)) continue;
      seenLower.add(lk);
      next.push({ keyword: k, priority: 'P2', intent: 'unknown', targetUrl: '' });
    }
    setRows(next);
    setRaw('');
  };

  const submit = useMutation({
    mutationFn: () =>
      api<{ inserted: number; skipped: number; totalSeedKeywords: number }>(
        `/projects/${projectId}/onboarding/keywords`,
        {
          method: 'POST',
          body: JSON.stringify({
            keywords: rows.map((r) => ({
              keyword: r.keyword,
              priority: r.priority,
              intent: r.intent,
              targetUrl: r.targetUrl || undefined,
            })),
          }),
        },
      ),
    onSuccess: (r) => {
      message.success(
        `${r.inserted} keyword${r.inserted === 1 ? '' : 's'} added (${r.skipped} skipped, ${r.totalSeedKeywords} total seed)`,
      );
      setRows([]);
      void qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <SectionCard
      title={
        <TermLabel term="search-intent">Seed keywords</TermLabel>
      }
      description="Paste keywords from the kickoff call, then refine priority + intent + target page per row. Skip-safe — GSC import remains available after the first crawl."
    >
      <div className="space-y-3 text-sm">
        <div className="rounded border border-border bg-surface-2 px-3 py-2 text-xs">
          Already on this project:{' '}
          <strong className="tabular-nums">{state.seedKeywordCount ?? 0}</strong> seed keywords.
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
            Paste keywords (one per line or comma-separated)
          </div>
          <Input.TextArea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder={`technical seo audit\nnode.js development company\nai automation agency`}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button onClick={parseAndMerge} disabled={raw.trim().length === 0}>
              Parse into rows
            </Button>
            <Button onClick={() => setRows([])} disabled={rows.length === 0} danger type="text">
              Clear rows
            </Button>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="rounded border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_140px_1fr_30px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-text-subtle bg-surface-2">
              <div>Keyword</div>
              <div><TermLabel term="action-priority">Priority</TermLabel></div>
              <div><TermLabel term="search-intent">Intent</TermLabel></div>
              <div>Target page (optional)</div>
              <div />
            </div>
            <ul className="divide-y divide-border max-h-[360px] overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={`${r.keyword}-${i}`}
                  className="grid grid-cols-[1fr_90px_140px_1fr_30px] gap-2 px-3 py-1.5 items-center"
                >
                  <span className="text-text truncate">{r.keyword}</span>
                  <Select
                    size="small"
                    value={r.priority}
                    options={[
                      { value: 'P0', label: 'P0' },
                      { value: 'P1', label: 'P1' },
                      { value: 'P2', label: 'P2' },
                    ]}
                    onChange={(v) => {
                      setRows((rs) => rs.map((x, j) => (j === i ? { ...x, priority: v } : x)));
                    }}
                  />
                  <Select
                    size="small"
                    value={r.intent}
                    options={INTENT_OPTIONS}
                    onChange={(v) => {
                      setRows((rs) => rs.map((x, j) => (j === i ? { ...x, intent: v } : x)));
                    }}
                  />
                  <Input
                    size="small"
                    value={r.targetUrl}
                    placeholder="/services/web-dev"
                    onChange={(e) => {
                      setRows((rs) =>
                        rs.map((x, j) => (j === i ? { ...x, targetUrl: e.target.value } : x)),
                      );
                    }}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="primary"
            onClick={() => submit.mutate()}
            disabled={rows.length === 0}
            loading={submit.isPending}
          >
            Save {rows.length || ''} keyword{rows.length === 1 ? '' : 's'}
          </Button>
        </div>
        <ActionsRow
          busy={false}
          onBack={onBack}
          onSaveExit={onSaveExit}
          onSubmit={onContinue}
          submitLabel="Continue"
          skipNote="Skip-safe — you can import from GSC after the first crawl"
        />
      </div>
    </SectionCard>
  );
}

// ----------------------------- Step 5: important pages -----------------------------

function StepImportantPages({
  projectId,
  state,
  onContinue,
  onBack,
  onSaveExit,
}: {
  projectId: string;
  state: OnboardingState;
  onContinue: () => Promise<void>;
  onBack: () => void;
  onSaveExit: () => Promise<void>;
}): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [raw, setRaw] = useState('');

  const list = useQuery<Array<{ id: string; pattern: string; label: string; notes: string }>>({
    queryKey: ['onboarding-important', projectId],
    queryFn: () => api(`/projects/${projectId}/onboarding/important-pages`),
  });

  const add = useMutation({
    mutationFn: () =>
      api<{ accepted: number; rejected: Array<{ url: string; reason: string }>; totalImportantPages: number }>(
        `/projects/${projectId}/onboarding/important-pages`,
        {
          method: 'POST',
          body: JSON.stringify({
            urls: raw.split(/\n+/).map((s) => s.trim()).filter(Boolean),
          }),
        },
      ),
    onSuccess: (r) => {
      message.success(
        `${r.accepted} added · ${r.rejected.length} rejected · ${r.totalImportantPages} total`,
      );
      setRaw('');
      void list.refetch();
      void qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/projects/${projectId}/onboarding/important-pages/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void list.refetch();
      void qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  return (
    <SectionCard
      title="Important pages"
      description="Add known money pages, conversion URLs, or strategic landing pages. These are force-included in the first crawl and weight recommendations higher."
    >
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
            Add URLs (one per line)
          </div>
          <Input.TextArea
            rows={5}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`https://example.com/contact\nhttps://example.com/services/web-dev`}
          />
          <div className="text-xs text-text-subtle mt-1">
            Must belong to the project domain. Subdomains only included if the project allows them.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            onClick={() => add.mutate()}
            disabled={raw.trim().length === 0}
            loading={add.isPending}
          >
            Add as important
          </Button>
          <Button onClick={() => setRaw('')} disabled={raw.length === 0}>
            Clear
          </Button>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
            Already force-included ({state.importantPageCount ?? 0})
          </div>
          {(list.data ?? []).length === 0 ? (
            <div className="text-xs text-text-subtle">No important pages added yet.</div>
          ) : (
            <ul className="space-y-1">
              {(list.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs"
                >
                  <span className="font-mono">{r.pattern}</span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => remove.mutate(r.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ActionsRow
          busy={false}
          onBack={onBack}
          onSaveExit={onSaveExit}
          onSubmit={onContinue}
          submitLabel="Continue"
          skipNote="Skip-safe — the crawler will discover more pages on its own"
        />
      </div>
    </SectionCard>
  );
}

// ----------------------------- Step 6: crawl setup -----------------------------

function StepCrawlSetup({
  projectId,
  project,
  state,
  onContinue,
  onBack,
  onSaveExit,
  busy,
}: {
  projectId: string;
  project: Project;
  state: OnboardingState;
  onContinue: (body: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onSaveExit: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<'light' | 'standard' | 'full' | 'custom'>(
    state.crawlPreset ?? 'standard',
  );
  const [maxPages, setMaxPages] = useState<number>(
    state.maxPages ?? (preset === 'light' ? 50 : preset === 'full' ? 2000 : 200),
  );
  const [scopeEnabled, setScopeEnabled] = useState<boolean>(
    project.crawlScopeSettings?.enabled ?? true,
  );
  const [handleDocs, setHandleDocs] = useState<'crawl' | 'sample' | 'exclude'>(
    state.handleDocuments ?? 'sample',
  );
  const [renderMode, setRenderMode] = useState<
    'cheerio-only' | 'cheerio-with-playwright-fallback' | 'playwright-only'
  >(
    (project.crawlSettings?.renderMode as
      | 'cheerio-only'
      | 'cheerio-with-playwright-fallback'
      | 'playwright-only'
      | undefined) ?? 'cheerio-with-playwright-fallback',
  );
  const [maxRendered, setMaxRendered] = useState<number>(
    project.crawlSettings?.maxRenderedPages ?? 25,
  );
  const [autoRenderImportant, setAutoRenderImportant] = useState<boolean>(
    project.crawlSettings?.autoRenderImportantPages ?? true,
  );
  const [autoRenderJsSuspected, setAutoRenderJsSuspected] = useState<boolean>(
    project.crawlSettings?.autoRenderJsSuspected ?? false,
  );

  const saveCrawlSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/projects/${projectId}/crawl-settings`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const saveScopeSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/projects/${projectId}/crawl-scope/settings`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  // PDF/document handling — translate the analyst's pick into a single scope rule. Doc 12
  // §"PDF/documents are different": let the analyst decide rather than hide.
  const upsertDocRule = useMutation({
    mutationFn: async () => {
      const behavior = handleDocs;
      // Find any existing PDF rule we may have created earlier.
      const existing = await api<Array<{ id: string; pattern: string }>>(
        `/projects/${projectId}/crawl-scope/rules?source=analyst`,
      );
      const pdfRule = existing.find((r) => r.pattern === '**/*.pdf');
      const body = {
        name: 'PDF documents',
        pattern: '**/*.pdf',
        patternType: 'glob' as const,
        behavior,
        sampleLimit: 5,
        priority: 80,
        groupName: 'Documents (PDF)',
        pageFamily: 'document',
        reason: 'Analyst chose how to treat PDF documents during onboarding.',
        source: 'analyst' as const,
        status: 'approved' as const,
      };
      if (pdfRule) {
        await api(`/projects/${projectId}/crawl-scope/rules/${pdfRule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await api(`/projects/${projectId}/crawl-scope/rules`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
    },
  });

  // Persist every step-6 selection to its real Mongo home. Reused by both Continue and
  // Save & start later. Crawl + scope settings MUST persist — if either fails, throw so the
  // caller surfaces an error and the analyst is not led to believe their choices saved. PDF
  // rule is allowed to fail (the analyst can re-set it from Crawl Settings).
  const persistAll = async (): Promise<void> => {
    try {
      await saveCrawlSettings.mutateAsync({
        renderMode,
        maxRenderedPages: maxRendered,
        autoRenderImportantPages: autoRenderImportant,
        autoRenderJsSuspected,
      });
    } catch (err) {
      throw new Error(`Crawl settings did not save: ${(err as Error).message}`);
    }
    try {
      await saveScopeSettings.mutateAsync({ enabled: scopeEnabled });
    } catch (err) {
      throw new Error(`Scope settings did not save: ${(err as Error).message}`);
    }
    await upsertDocRule.mutateAsync().catch(() => {
      message.warning('Document rule save skipped — re-check on the Crawl Settings page.');
    });
  };

  const continueStep = async (): Promise<void> => {
    try {
      await persistAll();
    } catch (err) {
      message.error((err as Error).message);
      return;
    }
    await onContinue({ crawlPreset: preset, maxPages, handleDocuments: handleDocs });
  };

  const saveExitStep = async (): Promise<void> => {
    // Audit round 3 fix #1: Save & start later must persist crawl/scope/PDF before exiting.
    // Audit round 4 fix #1: surface persist failures so analyst is not misled.
    try {
      await persistAll();
    } catch (err) {
      message.error((err as Error).message);
      return;
    }
    await onSaveExit({ crawlPreset: preset, maxPages, handleDocuments: handleDocs });
  };

  return (
    <>
      <SectionCard
        title="Crawl mode"
        description="Decide how aggressive the first crawl is. You can rerun a deeper crawl any time."
        className="mb-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          {(
            [
              { v: 'light', t: 'Light audit', d: 'Homepage + nav + important pages + small sample (50 URLs).' },
              { v: 'standard', t: 'Standard audit', d: 'Core pages + sampled repeated sections (200 URLs).' },
              { v: 'full', t: 'Full crawl', d: 'Crawl as much as allowed (up to 2000 URLs).' },
              { v: 'custom', t: 'Custom', d: 'Set your own max pages + scope rules.' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => {
                setPreset(opt.v);
                setMaxPages(opt.v === 'light' ? 50 : opt.v === 'full' ? 2000 : opt.v === 'standard' ? 200 : maxPages);
              }}
              className={`text-left rounded border p-3 transition-colors ${
                preset === opt.v
                  ? 'border-accent bg-accent-soft text-text'
                  : 'border-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-medium">{opt.t}</div>
              <div className="text-xs text-text-muted mt-1">{opt.d}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="block">
            <span className="text-[11px] uppercase tracking-wider text-text-subtle">
              <TermLabel term="max-pages">Max pages</TermLabel>
            </span>
            <InputNumber
              min={1}
              max={50000}
              value={maxPages}
              onChange={(v) => setMaxPages(Number(v ?? 200))}
              className="w-full mt-1"
            />
          </div>
          <div className="flex items-center gap-2 text-sm mt-6">
            <Switch
              checked={scopeEnabled}
              onChange={(v) => setScopeEnabled(v)}
            />
            <span>
              <TermLabel term="crawl-scope">Apply crawl scope rules</TermLabel>
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="block">
            <span className="text-[11px] uppercase tracking-wider text-text-subtle">
              <TermLabel term="render-mode">Render mode</TermLabel>
            </span>
            <Select
              value={renderMode}
              onChange={(v) => setRenderMode(v)}
              options={[
                { value: 'cheerio-only', label: 'Cheerio only — fastest, no JS render' },
                {
                  value: 'cheerio-with-playwright-fallback',
                  label: 'Cheerio + Playwright fallback (recommended)',
                },
                {
                  value: 'playwright-only',
                  label: 'Playwright selective — render up to the configured Chromium page cap',
                },
              ]}
              className="w-full mt-1"
            />
          </div>
          <div className="block">
            <span className="text-[11px] uppercase tracking-wider text-text-subtle">
              Max rendered pages (Chromium)
            </span>
            <InputNumber
              min={0}
              max={500}
              value={maxRendered}
              onChange={(v) => setMaxRendered(Number(v ?? 25))}
              className="w-full mt-1"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRenderImportant}
              onChange={(v) => setAutoRenderImportant(v)}
            />
            <span>Auto-render important pages</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRenderJsSuspected}
              onChange={(v) => setAutoRenderJsSuspected(v)}
            />
            <span>Auto-render JS-suspected pages (SPA shells)</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
            PDF / document URLs
          </div>
          <Select
            value={handleDocs}
            onChange={(v) => setHandleDocs(v)}
            options={[
              { value: 'crawl', label: 'Crawl all (NGO / education / legal sites)' },
              { value: 'sample', label: 'Sample 5 (default)' },
              { value: 'exclude', label: 'Exclude' },
            ]}
            className="w-full max-w-md"
          />
          <div className="text-xs text-text-subtle mt-1">
            PDFs are not hidden as static assets — they may be primary content for NGO,
            education, government, and research sites.
          </div>
        </div>
      </SectionCard>

      <CrawlScopeCard projectId={projectId} />

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            icon={<Save size={14} />}
            onClick={saveExitStep}
            disabled={busy}
          >
            Save & start later
          </Button>
          <Button
            type="primary"
            icon={<ArrowRight size={14} />}
            onClick={continueStep}
            loading={busy}
          >
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}

// ----------------------------- Step 7: integrations -----------------------------

function StepIntegrations({
  projectId,
  state,
  onContinue,
  onBack,
  onSaveExit,
  busy,
}: {
  projectId: string;
  state: OnboardingState;
  onContinue: (body: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onSaveExit: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}): JSX.Element {
  const [skip, setSkip] = useState<boolean>(state.skipIntegrations ?? false);
  return (
    <>
      <SectionCard
        title="Integrations"
        description="Connect now or later. Skipping is safe — affected dashboards/sections will show data gaps instead of failing."
        className="mb-4"
      >
        <div className="text-xs text-text-muted space-y-1 mb-2">
          <div>
            · <strong>GSC skipped:</strong> no real query data, no clicks/impressions/CTR/position.
            <span className="ml-1"><TermLabel term="quick-win">.</TermLabel></span>
          </div>
          <div>
            · <strong>GA4 skipped:</strong> no organic traffic / conversion analysis.
            <span className="ml-1"><TermLabel term="conversion-rate">.</TermLabel></span>
          </div>
          <div>
            · <strong>CWV / PSI skipped:</strong> performance dashboard stays empty.
            <span className="ml-1"><TermLabel term="cwv-pass-fail">.</TermLabel></span>
          </div>
        </div>
        <Checkbox
          checked={skip}
          onChange={(e) => setSkip(e.target.checked)}
          className="text-sm text-text-muted"
        >
          I'll connect integrations later (recommended only if the client hasn't shared access yet)
        </Checkbox>
      </SectionCard>

      <IntegrationsCard projectId={projectId} />

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            icon={<Save size={14} />}
            onClick={() => onSaveExit({ skipIntegrations: skip })}
            disabled={busy}
          >
            Save & start later
          </Button>
          <Button
            type="primary"
            icon={<ArrowRight size={14} />}
            onClick={() => onContinue({ skipIntegrations: skip })}
            loading={busy}
          >
            Continue to review
          </Button>
        </div>
      </div>
    </>
  );
}

// ----------------------------- Step 8: review -----------------------------

function StepReview({
  project,
  state,
  onBack,
  onStart,
  onSaveLater,
  busy,
}: {
  project: Project;
  state: OnboardingState;
  onBack: () => void;
  onStart: () => Promise<void>;
  onSaveLater: () => Promise<void>;
  busy: boolean;
}): JSX.Element {
  const { data: rules = [] } = useQuery<Array<{ id: string; pattern: string; behavior: string; status: string; groupName: string; sampleLimit: number }>>({
    queryKey: ['scope-rules', project.id],
    queryFn: () => api(`/projects/${project.id}/crawl-scope/rules`),
  });
  const approvedRules = rules.filter((r) => r.status === 'approved');
  const sampleRules = approvedRules.filter((r) => r.behavior === 'sample');
  const excludeRules = approvedRules.filter((r) => r.behavior === 'exclude');
  const forceRules = approvedRules.filter((r) => r.behavior === 'force_include');

  return (
    <>
      <SectionCard
        title="Review"
        description="Confirm everything before the first crawl runs."
        className="mb-4"
      >
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Row label="Website">
            <strong>{project.siteName}</strong>
            <div className="text-xs text-text-muted font-mono">{project.primaryDomain}</div>
          </Row>
          <Row label="Country / language">
            {state.country || '—'} · {state.primaryLanguage || '—'}
          </Row>
          <Row label="Website type">
            {state.websiteType === 'other' ? state.websiteTypeCustom : state.websiteType || '—'}
          </Row>
          <Row label="Audience">{state.primaryAudience || '—'}</Row>
          <Row label="Primary objective">{state.primaryObjective || '—'}</Row>
          <Row label="Secondary objectives">
            {(state.secondaryObjectives ?? []).length === 0
              ? '—'
              : (state.secondaryObjectives ?? []).join(', ')}
          </Row>
          <Row label="Seed keywords">
            <strong>{state.seedKeywordCount ?? 0}</strong> entered
          </Row>
          <Row label="Important pages">
            <strong>{state.importantPageCount ?? 0}</strong> force-included
          </Row>
          <Row label="Crawl preset">
            {state.crawlPreset ?? 'standard'} · {state.maxPages ?? 200} max pages
          </Row>
          <Row label="Documents (PDF)">{state.handleDocuments ?? 'sample'}</Row>
          <Row label="Integrations">
            {state.skipIntegrations ? 'Skipped (connect later)' : 'See Integrations tab for status'}
          </Row>
          <Row label="Approved scope rules">
            <strong>{approvedRules.length}</strong> · sample {sampleRules.length} · exclude{' '}
            {excludeRules.length} · force {forceRules.length}
          </Row>
        </dl>
        {state.objectiveNotes ? (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
              Objective notes
            </div>
            <div className="text-sm text-text whitespace-pre-wrap">{state.objectiveNotes}</div>
          </div>
        ) : null}
      </SectionCard>

      <div className="flex items-center justify-between gap-2">
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={onSaveLater} disabled={busy} icon={<Save size={14} />}>
            Save and start later
          </Button>
          <Button
            type="primary"
            onClick={onStart}
            loading={busy}
            icon={<Play size={14} />}
          >
            Start first crawl
          </Button>
        </div>
      </div>
    </>
  );
}

// ----------------------------- shared bits -----------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded border border-border bg-surface-2 p-2">
      <dt className="text-[10px] uppercase tracking-wider text-text-subtle">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

function ActionsRow({
  busy,
  onBack,
  onSaveExit,
  onSubmit,
  submitLabel,
  skipNote,
}: {
  busy: boolean;
  onBack?: () => void;
  onSaveExit?: () => void;
  onSubmit?: () => void;
  submitLabel: string;
  skipNote?: string;
}): JSX.Element {
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {onBack ? (
          <Button icon={<ArrowLeft size={14} />} onClick={onBack}>
            Back
          </Button>
        ) : null}
        {skipNote ? <span className="text-xs text-text-subtle">{skipNote}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {onSaveExit ? (
          <Button icon={<Save size={14} />} onClick={onSaveExit} disabled={busy}>
            Save & start later
          </Button>
        ) : null}
        {onSubmit ? (
          <Button
            type="primary"
            icon={<ArrowRight size={14} />}
            onClick={onSubmit}
            loading={busy}
          >
            {submitLabel}
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<ArrowRight size={14} />}
            htmlType="submit"
            loading={busy}
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
