'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency, formatDateShort } from '../../lib/currency.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg px-3 py-2 text-sm border border-gray-100 dark:border-gray-700">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="font-bold text-brand-600">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function BalanceLine({ history = [] }) {
  if (!history.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data available</div>;
  }

  // Thin out data points so labels aren't too dense — show every Nth label
  const step = Math.max(1, Math.floor(history.length / 8));
  const data = history.map((d, i) => ({
    ...d,
    label: i % step === 0 ? formatDateShort(d.date) : '',
  }));

  const balances = data.map((d) => d.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const padding = Math.abs(maxBal - minBal) * 0.15 || 100;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#808080' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#808080' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
          width={40}
          domain={[minBal - padding, maxBal + padding]}
        />
        <Tooltip content={<CustomTooltip />} />
        {minBal < 0 && <ReferenceLine y={0} stroke="#1a1a1a" strokeDasharray="4 2" />}
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#4d4d4d"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#4d4d4d', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
