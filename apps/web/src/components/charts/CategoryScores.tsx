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
import { chartColors, categoryColor } from '../../theme/chart-colors';

export type CategoryScore = { category: string; score: number };

export function CategoryScoresChart({ data }: { data: CategoryScore[] }): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          stroke={chartColors.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          stroke={chartColors.axis}
          fontSize={11}
          width={150}
          tickLine={false}
          axisLine={false}
          interval={0}
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
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.category} fill={categoryColor(d.category)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
