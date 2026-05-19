'use client';

import { use, useEffect } from 'react';
import { App, Button, Form, Input, Select, Skeleton } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { StatusPill } from '../../../../components/StatusPill';
import { EmptyState } from '../../../../components/EmptyState';

const CATEGORIES = [
  'service-business',
  'saas',
  'ecommerce',
  'ngo',
  'education',
  'publisher',
  'government',
  'healthcare',
  'local-business',
  'marketplace',
  'documentation',
  'community',
  'event',
  'personal-brand',
  'mixed-other',
];

type Profile = {
  websiteCategory?: string;
  categoryConfidence?: number;
  categorySource?: string;
  description?: string;
  complianceContext?: string;
  approvedAt?: string;
};

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { data, isLoading, error } = useQuery<Profile>({
    queryKey: ['profile', id],
    queryFn: () => api<Profile>(`/projects/${id}/profile`),
    retry: false,
  });

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const approve = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api(`/projects/${id}/profile/approve`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      message.success('Profile approved');
      void qc.invalidateQueries({ queryKey: ['profile', id] });
      void qc.invalidateQueries({ queryKey: ['project-overview', id] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="Website profile"
        subtitle="AI suggests a draft from evidence. Analyst approves before reports go out."
        meta={
          data ? (
            <>
              <StatusPill value={data.categorySource ?? 'pending'} kind="state" />
              {data.approvedAt ? (
                <StatusPill value="approved" kind="state" />
              ) : (
                <StatusPill value="needs review" kind="state" />
              )}
            </>
          ) : null
        }
      />
      <div className="max-w-3xl">
        <SectionCard>
          {isLoading ? (
            <Skeleton active />
          ) : error ? (
            <EmptyState
              title="No profile yet"
              description="Run AI analysis after the first audit completes. The AI will suggest a draft profile based on real evidence."
            />
          ) : (
            <Form layout="vertical" form={form} onFinish={(v) => approve.mutate(v)}>
              <Form.Item label="Category" name="websiteCategory">
                <Select options={CATEGORIES.map((c) => ({ label: c, value: c }))} />
              </Form.Item>
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="Compliance context" name="complianceContext">
                <Input placeholder="healthcare, finance, legal, govt, none, other" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={approve.isPending}>
                Approve profile
              </Button>
            </Form>
          )}
        </SectionCard>
      </div>
    </>
  );
}
