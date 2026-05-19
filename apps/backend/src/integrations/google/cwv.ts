import { request } from 'undici';
import { Types } from 'mongoose';
import { getLogger } from '../../config/logger';
import { loadEnv } from '../../config/env';
import { CwvMetricModel } from '../../db';

const log = getLogger('integrations:cwv');
const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export type CwvResult = {
  lcp?: number;
  inp?: number;
  cls?: number;
  performanceScore?: number;
  error?: string;
};

/**
 * Fetch CrUX field data + lighthouse audit via PageSpeed Insights. PSI returns BOTH CrUX (real-user)
 * + Lighthouse (lab). We prefer CrUX when available — lab values are last resort.
 */
export async function fetchCoreWebVitals(opts: {
  url: string;
  strategy?: 'mobile' | 'desktop';
}): Promise<CwvResult> {
  const env = loadEnv();
  const params = new URLSearchParams({
    url: opts.url,
    strategy: opts.strategy ?? 'mobile',
    category: 'PERFORMANCE',
  });
  if (env.PAGESPEED_API_KEY) params.set('key', env.PAGESPEED_API_KEY);

  try {
    const res = await request(`${PSI_URL}?${params.toString()}`, {
      method: 'GET',
      headersTimeout: 60_000,
      bodyTimeout: 90_000,
    });
    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      return { error: `PSI HTTP ${res.statusCode}: ${errText.slice(0, 160)}` };
    }
    const data = (await res.body.json()) as Record<string, unknown>;

    // CrUX field data preferred.
    const loadingExp = data['loadingExperience'] as Record<string, unknown> | undefined;
    const metrics = loadingExp?.['metrics'] as Record<string, { percentile?: number; category?: string }> | undefined;
    const crux = {
      lcp: metrics?.['LARGEST_CONTENTFUL_PAINT_MS']?.percentile,
      inp: metrics?.['INTERACTION_TO_NEXT_PAINT']?.percentile,
      cls: metrics?.['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.percentile
        ? (metrics['CUMULATIVE_LAYOUT_SHIFT_SCORE'].percentile as number) / 100
        : undefined,
    };

    const lighthouse = data['lighthouseResult'] as Record<string, unknown> | undefined;
    const categories = lighthouse?.['categories'] as Record<string, { score: number }> | undefined;
    const audits = lighthouse?.['audits'] as Record<string, { numericValue?: number }> | undefined;
    const lab = {
      lcp: audits?.['largest-contentful-paint']?.numericValue,
      cls: audits?.['cumulative-layout-shift']?.numericValue,
      // Lighthouse exposes Interactive (TTI) not INP; prefer CrUX.
      inp: undefined,
    };

    return {
      lcp: crux.lcp ?? lab.lcp,
      cls: crux.cls ?? lab.cls,
      inp: crux.inp,
      performanceScore: categories?.['performance']?.score
        ? categories['performance'].score * 100
        : undefined,
    };
  } catch (err) {
    log.warn({ err }, 'CWV fetch failed');
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Persist a CWV snapshot for a page.
 */
export async function recordCwv(opts: {
  projectId: string;
  pageUrl: string;
  strategy?: 'mobile' | 'desktop';
  result: CwvResult;
}): Promise<void> {
  await CwvMetricModel.create({
    projectId: new Types.ObjectId(opts.projectId),
    pageUrl: opts.pageUrl,
    strategy: opts.strategy ?? 'mobile',
    lcp: opts.result.lcp,
    inp: opts.result.inp,
    cls: opts.result.cls,
    performanceScore: opts.result.performanceScore,
    error: opts.result.error,
  });
}

/**
 * Latest CWV metric per page URL.
 */
export async function cwvLatestByPage(
  projectId: Types.ObjectId,
  strategy: 'mobile' | 'desktop' = 'mobile',
): Promise<Map<string, { lcp?: number; inp?: number; cls?: number; performanceScore?: number; capturedAt: Date }>> {
  const rows = await CwvMetricModel.aggregate<{
    _id: string;
    lcp?: number;
    inp?: number;
    cls?: number;
    performanceScore?: number;
    capturedAt: Date;
  }>([
    { $match: { projectId, strategy } },
    { $sort: { capturedAt: -1 } },
    {
      $group: {
        _id: '$pageUrl',
        lcp: { $first: '$lcp' },
        inp: { $first: '$inp' },
        cls: { $first: '$cls' },
        performanceScore: { $first: '$performanceScore' },
        capturedAt: { $first: '$capturedAt' },
      },
    },
  ]);
  const map = new Map<string, { lcp?: number; inp?: number; cls?: number; performanceScore?: number; capturedAt: Date }>();
  for (const r of rows) {
    map.set(r._id, {
      lcp: r.lcp,
      inp: r.inp,
      cls: r.cls,
      performanceScore: r.performanceScore,
      capturedAt: r.capturedAt,
    });
  }
  return map;
}
