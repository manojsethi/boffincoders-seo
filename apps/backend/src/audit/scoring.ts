import type {
  LayeredScoreKey,
  Priority,
  Severity,
} from '@boffin/schemas';
import type { AuditRule, Finding } from './types';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10,
};

const STATUS_DEDUCTION: Record<string, number> = {
  fail: 1,
  warning: 0.5,
  opportunity: 0.2,
  needs_review: 0.2,
};

/**
 * Compute P0/P1/P2 from severity + page importance + confidence. Doc 11 §"P0 / P1 / P2 Priority Model".
 */
export function computeActionPriority(
  severity: Severity,
  isImportantPage: boolean,
  confidence: number,
): Priority {
  if (severity === 'critical') return 'P0';
  if (severity === 'high' && isImportantPage) return 'P0';
  if (severity === 'high') return 'P1';
  if (severity === 'medium' && isImportantPage && confidence >= 0.7) return 'P1';
  if (severity === 'medium') return 'P2';
  return 'P2';
}

/**
 * Linear priority score for sorting (0-100). Doc 11 §"Priority Is Not The Same As Severity".
 */
export function computePriorityScore(finding: Finding, isImportantPage: boolean): number {
  const sev = SEVERITY_WEIGHT[finding.severity] ?? 25;
  const impact = finding.impactScore;
  const confidence = finding.confidence * 100;
  const importance = isImportantPage ? 30 : 0;
  return Math.round(sev * 0.4 + impact * 0.25 + confidence * 0.15 + importance * 0.2);
}

/**
 * Per-layered-score: tracks how much each rule deducted, what was excluded.
 */
export type LayeredScore = {
  value: number;
  applicableRuleCount: number;
  failedRuleCount: number;
  notApplicableRuleCount: number;
  notVerifiedRuleCount: number;
  topContributors: Array<{ ruleId: string; severity: Severity; affectedPages: number }>;
};

export function emptyLayeredScores(): Record<LayeredScoreKey, LayeredScore> {
  const keys: LayeredScoreKey[] = [
    'technical-foundation',
    'content-relevance',
    'trust-entity',
    'search-performance',
    'conversion-readiness',
    'ai-visibility',
    'integration-health',
  ];
  const out = {} as Record<LayeredScoreKey, LayeredScore>;
  for (const k of keys) {
    out[k] = {
      value: 100,
      applicableRuleCount: 0,
      failedRuleCount: 0,
      notApplicableRuleCount: 0,
      notVerifiedRuleCount: 0,
      topContributors: [],
    };
  }
  return out;
}

/**
 * Map a rule layer onto its score bucket. Doc 11 §"Use Separate Scores".
 */
export function layerToScoreKey(rule: AuditRule): LayeredScoreKey {
  return rule.scoresInto;
}

/**
 * Compute layered scores from all findings + the rule registry. Doc 11 §"Missing Data Must Not Penalize Blindly":
 * - not_applicable does not penalize.
 * - not_verified does not penalize; it inflates integration-health gap instead.
 */
export function computeLayeredScores(
  findings: Finding[],
  registry: AuditRule[],
): Record<LayeredScoreKey, LayeredScore> {
  const out = emptyLayeredScores();
  const byRule = new Map<string, AuditRule>();
  for (const r of registry) byRule.set(r.id, r);

  // Per-bucket totals
  const bucketTotals = new Map<LayeredScoreKey, { applies: number; weighted: number }>();
  const ruleAffected = new Map<string, number>();

  for (const f of findings) {
    const rule = byRule.get(f.ruleId);
    if (!rule) continue;
    const key = rule.scoresInto;
    const bucket = out[key];
    const totals = bucketTotals.get(key) ?? { applies: 0, weighted: 0 };

    if (f.status === 'not_applicable') {
      bucket.notApplicableRuleCount += 1;
    } else if (f.status === 'not_verified') {
      bucket.notVerifiedRuleCount += 1;
      // Integration-health absorbs not_verified noise
      out['integration-health'].notVerifiedRuleCount += 1;
    } else if (f.status === 'pass') {
      bucket.applicableRuleCount += 1;
      totals.applies += 1;
    } else {
      bucket.applicableRuleCount += 1;
      bucket.failedRuleCount += 1;
      totals.applies += 1;
      const weight = (STATUS_DEDUCTION[f.status] ?? 0.5) * (SEVERITY_WEIGHT[f.severity] / 100);
      totals.weighted += weight;
      ruleAffected.set(f.ruleId, (ruleAffected.get(f.ruleId) ?? 0) + 1);
    }
    bucketTotals.set(key, totals);
  }

  // Score = 100 - normalised(weighted / applies) * 100, clamped to [0,100]
  for (const [key, totals] of bucketTotals) {
    if (totals.applies === 0) {
      out[key].value = 100;
      continue;
    }
    const deduction = Math.min(100, (totals.weighted / totals.applies) * 100);
    out[key].value = Math.max(0, Math.round(100 - deduction));
  }

  // Top contributors per bucket
  for (const [ruleId, count] of ruleAffected) {
    const rule = byRule.get(ruleId);
    if (!rule) continue;
    const bucket = out[rule.scoresInto];
    bucket.topContributors.push({ ruleId, severity: rule.defaultSeverity, affectedPages: count });
  }
  for (const bucket of Object.values(out)) {
    bucket.topContributors.sort((a, b) => b.affectedPages - a.affectedPages);
    bucket.topContributors = bucket.topContributors.slice(0, 5);
  }

  // Integration-health score. Doc 11 §"Missing Data Must Not Penalize Blindly":
  // Not-connected sources are surfaced as data gaps, NOT as a score penalty. The score stays at
  // 100 until a connected source actually fails (Phase D will populate that signal).

  return out;
}

/**
 * Group not_verified findings into data gaps per reason. Doc 11 §"not_verified should appear in
 * integration/data quality sections" + §"Show data gaps instead of penalising blindly".
 */
export type DataGap = {
  reason: string;
  ruleCount: number;
  ruleIds: string[];
  description: string;
  callToAction: string;
};

const REASON_COPY: Record<string, { description: string; cta: string }> = {
  'gsc-not-connected': {
    description: 'Search Console is not connected. Several search-performance and CTR rules cannot run.',
    cta: 'Connect Google Search Console to populate clicks, impressions, CTR, and ranking opportunities.',
  },
  'ga4-not-connected': {
    description: 'GA4 is not connected. Engagement and conversion rules cannot run.',
    cta: 'Connect GA4 to understand which SEO pages drive engagement and conversions.',
  },
  'cwv-unavailable': {
    description: 'Core Web Vitals field data is not available for some URLs.',
    cta: 'Connect PageSpeed Insights or wait for CrUX data to populate.',
  },
  'backlinks-not-connected': {
    description: 'Backlink/referring domain data is not connected. Authority signals are not verified.',
    cta: 'Connect a backlink provider when available; until then, authority is reported as not verified.',
  },
  'citations-not-connected': {
    description: 'Local citation data is not connected. NAP consistency cannot be verified.',
    cta: 'Connect a citation provider when available, or skip local-SEO checks for this project.',
  },
  'ai-visibility-not-tracked': {
    description: 'AI/LLM citation visibility is not tracked.',
    cta: 'Enable AI visibility tracking later; until then, AEO/GEO findings stay observational.',
  },
  'rendered-html-missing': {
    description: 'Rendered HTML is not available. JavaScript-rendering checks cannot run.',
    cta: 'Enable Playwright or rendered crawl to verify JS-rendered SEO.',
  },
  'schema-not-verified': {
    description:
      'Pages have no JSON-LD in raw HTML and rendered (Playwright) verification has not run. Schema rules return not_verified — not failures — until rendered extraction has run.',
    cta:
      'Open Pages, filter by "Schema not verified", select affected pages, and click "Render selected".',
  },
  'markdown-missing': {
    description: 'Markdown was not extracted for some pages. Content-quality checks were skipped.',
    cta: 'Verify Crawl4AI is reachable and re-crawl affected pages.',
  },
  'crawl-incomplete': {
    description: 'Crawl is incomplete. Some pages were not audited.',
    cta: 'Increase crawl cap or re-run the crawl in standard/full mode.',
  },
  other: {
    description: 'Required data was not available for some rules.',
    cta: 'Review the affected rules and connect missing sources.',
  },
};

export function buildDataGaps(findings: Finding[]): DataGap[] {
  const grouped = new Map<string, { ruleIds: Set<string>; count: number }>();
  for (const f of findings) {
    if (f.status !== 'not_verified') continue;
    const reason = f.notVerifiedReason ?? 'other';
    const cur = grouped.get(reason) ?? { ruleIds: new Set<string>(), count: 0 };
    cur.ruleIds.add(f.ruleId);
    cur.count += 1;
    grouped.set(reason, cur);
  }
  const gaps: DataGap[] = [];
  for (const [reason, info] of grouped) {
    const copy = REASON_COPY[reason] ?? REASON_COPY.other!;
    gaps.push({
      reason,
      ruleCount: info.ruleIds.size,
      ruleIds: [...info.ruleIds],
      description: copy.description,
      callToAction: copy.cta,
    });
  }
  return gaps;
}
