import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireFields, ValidationError, isValidMonth } from '../utils/validators.js';
import { currentMonth, startOfMonth, endOfMonth } from '../utils/dateUtils.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const month = req.query.month && isValidMonth(req.query.month) ? req.query.month : currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const categories = await prisma.category.findMany({
    where: { type: 'expense', is_archived: 0 },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  });

  const [budgetRows, spendRows] = await Promise.all([
    prisma.budget.findMany({ where: { month } }),
    prisma.transaction.groupBy({
      by: ['category_id'],
      where: { type: 'expense', date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  const budgetMap = new Map(budgetRows.map((b) => [b.category_id, b.amount]));
  const spendMap = new Map(spendRows.map((s) => [s.category_id, s._sum.amount || 0]));

  const result = categories
    .map((c) => ({
      category_id: c.id,
      category_name: c.name,
      category_icon: c.icon,
      category_color: c.color,
      budget: budgetMap.get(c.id) || 0,
      spent: spendMap.get(c.id) || 0,
    }))
    .filter((r) => r.budget > 0 || r.spent > 0);

  const totals = result.reduce((acc, r) => ({
    budget: acc.budget + r.budget,
    spent: acc.spent + r.spent,
  }), { budget: 0, spent: 0 });

  res.json({ month, budgets: result, totals });
}));

router.put('/', asyncHandler(async (req, res) => {
  const { category_id, month, amount } = req.body;
  requireFields(req.body, ['category_id', 'month', 'amount']);
  if (!isValidMonth(month)) throw new ValidationError('month must be YYYY-MM');
  if (Number(amount) < 0) throw new ValidationError('amount must be >= 0');

  const cat = await prisma.category.findUnique({ where: { id: category_id } });
  if (!cat || cat.type !== 'expense') throw new ValidationError('category_id must reference a valid expense category');

  const budget = await prisma.budget.upsert({
    where: { category_id_month: { category_id, month } },
    create: { category_id, month, amount: Number(amount) },
    update: { amount: Number(amount) },
  });

  await prisma.budgetTemplate.upsert({
    where: { category_id },
    create: { category_id, amount: Number(amount) },
    update: { amount: Number(amount) },
  });

  res.json(budget);
}));

router.post('/copy-from-template', asyncHandler(async (req, res) => {
  const month = req.body.month && isValidMonth(req.body.month) ? req.body.month : currentMonth();
  const templates = await prisma.budgetTemplate.findMany();

  await prisma.$transaction(async (tx) => {
    for (const t of templates) {
      const existing = await tx.budget.findUnique({
        where: { category_id_month: { category_id: t.category_id, month } },
      });
      if (!existing) {
        await tx.budget.create({
          data: { category_id: t.category_id, month, amount: t.amount },
        });
      }
    }
  });

  res.json({ success: true, month, applied: templates.length });
}));

router.delete('/', asyncHandler(async (req, res) => {
  const { category_id, month } = req.query;
  requireFields(req.query, ['category_id', 'month']);
  await prisma.budget.delete({
    where: { category_id_month: { category_id: Number(category_id), month } },
  });
  res.json({ success: true });
}));

export default router;
