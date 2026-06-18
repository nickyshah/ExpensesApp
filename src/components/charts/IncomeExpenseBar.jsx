'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '../../lib/currency.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg px-3 py-2 text-sm border border-gray-100 dark:border-gray-700">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name.charAt(0).toUpperCase() + p.name.slice(1)}: {formatCurrency(p.value)}
        </p>
      ))}
      {payload.length === 2 && (
        <p className={`text-xs mt-1 ${payload[0].value - payload[1].value >= 0 ? 'text-income' : 'text-expense'}`}>
          Net: {formatCurrency(payload[0].value - payload[1].value)}
        </p>
      )}
    </div>
  );
}

export default function IncomeExpenseBar({ data = [] }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data available</div>;
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.month ? d.month.slice(0, 7).replace('-', '/').slice(2) : '',
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#808080' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#808080' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Bar dataKey="income" name="income" fill="#4d4d4d" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="expense" name="expense" fill="#1a1a1a" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
