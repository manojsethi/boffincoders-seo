'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/cn';

const TABS = [
  { key: 'search', label: 'Search Performance', desc: 'GSC' },
  { key: 'traffic', label: 'Traffic', desc: 'GA4' },
  { key: 'cwv', label: 'Core Web Vitals', desc: 'PSI/CrUX' },
];

export function DashboardsTabs({ projectId }: { projectId: string }): JSX.Element {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectId}/dashboards`;
  return (
    <div className="mb-4 inline-flex items-center rounded-lg border border-border bg-surface p-1 text-xs">
      {TABS.map((t) => {
        const href = `${base}/${t.key}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              'px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-2',
              active
                ? 'bg-accent/15 text-text'
                : 'text-text-muted hover:text-text',
            )}
          >
            <span>{t.label}</span>
            <span className="text-[10px] text-text-subtle uppercase tracking-wider">{t.desc}</span>
          </Link>
        );
      })}
    </div>
  );
}
