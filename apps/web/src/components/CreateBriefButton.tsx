'use client';

import { App, Button, Modal, Tooltip } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

/**
 * Reusable "Create brief" CTA. Used from Keywords / Opportunities / Page workspace.
 * Requires a keywordId. If the keyword isn't mapped, the button stays enabled but a tooltip
 * explains the result (the brief will use the ranking page or trigger a needs_target_mapping
 * verdict instead).
 */
export function CreateBriefButton({
  projectId,
  keywordId,
  pageId,
  keywordIsMapped,
  size = 'small',
  label = 'Create brief',
  disabled,
  disabledReason,
}: {
  projectId: string;
  keywordId?: string | null;
  pageId?: string | null;
  keywordIsMapped?: boolean;
  size?: 'small' | 'middle';
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
}): JSX.Element {
  const { message, modal } = App.useApp();
  const router = useRouter();

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; created: boolean; status: string; dataGaps: string[] }>(
        `/projects/${projectId}/content-briefs`,
        {
          method: 'POST',
          body: JSON.stringify({ keywordId, pageId: pageId ?? undefined, useAI: true }),
        },
      ),
    onSuccess: (r) => {
      message.success(r.created ? 'Brief created' : 'Brief updated');
      router.push(`/projects/${projectId}/content-briefs/${r.id}`);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const fullyDisabled = disabled || !keywordId;
  const tooltipText = disabledReason ?? (!keywordId ? 'Pick a keyword first' : undefined);

  const onClick = (): void => {
    if (fullyDisabled) return;
    if (!keywordIsMapped) {
      modal.confirm({
        title: 'Keyword is not mapped to a target page',
        content:
          'Brief generation works best on mapped keywords. Without a mapped page the brief will use the ranking URL (or come back as needs_target_mapping). Continue anyway?',
        okText: 'Create brief',
        onOk: () => create.mutate(),
      });
      return;
    }
    create.mutate();
  };

  return (
    <Tooltip title={tooltipText}>
      <Button
        size={size}
        icon={<FileText size={14} />}
        loading={create.isPending}
        disabled={fullyDisabled}
        onClick={onClick}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
