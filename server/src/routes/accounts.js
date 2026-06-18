import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getAllAccountBalances, getAccountBalance, getTotalBalance } from '../services/balanceService.js';
import { requireFields, ValidationError } from '../utils/validators.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const accounts = await getAllAccountBalances();
  const total = await getTotalBalance();
  res.json({ accounts, total });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: Number(req.params.id) } });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const balance = await getAccountBalance(account.id);
  res.json({ ...account, balance });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, type, icon, opening_balance } = req.body;
  requireFields(req.body, ['name']);

  const validTypes = ['bank', 'cash', 'savings', 'credit_card', 'other'];
  const accType = validTypes.includes(type) ? type : 'other';

  const maxOrder = await prisma.account.aggregate({ _max: { sort_order: true } });

  const account = await prisma.account.create({
    data: {
      name,
      type: accType,
      icon: icon || '🏦',
      opening_balance: Number(opening_balance) || 0,
      sort_order: (maxOrder._max.sort_order ?? -1) + 1,
    },
  });

  const balance = await getAccountBalance(account.id);
  res.status(201).json({ ...account, balance });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { name, icon, opening_balance, is_archived, sort_order } = req.body;

  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(icon !== undefined && { icon }),
      ...(opening_balance != null && { opening_balance: Number(opening_balance) }),
      ...(is_archived != null && { is_archived: Number(is_archived) }),
      ...(sort_order != null && { sort_order: Number(sort_order) }),
    },
  });

  const balance = await getAccountBalance(updated.id);
  res.json({ ...updated, balance });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const [inUse, usedByRecurring] = await Promise.all([
    prisma.transaction.count({
      where: { OR: [{ account_id: id }, { to_account_id: id }] },
    }),
    prisma.recurringBill.count({ where: { account_id: id } }),
  ]);

  if (inUse > 0 || usedByRecurring > 0) {
    throw new ValidationError('Cannot delete an account with existing transactions or recurring bills. Archive it instead.');
  }

  await prisma.account.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
