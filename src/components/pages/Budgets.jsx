'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Copy } from 'lucide-react';
import { useStore } from '@/state/store';
import { formatCurrency, currentMonth } from '@/lib/currency.js';
import TopBar from '@/components/layout/TopBar.jsx';
import ProgressBar, { budgetColor } from '@/components/ui/ProgressBar.jsx';
import Sheet from '@/components/ui/Sheet.jsx';
import { toast } from '@/components/ui/Toast.jsx';

function monthLabel(m) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function BudgetEditForm({ item, month, onDone }) {
  const setBudget = useStore((s) => s.setBudget);
  const deleteBudget = useStore((s) => s.deleteBudget);
  const [amount, setAmount] = useState(item.budget > 0 ? String(item.budget) : '');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!amount || Number(amount) === 0) {
        await deleteBudget(item.category_id, month);
        toast('Budget removed', 'success');
      } else {
        await setBudget(item.category_id, month, Number(amount));
        toast('Budget saved', 'success');
      }
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 p-4 card">
        <span className="text-3xl">{item.category_icon}</span>
        <div>
          <p className="font-bold">{item.category_name}</p>
          <p className="text-sm text-gray-400">Spent this month: {formatCurrency(item.spent)}</p>
        </div>
      </div>
      <div>
        <label className="label">Monthly Budget</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -trangray-y-1/2 text-gray-400 font-semibold">$</span>
          <input
            type="number" inputMode="decimal" step="1" min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input pl-8 text-xl font-bold"
            autoFocus
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Leave at $0 to remove the budget for this category.</p>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Budget'}
      </button>
    </form>
  );
}

export default function Budgets() {
  const fetchBudgets = useStore((s) => s.fetchBudgets);
  const copyBudgetTemplate = useStore((s) => s.copyBudgetTemplate);
  const budgets = useStore((s) => s.budgets);

  const [month, setMonth] = useState(currentMonth());
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBudgets(month).finally(() => setLoading(false));
  }, [month]);

  const isCurrentMonth = month === currentMonth();

  async function handleCopyTemplate() {
    try {
      await copyBudgetTemplate(month);
      toast('Budget template applied', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  const items = budgets?.budgets || [];
  const totals = budgets?.totals || { budget: 0, spent: 0 };
  const overBudgetItems = items.filter((i) => i.spent > i.budget && i.budget > 0);

  return (
    <div className="pb-24 min-h-screen">
      <TopBar title="Budgets" />

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-90 transition">
            <ChevronLeft size={22} />
          </button>
          <h2 className="font-bold text-lg">{monthLabel(month)}</h2>
          <button onClick={() => setMonth(nextMonth(month))} className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-90 transition"
            disabled={isCurrentMonth}>
            <ChevronRight size={22} className={isCurrentMonth ? 'text-gray-300' : ''} />
          </button>
        </div>

        {/* Summary card */}
        {totals.budget > 0 && (
          <div className="card p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Total Budget</span>
              <span className="font-bold">{formatCurrency(totals.budget)}</span>
            </div>
            <ProgressBar value={totals.spent} max={totals.budget} />
            <div className="flex justify-between text-xs mt-2 text-gray-400">
              <span>Spent: {formatCurrency(totals.spent)}</span>
              <span>Remaining: <span className={totals.spent > totals.budget ? 'text-expense font-semibold' : 'text-income font-semibold'}>
                {formatCurrency(totals.budget - totals.spent)}
              </span></span>
            </div>
          </div>
        )}

        {/* Over-budget alert */}
        {overBudgetItems.length > 0 && (
          <div className="card p-3 border-expense/30 bg-expense-light dark:bg-expense/10">
            <p className="text-expense font-semibold text-sm">⚠️ Over budget in {overBudgetItems.length} categor{overBudgetItems.length === 1 ? 'y' : 'ies'}:</p>
            <p className="text-sm text-expense mt-1">{overBudgetItems.map((i) => i.category_name).join(', ')}</p>
          </div>
        )}

        {/* Copy template button */}
        {items.length === 0 && !loading && (
          <button onClick={handleCopyTemplate} className="btn-secondary w-full">
            <Copy size={18} /> Copy from previous budget
          </button>
        )}

        {/* Budget items */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-24 animate-pulse bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-4xl mb-2">🎯</p>
            <p className="font-medium">No budgets set for this month</p>
            <p className="text-sm mt-1">Tap any category below or copy from your template</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pct = item.budget > 0 ? Math.min(100, Math.round((item.spent / item.budget) * 100)) : null;
              return (
                <div key={item.category_id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{item.category_icon}</span>
                    <span className="font-semibold flex-1">{item.category_name}</span>
                    {pct !== null && (
                      <span className={`text-xs font-bold ${budgetColor(item.spent, item.budget)}`}>{pct}%</span>
                    )}
                    <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                      <Pencil size={15} />
                    </button>
                  </div>
                  {item.budget > 0 ? (
                    <>
                      <ProgressBar value={item.spent} max={item.budget} />
                      <div className="flex justify-between text-xs mt-1.5 text-gray-400">
                        <span>Spent: <span className={budgetColor(item.spent, item.budget)}>{formatCurrency(item.spent)}</span></span>
                        <span>of {formatCurrency(item.budget)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">No budget set</span>
                      <span className="text-sm font-semibold text-expense">{formatCurrency(item.spent)} spent</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add budget for untracked category */}
        <button onClick={() => setEditingItem({ category_id: null, category_name: '', category_icon: '🏷️', budget: 0, spent: 0 })}
          className="btn-secondary w-full">
          <Plus size={18} /> Set budget for a category
        </button>
      </div>

      <Sheet open={!!editingItem} onClose={() => setEditingItem(null)} title="Set Budget">
        {editingItem && (
          editingItem.category_id ? (
            <BudgetEditForm item={editingItem} month={month} onDone={() => setEditingItem(null)} />
          ) : (
            <BudgetCategoryPicker month={month} onDone={() => setEditingItem(null)} />
          )
        )}
      </Sheet>
    </div>
  );
}

function BudgetCategoryPicker({ month, onDone }) {
  const categories = useStore((s) => s.categories);
  const setBudget = useStore((s) => s.setBudget);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (categories.length === 0) fetchCategories(); }, []);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.is_archived);

  async function submit(e) {
    e.preventDefault();
    if (!selected || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await setBudget(selected, month, Number(amount));
      toast('Budget saved', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <div>
        <label className="label">Category</label>
        <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
          {expenseCategories.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelected(c.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition
                ${selected === c.id ? 'bg-brand-100 dark:bg-brand-700/30 ring-2 ring-brand-500 text-brand-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
              <span className="text-lg">{c.icon}</span>
              <span className="truncate w-full text-center">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Monthly Budget</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -trangray-y-1/2 text-gray-400 font-semibold">$</span>
          <input type="number" inputMode="decimal" step="1" min="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input pl-8 text-xl font-bold" />
        </div>
      </div>
      <button type="submit" disabled={saving || !selected || !amount} className="btn-primary w-full disabled:opacity-60">
        {saving ? 'Saving...' : 'Set Budget'}
      </button>
    </form>
  );
}
