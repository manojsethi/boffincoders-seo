'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/cn';

const TABS = [
  { key: '', label: 'Overview' },
  { key: 'pages', label: 'Pages' },
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'issues', label: 'Issues' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'goals', label: 'Goals' },
  { key: 'reports', label: 'Reports' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'profile', label: 'Profile' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'settings', label: 'Settings' },
];

export function ProjectSubNav({ projectId }: { projectId: string }): JSX.Element {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectId}`;
  return (
    <nav className="mb-6 -mx-1 overflow-x-auto">
      <ul className="flex items-center gap-1 min-w-max px-1 border-b border-border">
        {TABS.map((t) => {
          const href = t.key ? `${base}/${t.key}` : base;
          const active =
            t.key === '' ? pathname === base : pathname.startsWith(`${base}/${t.key}`);
          return (
            <li key={t.key}>
              <Link
                href={href}
                className={cn(
                  'inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  active
                    ? 'border-accent text-text'
                    : 'border-transparent text-text-muted hover:text-text hover:border-border-strong',
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
