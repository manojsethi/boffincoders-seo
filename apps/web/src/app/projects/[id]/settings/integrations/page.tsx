'use client';

import { use } from 'react';
import { PageHeader } from '../../../../../components/PageHeader';
import { IntegrationsCard } from '../../../../../components/IntegrationsCard';

export default function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  return (
    <>
      <PageHeader
        eyebrow="Project · Setup"
        title="Integrations"
        subtitle="Connect Search Console, GA4, and CrUX/PSI. Connections power data-driven rules + opportunities."
      />
      <IntegrationsCard projectId={id} />
    </>
  );
}
