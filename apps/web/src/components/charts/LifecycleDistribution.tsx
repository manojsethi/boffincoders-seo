'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors } from '../../theme/chart-colors';

export type LifecyclePoint = { state: string; count: number };

export function LifecycleDistribution({ data }: { data: LifecyclePoint[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 28 }}>
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="state"
          stroke={chartColors.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke={chartColors.axis}
          fontSize={11}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          cursor={{ fill: 'var(--c-surface-hover)' }}
          contentStyle={{
            background: chartColors.tooltipBg,
            border: `1px solid ${chartColors.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--c-text)',
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={chartColors.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
}
