'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type PageRow = {
  id: string;
  url: string;
  normalizedUrl: string;
  statusCode: number;
  indexability: string;
  canonicalUrl: string | null;
  title: string | null;
  h1: string | null;
  pageRole: string;
  roleConfidence: number;
  roleConfidenceLevel: 'high' | 'medium' | 'low' | null;
  roleSource: 'analyst' | 'ai' | 'heuristic';
  isImportant: boolean;
  isIntentionallyNonIndexable: boolean;
  internalLinksIn: number;
  internalLinksOut: number;
  hasSchema: boolean;
  schemaTypeCount: number;
  schemaSource: 'raw-html' | 'rendered-html' | 'both' | 'none' | 'not-verified';
  schemaTypes: string[];
  rawSchemaCount: number;
  renderedSchemaCount: number;
  schemaParseErrorCount: number;
  renderedExtractedAt: string | null;
  lastCrawledAt: string | null;
  issueCounts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  topIssue: { id: string; title: string; severity: string; priority: number } | null;
  topIssues: Array<{ id: string; title: string; severity: string; priority: number }>;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  sessions: number | null;
  conversions: number | null;
  cwv: {
    lcp?: number;
    inp?: number;
    cls?: number;
    performanceScore?: number;
    capturedAt?: string;
  } | null;
};

export function usePagesTable(projectId: string): ReturnType<typeof useQuery<PageRow[]>> {
  return useQuery<PageRow[]>({
    queryKey: ['pages', projectId],
    queryFn: () => api<PageRow[]>(`/projects/${projectId}/pages?limit=1000`),
    staleTime: 10_000,
  });
}
