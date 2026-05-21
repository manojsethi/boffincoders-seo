'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Drawer, Popover, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { ArchivedBanner } from './ArchivedBanner';

/**
 * Project shell — left sidebar grouping project modules by analyst workflow.
 *
 * Doc 10 §"Project-Level Sidebar":
 *  Setup → Audit → Growth → Execution → Performance → Reporting → Settings.
 *
 * Behavior:
 *  - active item matches nested routes (e.g. /projects/:id/pages/:pageId still highlights Pages).
 *  - group containing active item auto-opens.
 *  - desktop collapse toggle persists in localStorage; collapsed = icons + tooltips.
 *  - mobile uses a drawer.
 *  - archived banner sits above the page content when project.status === 'archived'.
 */

type ProjectSummary = {
  id: string;
  status: 'active' | 'paused' | 'archived';
  siteName: string;
  primaryDomain: string;
  archivedAt: string | null;
  archivedReason: string | null;
};

type Item = {
  key: string;
  label: string;
  href: (id: string) => string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match: (path: string, id: string) => boolean;
};

type Group = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: Item[];
};

function startsWith(href: string): (path: string) => boolean {
  return (path: string) => path === href || path.startsWith(`${href}/`) || path.startsWith(`${href}?`);
}

const GROUPS: Group[] = [
  {
    key: 'command',
    label: 'Command Center',
    icon: Compass,
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: (id) => `/projects/${id}`,
        icon: LayoutDashboard,
        match: (path, id) => path === `/projects/${id}`,
      },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    icon: SettingsIcon,
    items: [
      {
        key: 'profile',
        label: 'Profile',
        href: (id) => `/projects/${id}/profile`,
        icon: Sparkles,
        match: (path, id) => startsWith(`/projects/${id}/profile`)(path),
      },
      {
        key: 'goals',
        label: 'Goals',
        href: (id) => `/projects/${id}/goals`,
        icon: Target,
        match: (path, id) => startsWith(`/projects/${id}/goals`)(path),
      },
      {
        key: 'integrations',
        label: 'Integrations',
        href: (id) => `/projects/${id}/settings/integrations`,
        icon: Globe,
        match: (path, id) => path.startsWith(`/projects/${id}/settings/integrations`),
      },
      {
        key: 'crawl-settings',
        label: 'Crawl settings',
        href: (id) => `/projects/${id}/settings/crawl`,
        icon: Workflow,
        match: (path, id) => path.startsWith(`/projects/${id}/settings/crawl`),
      },
      {
        key: 'monitoring',
        label: 'Monitoring',
        href: (id) => `/projects/${id}/monitoring`,
        icon: Gauge,
        match: (path, id) => startsWith(`/projects/${id}/monitoring`)(path),
      },
    ],
  },
  {
    key: 'audit',
    label: 'Audit & Evidence',
    icon: ClipboardCheck,
    items: [
      {
        key: 'pages',
        label: 'Pages',
        href: (id) => `/projects/${id}/pages`,
        icon: FileText,
        match: (path, id) => startsWith(`/projects/${id}/pages`)(path),
      },
      {
        key: 'issues',
        label: 'Issues',
        href: (id) => `/projects/${id}/issues`,
        icon: AlertTriangle,
        match: (path, id) =>
          startsWith(`/projects/${id}/issues`)(path) && !/[?&]rec=/.test(path),
      },
      {
        key: 'recommendations',
        label: 'Recommendations',
        href: (id) => `/projects/${id}/issues?rec=draft`,
        icon: Sparkles,
        match: (path, id) =>
          startsWith(`/projects/${id}/issues`)(path) && /[?&]rec=/.test(path),
      },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    icon: Zap,
    items: [
      {
        key: 'keywords',
        label: 'Keywords',
        href: (id) => `/projects/${id}/keywords`,
        icon: KeyRound,
        match: (path, id) => startsWith(`/projects/${id}/keywords`)(path),
      },
      {
        key: 'opportunities',
        label: 'Opportunities',
        href: (id) => `/projects/${id}/opportunities`,
        icon: Sparkles,
        match: (path, id) => startsWith(`/projects/${id}/opportunities`)(path),
      },
      {
        key: 'briefs',
        label: 'Content briefs',
        href: (id) => `/projects/${id}/content-briefs`,
        icon: FileText,
        match: (path, id) => startsWith(`/projects/${id}/content-briefs`)(path),
      },
    ],
  },
  {
    key: 'execution',
    label: 'Execution',
    icon: ClipboardList,
    items: [
      {
        key: 'fix-plans',
        label: 'Fix plans',
        href: (id) => `/projects/${id}/fix-plans`,
        icon: ClipboardList,
        match: (path, id) => startsWith(`/projects/${id}/fix-plans`)(path),
      },
      {
        key: 'jobs',
        label: 'Jobs',
        href: (id) => `/projects/${id}/jobs`,
        icon: ListChecks,
        match: (path, id) => startsWith(`/projects/${id}/jobs`)(path),
      },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    icon: LineChart,
    items: [
      {
        key: 'dashboards',
        label: 'Dashboards',
        href: (id) => `/projects/${id}/dashboards`,
        icon: BarChart3,
        match: (path, id) => startsWith(`/projects/${id}/dashboards`)(path),
      },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    icon: FlaskConical,
    items: [
      {
        key: 'reports',
        label: 'Reports',
        href: (id) => `/projects/${id}/reports`,
        icon: Briefcase,
        match: (path, id) => startsWith(`/projects/${id}/reports`)(path),
      },
    ],
  },
  {
    key: 'project-settings',
    label: 'Project Settings',
    icon: SettingsIcon,
    items: [
      {
        key: 'settings',
        label: 'General settings',
        href: (id) => `/projects/${id}/settings`,
        icon: SettingsIcon,
        match: (path, id) =>
          path === `/projects/${id}/settings` ||
          (path.startsWith(`/projects/${id}/settings`) &&
            !path.startsWith(`/projects/${id}/settings/integrations`) &&
            !path.startsWith(`/projects/${id}/settings/crawl`) &&
            !path.startsWith(`/projects/${id}/settings/danger-zone`)),
      },
      {
        key: 'danger-zone',
        label: 'Danger Zone',
        href: (id) => `/projects/${id}/settings/danger-zone`,
        icon: AlertTriangle,
        match: (path, id) => path.startsWith(`/projects/${id}/settings/danger-zone`),
      },
    ],
  },
];

const COLLAPSE_KEY = 'boffin.project-sidebar.collapsed';
const OPEN_GROUPS_KEY = 'boffin.project-sidebar.openGroups';

export function ProjectShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}): JSX.Element {
  const rawPathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  // We compose pathname + search so sidebar match() can distinguish Issues vs Recommendations
  // (same /issues route, differing `?rec=` query).
  const search = searchParams?.toString() ?? '';
  const pathname = search ? `${rawPathname}?${search}` : rawPathname;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { data: project } = useQuery<ProjectSummary>({
    queryKey: ['project-shell', projectId],
    queryFn: () => api<ProjectSummary>(`/projects/${projectId}`),
  });

  // Hydrate persisted UI state.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
      const stored = window.localStorage.getItem(OPEN_GROUPS_KEY);
      if (stored) setOpenGroups(new Set(JSON.parse(stored) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  // Whichever group contains the active item must be open. We never close that group
  // automatically — analyst flips other groups themselves.
  const activeItem = useMemo(() => {
    for (const g of GROUPS) {
      for (const it of g.items) {
        if (it.match(pathname, projectId)) {
          return { group: g.key, item: it.key };
        }
      }
    }
    return { group: 'command', item: 'overview' };
  }, [pathname, projectId]);

  useEffect(() => {
    setOpenGroups((prev) => {
      if (prev.has(activeItem.group)) return prev;
      const next = new Set(prev);
      next.add(activeItem.group);
      try {
        window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeItem.group]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = (): void => {
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

  const toggleGroup = (key: string): void => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Both trees stay mounted absolutely so neither contributes to the aside's intrinsic width —
  // otherwise flex `min-width: auto` would grow the aside back to ~240px when collapsed. Sized
  // wrapper takes the active tree's width (set via inline rail width). Cross-fade via opacity.
  const sidebarNav = (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          visibility: collapsed ? 'hidden' : 'visible',
          transition: 'opacity 500ms ease, visibility 0ms linear',
          transitionDelay: collapsed ? '0ms, 500ms' : '500ms, 0ms',
        }}
        aria-hidden={collapsed}
      >
        <SidebarNav
          projectId={projectId}
          pathname={pathname}
          activeItem={activeItem}
          openGroups={openGroups}
          collapsed={false}
          toggleGroup={toggleGroup}
        />
      </div>
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
          visibility: collapsed ? 'visible' : 'hidden',
          transition: 'opacity 500ms ease, visibility 0ms linear',
          transitionDelay: collapsed ? '500ms, 0ms' : '0ms, 500ms',
        }}
        aria-hidden={!collapsed}
      >
        <SidebarNav
          projectId={projectId}
          pathname={pathname}
          activeItem={activeItem}
          openGroups={openGroups}
          collapsed={true}
          toggleGroup={toggleGroup}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside
        className={cn(
          'project-sidebar hidden md:flex shrink-0 flex-col border-r border-border bg-surface/40 sticky top-14 self-start',
          'h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden',
          collapsed ? 'project-sidebar--collapsed' : '',
        )}
        aria-label="Project navigation"
      >
        <div className="flex-1 py-3">{sidebarNav}</div>
        <div
          className={cn(
            'border-t border-border flex items-center py-2',
            collapsed ? 'justify-center px-1' : 'justify-between px-3',
          )}
        >
          {!collapsed ? (
            <span className="text-[10px] uppercase tracking-wider text-text-subtle">
              Project
            </span>
          ) : null}
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="grid h-7 w-7 place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </Tooltip>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="md:hidden border-b border-border bg-surface/60 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm"
          >
            <MenuIcon size={14} />
            Project menu
          </button>
        </div>

        {project?.status === 'archived' ? (
          <ArchivedBanner
            projectId={projectId}
            archivedAt={project.archivedAt}
            reason={project.archivedReason}
          />
        ) : null}

        <main className="mx-auto w-full max-w-[1320px] px-4 md:px-8 py-6">{children}</main>
      </div>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closeIcon={<X size={16} />}
        width={280}
        title="Project"
      >
        <SidebarNav
          projectId={projectId}
          pathname={pathname}
          activeItem={activeItem}
          openGroups={openGroups}
          collapsed={false}
          toggleGroup={toggleGroup}
        />
      </Drawer>
    </div>
  );
}

function SidebarNav({
  projectId,
  pathname,
  activeItem,
  openGroups,
  collapsed,
  toggleGroup,
}: {
  projectId: string;
  pathname: string;
  activeItem: { group: string; item: string };
  openGroups: Set<string>;
  collapsed: boolean;
  toggleGroup: (key: string) => void;
}): JSX.Element {
  if (collapsed) {
    // Collapsed mode: render one icon per group. Hovering opens an AntD popover with the group's
    // items as a flyout panel. This keeps the rail short (8 icons total) and only surfaces the
    // 17 leaf items on demand. Doc 10 §"Collapsed state: show icons only".
    return (
      <nav className="space-y-1 px-1.5">
        {GROUPS.map((g) => {
          const GroupIcon = g.icon;
          const groupIsActive = activeItem.group === g.key;
          return (
            <Popover
              key={g.key}
              placement="rightTop"
              trigger={['hover', 'click']}
              mouseEnterDelay={0.05}
              mouseLeaveDelay={0.15}
              styles={{ body: { padding: 8 } }}
              content={
                <div className="min-w-[200px]">
                  <div className="px-2 pb-1.5 mb-1 border-b border-border text-[10px] uppercase tracking-wider text-text-subtle flex items-center gap-1.5">
                    <GroupIcon size={11} />
                    {g.label}
                  </div>
                  <ul className="space-y-0.5">
                    {g.items.map((it) => {
                      const isActive = it.match(pathname, projectId);
                      const Icon = it.icon;
                      return (
                        <li key={it.key}>
                          <Link
                            href={it.href(projectId)}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                              isActive
                                ? 'bg-accent-soft text-text'
                                : 'text-text-muted hover:bg-surface-hover hover:text-text',
                            )}
                          >
                            <Icon
                              size={14}
                              className={cn(
                                'shrink-0',
                                isActive ? 'text-accent-hover' : 'text-text-subtle',
                              )}
                            />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              }
            >
              <button
                type="button"
                aria-label={g.label}
                className={cn(
                  'w-full grid place-items-center rounded-md py-2 transition-colors',
                  groupIsActive
                    ? 'bg-accent-soft text-text'
                    : 'text-text-subtle hover:bg-surface-hover hover:text-text',
                )}
              >
                <GroupIcon size={16} />
              </button>
            </Popover>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1 px-2">
      {GROUPS.map((g) => {
        const isOpen = openGroups.has(g.key) || activeItem.group === g.key;
        const GroupIcon = g.icon;
        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => toggleGroup(g.key)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] uppercase tracking-wider',
                'text-text-subtle hover:text-text-muted hover:bg-surface-hover',
              )}
            >
              <span className="flex items-center gap-1.5">
                <GroupIcon size={11} />
                <span>{g.label}</span>
              </span>
              {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            {isOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-1">
                {g.items.map((it) => {
                  const isActive = it.match(pathname, projectId);
                  const Icon = it.icon;
                  return (
                    <li key={it.key}>
                      <Link
                        href={it.href(projectId)}
                        className={cn(
                          'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-accent-soft text-text'
                            : 'text-text-muted hover:bg-surface-hover hover:text-text',
                        )}
                      >
                        <Icon
                          size={14}
                          className={cn(
                            'shrink-0',
                            isActive ? 'text-accent-hover' : 'text-text-subtle',
                          )}
                        />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
