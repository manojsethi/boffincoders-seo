import { ProjectModel } from '../db';
import type { ProjectCreateInput } from '@boffin/schemas';
import { syncLifecycleState } from './lifecycle';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function createProject(input: ProjectCreateInput): Promise<{ id: string; slug: string }> {
  const baseSlug = slugify(`${input.clientName}-${input.siteName}`) || `project-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;
  while (await ProjectModel.exists({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const doc = await ProjectModel.create({
    slug,
    clientName: input.clientName,
    siteName: input.siteName,
    primaryDomain: input.primaryDomain,
    allowedDomains: input.allowedDomains ?? [],
    includeSubdomains: input.includeSubdomains ?? false,
    status: 'active',
    lifecycleState: 'ready-for-first-crawl',
  });

  await syncLifecycleState(doc._id);
  return { id: String(doc._id), slug };
}
