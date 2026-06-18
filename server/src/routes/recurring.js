import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireFields, ValidationError, isValidDate, isValidAmount } from '../utils/validators.js';
import { getUpcomingBills, markBillPaid } from '../services/recurringService.js';

const router = express.Router();
const VALID_FREQ = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

const billInclude = {
  category: { select: { name: true, icon: true, color: true } },
  account: { select: { name: true, icon: true } },
};

function formatBill(b) {
  return {
    ...b,
    category_name: b.category?.name,
    category_icon: b.category?.icon,
    category_color: b.category?.color,
    account_name: b.account?.name,
    account_icon: b.account?.icon,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { active, upcoming } = req.query;

  if (upcoming) {
    return res.json(await getUpcomingBills(Number(upcoming) || 14));
  }

  const where = {};
  if (active !== undefined) where.is_active = Number(active);

  const bills = await prisma.recurringBill.findMany({
    where,
    include: billInclude,
    orderBy: { next_due_date: 'asc' },
  });
  res.json(bills.map(formatBill));
}));

router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'amount', 'frequency', 'next_due_date', 'account_id', 'category_id']);
  const { name, amount, frequency, next_due_date, account_id, category_id, payment_method, notes } = req.body;

  if (!isValidAmount(amount)) throw new ValidationError('amount must be a positive number');
  if (!VALID_FREQ.includes(frequency)) throw new ValidationError(`frequency must be one of: ${VALID_FREQ.join(', ')}`);
  if (!isValidDate(next_due_date)) throw new ValidationError('next_due_date must be YYYY-MM-DD');

  const account = await prisma.account.findUnique({ where: { id: account_id } });
  if (!account) throw new ValidationError('account_id does not reference a valid account');

  const cat = await prisma.category.findUnique({ where: { id: category_id } });
  if (!cat || cat.type !== 'expense') throw new ValidationError('category_id must reference a valid expense category');

  const bill = await prisma.recurringBill.create({
    data: {
      name,
      amount: Number(amount),
      frequency,
      next_due_date,
      account_id,
      category_id,
      payment_method: payment_method || 'bank',
      notes: notes || null,
    },
  });
  res.status(201).json(bill);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return res.status(404).json({ error: 'Recurring bill not found' });

  const { name, amount, frequency, next_due_date, account_id, category_id, payment_method, notes, is_active } = req.body;

  if (amount !== undefined && !isValidAmount(amount)) throw new ValidationError('amount must be a positive number');
  if (frequency !== undefined && !VALID_FREQ.includes(frequency)) throw new ValidationError(`frequency must be one of: ${VALID_FREQ.join(', ')}`);
  if (next_due_date !== undefined && !isValidDate(next_due_date)) throw new ValidationError('next_due_date must be YYYY-MM-DD');

  const updated = await prisma.recurringBill.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(amount != null && { amount: Number(amount) }),
      ...(frequency !== undefined && { frequency }),
      ...(next_due_date !== undefined && { next_due_date }),
      ...(account_id !== undefined && { account_id }),
      ...(category_id !== undefined && { category_id }),
      ...(payment_method !== undefined && { payment_method }),
      ...(notes !== undefined && { notes }),
      ...(is_active != null && { is_active: Number(is_active) }),
    },
  });
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return res.status(404).json({ error: 'Recurring bill not found' });
  await prisma.recurringBill.delete({ where: { id } });
  res.json({ success: true });
}));

router.post('/:id/pay', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return res.status(404).json({ error: 'Recurring bill not found' });

  const { date, account_id, amount, notes } = req.body || {};
  if (date && !isValidDate(date)) throw new ValidationError('date must be YYYY-MM-DD');
  if (amount != null && !isValidAmount(amount)) throw new ValidationError('amount must be a positive number');

  const result = await markBillPaid(bill.id, { date, accountId: account_id, amount, notes });
  res.json(result);
}));

export default router;
