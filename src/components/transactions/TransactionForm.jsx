'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../state/store.js';
import { todayISO } from '../../lib/currency.js';
import { toast } from '../ui/Toast.jsx';

const INCOME_SOURCES = ['Salary', 'Bank Transfer', 'Cash Deposit', 'Refund', 'Other'];
const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
];

/**
 * Unified form for creating/editing a transaction.
 * `initialType` is one of 'income' | 'expense' | 'transfer'.
 * `editingTransaction` (optional) pre-fills the form for edit mode.
 */
export default function TransactionForm({ initialType = 'expense', editingTransaction = null, onDone }) {
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const createTransaction = useStore((s) => s.createTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const fetchAccounts = useStore((s) => s.fetchAccounts);

  const isEdit = !!editingTransaction;
  const [type, setType] = useState(editingTransaction?.type || initialType);
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amount) : '');
  const [date, setDate] = useState(editingTransaction?.date || todayISO());
  const [accountId, setAccountId] = useState(editingTransaction?.account_id || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(editingTransaction?.to_account_id || '');
  const [categoryId, setCategoryId] = useState(editingTransaction?.category_id || '');
  const [source, setSource] = useState(editingTransaction?.source || 'Salary');
  const [paymentMethod, setPaymentMethod] = useState(editingTransaction?.payment_method || 'bank');
  const [notes, setNotes] = useState(editingTransaction?.notes || '');
  const [tagsInput, setTagsInput] = useState((editingTransaction?.tags || []).map((t) => t.name).join(', '));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
    if (categories.length === 0) fetchCategories();
  }, []);

  // Default account once accounts load
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts]);

  const filteredCategories = useMemo(() => {
    if (type === 'transfer') return [];
    return categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  }, [categories, type]);

  // Reset category when type changes (if it no longer matches)
  useEffect(() => {
    if (type === 'transfer') {
      setCategoryId('');
      return;
    }
    const valid = filteredCategories.some((c) => c.id === Number(categoryId));
    if (!valid) setCategoryId(filteredCategories[0]?.id || '');
  }, [type, filteredCategories]);

  function validate() {
    const e = {};
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than $0';
    if (!date) e.date = 'Date is required';
    if (!accountId) e.accountId = 'Select an account';
    if (type === 'transfer') {
      if (!toAccountId) e.toAccountId = 'Select destination account';
      if (toAccountId && Number(toAccountId) === Number(accountId)) e.toAccountId = 'Must differ from source account';
    } else if (!categoryId) {
      e.categoryId = 'Select a category';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

    const payload = {
      type,
      amount: Number(amount),
      date,
      account_id: Number(accountId),
      ...(type === 'transfer' ? { to_account_id: Number(toAccountId) } : { category_id: Number(categoryId) }),
      ...(type === 'income' ? { source } : {}),
      ...(type === 'expense' ? { payment_method: paymentMethod } : {}),
      notes: notes || null,
      tags,
    };

    try {
      if (isEdit) {
        await updateTransaction(editingTransaction.id, payload);
        toast('Transaction updated', 'success');
      } else {
        await createTransaction(payload);
        toast(`${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} added`, 'success');
      }
      onDone?.();
    } catch (err) {
      toast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const isIncome = type === 'income';
  const isExpense = type === 'expense';
  const isTransfer = type === 'transfer';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-4">
      {/* Type selector */}
      {!isEdit || true ? (
        <div className="grid grid-cols-3 gap-2">
          {['expense', 'income', 'transfer'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-2.5 rounded-xl font-semibold text-sm capitalize transition-colors
                ${type === t
                  ? t === 'income' ? 'bg-income text-white'
                  : t === 'expense' ? 'bg-expense text-white'
                  : 'bg-gray-700 text-white dark:bg-gray-600'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {/* Amount */}
      <div>
        <label className="label">Amount (AUD)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -trangray-y-1/2 text-gray-400 text-lg font-semibold">$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input pl-8 text-xl font-bold"
            autoFocus
          />
        </div>
        {errors.amount && <p className="text-expense text-sm mt-1">{errors.amount}</p>}
      </div>

      {/* Date */}
      <div>
        <label className="label">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" max={todayISO()} />
        {errors.date && <p className="text-expense text-sm mt-1">{errors.date}</p>}
      </div>

      {/* Account(s) */}
      {isTransfer ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">From</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="input">
              <option value="">Select account</option>
              {accounts.filter((a) => a.id !== Number(accountId)).map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
            {errors.toAccountId && <p className="text-expense text-sm mt-1">{errors.toAccountId}</p>}
          </div>
        </div>
      ) : (
        <div>
          <label className="label">Account</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          {errors.accountId && <p className="text-expense text-sm mt-1">{errors.accountId}</p>}
        </div>
      )}

      {/* Category */}
      {!isTransfer && (
        <div>
          <label className="label">Category</label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-colors
                  ${Number(categoryId) === c.id
                    ? 'bg-brand-100 dark:bg-brand-700/30 text-brand-700 dark:text-brand-400 ring-2 ring-brand-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                <span className="text-lg">{c.icon}</span>
                <span className="truncate w-full text-center">{c.name}</span>
              </button>
            ))}
          </div>
          {errors.categoryId && <p className="text-expense text-sm mt-1">{errors.categoryId}</p>}
        </div>
      )}

      {/* Income source */}
      {isIncome && (
        <div>
          <label className="label">Source</label>
          <div className="flex flex-wrap gap-2">
            {INCOME_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`chip ${source === s ? 'bg-income text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment method */}
      {isExpense && (
        <div>
          <label className="label">Payment Method</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`chip flex-1 justify-center ${paymentMethod === m.value ? 'bg-expense text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {!isTransfer && (
        <div>
          <label className="label">Tags <span className="text-gray-400 font-normal">(comma separated)</span></label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. work, weekly, family"
            className="input"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes..."
          className="input resize-none"
        />
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full text-base py-3.5 disabled:opacity-60">
        {saving ? 'Saving...' : isEdit ? 'Save Changes' : `Add ${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'}`}
      </button>
    </form>
  );
}
