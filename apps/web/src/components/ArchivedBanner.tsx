'use client';

import { App, Button } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Banner shown above all project pages when the project is archived. Doc 10 §"Archived project
 * pages should clearly show archived state".
 */
export function ArchivedBanner({
  projectId,
  archivedAt,
  reason,
}: {
  projectId: string;
  archivedAt: string | null;
  reason: string | null;
}): JSX.Element {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: () => api(`/projects/${projectId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Project restored. Re-enable monitoring on the Monitoring tab when ready.');
      void qc.invalidateQueries({ queryKey: ['project-shell', projectId] });
      void qc.invalidateQueries({ queryKey: ['projects-list'] });
    },
    onError: (err) => message.error((err as Error).message),
  });

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 md:px-8 py-3">
      <div className="mx-auto max-w-[1320px] flex flex-wrap items-center gap-3 text-sm">
        <Archive size={14} className="text-amber-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-amber-200">This project is archived.</span>
          <span className="text-amber-200/80 ml-2">
            Manual crawls, audits, syncs, and report generation are blocked. Historical data
            remains viewable.
            {archivedAt
              ? ` Archived ${new Date(archivedAt).toLocaleDateString()}.`
              : ''}
            {reason ? ` Reason: ${reason}` : ''}
          </span>
        </div>
        <Button
          size="small"
          loading={restore.isPending}
          onClick={() =>
            modal.confirm({
              title: 'Restore this project?',
              content:
                'The project will become writable again. Scheduled monitoring remains paused until you re-enable it on the Monitoring tab.',
              okText: 'Restore',
              onOk: () => restore.mutate(),
            })
          }
        >
          Restore project
        </Button>
      </div>
    </div>
  );
}
