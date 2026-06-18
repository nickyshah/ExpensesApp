'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '@/state/store';
import TopBar from '@/components/layout/TopBar.jsx';
import FAB from '@/components/layout/FAB.jsx';
import TransactionList from '@/components/transactions/TransactionList.jsx';
import TransactionForm from '@/components/transactions/TransactionForm.jsx';
import FilterSheet from '@/components/transactions/FilterSheet.jsx';
import Sheet from '@/components/ui/Sheet.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { toast } from '@/components/ui/Toast.jsx';

const PAGE_SIZE = 30;

export default function Transactions() {
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const transactions = useStore((s) => s.transactions);
  const transactionsTotal = useStore((s) => s.transactionsTotal);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState('expense');
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const searchTimeout = useRef(null);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const load = useCallback(async (newOffset = 0, newSearch = search, newFilters = filters) => {
    setLoading(true);
    await fetchTransactions({ search: newSearch, ...newFilters, limit: PAGE_SIZE, offset: newOffset });
    setLoading(false);
  }, [search, filters]);

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => {
    setOffset(0);
    load(0, search, filters);
  }, [filters]);

  function handleSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      load(0, val, filters);
    }, 350);
  }

  function applyFilters(newFilters) {
    setFilters(newFilters);
  }

  function clearSearch() {
    setSearch('');
    setOffset(0);
    load(0, '', filters);
  }

  function handleEdit(tx) {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormOpen(true);
  }

  function openForm(type) {
    setEditingTx(null);
    setFormType(type);
    setFormOpen(true);
  }

  async function handleDelete() {
    try {
      await deleteTransaction(deleteTarget.id);
      toast('Transaction deleted', 'success');
      load(offset);
    } catch (err) {
      toast(err.message, 'error');
    }
    setDeleteTarget(null);
  }

  const hasMore = offset + PAGE_SIZE < transactionsTotal;

  return (
    <div className="pb-24 min-h-screen">
      <TopBar title="Transactions" />

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-3">
        {/* Search + Filter bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -trangray-y-1/2 text-gray-400" />
            <input
              type="search"
              inputMode="search"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input pl-9 pr-9"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -trangray-y-1/2 text-gray-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className={`relative p-3 rounded-xl font-semibold transition
              ${activeFilterCount > 0 ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-gray-400 px-1">
            {transactionsTotal} transaction{transactionsTotal !== 1 ? 's' : ''}
            {activeFilterCount > 0 || search ? ' (filtered)' : ''}
          </p>
        )}

        {/* Transaction list */}
        {loading && transactions.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card h-16 animate-pulse bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
        ) : (
          <TransactionList
            transactions={transactions}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            emptyMessage={search || activeFilterCount > 0 ? 'No transactions match your filters' : 'No transactions yet'}
          />
        )}

        {/* Load more */}
        {hasMore && (
          <button
            onClick={() => {
              const next = offset + PAGE_SIZE;
              setOffset(next);
              load(next);
            }}
            className="w-full btn-secondary"
            disabled={loading}
          >
            {loading ? 'Loading...' : `Load more (${transactionsTotal - offset - transactions.length} remaining)`}
          </button>
        )}
      </div>

      <FAB
        onIncome={() => openForm('income')}
        onExpense={() => openForm('expense')}
        onBillPaid={() => openForm('expense')}
      />

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={applyFilters}
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
            load(offset);
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transaction"
        message={`Delete this ${deleteTarget?.type} of ${deleteTarget ? ('$' + deleteTarget.amount) : ''}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
