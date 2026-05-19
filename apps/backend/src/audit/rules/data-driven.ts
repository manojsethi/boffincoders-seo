// Data-driven rules wired to GSC / GA4 / CWV. When source not connected, engine returns
// not_verified via requiredInputs gating. When connected but page lacks metric, returns pass.
import { APPLIES, notApplicable } from '../applicability';
import type { AuditRule } from '../types';

const gscHighImpressionsLowCtr: AuditRule = {
  id: 'gsc.high-impressions-low-ctr',
  version: '1.0.0',
  name: 'High impressions, low CTR',
  category: 'gsc-opportunities',
  layer: 'search-performance',
  pack: 'integration',
  scoresInto: 'search-performance',
  description: 'Pages with strong impressions but below-expected CTR.',
  whyItMatters: 'Low CTR on high-impression pages = weak SERP snippet vs intent.',
  recommendationTemplate: 'Rewrite title + meta description for the primary query group.',
  defaultSeverity: 'medium',
  defaultImpact: 55,
  defaultEffort: 'small',
  defaultValidationMethod:
    'Refresh title + meta, deploy, sync GSC after 2-4 weeks; confirm CTR moved into expected range.',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['integration.gsc'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.gsc) return notApplicable('other', 'no GSC data for this URL');
    if (page.gsc.impressions < 200) return notApplicable('other', 'below impression threshold');
    if (page.isIntentionallyNonIndexable) return notApplicable('page-intentionally-non-indexable');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const g = page.gsc!;
    const expected = expectedCtrAt(g.position);
    if (g.ctr >= expected * 0.8) return { status: 'pass', severity: 'info', title: 'CTR healthy' };
    return {
      status: 'opportunity',
      severity: 'medium',
      title: 'High impressions, low CTR',
      observed: `${g.impressions.toFixed(0)} impressions, CTR ${(g.ctr * 100).toFixed(2)}% at position ${g.position.toFixed(1)}. Expected ~${(expected * 100).toFixed(1)}%.`,
      whyItMatters: 'Below-expected CTR at this position signals weak SERP snippet vs intent.',
      recommendation: 'Rewrite title + meta description. Consider FAQ / table answer for query intent.',
      evidence: { ...g, expectedCtr: expected, pageRole: page.pageRole },
      evidenceSources: ['gsc'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: Math.min(80, Math.round(g.impressions / 50)),
      effortEstimate: 'small',
    };
  },
};

const gscPosition11to20: AuditRule = {
  id: 'gsc.position-11-to-20-quick-win',
  version: '1.0.0',
  name: 'Ranking position 11-20 quick win',
  category: 'gsc-opportunities',
  layer: 'search-performance',
  pack: 'integration',
  scoresInto: 'search-performance',
  description: 'Pages ranking on page 2 with meaningful impressions.',
  whyItMatters: 'Position 11-20 = nearest-term ranking opportunities.',
  recommendationTemplate: 'Refresh content + add internal links + improve E-E-A-T signals.',
  defaultSeverity: 'medium',
  defaultImpact: 55,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['integration.gsc'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.gsc) return notApplicable('other', 'no GSC data');
    if (page.gsc.impressions < 100) return notApplicable('other');
    if (page.gsc.position < 10 || page.gsc.position > 20) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const g = page.gsc!;
    return {
      status: 'opportunity',
      severity: 'medium',
      title: `Quick-win at position ${g.position.toFixed(1)}`,
      observed: `Page ranks at avg position ${g.position.toFixed(1)} with ${g.impressions.toFixed(0)} impressions.`,
      whyItMatters: 'Page-2 rankings with impressions are highest-leverage SEO wins.',
      recommendation:
        'Refresh content, expand depth, add internal links from related pages, improve trust signals.',
      evidence: { ...g, pageRole: page.pageRole },
      evidenceSources: ['gsc'],
      confidence: 0.9,
      confidenceLevel: 'high',
      impactScore: Math.min(80, Math.round(g.impressions / 20)),
      effortEstimate: 'medium',
    };
  },
};

const gscDecliningClicks: AuditRule = {
  id: 'gsc.declining-clicks',
  version: '1.0.0',
  name: 'Declining organic clicks',
  category: 'gsc-opportunities',
  layer: 'search-performance',
  pack: 'integration',
  scoresInto: 'search-performance',
  description: 'Pages where most recent GSC sync shows zero clicks despite impressions.',
  whyItMatters: 'Steady impressions + zero clicks = SERP intent mismatch or competing result.',
  recommendationTemplate: 'Re-evaluate query intent + refresh title.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['integration.gsc'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.gsc) return notApplicable('other');
    if (page.gsc.impressions < 200) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const g = page.gsc!;
    if (g.clicks > 0) return { status: 'pass', severity: 'info', title: 'Clicks present' };
    return {
      status: 'opportunity',
      severity: 'medium',
      title: 'Impressions without clicks',
      observed: `${g.impressions.toFixed(0)} impressions, 0 clicks at position ${g.position.toFixed(1)}.`,
      whyItMatters: 'Impressions without clicks signal intent or SERP-feature mismatch.',
      recommendation: 'Inspect SERP for this query group. Rewrite title for the actual intent.',
      evidence: g,
      evidenceSources: ['gsc'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: Math.min(60, Math.round(g.impressions / 50)),
      effortEstimate: 'medium',
    };
  },
};

const ga4HighTrafficLowConv: AuditRule = {
  id: 'ga4.high-traffic-low-conversion',
  version: '1.0.0',
  name: 'High traffic, low conversion',
  category: 'ga4-engagement',
  layer: 'business-outcomes',
  pack: 'integration',
  scoresInto: 'conversion-readiness',
  description: 'Pages with strong organic sessions but few/zero conversions.',
  whyItMatters: 'High traffic + low conversion = monetization leak at funnel bottom.',
  recommendationTemplate: 'Audit CTA placement, trust signals, page intent vs query intent.',
  defaultSeverity: 'medium',
  defaultImpact: 50,
  defaultEffort: 'medium',
  defaultValidationMethod:
    'Sync GA4 after CTA/page-intent changes deploy + check conversions metric on this URL.',
  reportVisibility: 'both',
  ownerHint: 'seo',
  lifecycle: 'active',
  requiredInputs: ['integration.ga4'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.ga4) return notApplicable('other');
    if (page.ga4.sessions < 100) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const g = page.ga4!;
    const convRate = g.sessions > 0 ? g.conversions / g.sessions : 0;
    if (convRate > 0.01)
      return { status: 'pass', severity: 'info', title: 'Conversion rate healthy' };
    return {
      status: 'opportunity',
      severity: 'medium',
      title: 'High traffic, low conversion',
      observed: `${g.sessions} sessions, ${g.conversions} conversions (${(convRate * 100).toFixed(2)}%).`,
      whyItMatters: 'High traffic + low conversion = bottom-funnel leak.',
      recommendation: 'Audit CTA placement, page intent, proof + trust signals.',
      evidence: { ...g, convRate, pageRole: page.pageRole },
      evidenceSources: ['ga4'],
      confidence: 0.85,
      confidenceLevel: 'high',
      impactScore: Math.min(80, Math.round(g.sessions / 50)),
      effortEstimate: 'medium',
    };
  },
};

const ga4LowEngagement: AuditRule = {
  id: 'ga4.low-engagement',
  version: '1.0.0',
  name: 'Low engagement on landing page',
  category: 'ga4-engagement',
  layer: 'business-outcomes',
  pack: 'integration',
  scoresInto: 'conversion-readiness',
  description: 'Landing pages with very low engaged-session rate.',
  whyItMatters: 'Low engagement = content/intent mismatch or thin lead paragraph.',
  recommendationTemplate: 'Strengthen lead paragraph + above-the-fold value; verify intent.',
  defaultSeverity: 'low',
  defaultImpact: 35,
  defaultEffort: 'medium',
  reportVisibility: 'both',
  ownerHint: 'content',
  lifecycle: 'active',
  requiredInputs: ['integration.ga4'],
  scope: 'page',
  appliesTo({ page }) {
    if (!page.ga4) return notApplicable('other');
    if (page.ga4.sessions < 100) return notApplicable('other');
    return APPLIES;
  },
  evaluatePage({ page }) {
    const g = page.ga4!;
    if (g.engagementRate >= 0.4)
      return { status: 'pass', severity: 'info', title: 'Engagement healthy' };
    return {
      status: 'opportunity',
      severity: 'low',
      title: 'Low engagement rate',
      observed: `Engagement rate ${(g.engagementRate * 100).toFixed(1)}% (${g.engagedSessions}/${g.sessions} engaged).`,
      whyItMatters: 'Low engagement = intent mismatch or weak above-the-fold value.',
      recommendation: 'Strengthen lead paragraph + first-screen value. Match query intent.',
      evidence: g,
      evidenceSources: ['ga4'],
      confidence: 0.85,
      confidenceLevel: 'medium',
      impactScore: 35,
      effortEstimate: 'medium',
    };
  },
};

function cwvRule(opts: {
  id: string;
  name: string;
  metric: 'lcp' | 'inp' | 'cls';
}): AuditRule {
  return {
    id: opts.id,
    version: '1.0.0',
    name: opts.name,
    category: 'performance',
    layer: 'technical-foundation',
    pack: 'integration',
    scoresInto: 'technical-foundation',
    description: `Pages failing the ${opts.metric.toUpperCase()} threshold per CrUX field data.`,
    whyItMatters: 'Core Web Vitals are a baseline ranking + UX signal.',
    recommendationTemplate: `Run PageSpeed Insights on the URL and address ${opts.metric.toUpperCase()} causes.`,
    defaultSeverity: 'medium',
    defaultImpact: 50,
    defaultEffort: 'medium',
    defaultValidationMethod: 'Wait for fresh CrUX data (28-day rolling) + re-sync CWV.',
    reportVisibility: 'both',
    ownerHint: 'developer',
    lifecycle: 'active',
    requiredInputs: ['integration.cwv'],
    scope: 'page',
    appliesTo({ page }) {
      if (page.isIntentionallyNonIndexable)
        return notApplicable('page-intentionally-non-indexable');
      if (!page.cwv) return notApplicable('other', 'no CWV data for this URL');
      const value = page.cwv[opts.metric];
      if (typeof value !== 'number') return notApplicable('other', `no ${opts.metric} value`);
      return APPLIES;
    },
    evaluatePage({ page }) {
      const value = page.cwv![opts.metric] as number;
      const threshold = THRESHOLDS[opts.metric];
      if (value <= threshold.good)
        return { status: 'pass', severity: 'info', title: `${opts.metric.toUpperCase()} is good` };
      const isPoor = value > threshold.poor;
      return {
        status: 'fail',
        severity: isPoor ? 'high' : 'medium',
        priority: isPoor ? 'P1' : 'P2',
        title: `${opts.metric.toUpperCase()} ${isPoor ? 'is poor' : 'needs improvement'} (${formatMetric(opts.metric, value)})`,
        observed: `${opts.metric.toUpperCase()}: ${formatMetric(opts.metric, value)}. Good ≤ ${formatMetric(opts.metric, threshold.good)}; poor > ${formatMetric(opts.metric, threshold.poor)}.`,
        whyItMatters: 'Failing CWV reduces ranking + hurts user experience on mobile.',
        recommendation:
          opts.metric === 'lcp'
            ? 'Optimize largest content element: hero image priority, font loading, edge caching.'
            : opts.metric === 'inp'
              ? 'Reduce main-thread blocking; split JS bundles; defer non-critical handlers.'
              : 'Reserve space for late-loading content; preload font + image dimensions.',
        evidence: { metric: opts.metric, value, threshold, capturedAt: page.cwv!.capturedAt },
        evidenceSources: ['cwv'],
        confidence: 0.9,
        confidenceLevel: 'high',
        impactScore: isPoor ? 60 : 40,
        effortEstimate: 'medium',
      };
    },
  };
}

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

function formatMetric(m: 'lcp' | 'inp' | 'cls', v: number): string {
  if (m === 'cls') return v.toFixed(3);
  return `${Math.round(v)}ms`;
}

function expectedCtrAt(position: number): number {
  // Coarse SERP CTR curve; AI Overviews + features pull lower but useful baseline.
  if (position < 1.5) return 0.28;
  if (position < 2.5) return 0.16;
  if (position < 3.5) return 0.11;
  if (position < 4.5) return 0.08;
  if (position < 6) return 0.06;
  if (position < 8) return 0.045;
  if (position < 10) return 0.035;
  if (position < 12) return 0.025;
  return 0.015;
}

export const dataDrivenRules: AuditRule[] = [
  gscHighImpressionsLowCtr,
  gscPosition11to20,
  gscDecliningClicks,
  ga4HighTrafficLowConv,
  ga4LowEngagement,
  cwvRule({ id: 'cwv.lcp.fails-threshold', name: 'LCP fails threshold', metric: 'lcp' }),
  cwvRule({ id: 'cwv.inp.fails-threshold', name: 'INP fails threshold', metric: 'inp' }),
  cwvRule({ id: 'cwv.cls.fails-threshold', name: 'CLS fails threshold', metric: 'cls' }),
];
