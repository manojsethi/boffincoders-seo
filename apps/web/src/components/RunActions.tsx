'use client';

import { Button, App } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bot, FileText, Globe, ListChecks } from 'lucide-react';
import { api } from '../lib/api';

type ActionKey = 'crawl' | 'audit' | 'ai' | 'report';

const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  path: string;
  body: Record<string, unknown>;
  disableWhen: string[];
  icon: typeof Globe;
}> = [
  {
    key: 'crawl',
    label: 'Run crawl',
    path: '/crawl',
    body: { mode: 'first', maxPages: 100 },
    disableWhen: ['crawling'],
    icon: Globe,
  },
  {
    key: 'audit',
    label: 'Run audit',
    path: '/audit',
    body: {},
    disableWhen: ['auditing', 'crawling'],
    icon: ListChecks,
  },
  {
    key: 'ai',
    label: 'Run AI analysis',
    path: '/ai-analysis',
    body: {},
    disableWhen: [],
    icon: Bot,
  },
  {
    key: 'report',
    label: 'Generate report',
    path: '/reports',
    body: { type: 'initial-audit', view: 'client' },
    disableWhen: [],
    icon: FileText,
  },
];

// Map lifecycle state -> the recommended primary action key.
const PRIMARY_BY_STATE: Record<string, ActionKey> = {
  'ready-for-first-crawl': 'crawl',
  'crawl-needs-review': 'crawl',
  'ready-for-initial-audit': 'audit',
  'ready-for-ai-analysis': 'ai',
  'profile-needs-review': 'ai',
  'active-issues': 'report',
  'ready-to-report': 'report',
  'verification-needed': 'crawl',
};

export function RunActions({
  projectId,
  lifecycleState,
}: {
  projectId: string;
  lifecycleState: string;
}): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const primary = PRIMARY_BY_STATE[lifecycleState];

  const trigger = async (action: (typeof ACTIONS)[number]): Promise<void> => {
    setBusy(action.key);
    try {
      await api(`/projects/${projectId}${action.path}`, {
        method: 'POST',
        body: JSON.stringify(action.body),
      });
      message.success(`${action.label} queued`);
      router.refresh();
      void qc.invalidateQueries({ queryKey: ['project-overview', projectId] });
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACTIONS.map((a) => {
        const isPrimary = primary === a.key;
        const Icon = a.icon;
        return (
          <Button
            key={a.key}
            type={isPrimary ? 'primary' : 'default'}
            loading={busy === a.key}
            disabled={a.disableWhen.includes(lifecycleState)}
            onClick={() => trigger(a)}
            icon={<Icon size={14} />}
            iconPosition="start"
          >
            <span className="inline-flex items-center gap-1">
              {a.label}
              {isPrimary ? <ArrowRight size={12} /> : null}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
