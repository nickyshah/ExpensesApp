'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { useStore } from '@/state/store';
import { formatCurrency, currentMonth } from '@/lib/currency.js';
import TopBar from '@/components/layout/TopBar.jsx';
import CategoryPie from '@/components/charts/CategoryPie.jsx';
import BalanceLine from '@/components/charts/BalanceLine.jsx';
import IncomeExpenseBar from '@/components/charts/IncomeExpenseBar.jsx';

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

function StatCard({ icon: Icon, label, value, color = 'text-gray-800 dark:text-white', sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-gray-400" />
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
      <p className={`text-xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());
  const [pieType, setPieType] = useState('expense');
  const [balanceDays, setBalanceDays] = useState(90);

  const fetchCategoryBreakdown = useStore((s) => s.fetchCategoryBreakdown);
  const fetchBalanceHistory = useStore((s) => s.fetchBalanceHistory);
  const fetchIncomeVsExpenses = useStore((s) => s.fetchIncomeVsExpenses);
  const fetchMonthSummary = useStore((s) => s.fetchMonthSummary);

  const categoryBreakdown = useStore((s) => s.categoryBreakdown);
  const balanceHistory = useStore((s) => s.balanceHistory);
  const incomeVsExpenses = useStore((s) => s.incomeVsExpenses);
  const monthSummary = useStore((s) => s.monthSummary);

  const isCurrentMonth = month === currentMonth();

  useEffect(() => {
    fetchCategoryBreakdown(month, pieType);
    fetchMonthSummary(month);
  }, [month, pieType]);

  useEffect(() => {
    fetchBalanceHistory(balanceDays);
  }, [balanceDays]);

  useEffect(() => {
    fetchIncomeVsExpenses(12);
  }, []);

  const ms = monthSummary;

  return (
    <div className="pb-24 min-h-screen">
      <TopBar title="Reports" />

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-5">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-90 transition">
            <ChevronLeft size={22} />
          </button>
          <h2 className="font-bold text-lg">{monthLabel(month)}</h2>
          <button onClick={() => setMonth(nextMonth(month))} disabled={isCurrentMonth}
            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-90 transition disabled:opacity-30">
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Summary stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={TrendingUp} label="Income" value={formatCurrency(ms?.income ?? 0)} color="text-income" />
          <StatCard icon={TrendingDown} label="Expenses" value={formatCurrency(ms?.expense ?? 0)} color="text-expense" />
          <StatCard
            icon={DollarSign}
            label="Net Savings"
            value={formatCurrency(ms?.net ?? 0)}
            color={(ms?.net ?? 0) >= 0 ? 'text-income' : 'text-expense'}
            sub={ms?.savingsRate != null ? `${ms.savingsRate}% savings rate` : undefined}
          />
          <StatCard
            icon={Calendar}
            label="Daily Avg Spend"
            value={formatCurrency(ms?.avgDailySpend ?? 0)}
            sub={ms?.elapsedDays ? `over ${ms.elapsedDays} days` : undefined}
          />
        </div>

        {/* Top spending categories */}
        {ms?.topCategories?.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold mb-3">Top Expenses</h3>
            <div className="space-y-2">
              {ms.topCategories.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg">{c.icon}</span>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="font-bold text-expense text-sm">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Pie */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Spending Breakdown</h3>
            <div className="flex gap-1">
              {['expense', 'income'].map((t) => (
                <button key={t} onClick={() => setPieType(t)}
                  className={`chip text-xs ${pieType === t ? (t === 'income' ? 'bg-income text-white' : 'bg-expense text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <CategoryPie data={categoryBreakdown?.categories || []} />
        </div>

        {/* Balance History Line */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Balance History</h3>
            <div className="flex gap-1">
              {[30, 90, 180, 365].map((d) => (
                <button key={d} onClick={() => setBalanceDays(d)}
                  className={`chip text-xs ${balanceDays === d ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                  {d < 365 ? `${d}d` : '1y'}
                </button>
              ))}
            </div>
          </div>
          <BalanceLine history={balanceHistory?.history || []} />
        </div>

        {/* Income vs Expenses Bar */}
        <div className="card p-4">
          <h3 className="font-bold mb-3">Income vs Expenses</h3>
          <IncomeExpenseBar data={incomeVsExpenses?.data || []} />
        </div>
      </div>
    </div>
  );
}
