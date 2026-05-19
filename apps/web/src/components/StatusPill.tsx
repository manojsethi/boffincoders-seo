import { cn } from '../lib/cn';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const TONE: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: { bg: 'bg-surface-muted', text: 'text-text-muted', dot: 'bg-text-subtle' },
  info: { bg: 'bg-[color-mix(in_oklab,var(--c-info)_14%,transparent)]', text: 'text-info', dot: 'bg-info' },
  success: { bg: 'bg-[color-mix(in_oklab,var(--c-success)_14%,transparent)]', text: 'text-success', dot: 'bg-success' },
  warning: { bg: 'bg-[color-mix(in_oklab,var(--c-warning)_18%,transparent)]', text: 'text-warning', dot: 'bg-warning' },
  danger: { bg: 'bg-[color-mix(in_oklab,var(--c-danger)_14%,transparent)]', text: 'text-danger', dot: 'bg-danger' },
  accent: { bg: 'bg-accent-soft', text: 'text-accent-hover', dot: 'bg-accent' },
};

const STATE_TONE: Record<string, Tone> = {
  'needs-setup': 'neutral',
  'ready-for-first-crawl': 'info',
  crawling: 'info',
  'crawl-needs-review': 'warning',
  'ready-for-initial-audit': 'info',
  auditing: 'info',
  'ready-for-ai-analysis': 'info',
  'profile-needs-review': 'warning',
  'active-issues': 'accent',
  'ready-to-report': 'accent',
  monitoring: 'success',
  'verification-needed': 'warning',
  // run statuses
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  canceled: 'neutral',
  cancelled: 'neutral',
  scheduled: 'info',
  stale: 'warning',
  draft: 'neutral',
  ready: 'success',
  exported: 'success',
  sent: 'success',
  enabled: 'success',
  disabled: 'neutral',
};

const SEVERITY_TONE: Record<string, Tone> = {
  critical: 'danger',
  high: 'warning',
  medium: 'warning',
  low: 'info',
  info: 'neutral',
};

export function StatusPill({
  value,
  kind = 'state',
  showDot = true,
  className,
}: {
  value: string;
  kind?: 'state' | 'severity';
  showDot?: boolean;
  className?: string;
}): JSX.Element {
  const tone = kind === 'severity' ? (SEVERITY_TONE[value] ?? 'neutral') : (STATE_TONE[value] ?? 'neutral');
  const t = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap border border-transparent',
        t.bg,
        t.text,
        className,
      )}
    >
      {showDot ? <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} /> : null}
      <span className="capitalize">{value.replace(/-/g, ' ')}</span>
    </span>
  );
}
