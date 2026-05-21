'use client';

import { useMemo, useState } from 'react';
import { Drawer, Empty, FloatButton, Input, Select, Tabs, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CircleHelp, Search } from 'lucide-react';
import {
  listGlossaryEntries,
  type GlossaryEntry,
  type GlossaryListEntry,
} from '../glossary';
import { api } from '../lib/api';

const SOURCE_LABEL: Record<NonNullable<GlossaryEntry['source']>, string> = {
  crawl: 'Crawl',
  gsc: 'GSC',
  ga4: 'GA4',
  cwv: 'CWV',
  analyst: 'Analyst',
  ai: 'AI',
};

const GUIDE_STEPS = [
  {
    title: 'Create or open a project',
    goal: 'Start from the website you want to improve.',
    where: 'Projects',
    checks: [
      'Confirm the domain is correct.',
      'Use Settings to connect GSC, GA4, and Core Web Vitals when available.',
      'Keep crawl/render settings conservative unless the site is JavaScript-heavy.',
    ],
  },
  {
    title: 'Run crawl and audit',
    goal: 'Collect pages, content, links, schema, and technical signals.',
    where: 'Project overview or Settings',
    checks: [
      'Review crawl status and data gaps before trusting scores.',
      'Use rendered recrawl only for important or not-verified pages.',
      'Schema should show raw HTML, rendered HTML, both, none, or not verified.',
    ],
  },
  {
    title: 'Triage pages and issues',
    goal: 'Find which URLs need attention first.',
    where: 'Pages and Issues',
    checks: [
      'Filter by severity, role, indexability, and affected URL.',
      'Open the issue drawer to read evidence, impact, owner, and validation method.',
      'Do not treat not-verified data gaps as confirmed SEO failures.',
    ],
  },
  {
    title: 'Review recommendations',
    goal: 'Turn issues into clear actions for SEO, content, or developers.',
    where: 'Issue drawer and project overview',
    checks: [
      'Approve, edit, or reject each recommendation.',
      'Check root cause, recommended action, why it matters, and validation method.',
      'Grouped issues should create one recommendation with affected URL samples.',
    ],
  },
  {
    title: 'Map goals and keywords',
    goal: 'Connect SEO work to business outcomes.',
    where: 'Goals, Keywords, and Opportunities',
    checks: [
      'Define goals such as leads, signups, donations, bookings, awareness, or sales.',
      'Import GSC queries and map them to the right pages.',
      'Review keyword fit before creating content or page changes.',
    ],
  },
  {
    title: 'Create content briefs',
    goal: 'Give writers and analysts an evidence-backed page plan.',
    where: 'Content Briefs',
    checks: [
      'Create briefs from mapped keywords, pages, or opportunities.',
      'Review title ideas, H1, outline, missing sections, schema, and evidence.',
      'Approve only after the brief matches the page intent and business goal.',
    ],
  },
  {
    title: 'Build the weekly fix plan',
    goal: 'Choose the work that should actually be done next.',
    where: 'Fix Plans',
    checks: [
      'Pull in recommendations, opportunities, issues, and briefs.',
      'Assign owners, priority, due dates, and validation method.',
      'Keep the plan small enough for the team to finish and verify.',
    ],
  },
  {
    title: 'Validate and report',
    goal: 'Prove what changed and what improved.',
    where: 'Fix Plans, Dashboards, and Reports',
    checks: [
      'Re-crawl, re-audit, and sync integrations after fixes are shipped.',
      'Use dashboards for performance movement and reports for client-ready summaries.',
      'Keep internal notes separate from client-visible report sections.',
    ],
  },
];

type AuditRuleRow = {
  id: string;
  version: string;
  name: string;
  scope: 'page' | 'site';
  category: string;
  layer: string;
  pack: string;
  scoresInto: string;
  description: string;
  whyItMatters: string;
  recommendationTemplate: string;
  defaultSeverity: string;
  defaultImpact: number;
  defaultEffort: string;
  defaultValidationMethod: string | null;
  reportVisibility: string;
  ownerHint: string | null;
  lifecycle: string;
  requiredInputs: string[];
  optionalInputs: string[];
};

type AuditRulesResponse = {
  summary: {
    total: number;
    active: number;
    experimental: number;
    byLayer: Record<string, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  rules: AuditRuleRow[];
};

function matchesEntry(entry: GlossaryListEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [
    entry.key,
    entry.term,
    entry.short,
    entry.whatItIs,
    entry.whyItMatters,
    entry.howWeMeasure,
    entry.whatGoodLooksLike,
    entry.whatToDoNext,
    entry.source ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesRule(rule: AuditRuleRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    rule.id,
    rule.name,
    rule.scope,
    rule.category,
    rule.layer,
    rule.pack,
    rule.description,
    rule.whyItMatters,
    rule.recommendationTemplate,
    rule.defaultSeverity,
    rule.defaultEffort,
    rule.ownerHint ?? '',
    rule.lifecycle,
    ...rule.requiredInputs,
    ...rule.optionalInputs,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function GuidePanel(): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface/70 p-4">
        <p className="text-sm text-text-muted">
          Use this as a working checklist while testing the product. Each step should leave you
          with clearer evidence, a clearer action, or a clearer report.
        </p>
      </div>
      <div className="space-y-3">
        {GUIDE_STEPS.map((step, index) => (
          <section
            key={step.title}
            className="rounded-lg border border-border bg-surface/70 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-text-onaccent">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">{step.title}</h3>
                  <Tag>{step.where}</Tag>
                </div>
                <p className="mt-1 text-sm text-text-muted">{step.goal}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-text-muted">
                  {step.checks.map((check) => (
                    <li key={check} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function GlossaryPanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const entries = useMemo(() => listGlossaryEntries(), []);
  const filtered = useMemo(
    () => entries.filter((entry) => matchesEntry(entry, query.trim())),
    [entries, query],
  );

  return (
    <div className="space-y-3">
      <Input
        allowClear
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        prefix={<Search size={15} className="text-text-subtle" />}
        placeholder="Search glossary terms, sources, or definitions"
        aria-label="Search glossary"
      />
      <div className="text-xs text-text-subtle">
        Showing {filtered.length} of {entries.length} terms
      </div>
      {filtered.length === 0 ? (
        <Empty description="No matching glossary terms" />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <article
              key={entry.key}
              className="rounded-lg border border-border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text">{entry.term}</h3>
                  <p className="mt-1 text-sm text-text-muted">{entry.short}</p>
                </div>
                {entry.source ? <Tag>{SOURCE_LABEL[entry.source]}</Tag> : null}
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-medium text-text">What it is</dt>
                  <dd className="mt-1 text-text-muted">{entry.whatItIs}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">Why it matters</dt>
                  <dd className="mt-1 text-text-muted">{entry.whyItMatters}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">How we measure it</dt>
                  <dd className="mt-1 text-text-muted">{entry.howWeMeasure}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">Good looks like</dt>
                  <dd className="mt-1 text-text-muted">{entry.whatGoodLooksLike}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">What to do next</dt>
                  <dd className="mt-1 text-text-muted">{entry.whatToDoNext}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRulesPanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');

  const { data, isLoading, error } = useQuery<AuditRulesResponse>({
    queryKey: ['help-audit-rules'],
    queryFn: () => api<AuditRulesResponse>('/audit-rules'),
  });

  const rules = data?.rules ?? [];
  const categories = useMemo(
    () => [...new Set(rules.map((r) => r.category))].sort(),
    [rules],
  );
  const layers = useMemo(() => [...new Set(rules.map((r) => r.layer))].sort(), [rules]);
  const severities = useMemo(
    () => [...new Set(rules.map((r) => r.defaultSeverity))].sort(),
    [rules],
  );

  const filtered = useMemo(
    () =>
      rules.filter((rule) => {
        if (!matchesRule(rule, query.trim())) return false;
        if (layer !== 'all' && rule.layer !== layer) return false;
        if (severity !== 'all' && rule.defaultSeverity !== severity) return false;
        if (category !== 'all' && rule.category !== category) return false;
        return true;
      }),
    [rules, query, layer, severity, category],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface/70 p-4">
        <p className="text-sm text-text-muted">
          These are the audit rules currently implemented in the product. Use this tab to learn
          what each rule checks, why it matters, who usually owns the fix, and how the fix should
          be validated.
        </p>
        {data ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag>Total {data.summary.total}</Tag>
            <Tag color="green">Active {data.summary.active}</Tag>
            {data.summary.experimental > 0 ? (
              <Tag color="orange">Experimental {data.summary.experimental}</Tag>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          prefix={<Search size={15} className="text-text-subtle" />}
          placeholder="Search rules, categories, inputs, or fixes"
          aria-label="Search audit rules"
        />
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={layer}
            onChange={setLayer}
            options={[
              { value: 'all', label: 'All layers' },
              ...layers.map((v) => ({ value: v, label: v })),
            ]}
          />
          <Select
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((v) => ({ value: v, label: v })),
            ]}
          />
          <Select
            value={severity}
            onChange={setSeverity}
            options={[
              { value: 'all', label: 'All severity' },
              ...severities.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
      </div>

      <div className="text-xs text-text-subtle">
        {isLoading
          ? 'Loading audit rules...'
          : `Showing ${filtered.length} of ${rules.length} rules`}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Audit rules could not be loaded. Check that the backend is running.
        </div>
      ) : filtered.length === 0 && !isLoading ? (
        <Empty description="No matching audit rules" />
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => (
            <article
              key={rule.id}
              className="rounded-lg border border-border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text">{rule.name}</h3>
                  <p className="mt-1 break-all text-xs text-text-subtle">{rule.id}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Tag>{rule.scope}</Tag>
                  <Tag>{rule.defaultSeverity}</Tag>
                  <Tag>{rule.lifecycle}</Tag>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag>{rule.layer}</Tag>
                <Tag>{rule.category}</Tag>
                <Tag>{rule.pack}</Tag>
                {rule.ownerHint ? <Tag>owner: {rule.ownerHint}</Tag> : null}
                <Tag>impact: {rule.defaultImpact}</Tag>
                <Tag>effort: {rule.defaultEffort}</Tag>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-medium text-text">What it checks</dt>
                  <dd className="mt-1 text-text-muted">{rule.description}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">Why it matters</dt>
                  <dd className="mt-1 text-text-muted">{rule.whyItMatters}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text">Recommended fix</dt>
                  <dd className="mt-1 text-text-muted">{rule.recommendationTemplate}</dd>
                </div>
                {rule.defaultValidationMethod ? (
                  <div>
                    <dt className="font-medium text-text">How to validate</dt>
                    <dd className="mt-1 text-text-muted">{rule.defaultValidationMethod}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-medium text-text">Data needed</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {rule.requiredInputs.map((input) => (
                      <Tag key={input}>{input}</Tag>
                    ))}
                    {rule.optionalInputs.map((input) => (
                      <Tag key={input}>optional: {input}</Tag>
                    ))}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function FloatingHelp(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FloatButton
        icon={<CircleHelp size={18} />}
        tooltip="Tool guide, audit rules, and glossary"
        onClick={() => setOpen(true)}
        className="!right-5 !bottom-5"
      />
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <BookOpenCheck size={18} className="text-accent-hover" />
            <span>Tool Guide</span>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={680}
        destroyOnClose={false}
      >
        <Tabs
          items={[
            { key: 'guide', label: 'How to use', children: <GuidePanel /> },
            { key: 'rules', label: 'Audit rules', children: <AuditRulesPanel /> },
            { key: 'glossary', label: 'Glossary', children: <GlossaryPanel /> },
          ]}
        />
      </Drawer>
    </>
  );
}
