'use client';

import { use } from 'react';
import { PageHeader } from '../../../../../components/PageHeader';
import { CrawlSettingsCard } from '../../../../../components/CrawlSettingsCard';
import { CrawlScopeCard } from '../../../../../components/CrawlScopeCard';

export default function CrawlSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  return (
    <>
      <PageHeader
        eyebrow="Project · Setup"
        title="Crawl settings"
        subtitle="Render mode + auto-render policy. Doc 04 §Project-level crawl/render policy."
      />
      <CrawlSettingsCard projectId={id} />
      <CrawlScopeCard projectId={id} />
    </>
  );
}
