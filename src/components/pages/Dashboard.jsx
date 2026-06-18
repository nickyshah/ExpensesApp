'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, AlertCircle, ChevronRight } from 'lucide-react';
import { useStore } from '@/state/store';
import { formatCurrency } from '@/lib/currency.js';
import TopBar from '@/components/layout/TopBar.jsx';
import FAB from '@/components/layout/FAB.jsx';
import TransactionList from '@/components/transactions/TransactionList.jsx';
import TransactionForm from '@/components/transactions/TransactionForm.jsx';
import Sheet from '@/components/ui/Sheet.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import ProgressBar from '@/components/ui/ProgressBar.jsx';
import { toast } from '@/components/ui/Toast.jsx';

export default function Dashboard() {
  const router = useRouter();
  const fetchDashboard = useStore((s) => s.fetchDashboard);
  const fetchRecentTransactions = useStore((s) => s.fetchRecentTransactions);
  const fetchUpcomingBills = useStore((s) => s.fetchUpcomingBills);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const dashboard = useStore((s) => s.dashboard);
  const recentTransactions = useStore((s) => s.recentTransactions);
  const upcomingBills = useStore((s) => s.upcomingBills);
  const markBillPaid = useStore((s) => s.markBillPaid);

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState('expense');
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchRecentTransactions(), fetchUpcomingBills(14)])
      .finally(() => setLoading(false));
  }, []);

  function openForm(type) {
    setFormType(type);
    setEditingTx(null);
    setFormOpen(true);
  }

  function handleEdit(tx) {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTransaction(deleteTarget.id);
      toast('Transaction deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    setDeleteTarget(null);
  }

  async function handleBillPaid(bill) {
    try {
      await markBillPaid(bill.id);
      toast(`${bill.name} marked as paid ✓`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const d = dashboard;

  return (
    <div className="pb-24 min-h-screen">
      <TopBar title="Expenses App" />

      <div className="max-w-2xl mx-auto px-4 space-y-4 pt-2">
        {/* Total Balance Hero */}
        <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
          <p className="text-brand-100 text-sm font-medium mb-1">Total Balance</p>
          <p className="text-4xl font-extrabold tracking-tight mb-4">
            {loading ? '—' : formatCurrency(d?.totalBalance ?? 0)}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-brand-100 text-xs mb-0.5">🏦 Bank</p>
              <p className="font-bold">{loading ? '—' : formatCurrency(d?.bankBalance ?? 0)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-brand-100 text-xs mb-0.5">💵 Cash</p>
              <p className="font-bold">{loading ? '—' : formatCurrency(d?.cashBalance ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Today's Flow */}
        <div className="card p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Today</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Income</p>
              <p className="font-bold text-income">{formatCurrency(d?.today?.income ?? 0)}</p>
            </div>
            <div className="text-center border-x border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Spent</p>
              <p className="font-bold text-expense">{formatCurrency(d?.today?.expense ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Net</p>
              <p className={`font-bold ${(d?.today?.net ?? 0) >= 0 ? 'text-income' : 'text-expense'}`}>
                {(d?.today?.net ?? 0) >= 0 ? '+' : ''}{formatCurrency(d?.today?.net ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="card p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">This Month</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={14} className="text-income" />
                <p className="text-xs text-gray-400">Income</p>
              </div>
              <p className="font-bold text-income">{formatCurrency(d?.month?.income ?? 0)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={14} className="text-expense" />
                <p className="text-xs text-gray-400">Expenses</p>
              </div>
              <p className="font-bold text-expense">{formatCurrency(d?.month?.expense ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Remaining</p>
              <p className={`font-bold ${(d?.month?.remaining ?? 0) >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(d?.month?.remaining ?? 0)}
              </p>
            </div>
          </div>

          {/* Budget progress */}
          {d?.budgetOverview?.budget > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Budget {formatCurrency(d.budgetOverview.budget)}</span>
                <span className={d.budgetOverview.percent > 100 ? 'text-expense font-semibold' : ''}>
                  {d.budgetOverview.percent}% used
                </span>
              </div>
              <ProgressBar value={d.budgetOverview.spent} max={d.budgetOverview.budget} />
            </div>
          )}
        </div>

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide">Upcoming Bills</h2>
              <button onClick={() => router.push('/recurring')} className="text-brand-600 text-xs font-semibold flex items-center">
                See all <ChevronRight size={14} />
              </button>
            </div>
            <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {upcomingBills.slice(0, 3).map((bill) => (
                <div key={bill.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="text-xl">{bill.category_icon || '📋'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{bill.name}</p>
                    <p className={`text-xs ${bill.is_overdue ? 'text-expense font-semibold' : 'text-gray-400'}`}>
                      {bill.is_overdue ? '⚠️ Overdue — ' : ''}Due {bill.next_due_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm">{formatCurrency(bill.amount)}</span>
                    <button
                      onClick={() => handleBillPaid(bill)}
                      className="text-xs bg-income text-white px-2.5 py-1.5 rounded-lg font-semibold active:scale-95 transition"
                    >
                      Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide">Recent</h2>
            <button onClick={() => router.push('/transactions')} className="text-brand-600 text-xs font-semibold flex items-center">
              See all <ChevronRight size={14} />
            </button>
          </div>
          <TransactionList
            transactions={recentTransactions}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            emptyMessage="No transactions yet — tap + to add one"
          />
        </div>
      </div>

      <FAB
        onIncome={() => openForm('income')}
        onExpense={() => openForm('expense')}
        onBillPaid={() => router.push('/recurring')}
      />

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingTx ? 'Edit Transaction' : `Add ${formType.charAt(0).toUpperCase() + formType.slice(1)}`}
      >
        <TransactionForm
          key={editingTx?.id || formType}
          initialType={formType}
          editingTransaction={editingTx}
          onDone={() => {
            setFormOpen(false);
            fetchDashboard();
            fetchRecentTransactions();
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transaction"
        message={`Are you sure you want to delete this ${deleteTarget?.type}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
