'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../../lib/currency.js';

const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg px-3 py-2 text-sm border border-gray-100 dark:border-gray-700">
      <p className="font-semibold">{d.icon} {d.name}</p>
      <p className="text-gray-500">{formatCurrency(d.total)} · {d.percent}%</p>
    </div>
  );
}

export default function CategoryPie({ data = [] }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for this period</div>;
  }

  const chartData = data.map((d) => ({ ...d, value: d.total }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color || '#808080'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-2 mt-2">
        {data.map((d) => (
          <div key={d.category_id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color || '#808080' }} />
            <span className="text-sm flex-1 truncate">{d.icon} {d.name}</span>
            <span className="text-sm font-semibold">{formatCurrency(d.total)}</span>
            <span className="text-xs text-gray-400 w-10 text-right">{d.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
