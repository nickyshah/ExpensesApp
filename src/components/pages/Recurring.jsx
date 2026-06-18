'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '@/state/store';
import { formatCurrency } from '@/lib/currency.js';
import TopBar from '@/components/layout/TopBar.jsx';
import Sheet from '@/components/ui/Sheet.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { toast } from '@/components/ui/Toast.jsx';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function RecurringForm({ editing, onDone }) {
  const createRecurringBill = useStore((s) => s.createRecurringBill);
  const updateRecurringBill = useStore((s) => s.updateRecurringBill);
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const fetchAccounts = useStore((s) => s.fetchAccounts);

  const [name, setName] = useState(editing?.name || '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [frequency, setFrequency] = useState(editing?.frequency || 'monthly');
  const [nextDueDate, setNextDueDate] = useState(editing?.next_due_date || '');
  const [accountId, setAccountId] = useState(editing?.account_id || '');
  const [categoryId, setCategoryId] = useState(editing?.category_id || '');
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method || 'bank');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.is_archived);

  useEffect(() => {
    if (categories.length === 0) fetchCategories();
    if (accounts.length === 0) fetchAccounts();
  }, []);

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts]);

  async function submit(e) {
    e.preventDefault();
    if (!name || !amount || !nextDueDate || !accountId || !categoryId) {
      toast('Please fill in all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { name, amount: Number(amount), frequency, next_due_date: nextDueDate, account_id: Number(accountId), category_id: Number(categoryId), payment_method: paymentMethod, notes };
      if (editing) await updateRecurringBill(editing.id, payload);
      else await createRecurringBill(payload);
      toast(editing ? 'Bill updated' : 'Bill created', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <div>
        <label className="label">Bill Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix, Rent" className="input" autoFocus />
      </div>
      <div>
        <label className="label">Amount</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -trangray-y-1/2 text-gray-400 font-semibold">$</span>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input pl-8 text-xl font-bold" placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className="label">Frequency</label>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button key={f.value} type="button" onClick={() => setFrequency(f.value)}
              className={`chip ${frequency === f.value ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Next Due Date</label>
        <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Account</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Category</label>
        <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto">
          {expenseCategories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition
                ${Number(categoryId) === c.id ? 'bg-brand-100 dark:bg-brand-700/30 ring-2 ring-brand-500 text-brand-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
              <span className="text-lg">{c.icon}</span>
              <span className="truncate w-full text-center">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Payment Method</label>
        <div className="flex gap-2">
          {['bank', 'cash', 'card'].map((m) => (
            <button key={m} type="button" onClick={() => setPaymentMethod(m)}
              className={`chip flex-1 justify-center ${paymentMethod === m ? 'bg-expense text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="input" />
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
        {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Bill'}
      </button>
    </form>
  );
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

export default function Recurring() {
  const fetchRecurringBills = useStore((s) => s.fetchRecurringBills);
  const recurringBills = useStore((s) => s.recurringBills);
  const updateRecurringBill = useStore((s) => s.updateRecurringBill);
  const deleteRecurringBill = useStore((s) => s.deleteRecurringBill);
  const markBillPaid = useStore((s) => s.markBillPaid);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [paying, setPaying] = useState(null);

  useEffect(() => { fetchRecurringBills(); }, []);

  async function handlePay(bill) {
    setPaying(bill.id);
    try {
      await markBillPaid(bill.id);
      toast(`${bill.name} paid ✓`, 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setPaying(null); }
  }

  async function handleToggle(bill) {
    try {
      await updateRecurringBill(bill.id, { is_active: bill.is_active ? 0 : 1 });
      toast(bill.is_active ? 'Bill paused' : 'Bill resumed', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await deleteRecurringBill(deleteTarget.id);
      toast('Bill deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setDeleteTarget(null);
  }

  const activeBills = recurringBills.filter((b) => b.is_active);
  const pausedBills = recurringBills.filter((b) => !b.is_active);

  const monthlyTotal = activeBills.reduce((sum, b) => {
    const multiplier = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
    return sum + b.amount * (multiplier[b.frequency] || 1);
  }, 0);

  return (
    <div className="pb-24 min-h-screen">
      <TopBar title="Recurring" />

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-4">
        {/* Summary */}
        <div className="card p-4 flex justify-between items-center">
          <div>
            <p className="text-gray-400 text-sm">Est. monthly commitments</p>
            <p className="text-2xl font-extrabold text-expense">{formatCurrency(monthlyTotal)}</p>
          </div>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-primary py-2 px-3 text-sm">
            <Plus size={18} /> Add Bill
          </button>
        </div>

        {/* Active bills */}
        {activeBills.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p>No recurring bills yet.</p>
            <p className="text-sm mt-1">Add rent, subscriptions, insurance…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBills.sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).map((bill) => {
              const days = daysUntil(bill.next_due_date);
              const isOverdue = days < 0;
              const isSoon = days >= 0 && days <= 3;
              return (
                <div key={bill.id} className={`card p-4 ${isOverdue ? 'border-expense/40 dark:border-expense/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">{bill.category_icon || '📋'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{bill.name}</p>
                        <span className="text-xs text-gray-400 capitalize shrink-0">{bill.frequency}</span>
                      </div>
                      <p className="text-xs text-gray-400">{bill.category_name} · {bill.account_name}</p>
                      <p className={`text-xs font-semibold mt-1 ${isOverdue ? 'text-expense' : isSoon ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isOverdue ? `⚠️ Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}` :
                          days === 0 ? '📅 Due today' :
                          `📅 Due in ${days} day${days !== 1 ? 's' : ''} (${bill.next_due_date})`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-lg">{formatCurrency(bill.amount)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handlePay(bill)} disabled={paying === bill.id}
                      className="btn-primary flex-1 py-2 text-sm disabled:opacity-60">
                      <CheckCircle size={16} />
                      {paying === bill.id ? 'Paying...' : 'Mark as Paid'}
                    </button>
                    <button onClick={() => { setEditing(bill); setFormOpen(true); }} className="btn-secondary py-2 px-3">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleToggle(bill)} className="btn-secondary py-2 px-3">
                      <ToggleRight size={16} />
                    </button>
                    <button onClick={() => setDeleteTarget(bill)} className="btn-ghost py-2 px-3 text-gray-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paused bills */}
        {pausedBills.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Paused ({pausedBills.length})</p>
            <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden opacity-60">
              {pausedBills.map((bill) => (
                <div key={bill.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl">{bill.category_icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold line-through text-gray-400">{bill.name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(bill.amount)} / {bill.frequency}</p>
                  </div>
                  <button onClick={() => handleToggle(bill)} className="text-xs text-brand-600 font-semibold">Resume</button>
                  <button onClick={() => setDeleteTarget(bill)} className="p-1 text-gray-300"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Bill' : 'New Recurring Bill'} fullHeight>
        <RecurringForm key={editing?.id || 'new'} editing={editing} onDone={() => setFormOpen(false)} />
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Recurring Bill"
        message={`Delete "${deleteTarget?.name}"? Past transactions will be kept.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
