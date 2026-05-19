'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type IssueRow = {
  id: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  category: string;
  layer?: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  lifecycleStatus: string;
  latestStatus: string;
  priority: number;
  actionPriority: 'P0' | 'P1' | 'P2';
  impact: number;
  effort: string;
  confidence: number;
  confidenceLevel?: 'high' | 'medium' | 'low' | null;
  pageId: string | null;
  affectedUrl: string | null;
  affectedUrls: string[];
  affectedPageCount: number;
  pageRole: string | null;
  pageTitle: string | null;
  scope: 'page' | 'site';
  groupKey: string | null;
  ownerType: string;
  verifiedAt: string | null;
  firstSeenAuditRunId: string | null;
  lastSeenAuditRunId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export function useIssues(
  projectId: string,
  qs: string = '',
): ReturnType<typeof useQuery<IssueRow[]>> {
  return useQuery<IssueRow[]>({
    queryKey: ['issues', projectId, qs],
    queryFn: () => api<IssueRow[]>(`/projects/${projectId}/issues?limit=500${qs ? `&${qs}` : ''}`),
    staleTime: 5_000,
  });
}

export type IssueDetail = {
  issue: {
    id: string;
    ruleId: string;
    ruleVersion: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    layer?: string;
    lifecycleStatus: string;
    latestStatus: string;
    priority: number;
    actionPriority: 'P0' | 'P1' | 'P2';
    impact: number;
    effort: string;
    confidence: number;
    confidenceLevel?: 'high' | 'medium' | 'low' | null;
    ownerType: string;
    pageId: string | null;
    groupKey: string | null;
    affectedUrls: string[];
    affectedPageCount: number;
    firstSeenAuditRunId: string | null;
    lastSeenAuditRunId: string | null;
    verifiedAt: string | null;
    dueDate: string | null;
    notes: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
  page: {
    id: string;
    url: string;
    title: string | null;
    pageRole: string | null;
    statusCode: number | null;
    indexability: string | null;
    canonicalUrl: string | null;
  } | null;
  currentFinding: {
    id: string;
    status: string;
    severity: string;
    title: string;
    observed: string;
    whyItMatters: string;
    recommendation: string;
    howToFix: string;
    evidence: Record<string, unknown>;
    evidenceSources: string[];
    confidence: number;
    confidenceLevel?: string;
    impactScore: number;
    effortEstimate: string;
    validationMethod?: string;
    createdAt: string | null;
    ruleVersion: string;
  } | null;
  history: Array<{
    id: string;
    auditRunId: string;
    status: string;
    severity: string;
    observed: string;
    createdAt: string | null;
    ruleVersion: string;
  }>;
  relatedIssues: Array<{
    id: string;
    title: string;
    severity: string;
    lifecycleStatus: string;
    affectedUrl: string | null;
    pageId: string | null;
  }>;
};

export function useIssueDetail(
  projectId: string,
  issueId: string | null,
): ReturnType<typeof useQuery<IssueDetail>> {
  return useQuery<IssueDetail>({
    queryKey: ['issue-detail', projectId, issueId],
    queryFn: () => api<IssueDetail>(`/projects/${projectId}/issues/${issueId}`),
    enabled: !!issueId,
    staleTime: 5_000,
  });
}
