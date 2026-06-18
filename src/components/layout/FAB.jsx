'use client';

import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Receipt, X } from 'lucide-react';

/**
 * FAB that expands into Quick Action options: + Income, + Expense, + Bill Paid.
 */
export default function FAB({ onIncome, onExpense, onBillPaid }) {
  const [open, setOpen] = useState(false);

  const actions = [
    { label: 'Income', icon: TrendingUp, color: 'bg-income text-white', onClick: onIncome },
    { label: 'Expense', icon: TrendingDown, color: 'bg-expense text-white', onClick: onExpense },
    { label: 'Bill Paid', icon: Receipt, color: 'bg-gray-700 text-white dark:bg-gray-600', onClick: onBillPaid },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <>
          <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
          {actions.map(({ label, icon: Icon, color, onClick }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); onClick?.(); }}
              className={`flex items-center gap-3 pl-4 pr-5 py-3 rounded-full shadow-lg ${color}
                font-semibold text-sm active:scale-95 transition animate-in slide-in-from-bottom-2 fade-in`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90
          ${open ? 'bg-gray-700 dark:bg-gray-600 rotate-45' : 'bg-brand-600'} text-white`}
        aria-label="Quick add"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
