import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isValidMonth } from '../utils/validators.js';
import { currentMonth, startOfMonth, endOfMonth, todayISO } from '../utils/dateUtils.js';
import { getAllAccountBalances, getTotalBalance } from '../services/balanceService.js';

const router = express.Router();

router.get('/dashboard', asyncHandler(async (req, res) => {
  const today = todayISO();
  const month = currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const accounts = await getAllAccountBalances();
  const total = await getTotalBalance();

  const bankBalance = accounts.filter((a) => a.type === 'bank' || a.type === 'savings')
    .reduce((s, a) => s + a.balance, 0);
  const cashBalance = accounts.filter((a) => a.type === 'cash')
    .reduce((s, a) => s + a.balance, 0);

  const [todayIncome, todayExpense, monthIncome, monthExpense, budgetTotal] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'income', date: today }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: today }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.budget.aggregate({ where: { month }, _sum: { amount: true } }),
  ]);

  const todayInc = todayIncome._sum.amount || 0;
  const todayExp = todayExpense._sum.amount || 0;
  const monthInc = monthIncome._sum.amount || 0;
  const monthExp = monthExpense._sum.amount || 0;
  const budget = budgetTotal._sum.amount || 0;

  res.json({
    totalBalance: total,
    bankBalance,
    cashBalance,
    accounts,
    today: { income: todayInc, expense: todayExp, net: todayInc - todayExp },
    month: { label: month, income: monthInc, expense: monthExp, remaining: monthInc - monthExp },
    budgetOverview: {
      budget,
      spent: monthExp,
      remaining: budget - monthExp,
      percent: budget > 0 ? Math.min(100, Math.round((monthExp / budget) * 100)) : null,
    },
  });
}));

router.get('/category-breakdown', asyncHandler(async (req, res) => {
  const month = req.query.month && isValidMonth(req.query.month) ? req.query.month : currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const type = req.query.type === 'income' ? 'income' : 'expense';

  const grouped = await prisma.transaction.groupBy({
    by: ['category_id'],
    where: { type, date: { gte: from, lte: to }, category_id: { not: null } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const filtered = grouped.filter((g) => (g._sum.amount || 0) > 0);
  const categoryIds = filtered.map((g) => g.category_id);
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const rows = filtered.map((g) => ({
    category_id: g.category_id,
    name: catMap.get(g.category_id)?.name,
    icon: catMap.get(g.category_id)?.icon,
    color: catMap.get(g.category_id)?.color,
    total: g._sum.amount || 0,
  }));

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  res.json({
    month, type, total: grandTotal,
    categories: rows.map((r) => ({
      ...r,
      percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
    })),
  });
}));

router.get('/balance-history', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 90, 730);

  const accounts = await prisma.account.findMany({ where: { is_archived: 0 } });
  const openingTotal = accounts.reduce((s, a) => s + a.opening_balance, 0);

  const allTxns = await prisma.transaction.findMany({
    select: { date: true, type: true, amount: true, account_id: true, to_account_id: true },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  const startISO = startDate.toISOString().slice(0, 10);
  const todayStr = todayISO();

  let runningBalance = openingTotal;
  let i = 0;
  while (i < allTxns.length && allTxns[i].date < startISO) {
    runningBalance += deltaForTotal(allTxns[i]);
    i++;
  }

  const history = [];
  let cursor = startISO;
  while (cursor <= todayStr) {
    while (i < allTxns.length && allTxns[i].date === cursor) {
      runningBalance += deltaForTotal(allTxns[i]);
      i++;
    }
    history.push({ date: cursor, balance: Math.round(runningBalance * 100) / 100 });
    cursor = addDaysStr(cursor, 1);
  }

  res.json({ days, history });
}));

function deltaForTotal(t) {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0;
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get('/income-vs-expenses', asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 12, 36);

  const rows = await prisma.$queryRaw`
    SELECT substr(date, 1, 7) AS month,
           SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    WHERE type IN ('income','expense')
    GROUP BY month
    ORDER BY month DESC
    LIMIT ${months}
  `;

  res.json({ data: rows.reverse() });
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const month = req.query.month && isValidMonth(req.query.month) ? req.query.month : currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: from, lte: to } }, _sum: { amount: true } }),
  ]);

  const income = incomeAgg._sum.amount || 0;
  const expense = expenseAgg._sum.amount || 0;

  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = todayISO();
  const isCurrentMonth = today.slice(0, 7) === month;
  const elapsedDays = isCurrentMonth ? Number(today.slice(8, 10)) : lastDay;

  const avgDailySpend = elapsedDays > 0 ? expense / elapsedDays : 0;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

  const grouped = await prisma.transaction.groupBy({
    by: ['category_id'],
    where: { type: 'expense', date: { gte: from, lte: to }, category_id: { not: null } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5,
  });

  const categoryIds = grouped.map((g) => g.category_id);
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const topCategories = grouped.map((g) => ({
    name: catMap.get(g.category_id)?.name,
    icon: catMap.get(g.category_id)?.icon,
    color: catMap.get(g.category_id)?.color,
    total: g._sum.amount || 0,
  }));

  res.json({
    month,
    income,
    expense,
    net: income - expense,
    avgDailySpend: Math.round(avgDailySpend * 100) / 100,
    savingsRate: Math.round(savingsRate * 10) / 10,
    daysInMonth: lastDay,
    elapsedDays,
    topCategories,
  });
}));

export default router;
