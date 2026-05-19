import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1.5">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-text leading-tight truncate">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-text-muted mt-1 max-w-2xl">{subtitle}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
