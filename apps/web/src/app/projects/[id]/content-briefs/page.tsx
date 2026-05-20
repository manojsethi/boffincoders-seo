'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { App, Button, Modal, Select, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../../../lib/api';
import { PageHeader } from '../../../../components/PageHeader';
import { SectionCard } from '../../../../components/SectionCard';
import { StatusPill } from '../../../../components/StatusPill';
import { EmptyState } from '../../../../components/EmptyState';
import { TermLabel } from '../../../../components/TermLabel';

type Brief = {
  id: string;
  keywordId: string;
  pageId: string | null;
  version: number;
  title: string;
  targetKeyword: string;
  searchIntent: string;
  status: string;
  updatedAt?: string;
  dataGaps: string[];
};
type Keyword = { id: string; keyword: string; status: string; mappedPageId: string | null };

export default function ContentBriefsList({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedKw, setSelectedKw] = useState<string | undefined>();

  const { data: briefs = [], isLoading } = useQuery<Brief[]>({
    queryKey: ['content-briefs', id],
    queryFn: () => api<Brief[]>(`/projects/${id}/content-briefs?limit=500`),
  });

  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ['keywords-for-briefs', id],
    queryFn: () => api<Keyword[]>(`/projects/${id}/keywords?status=mapped&limit=500`),
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; created: boolean; dataGaps: string[] }>(
        `/projects/${id}/content-briefs`,
        { method: 'POST', body: JSON.stringify({ keywordId: selectedKw, useAI: true }) },
      ),
    onSuccess: (r) => {
      message.success(r.created ? 'Brief created' : 'Brief updated');
      void qc.invalidateQueries({ queryKey: ['content-briefs', id] });
      setCreateOpen(false);
      window.location.href = `/projects/${id}/content-briefs/${r.id}`;
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={<TermLabel term="content-brief">Content briefs</TermLabel>}
        subtitle="Evidence-backed briefs generated from mapped keywords + content-fit analysis. AI assist is optional; everything is analyst-reviewed before publish."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            New brief
          </Button>
        }
      />

      <SectionCard noPadding>
        {!isLoading && briefs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No briefs yet"
              description="Map a keyword to a page on the Keywords tab, then create a brief here."
              action={
                <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                  New brief
                </Button>
              }
            />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={briefs}
            pagination={{ pageSize: 25, showSizeChanger: false }}
            columns={[
              {
                title: 'Title',
                dataIndex: 'title',
                ellipsis: true,
                render: (t: string, b: Brief) => (
                  <Link
                    href={`/projects/${id}/content-briefs/${b.id}`}
                    className="text-text hover:text-accent-hover"
                  >
                    {t}
                  </Link>
                ),
              },
              {
                title: 'Target keyword',
                dataIndex: 'targetKeyword',
                width: 220,
                render: (k: string) => <span className="font-mono text-[12px]">{k}</span>,
              },
              {
                title: 'Intent',
                dataIndex: 'searchIntent',
                width: 130,
                render: (v: string) => <Tag className="m-0">{v}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 140,
                render: (s: string) => <StatusPill value={s} kind="state" />,
              },
              {
                title: 'Version',
                dataIndex: 'version',
                width: 80,
                render: (v: number) => <span className="text-xs tabular-nums">v{v}</span>,
              },
              {
                title: 'Data gaps',
                dataIndex: 'dataGaps',
                width: 110,
                render: (g: string[]) =>
                  g.length > 0 ? (
                    <Tag color="warning" className="m-0">
                      {g.length}
                    </Tag>
                  ) : (
                    <span className="text-text-subtle text-xs">none</span>
                  ),
              },
              {
                title: 'Updated',
                dataIndex: 'updatedAt',
                width: 140,
                render: (d: string | undefined) =>
                  d ? (
                    <span className="text-xs tabular-nums text-text-muted">
                      {new Date(d).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : null,
              },
            ]}
          />
        )}
      </SectionCard>

      <Modal
        open={createOpen}
        title="New content brief"
        onCancel={() => setCreateOpen(false)}
        onOk={() => create.mutate()}
        okText="Create"
        confirmLoading={create.isPending}
        width={520}
      >
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-text-muted mb-1">Keyword (must be mapped)</label>
            <Select
              showSearch
              placeholder="Pick a mapped keyword"
              value={selectedKw}
              onChange={(v) => setSelectedKw(v)}
              className="w-full"
              options={keywords
                .filter((k) => !!k.mappedPageId)
                .map((k) => ({ value: k.id, label: k.keyword }))}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            {keywords.filter((k) => !!k.mappedPageId).length === 0 ? (
              <p className="text-[11px] text-amber-400 mt-2">
                No mapped keywords yet. Map a target page on the Keywords tab first.
              </p>
            ) : null}
          </div>
          <p className="text-[11px] text-text-subtle">
            AI assist runs automatically using the cheap-tier model. Output is structural — no full
            content writing. Brief is created as <code>draft</code> and is editable.
          </p>
        </div>
      </Modal>
    </>
  );
}
