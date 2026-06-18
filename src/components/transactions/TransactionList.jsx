'use client';

import { useMemo } from 'react';
import TransactionItem from './TransactionItem.jsx';
import { groupLabelForDate } from '../../lib/currency.js';

/**
 * Renders a flat transaction array grouped into labeled date sections.
 */
export default function TransactionList({ transactions, onEdit, onDelete, emptyMessage = 'No transactions found' }) {
  const groups = useMemo(() => {
    const map = new Map();
    transactions.forEach((t) => {
      const label = groupLabelForDate(t.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(t);
    });
    return Array.from(map.entries());
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-2">📭</p>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([label, items]) => (
        <div key={label}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">{label}</h3>
          <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {items.map((t) => (
              <TransactionItem key={t.id} transaction={t} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
