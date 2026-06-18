'use client';

import { useState, useEffect } from 'react';
import Sheet from '../ui/Sheet.jsx';
import { useStore } from '../../state/store.js';

const DEFAULT_FILTERS = {
  type: '',
  category_id: '',
  payment_method: '',
  date_from: '',
  date_to: '',
  amount_min: '',
  amount_max: '',
};

export default function FilterSheet({ open, onClose, filters, onApply }) {
  const categories = useStore((s) => s.categories);
  const [local, setLocal] = useState({ ...DEFAULT_FILTERS, ...filters });

  useEffect(() => {
    if (open) setLocal({ ...DEFAULT_FILTERS, ...filters });
  }, [open]);

  function update(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function apply() {
    onApply(local);
    onClose();
  }

  function reset() {
    setLocal(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    onClose();
  }

  const filteredCategories = local.type === 'income'
    ? categories.filter((c) => c.type === 'income')
    : local.type === 'expense'
      ? categories.filter((c) => c.type === 'expense')
      : categories;

  return (
    <Sheet open={open} onClose={onClose} title="Filter Transactions">
      <div className="space-y-4">
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {[
              { value: '', label: 'All' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('type', opt.value)}
                className={`chip flex-1 justify-center ${local.type === opt.value ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select value={local.category_id} onChange={(e) => update('category_id', e.target.value)} className="input">
            <option value="">All categories</option>
            {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Payment Method</label>
          <div className="flex gap-2">
            {[
              { value: '', label: 'All' },
              { value: 'bank', label: 'Bank' },
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('payment_method', opt.value)}
                className={`chip flex-1 justify-center ${local.payment_method === opt.value ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">From Date</label>
            <input type="date" value={local.date_from} onChange={(e) => update('date_from', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={local.date_to} onChange={(e) => update('date_to', e.target.value)} className="input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Min Amount</label>
            <input type="number" inputMode="decimal" min="0" placeholder="$0" value={local.amount_min} onChange={(e) => update('amount_min', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Max Amount</label>
            <input type="number" inputMode="decimal" min="0" placeholder="No limit" value={local.amount_max} onChange={(e) => update('amount_max', e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={reset} className="btn-secondary flex-1">Reset</button>
          <button onClick={apply} className="btn-primary flex-1">Apply Filters</button>
        </div>
      </div>
    </Sheet>
  );
}
