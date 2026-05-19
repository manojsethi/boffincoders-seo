import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyState } from '../../components/EmptyState';

export default function SettingsPage(): JSX.Element {
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="Workspace-wide configuration." />
      <SectionCard>
        <EmptyState
          title="Settings coming soon"
          description="Integrations management, team members, and AI provider configuration will live here."
        />
      </SectionCard>
    </>
  );
}
