'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Settings as SettingsIcon,
  Sparkles,
  Activity,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Tooltip } from 'antd';
import { cn } from '../lib/cn';
import { ThemeToggle } from './ThemeToggle';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Workspace', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/workspace/jobs', label: 'Jobs', icon: ListChecks },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const COLLAPSE_KEY = 'boffin.sidebar.collapsed';

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname() ?? '/';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(COLLAPSE_KEY);
      if (v === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (): void => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen flex bg-bg text-text">
      <aside
        className={cn(
          'hidden md:flex shrink-0 flex-col border-r border-border bg-surface/40 backdrop-blur-sm',
          // Sidebar stays pinned + scrolls internally, never elongates with page content.
          'sticky top-0 h-screen overflow-y-auto',
          collapsed ? 'w-14' : 'w-60',
          'transition-[width] duration-150',
        )}
        aria-label="Primary navigation"
      >
        <div
          className={cn(
            'h-14 flex items-center gap-2 border-b border-border',
            collapsed ? 'px-2 justify-center' : 'px-4',
          )}
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-text-onaccent shrink-0">
            <Sparkles size={14} />
          </span>
          {!collapsed ? (
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-text truncate"
            >
              Boffin SEO
              <span className="ml-1 text-text-subtle text-[10px] uppercase tracking-wider">v2</span>
            </Link>
          ) : null}
        </div>
        <nav className={cn('flex-1 py-3 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')}>
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            const linkEl = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center px-2 py-2' : 'px-3 py-1.5',
                  active
                    ? 'bg-accent-soft text-text'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text',
                )}
              >
                <Icon
                  size={15}
                  className={cn(
                    'transition-colors shrink-0',
                    active ? 'text-accent-hover' : 'text-text-subtle group-hover:text-text-muted',
                  )}
                />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href} title={item.label} placement="right">
                {linkEl}
              </Tooltip>
            ) : (
              linkEl
            );
          })}
        </nav>
        <div
          className={cn(
            'border-t border-border flex items-center gap-2 py-3',
            collapsed ? 'flex-col px-1.5' : 'justify-between px-3',
          )}
        >
          {!collapsed ? (
            <div className="flex items-center gap-2 text-xs text-text-subtle">
              <Activity size={12} />
              <span>Local</span>
            </div>
          ) : (
            <Activity size={12} className="text-text-subtle" />
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Tooltip
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              placement="right"
            >
              <button
                type="button"
                onClick={toggle}
                className="grid h-7 w-7 place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between gap-2 px-4 border-b border-border bg-surface/40 backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-text-onaccent">
              <Sparkles size={14} />
            </span>
            Boffin SEO
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 min-w-0 mx-auto w-full max-w-[1320px] px-4 md:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
