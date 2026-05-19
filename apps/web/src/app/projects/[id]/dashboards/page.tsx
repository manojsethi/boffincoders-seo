import { redirect } from 'next/navigation';

export default async function DashboardsIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/projects/${id}/dashboards/search`);
}
