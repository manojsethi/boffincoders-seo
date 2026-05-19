'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type ProjectOverview = {
  project: {
    id: string;
    siteName: string;
    clientName: string;
    primaryDomain: string;
    lifecycleState: string;
  };
  lifecycleState: string;
  nextAction: { label: string; command: string; description: string };
  latestCrawl: null | {
    id: string;
    status: string;
    progressPercent: number;
    currentStep: string;
    startedAt?: string;
    completedAt?: string;
    diagnostics?: Record<string, unknown>;
    counts?: Record<string, number>;
  };
  latestAudit: null | {
    id: string;
    status: string;
    progressPercent: number;
    currentStep: string;
    pagesAudited: number;
    layeredScores?: Record<
      string,
      { value: number; failedRuleCount?: number; notVerifiedRuleCount?: number }
    >;
    statusCounts?: Record<string, number>;
    severityCounts?: Record<string, number>;
    dataGapCount?: number;
    dataGaps?: Array<{
      reason: string;
      ruleCount: number;
      ruleIds: string[];
      description: string;
      callToAction: string;
    }>;
  };
  latestAI: null | {
    id: string;
    status: string;
    modelProvider: string;
    confidence: number;
    requiresAnalystReview: boolean;
  };
  issueCounts: { open: number; criticalOrHigh: number };
  topIssues: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    layer?: string;
    priority: number;
    actionPriority: 'P0' | 'P1' | 'P2';
    pageId: string | null;
    affectedUrl: string | null;
    groupKey: string | null;
  }>;
  latestReport: null | { id: string; type: string; status: string };
};

export function useProjectOverview(projectId: string): ReturnType<typeof useQuery<ProjectOverview>> {
  return useQuery<ProjectOverview>({
    queryKey: ['project-overview', projectId],
    queryFn: () => api<ProjectOverview>(`/projects/${projectId}/overview`),
    refetchInterval: (q) => {
      const data = q.state.data;
      const inProgress =
        data?.latestCrawl?.status === 'running' ||
        data?.latestCrawl?.status === 'queued' ||
        data?.latestAudit?.status === 'running' ||
        data?.latestAudit?.status === 'queued' ||
        data?.latestAI?.status === 'running' ||
        data?.latestAI?.status === 'queued';
      return inProgress ? 3_000 : 30_000;
    },
  });
}
