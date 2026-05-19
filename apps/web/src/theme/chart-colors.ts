// Recharts reads colors via CSS variables so charts re-color on theme switch.

const v = (name: string): string => `var(--${name})`;

export const chartColors = {
  severity: {
    critical: v('c-sev-critical'),
    high: v('c-sev-high'),
    medium: v('c-sev-medium'),
    low: v('c-sev-low'),
    info: v('c-sev-info'),
  },
  category: {
    'crawl-indexing': v('c-cat-crawl'),
    'on-page': v('c-cat-on-page'),
    'content-quality': v('c-cat-content'),
    'internal-links': v('c-cat-links'),
    'structured-data': v('c-cat-schema'),
    performance: v('c-cat-perf'),
    'eeat-trust': v('c-cat-trust'),
    'ai-geo-aeo': v('c-cat-geo'),
    conversion: v('c-cat-conv'),
    measurement: v('c-cat-meas'),
  },
  state: {
    success: v('c-success'),
    warning: v('c-warning'),
    danger: v('c-danger'),
    info: v('c-info'),
  },
  series: [
    v('c-accent'),
    v('c-cat-geo'),
    v('c-success'),
    v('c-warning'),
    v('c-cat-links'),
    v('c-cat-schema'),
    v('c-sev-high'),
    v('c-text-muted'),
  ],
  grid: v('c-chart-grid'),
  axis: v('c-chart-axis'),
  tooltipBg: v('c-tooltip-bg'),
  tooltipBorder: v('c-tooltip-border'),
  accent: v('c-accent'),
  textMuted: v('c-text-muted'),
} as const;

export function severityColor(s: string): string {
  return chartColors.severity[s as keyof typeof chartColors.severity] ?? chartColors.textMuted;
}
export function categoryColor(c: string): string {
  return chartColors.category[c as keyof typeof chartColors.category] ?? chartColors.textMuted;
}
