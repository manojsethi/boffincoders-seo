'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Dropdown, Tag } from 'antd';
import { Archive, Check, ChevronDown, Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn } from '../lib/cn';

type ProjectListRow = {
  id: string;
  clientName: string;
  siteName: string;
  primaryDomain: string;
  status: 'active' | 'paused' | 'archived';
};

/**
 * Compact project switcher mounted in the global top bar inside a project. Shows current project
 * + dropdown of other active projects with optional toggle to surface archived projects.
 */
export function ProjectSwitcher(): JSX.Element | null {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const currentId = (params?.id as string | undefined) ?? '';
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filter, setFilter] = useState('');

  const activeQ = useQuery<ProjectListRow[]>({
    queryKey: ['projects-list', 'active'],
    queryFn: () => api<ProjectListRow[]>(`/projects`),
  });
  const archivedQ = useQuery<ProjectListRow[]>({
    queryKey: ['projects-list', 'archived'],
    queryFn: () => api<ProjectListRow[]>(`/projects?status=archived`),
    enabled: includeArchived,
  });

  const all = useMemo(() => {
    const base = activeQ.data ?? [];
    if (includeArchived && archivedQ.data) return [...base, ...archivedQ.data];
    return base;
  }, [activeQ.data, archivedQ.data, includeArchived]);

  const current = all.find((p) => p.id === currentId) ?? null;
  const fLower = filter.trim().toLowerCase();
  const others = all
    .filter((p) => p.id !== currentId)
    .filter((p) =>
      fLower
        ? `${p.siteName} ${p.clientName} ${p.primaryDomain}`.toLowerCase().includes(fLower)
        : true,
    )
    .slice(0, 30);

  if (!currentId) return null;

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={() => (
        <div className="w-[320px] rounded-md border border-border bg-surface shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Search size={14} className="text-text-subtle" />
            <input
              autoFocus
              placeholder="Search projects"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-subtle"
            />
          </div>
          <ul className="max-h-[300px] overflow-y-auto py-1">
            {others.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-subtle">No other projects match.</li>
            ) : (
              others.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-sm flex items-start gap-2"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-text truncate">{p.siteName}</div>
                      <div className="text-[11px] text-text-subtle truncate font-mono">
                        {p.primaryDomain}
                      </div>
                    </div>
                    {p.status === 'archived' ? (
                      <Tag color="default" className="m-0 text-[10px]">
                        archived
                      </Tag>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-text-muted">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Show archived
            </label>
            <button
              type="button"
              onClick={() => router.push('/projects/new')}
              className="inline-flex items-center gap-1 text-accent-hover hover:underline"
            >
              <Plus size={12} /> New project
            </button>
          </div>
        </div>
      )}
    >
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-hover max-w-[280px]',
        )}
      >
        <span className="flex flex-col items-start min-w-0">
          <span className="text-text font-medium text-[13px] truncate max-w-[200px]">
            {current?.siteName ?? 'Loading…'}
          </span>
          {current ? (
            <span className="text-[10px] text-text-subtle font-mono truncate max-w-[200px]">
              {current.primaryDomain}
            </span>
          ) : null}
        </span>
        {current?.status === 'archived' ? (
          <Tag color="default" className="m-0 text-[10px]">
            <Archive size={10} className="inline mr-0.5" />
            archived
          </Tag>
        ) : null}
        <ChevronDown size={14} className="text-text-subtle" />
      </button>
    </Dropdown>
  );
}
