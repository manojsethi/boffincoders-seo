import { z } from 'zod';
import { LifecycleStateSchema, ProjectStatusSchema, WebsiteCategorySchema } from './lifecycle';

export const ProjectCreateInput = z.object({
  clientName: z.string().min(1),
  siteName: z.string().min(1),
  primaryDomain: z
    .string()
    .min(1)
    .transform((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')),
  allowedDomains: z.array(z.string()).optional().default([]),
  includeSubdomains: z.boolean().optional().default(false),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateInput>;

export const ProjectUpdateInput = ProjectCreateInput.partial().extend({
  status: ProjectStatusSchema.optional(),
});
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInput>;

export const ProjectDTO = z.object({
  id: z.string(),
  slug: z.string(),
  clientName: z.string(),
  siteName: z.string(),
  primaryDomain: z.string(),
  allowedDomains: z.array(z.string()),
  includeSubdomains: z.boolean(),
  status: ProjectStatusSchema,
  lifecycleState: LifecycleStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCrawledAt: z.string().nullable(),
  lastAuditedAt: z.string().nullable(),
  lastReportedAt: z.string().nullable(),
  nextScheduledRunAt: z.string().nullable(),
});
export type ProjectDTO = z.infer<typeof ProjectDTO>;

export const WebsiteProfileInput = z.object({
  websiteCategory: WebsiteCategorySchema,
  description: z.string().optional().default(''),
  audienceSegments: z.array(z.string()).optional().default([]),
  primaryGoals: z.array(z.string()).optional().default([]),
  conversionActions: z.array(z.string()).optional().default([]),
  entityGroups: z.array(z.string()).optional().default([]),
  contentSections: z.array(z.string()).optional().default([]),
  complianceContext: z.string().optional().default(''),
  markets: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
});
export type WebsiteProfileInput = z.infer<typeof WebsiteProfileInput>;
