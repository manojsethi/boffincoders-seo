'use client';

import { App, Button, Form, Input, Select, Steps, Switch } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';

const ONBOARDING_STEPS = [
  { title: 'Basics' },
  { title: 'Website profile' },
  { title: 'Client objective' },
  { title: 'Seed keywords' },
  { title: 'Important pages' },
  { title: 'Crawl setup' },
  { title: 'Integrations' },
  { title: 'Review & start' },
];

/**
 * Step 1 of the Phase 12 onboarding wizard. Collects the bare minimum needed to materialize a
 * Project record (client, site name, primary domain, market/language). On success we redirect
 * into /projects/:id/onboarding which holds steps 2–8.
 */

const COUNTRIES = [
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'global', label: 'Global / multi-market' },
];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'other', label: 'Other' },
];

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: Record<string, unknown>): Promise<void> => {
    setSubmitting(true);
    try {
      const project = await api<{ id: string; slug: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          clientName: values.clientName,
          siteName: values.siteName,
          primaryDomain: values.primaryDomain,
          includeSubdomains: values.includeSubdomains,
        }),
      });
      await api(`/projects/${project.id}/onboarding`, {
        method: 'PATCH',
        body: JSON.stringify({
          markStepComplete: 1,
          country: values.country,
          primaryLanguage: values.primaryLanguage,
          notes: values.notes,
        }),
      }).catch(() => {
        /* non-fatal — analyst can still revisit step 1 */
      });
      message.success('Project created — continue onboarding');
      router.push(`/projects/${project.id}/onboarding`);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace · Onboarding (Step 1 of 8)"
        title="New project — basics"
        subtitle="Only the essentials. The next steps capture website profile, objective, keywords, important pages, and crawl scope before the first crawl."
      />
      <div className="max-w-5xl mx-auto">
        <SectionCard className="mb-4">
          <Steps
            size="small"
            current={0}
            items={ONBOARDING_STEPS.map((s, i) => ({
              title: s.title,
              disabled: i !== 0,
            }))}
          />
        </SectionCard>
        <SectionCard>
          <Form
            layout="vertical"
            form={form}
            onFinish={onFinish}
            initialValues={{
              includeSubdomains: false,
              country: 'IN',
              primaryLanguage: 'en',
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Form.Item label="Client name" name="clientName" rules={[{ required: true }]}>
                <Input placeholder="Acme Corp" />
              </Form.Item>
              <Form.Item label="Project / site name" name="siteName" rules={[{ required: true }]}>
                <Input placeholder="Acme — main marketing site" />
              </Form.Item>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-4 items-start">
              <Form.Item
                label="Website URL"
                name="primaryDomain"
                rules={[{ required: true, message: 'Domain required, e.g. example.com' }]}
                extra="Just the domain — protocol added automatically."
              >
                <Input placeholder="example.com" />
              </Form.Item>
              <Form.Item
                label="Include subdomains in crawl"
                name="includeSubdomains"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Form.Item label="Primary country / market" name="country">
                <Select options={COUNTRIES} showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item label="Primary language" name="primaryLanguage">
                <Select options={LANGUAGES} showSearch optionFilterProp="label" />
              </Form.Item>
            </div>
            <Form.Item label="Notes (optional)" name="notes">
              <Input.TextArea
                rows={3}
                placeholder="Context from kickoff call, scope, or known constraints"
                maxLength={2000}
                showCount
              />
            </Form.Item>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => router.push('/projects')}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Continue to onboarding →
              </Button>
            </div>
          </Form>
        </SectionCard>
      </div>
    </>
  );
}
