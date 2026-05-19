'use client';

import { Button, Form, Input, Switch, App } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: Record<string, unknown>): Promise<void> => {
    setSubmitting(true);
    try {
      const res = await api<{ id: string; slug: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('Project created');
      router.push(`/projects/${res.id}`);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="New project"
        subtitle="Only basics required. The website profile is inferred from the first crawl, audit, and AI analysis."
      />
      <div className="max-w-2xl">
        <SectionCard>
          <Form layout="vertical" form={form} onFinish={onFinish} initialValues={{ includeSubdomains: false }}>
            <Form.Item label="Client name" name="clientName" rules={[{ required: true }]}>
              <Input placeholder="Acme Corp" />
            </Form.Item>
            <Form.Item label="Site name" name="siteName" rules={[{ required: true }]}>
              <Input placeholder="Acme — main marketing site" />
            </Form.Item>
            <Form.Item label="Primary domain" name="primaryDomain" rules={[{ required: true }]}>
              <Input placeholder="example.com" />
            </Form.Item>
            <Form.Item label="Include subdomains" name="includeSubdomains" valuePropName="checked">
              <Switch />
            </Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" loading={submitting}>
                Create project
              </Button>
              <Button onClick={() => router.back()} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </Form>
        </SectionCard>
      </div>
    </>
  );
}
