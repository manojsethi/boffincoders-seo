import { Types } from 'mongoose';
import { WebsiteProfileModel } from '../db';
import type { WebsiteProfileInput } from '@boffin/schemas';
import { syncLifecycleState } from './lifecycle';

export async function applySuggestedProfile(opts: {
  projectId: string;
  suggestion: Record<string, unknown>;
  sourceRunId?: string;
}): Promise<void> {
  const projectId = new Types.ObjectId(opts.projectId);
  const s = opts.suggestion;
  await WebsiteProfileModel.findOneAndUpdate(
    { projectId },
    {
      $set: {
        websiteCategory: typeof s.websiteCategory === 'string' ? s.websiteCategory : undefined,
        categoryConfidence: typeof s.categoryConfidence === 'number' ? s.categoryConfidence : 0,
        categorySource: 'ai',
        description: typeof s.description === 'string' ? s.description : '',
        audienceSegments: asStrings(s.audienceSegments),
        primaryGoals: asStrings(s.primaryGoals),
        conversionActions: asStrings(s.conversionActions),
        entityGroups: asStrings(s.entityGroups),
        contentSections: asStrings(s.contentSections),
        complianceContext: typeof s.complianceContext === 'string' ? s.complianceContext : '',
        markets: asStrings(s.markets),
        languages: asStrings(s.languages),
        lastSuggestedAt: new Date(),
        sourceRunId: opts.sourceRunId ? new Types.ObjectId(opts.sourceRunId) : undefined,
      },
      $setOnInsert: { projectId },
    },
    { upsert: true },
  );
  await syncLifecycleState(projectId);
}

export async function approveProfile(opts: {
  projectId: string;
  approvedBy: string;
  edits?: Partial<WebsiteProfileInput>;
}): Promise<void> {
  const projectId = new Types.ObjectId(opts.projectId);
  await WebsiteProfileModel.findOneAndUpdate(
    { projectId },
    {
      $set: {
        ...(opts.edits ?? {}),
        categorySource: opts.edits?.websiteCategory ? 'analyst' : 'ai',
        approvedAt: new Date(),
        approvedBy: opts.approvedBy,
      },
      $setOnInsert: { projectId },
    },
    { upsert: true },
  );
  await syncLifecycleState(projectId);
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string') as string[];
}
