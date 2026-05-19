import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Compact KPI tile with current value, delta vs previous period, and optional info icon.
 * Used by every dashboard. Doc 7 §"Chart Rules" — every metric must be sourced + dated.
 */
export function KpiCard({
  label,
  value,
  previous,
  format = 'number',
  inverse = false,
  caption,
}: {
  label: ReactNode;
  value: number | null | undefined;
  previous?: number | null;
  format?: 'number' | 'percent' | 'ms' | 'position';
  inverse?: boolean; // true when lower is better (e.g. position, LCP)
  caption?: ReactNode;
}): JSX.Element {
  const fmt = (v: number | null | undefined): string => {
    if (v == null) return '—';
    if (format === 'percent') return `${(v * 100).toFixed(2)}%`;
    if (format === 'ms') return `${Math.round(v).toLocaleString()} ms`;
    if (format === 'position') return v.toFixed(1);
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  let delta: number | null = null;
  let deltaPct: number | null = null;
  if (value != null && previous != null) {
    delta = value - previous;
    deltaPct = previous !== 0 ? delta / previous : null;
  }
  const improving = delta != null && (inverse ? delta < 0 : delta > 0);
  const worsening = delta != null && delta !== 0 && (inverse ? delta > 0 : delta < 0);
  const Icon = delta == null || delta === 0 ? ArrowRight : improving ? ArrowUp : ArrowDown;
  const trendColor = improving
    ? 'text-emerald-500'
    : worsening
      ? 'text-rose-500'
      : 'text-text-subtle';

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 min-w-[160px] flex-1">
      <div className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-text">{fmt(value)}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] tabular-nums">
        <Icon size={12} className={trendColor} />
        <span className={trendColor}>
          {delta == null
            ? 'no prior period'
            : deltaPct != null
              ? `${(deltaPct * 100).toFixed(1)}% vs prev`
              : `${fmt(delta)} vs prev`}
        </span>
      </div>
      {caption ? <div className="mt-1 text-[11px] text-text-subtle">{caption}</div> : null}
    </div>
  );
}

export function KpiRow({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('flex flex-wrap gap-3 mb-4', className)}>{children}</div>;
}
