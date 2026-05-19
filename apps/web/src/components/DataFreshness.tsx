import { Clock } from 'lucide-react';
import { TermLabel } from './TermLabel';

/**
 * Inline freshness chip. Pairs with every dashboard section so the analyst knows whether the
 * decision is grounded on current data. Doc 7 §"Chart Rules".
 */
export function DataFreshness({
  source,
  lastSyncedAt,
  rangeStart,
  rangeEnd,
  notConnectedHint,
}: {
  source: 'GSC' | 'GA4' | 'CWV';
  lastSyncedAt?: string | Date | null;
  rangeStart?: string | Date | null;
  rangeEnd?: string | Date | null;
  notConnectedHint?: string;
}): JSX.Element {
  if (!lastSyncedAt && !rangeEnd) {
    return (
      <div className="inline-flex items-center gap-2 text-[11px] text-text-subtle">
        <Clock size={12} />
        <TermLabel term="data-freshness">No {source} data yet.</TermLabel>
        {notConnectedHint ? <span>{notConnectedHint}</span> : null}
      </div>
    );
  }
  const fmt = (d?: string | Date | null): string =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : '—';
  const synced = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const ageH = synced ? (Date.now() - synced.getTime()) / 3600_000 : null;
  return (
    <div className="inline-flex items-center gap-2 text-[11px] text-text-muted">
      <Clock size={12} />
      <TermLabel term="data-freshness">
        <span>
          {source}: {rangeStart && rangeEnd ? `${fmt(rangeStart)} → ${fmt(rangeEnd)}` : fmt(rangeEnd)}
        </span>
      </TermLabel>
      {synced ? (
        <span className={ageH != null && ageH > 48 ? 'text-amber-500' : 'text-text-subtle'}>
          · synced {ageH != null && ageH < 1 ? 'just now' : ageH != null && ageH < 24 ? `${Math.round(ageH)}h ago` : `${Math.round((ageH ?? 0) / 24)}d ago`}
        </span>
      ) : null}
    </div>
  );
}
