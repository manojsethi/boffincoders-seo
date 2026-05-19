import { z } from 'zod';
import { CrawlModeSchema, RunStatusSchema, TriggeredBySchema } from './lifecycle';

export const CrawlDiagnostics = z.object({
  discoveredCount: z.number().default(0),
  crawledCount: z.number().default(0),
  skippedCount: z.number().default(0),
  failedCount: z.number().default(0),
  blockedByRobotsCount: z.number().default(0),
  sitemapStatus: z.enum(['found', 'missing', 'invalid', 'partial']).default('missing'),
  redirectChainCount: z.number().default(0),
  duplicateClusterCount: z.number().default(0),
  depthDistribution: z.record(z.string(), z.number()).default({}),
  pageRoleDistribution: z.record(z.string(), z.number()).default({}),
  markdownCoveragePct: z.number().default(0),
  healthStatus: z.enum(['healthy', 'needs-review', 'unreliable']).default('healthy'),
  skippedReasons: z.array(z.object({ reason: z.string(), count: z.number() })).default([]),
  failedReasons: z.array(z.object({ reason: z.string(), count: z.number() })).default([]),
});
export type CrawlDiagnostics = z.infer<typeof CrawlDiagnostics>;

export const StartCrawlInput = z.object({
  mode: CrawlModeSchema.default('first'),
  seedUrl: z.string().optional(),
  maxPages: z.number().min(1).max(2000).default(200),
});
export type StartCrawlInput = z.infer<typeof StartCrawlInput>;

export const CrawlRunDTO = z.object({
  id: z.string(),
  projectId: z.string(),
  mode: CrawlModeSchema,
  status: RunStatusSchema,
  seedUrl: z.string().nullable(),
  maxPages: z.number(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  agendaJobId: z.string().nullable(),
  triggeredBy: TriggeredBySchema,
  diagnostics: CrawlDiagnostics,
  counts: z.object({ pages: z.number(), markdown: z.number() }),
  error: z.string().nullable(),
  progressPercent: z.number(),
  currentStep: z.string(),
});
export type CrawlRunDTO = z.infer<typeof CrawlRunDTO>;
