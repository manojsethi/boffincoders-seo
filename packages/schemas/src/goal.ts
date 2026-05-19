import { z } from 'zod';

/**
 * Goal type. Phase E will expand UX around this; Phase A reserves the slot
 * so rule applicability can already read goals[] when present.
 * Doc 6 §"Supported Goal Types".
 */
export const GoalTypeSchema = z.enum([
  'generate-leads',
  'consultation-calls',
  'quote-requests',
  'ecommerce-sales',
  'donations',
  'volunteers',
  'course-applications',
  'bookings',
  'demo-requests',
  'trial-signups',
  'subscriptions',
  'documentation-adoption',
  'organic-traffic',
  'local-visibility',
  'ai-geo-visibility',
  'brand-visibility',
  'custom',
]);
export type GoalType = z.infer<typeof GoalTypeSchema>;

export const GoalPrioritySchema = z.enum(['primary', 'secondary', 'tertiary']);
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;

export const GoalStatusSchema = z.enum(['active', 'achieved', 'paused', 'archived']);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const GoalSchema = z.object({
  id: z.string().optional(),
  type: GoalTypeSchema,
  label: z.string().optional(),
  priority: GoalPrioritySchema.default('secondary'),
  status: GoalStatusSchema.default('active'),
  conversionAction: z.string().optional(),
  relatedPageIds: z.array(z.string()).default([]),
  relatedPagePatterns: z.array(z.string()).default([]),
  audience: z.string().optional(),
  geography: z.array(z.string()).default([]),
  kpi: z.string().optional(),
  baseline: z.number().optional(),
  target: z.number().optional(),
  deadline: z.string().datetime().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Goal = z.infer<typeof GoalSchema>;
