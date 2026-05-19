import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/cn';

type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const TONE_VALUE: Record<Tone, string> = {
  neutral: 'text-text',
  positive: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-text-subtle',
  positive: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function MetricTile({
  label,
  value,
  delta,
  trend,
  tone = 'neutral',
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  trend?: 'up' | 'down';
  tone?: Tone;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-surface p-4 flex flex-col gap-1.5 overflow-hidden',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]',
        'transition-colors hover:bg-surface-hover/40',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />
          {label}
        </span>
        {icon ? <span className="text-text-subtle">{icon}</span> : null}
      </div>
      <span className={cn('text-2xl font-semibold leading-tight tabular-nums', TONE_VALUE[tone])}>
        {value}
      </span>
      {delta ? (
        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
          {delta}
        </span>
      ) : null}
      {hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
    </div>
  );
}
