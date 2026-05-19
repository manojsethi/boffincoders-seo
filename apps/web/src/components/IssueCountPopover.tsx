'use client';

import { Popover } from 'antd';
import Link from 'next/link';
import { cn } from '../lib/cn';

type Counts = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

type TopIssue = { id: string; title: string; severity: string; priority: number };

const SEV_COLOR: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-warning',
  low: 'text-info',
  info: 'text-text-subtle',
};

/**
 * Doc 3 §"Issue Count Popover". Trigger element is the integer count itself.
 */
export function IssueCountPopover({
  counts,
  topIssue,
  topIssues,
  pageWorkspaceHref,
  pageIssuesHref,
}: {
  counts: Counts;
  topIssue?: TopIssue | null;
  topIssues?: TopIssue[];
  pageWorkspaceHref: string;
  pageIssuesHref: string;
}): JSX.Element {
  if (counts.total === 0) {
    return <span className="text-text-subtle tabular-nums">0</span>;
  }

  const content = (
    <div className="max-w-xs w-64 text-xs space-y-2 text-text">
      <div className="text-sm font-semibold">{counts.total} open issues</div>
      <ul className="space-y-1">
        {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
          const v = counts[sev];
          if (v === 0) return null;
          return (
            <li key={sev} className="flex items-center justify-between">
              <span className={cn('capitalize', SEV_COLOR[sev])}>{sev}</span>
              <span className="tabular-nums">{v}</span>
            </li>
          );
        })}
      </ul>
      {(topIssues && topIssues.length > 0) || topIssue ? (
        <div className="pt-2 border-t border-border">
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
            Top issues
          </div>
          <ul className="space-y-1">
            {(topIssues && topIssues.length > 0
              ? topIssues
              : topIssue
                ? [topIssue]
                : []
            )
              .slice(0, 3)
              .map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <span className={cn('capitalize w-12 shrink-0', SEV_COLOR[t.severity])}>
                    {t.severity}
                  </span>
                  <span className="text-text break-words">{t.title}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Link href={pageIssuesHref} className="text-accent-hover hover:underline">
          View page issues
        </Link>
        <span className="text-text-subtle">·</span>
        <Link href={pageWorkspaceHref} className="text-accent-hover hover:underline">
          Open page
        </Link>
      </div>
    </div>
  );

  const dominant =
    counts.critical > 0
      ? 'critical'
      : counts.high > 0
        ? 'high'
        : counts.medium > 0
          ? 'medium'
          : counts.low > 0
            ? 'low'
            : 'info';

  return (
    <Popover content={content} trigger={['hover', 'click']} placement="right">
      <button
        type="button"
        className={cn(
          'tabular-nums font-medium hover:underline cursor-pointer',
          SEV_COLOR[dominant],
        )}
      >
        {counts.total}
      </button>
    </Popover>
  );
}
