import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-muted text-text-subtle">
        {icon ?? <Inbox size={18} />}
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? (
        <p className="text-xs text-text-muted mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
