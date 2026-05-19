import type { ReactNode } from 'react';
import { DashboardsTabs } from '../../../../components/DashboardsTabs';

export default async function DashboardsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}): Promise<JSX.Element> {
  const { id } = await params;
  return (
    <>
      <DashboardsTabs projectId={id} />
      {children}
    </>
  );
}
