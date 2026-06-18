'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Trash2, Archive } from 'lucide-react';
import { useStore } from '@/state/store';
import { formatCurrency } from '@/lib/currency.js';
import Sheet from '@/components/ui/Sheet.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { toast } from '@/components/ui/Toast.jsx';

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'savings', label: 'Savings', icon: '🪙' },
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
  { value: 'other', label: 'Other', icon: '📁' },
];

const DEFAULT_ICONS = { bank: '🏦', cash: '💵', savings: '🪙', credit_card: '💳', other: '📁' };

function AccountForm({ editing, onDone }) {
  const createAccount = useStore((s) => s.createAccount);
  const updateAccount = useStore((s) => s.updateAccount);
  const [name, setName] = useState(editing?.name || '');
  const [type, setType] = useState(editing?.type || 'bank');
  const [icon, setIcon] = useState(editing?.icon || '🏦');
  const [openingBalance, setOpeningBalance] = useState(editing ? String(editing.opening_balance) : '0');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), type, icon, opening_balance: Number(openingBalance) || 0 };
      if (editing) await updateAccount(editing.id, payload);
      else await createAccount(payload);
      toast(editing ? 'Account updated' : 'Account created', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <div>
        <label className="label">Account Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CommBank Everyday" className="input" autoFocus />
      </div>
      <div>
        <label className="label">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => { setType(t.value); setIcon(DEFAULT_ICONS[t.value]); }}
              className={`py-2 rounded-xl text-sm font-medium transition ${type === t.value ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Icon (emoji)</label>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className="input w-20 text-2xl text-center" maxLength={2} />
      </div>
      {!editing && (
        <div>
          <label className="label">Opening Balance</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -trangray-y-1/2 text-gray-400 font-semibold">$</span>
            <input type="number" inputMode="decimal" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="input pl-8" placeholder="0.00" />
          </div>
          <p className="text-xs text-gray-400 mt-1">The current balance of this account before tracking in Expenses App</p>
        </div>
      )}
      <button type="submit" disabled={saving || !name.trim()} className="btn-primary w-full disabled:opacity-60">
        {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Account'}
      </button>
    </form>
  );
}

export default function Accounts() {
  const accounts = useStore((s) => s.accounts);
  const totalBalance = useStore((s) => s.totalBalance);
  const fetchAccounts = useStore((s) => s.fetchAccounts);
  const updateAccount = useStore((s) => s.updateAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const archivedAccounts = accounts.filter((a) => a.is_archived);

  async function handleArchive(acc) {
    try {
      await updateAccount(acc.id, { is_archived: acc.is_archived ? 0 : 1 });
      toast(acc.is_archived ? 'Account restored' : 'Account archived', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await deleteAccount(deleteTarget.id);
      toast('Account deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setDeleteTarget(null);
  }

  function AccountCard({ acc }) {
    const isNegative = acc.balance < 0;
    return (
      <div className="card p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl shrink-0">
          {acc.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold">{acc.name}</p>
          <p className="text-xs text-gray-400 capitalize">{acc.type.replace('_', ' ')}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-extrabold text-lg ${isNegative ? 'text-expense' : 'text-gray-800 dark:text-white'}`}>
            {formatCurrency(acc.balance)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => { setEditing(acc); setFormOpen(true); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <Pencil size={16} />
          </button>
          <button onClick={() => handleArchive(acc)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <Archive size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      <div className="sticky top-0 z-30 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-md safe-top">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Accounts</h1>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-primary py-2 px-3 text-sm">
            <PlusCircle size={18} /> Add Account
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-4">
        {/* Total */}
        <div className="card p-4 bg-gradient-to-r from-brand-600 to-brand-700 text-white border-0">
          <p className="text-brand-100 text-sm">Total Net Worth</p>
          <p className="text-3xl font-extrabold mt-1">{formatCurrency(totalBalance)}</p>
        </div>

        {/* Active accounts */}
        <div className="space-y-3">
          {activeAccounts.map((acc) => <AccountCard key={acc.id} acc={acc} />)}
          {activeAccounts.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🏦</p>
              <p>No accounts yet. Add one to get started.</p>
            </div>
          )}
        </div>

        {/* Archived */}
        {archivedAccounts.length > 0 && (
          <div>
            <button onClick={() => setShowArchived((v) => !v)} className="text-sm text-gray-400 font-medium">
              {showArchived ? '▾' : '▸'} Archived ({archivedAccounts.length})
            </button>
            {showArchived && (
              <div className="space-y-2 mt-2 opacity-60">
                {archivedAccounts.map((acc) => (
                  <div key={acc.id} className="card p-4 flex items-center gap-3">
                    <div className="text-2xl">{acc.icon}</div>
                    <div className="flex-1">
                      <p className="font-semibold line-through">{acc.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(acc.balance)}</p>
                    </div>
                    <button onClick={() => handleArchive(acc)} className="text-xs text-brand-600 font-semibold">Restore</button>
                    <button onClick={() => setDeleteTarget(acc)} className="p-2 text-gray-400"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Account' : 'New Account'}>
        <AccountForm key={editing?.id || 'new'} editing={editing} onDone={() => setFormOpen(false)} />
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Account"
        message="This permanently deletes the account. You can only delete accounts with no transactions."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
