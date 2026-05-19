'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartColors, severityColor } from '../../theme/chart-colors';

export type SeverityBucket = { severity: string; count: number };

export function SeverityBars({ data }: { data: SeverityBucket[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="severity"
          stroke={chartColors.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke={chartColors.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
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
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.severity} fill={severityColor(d.severity)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
