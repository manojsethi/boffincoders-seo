import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  noPadding = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}): JSX.Element {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]',
        className,
      )}
    >
      {(title || actions || description) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-text leading-tight">{title}</h2> : null}
            {description ? (
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={cn(!noPadding && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
