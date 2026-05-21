import type { ReactNode } from 'react';
import { ProjectShell } from '../../../components/ProjectShell';

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}): Promise<JSX.Element> {
  const { id } = await params;
  return <ProjectShell projectId={id}>{children}</ProjectShell>;
}
