import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function ChartContainer({
  title,
  subtitle,
  height = 240,
  empty,
  emptyLabel = 'Not enough data yet',
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  height?: number;
  empty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-4',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]',
        className,
      )}
    >
      {(title || subtitle || actions) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title ? (
              <h3 className="text-sm font-semibold text-text leading-tight">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div style={{ height }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-xs text-text-subtle">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
