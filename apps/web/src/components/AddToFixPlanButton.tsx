'use client';

import { App, Button, Modal, Select } from 'antd';
import { ClipboardList } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

/**
 * Reusable "Add to fix plan" CTA. Shows a small modal listing the project's existing draft/active
 * plans plus a "Create new draft" affordance. Used from Recommendations, Issues, Opportunities,
 * Content briefs.
 */

type Plan = {
  id: string;
  title: string;
  status: string;
};

export function AddToFixPlanButton({
  projectId,
  sourceType,
  sourceId,
  size = 'small',
  label = 'Add to fix plan',
  disabled,
  disabledReason,
}: {
  projectId: string;
  sourceType: 'recommendation' | 'issue' | 'opportunity' | 'content-brief';
  sourceId: string;
  size?: 'small' | 'middle';
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
}): JSX.Element {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');

  const plans = useQuery<Plan[]>({
    queryKey: ['fix-plans', projectId, 'draft+active'],
    queryFn: () =>
      api<Plan[]>(`/projects/${projectId}/fix-plans`).then((p) =>
        p.filter((x) => x.status === 'draft' || x.status === 'active'),
      ),
    enabled: open,
  });

  const addItem = useMutation({
    mutationFn: (targetPlanId: string) =>
      api(`/projects/${projectId}/fix-plans/${targetPlanId}/items`, {
        method: 'POST',
        body: JSON.stringify({ sourceType, sourceId }),
      }),
    onSuccess: () => {
      message.success('Added to fix plan');
      void qc.invalidateQueries({ queryKey: ['fix-plans', projectId] });
      void qc.invalidateQueries({ queryKey: ['fix-plans-summary', projectId] });
      setOpen(false);
    },
    onError: (err) => message.error((err as Error).message),
  });

  const createPlan = useMutation({
    mutationFn: async (title: string) => {
      const plan = await api<Plan>(`/projects/${projectId}/fix-plans`, {
        method: 'POST',
        body: JSON.stringify({ title, status: 'draft' }),
      });
      await api(`/projects/${projectId}/fix-plans/${plan.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ sourceType, sourceId }),
      });
      return plan;
    },
    onSuccess: () => {
      message.success('New plan created with this item');
      void qc.invalidateQueries({ queryKey: ['fix-plans', projectId] });
      void qc.invalidateQueries({ queryKey: ['fix-plans-summary', projectId] });
      setOpen(false);
      setNewTitle('');
    },
    onError: (err) => message.error((err as Error).message),
  });

  const planOptions = (plans.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.title} (${p.status})`,
  }));

  return (
    <>
      <Button
        size={size}
        icon={<ClipboardList size={14} />}
        disabled={disabled}
        title={disabledReason ?? undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Modal
        open={open}
        title="Add to fix plan"
        onCancel={() => setOpen(false)}
        footer={null}
        width={480}
      >
        <div className="space-y-4 mt-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
              Existing draft / active plans
            </div>
            <div className="flex items-center gap-2">
              <Select
                style={{ flex: 1 }}
                placeholder={
                  plans.isLoading
                    ? 'Loading…'
                    : planOptions.length === 0
                    ? 'No draft or active plans yet'
                    : 'Pick a plan'
                }
                value={planId || undefined}
                onChange={(v) => setPlanId(v)}
                options={planOptions}
                disabled={planOptions.length === 0}
              />
              <Button
                type="primary"
                disabled={!planId}
                loading={addItem.isPending}
                onClick={() => addItem.mutate(planId)}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <div className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
              Or create a new plan with this item
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Week of 2026-05-19"
                className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
              />
              <Button
                disabled={!newTitle.trim()}
                loading={createPlan.isPending}
                onClick={() => createPlan.mutate(newTitle.trim())}
              >
                Create + add
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
