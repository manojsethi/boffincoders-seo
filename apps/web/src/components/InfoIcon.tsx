'use client';

import { Popover } from 'antd';
import { HelpCircle } from 'lucide-react';
import { lookupGlossary } from '../glossary';
import { cn } from '../lib/cn';

const SOURCE_LABEL: Record<string, string> = {
  crawl: 'Crawl',
  gsc: 'Search Console',
  ga4: 'GA4',
  cwv: 'Core Web Vitals',
  analyst: 'Analyst input',
  ai: 'AI inference',
};

/**
 * Inline info icon backed by the glossary. Doc 9 §"Where Info Icons Must Appear".
 * Renders a popover with: what / why / how measured / good vs bad / next action / source.
 *
 * Usage: <InfoIcon term="canonical" />
 *
 * If the term is unknown we render a question-mark with the literal term as fallback so
 * we never silently swallow missing glossary entries.
 */
export function InfoIcon({
  term,
  className,
  size = 13,
}: {
  term: string;
  className?: string;
  size?: number;
}): JSX.Element {
  const entry = lookupGlossary(term);
  const content = entry ? (
    <div className="max-w-xs space-y-2 text-xs leading-relaxed text-text">
      <div className="font-semibold text-sm text-text">{entry.term}</div>
      <p className="text-text-muted">{entry.whatItIs}</p>
      <Row label="Why it matters" body={entry.whyItMatters} />
      <Row label="How we measure" body={entry.howWeMeasure} />
      <Row label="What good looks like" body={entry.whatGoodLooksLike} />
      <Row label="Next step" body={entry.whatToDoNext} />
      {entry.source ? (
        <div className="pt-1 border-t border-border text-[11px] text-text-subtle">
          Source: {SOURCE_LABEL[entry.source] ?? entry.source}
        </div>
      ) : null}
    </div>
  ) : (
    <div className="max-w-xs text-xs text-text-muted">
      No glossary entry for <code>{term}</code>. Add one in <code>src/glossary/index.ts</code>.
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottom" overlayClassName="seo-info-popover">
      <button
        type="button"
        aria-label={`What is ${entry?.term ?? term}?`}
        className={cn(
          'inline-flex items-center justify-center text-text-subtle hover:text-accent-hover transition-colors align-middle',
          className,
        )}
      >
        <HelpCircle size={size} />
      </button>
    </Popover>
  );
}

function Row({ label, body }: { label: string; body: string }): JSX.Element {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-subtle">{label}</div>
      <div className="text-text-muted">{body}</div>
    </div>
  );
}
