import type { ReactNode } from 'react';
import { ProjectSubNav } from '../../../components/ProjectSubNav';

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}): Promise<JSX.Element> {
  const { id } = await params;
  return (
    <>
      <ProjectSubNav projectId={id} />
      {children}
    </>
  );
}
