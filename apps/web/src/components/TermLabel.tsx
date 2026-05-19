import { InfoIcon } from './InfoIcon';
import { cn } from '../lib/cn';
import type { ReactNode } from 'react';

/**
 * Inline label paired with an info icon. Doc 9 §"Where Info Icons Must Appear".
 * `term` matches a key from glossary/index.ts.
 */
export function TermLabel({
  term,
  children,
  className,
}: {
  term: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{children}</span>
      <InfoIcon term={term} />
    </span>
  );
}
