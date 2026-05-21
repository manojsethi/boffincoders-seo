export type Diagnostics = {
  discoveredCount: number;
  crawledCount: number;
  skippedCount: number;
  failedCount: number;
  blockedByRobotsCount: number;
  sitemapStatus: 'found' | 'missing' | 'invalid' | 'partial';
  redirectChainCount: number;
  duplicateClusterCount: number;
  depthDistribution: Record<string, number>;
  pageRoleDistribution: Record<string, number>;
  markdownCoveragePct: number;
  healthStatus: 'healthy' | 'needs-review' | 'unreliable';
  skippedReasons: Array<{ reason: string; count: number }>;
  failedReasons: Array<{ reason: string; count: number }>;
  // Phase 11 — scope summary. Optional so older runs still validate.
  scope?: {
    discoveredCandidates: number;
    selectedForCrawl: number;
    excludedByRules: number;
    sampledGroups: number;
    forceIncluded: number;
    normalizedDuplicates: number;
    groups: Array<{
      name: string;
      pattern: string;
      behavior: string;
      discovered: number;
      selected: number;
      excluded: number;
      sampleLimit: number;
    }>;
  };
};

export function emptyDiagnostics(): Diagnostics {
  return {
    discoveredCount: 0,
    crawledCount: 0,
    skippedCount: 0,
    failedCount: 0,
    blockedByRobotsCount: 0,
    sitemapStatus: 'missing',
    redirectChainCount: 0,
    duplicateClusterCount: 0,
    depthDistribution: {},
    pageRoleDistribution: {},
    markdownCoveragePct: 0,
    healthStatus: 'healthy',
    skippedReasons: [],
    failedReasons: [],
  };
}

export function bumpReason(list: Array<{ reason: string; count: number }>, reason: string): void {
  const found = list.find((r) => r.reason === reason);
  if (found) found.count += 1;
  else list.push({ reason, count: 1 });
}

export function computeHealth(d: Diagnostics): Diagnostics['healthStatus'] {
  if (d.crawledCount === 0) return 'unreliable';
  const failRate = d.failedCount / Math.max(1, d.crawledCount + d.failedCount);
  if (failRate > 0.5 || d.markdownCoveragePct < 20) return 'unreliable';
  if (failRate > 0.2 || d.markdownCoveragePct < 60 || d.sitemapStatus === 'missing') return 'needs-review';
  return 'healthy';
}
