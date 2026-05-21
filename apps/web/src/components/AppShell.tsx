'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Drawer, Tooltip } from 'antd';
import {
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { ThemeToggle } from './ThemeToggle';
import { FloatingHelp } from './FloatingHelp';
import { ProjectSwitcher } from './ProjectSwitcher';
import type { ReactNode } from 'react';

/**
 * Global app shell. Phase 10 navigation pass.
 *
 * Workspace-level only. No project modules here — those live in the project sidebar (see
 * `ProjectShell`). Designed to stay compact: logo + 3 workspace links + project switcher (only
 * inside a project) + theme + help. Mobile collapses links into a drawer.
 */

const NAV = [
  { href: '/', label: 'Workspace', icon: LayoutDashboard, match: (p: string) => p === '/' },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    match: (p: string) => p === '/projects' || p === '/projects/new',
  },
  {
    href: '/workspace/jobs',
    label: 'Jobs',
    icon: ListChecks,
    match: (p: string) => p.startsWith('/workspace/jobs'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    match: (p: string) => p === '/settings' || p.startsWith('/settings/'),
  },
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever route changes — analyst expects a link tap to navigate AND
  // dismiss the menu.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isInProject = /^\/projects\/[a-f0-9]{24}/i.test(pathname);
  // Project routes get their own padded main from ProjectShell. Everything else (workspace
  // overview, project list, global settings, etc.) needs page-level padding here, otherwise
  // content runs to viewport edges.
  const needsPagePadding = !isInProject;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-3 md:px-5 border-b border-border bg-surface/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-text-onaccent">
            <Sparkles size={14} />
          </span>
          <span className="font-semibold tracking-tight text-sm hidden sm:inline">
            Boffin SEO
            <span className="ml-1 text-text-subtle text-[10px] uppercase tracking-wider">v2</span>
          </span>
        </Link>

        <div className="flex-1" />

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent-soft text-text'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text',
                )}
              >
                <Icon size={14} className={active ? 'text-accent-hover' : 'text-text-subtle'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {isInProject ? (
          <div className="hidden md:block">
            <ProjectSwitcher />
          </div>
        ) : null}

        <Tooltip title="Toggle theme" placement="bottom">
          <span>
            <ThemeToggle />
          </span>
        </Tooltip>

        <button
          type="button"
          className="md:hidden grid h-9 w-9 place-items-center rounded-md hover:bg-surface-hover"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon size={18} />
        </button>
      </header>

      <main
        className={cn(
          'flex-1 min-w-0',
          needsPagePadding && 'mx-auto w-full max-w-[1320px] px-4 md:px-8 py-6',
        )}
      >
        {children}
      </main>

      <Drawer
        placement="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closeIcon={<X size={16} />}
        width={280}
        title="Workspace"
      >
        <div className="space-y-1">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  active
                    ? 'bg-accent-soft text-text'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text',
                )}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
          {isInProject ? (
            <div className="pt-3 border-t border-border mt-3">
              <ProjectSwitcher />
            </div>
          ) : null}
        </div>
      </Drawer>

      <FloatingHelp />
    </div>
  );
}
