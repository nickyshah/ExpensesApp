import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireFields, ValidationError, isValidDate, isValidAmount } from '../utils/validators.js';
import { formatTransaction, setTags, transactionInclude } from '../lib/transactions.js';

const router = express.Router();

const VALID_TYPES = ['income', 'expense', 'transfer'];
const VALID_PAYMENT_METHODS = ['bank', 'cash', 'card'];
const VALID_SOURCES = ['Salary', 'Bank Transfer', 'Cash Deposit', 'Refund', 'Other'];

function validateTransactionBody(body, { partial = false } = {}) {
  const { type } = body;

  if (!partial || body.type !== undefined) {
    if (!VALID_TYPES.includes(type)) throw new ValidationError('type must be income, expense, or transfer');
  }

  if (!partial) requireFields(body, ['type', 'amount', 'date', 'account_id']);

  if (body.amount !== undefined && !isValidAmount(body.amount)) {
    throw new ValidationError('amount must be a positive number');
  }
  if (body.date !== undefined && !isValidDate(body.date)) {
    throw new ValidationError('date must be in YYYY-MM-DD format');
  }
  if (body.payment_method !== undefined && body.payment_method !== null && !VALID_PAYMENT_METHODS.includes(body.payment_method)) {
    throw new ValidationError('payment_method must be bank, cash, or card');
  }
  if (body.source !== undefined && body.source !== null && body.source !== '' && !VALID_SOURCES.includes(body.source)) {
    throw new ValidationError(`source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  const effectiveType = type || body._existingType;
  if (effectiveType === 'transfer') {
    if (body.to_account_id !== undefined && Number(body.to_account_id) === Number(body.account_id)) {
      throw new ValidationError('to_account_id must differ from account_id for transfers');
    }
  }
}

function buildWhere(query) {
  const {
    search, type, category_id, payment_method, account_id,
    date_from, date_to, amount_min, amount_max, tag,
  } = query;

  const where = { AND: [] };

  if (search) {
    where.AND.push({
      OR: [
        { notes: { contains: search } },
        { category: { name: { contains: search } } },
        { account: { name: { contains: search } } },
      ],
    });
  }
  if (type) where.AND.push({ type });
  if (category_id) where.AND.push({ category_id: Number(category_id) });
  if (payment_method) where.AND.push({ payment_method });
  if (account_id) {
    const id = Number(account_id);
    where.AND.push({ OR: [{ account_id: id }, { to_account_id: id }] });
  }
  if (date_from) where.AND.push({ date: { gte: date_from } });
  if (date_to) where.AND.push({ date: { lte: date_to } });
  if (amount_min) where.AND.push({ amount: { gte: Number(amount_min) } });
  if (amount_max) where.AND.push({ amount: { lte: Number(amount_max) } });
  if (tag) where.AND.push({ tags: { some: { tag: { name: tag } } } });

  return where.AND.length ? where : {};
}

router.get('/', asyncHandler(async (req, res) => {
  const {
    limit = 50, offset = 0, sort = 'desc',
  } = req.query;

  const where = buildWhere(req.query);
  const dir = sort === 'asc' ? 'asc' : 'desc';

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ date: dir }, { id: dir }],
      take: Number(limit),
      skip: Number(offset),
    }),
  ]);

  res.json({
    transactions: rows.map(formatTransaction),
    total,
    limit: Number(limit),
    offset: Number(offset),
  });
}));

router.get('/recent', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 7;
  const rows = await prisma.transaction.findMany({
    include: transactionInclude,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  res.json(rows.map(formatTransaction));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.transaction.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      account: { select: { name: true } },
      to_account: { select: { name: true } },
      category: { select: { name: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });
  if (!row) return res.status(404).json({ error: 'Transaction not found' });
  res.json(formatTransaction(row));
}));

router.post('/', asyncHandler(async (req, res) => {
  validateTransactionBody(req.body);
  const {
    type, amount, date, account_id, to_account_id, category_id,
    source, payment_method, notes, tags,
  } = req.body;

  const account = await prisma.account.findUnique({ where: { id: account_id } });
  if (!account) throw new ValidationError('account_id does not reference a valid account');

  if (type === 'transfer') {
    if (!to_account_id) throw new ValidationError('to_account_id is required for transfers');
    const toAccount = await prisma.account.findUnique({ where: { id: to_account_id } });
    if (!toAccount) throw new ValidationError('to_account_id does not reference a valid account');
  }

  if (category_id) {
    const cat = await prisma.category.findUnique({ where: { id: category_id } });
    if (!cat) throw new ValidationError('category_id does not reference a valid category');
    if (type !== 'transfer' && cat.type !== type) {
      throw new ValidationError(`category type "${cat.type}" does not match transaction type "${type}"`);
    }
  }

  const created = await prisma.transaction.create({
    data: {
      type,
      amount: Number(amount),
      date,
      account_id,
      to_account_id: type === 'transfer' ? to_account_id : null,
      category_id: type !== 'transfer' ? (category_id || null) : null,
      source: type === 'income' ? (source || null) : null,
      payment_method: type === 'expense' ? (payment_method || null) : null,
      notes: notes || null,
    },
  });

  if (Array.isArray(tags)) await setTags(created.id, tags);

  const row = await prisma.transaction.findUnique({
    where: { id: created.id },
    include: transactionInclude,
  });
  res.status(201).json(formatTransaction(row));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  validateTransactionBody({ ...req.body, _existingType: existing.type }, { partial: true });

  const type = req.body.type ?? existing.type;
  const account_id = req.body.account_id ?? existing.account_id;
  const to_account_id = req.body.to_account_id !== undefined ? req.body.to_account_id : existing.to_account_id;
  const category_id = req.body.category_id !== undefined ? req.body.category_id : existing.category_id;
  const amount = req.body.amount !== undefined ? Number(req.body.amount) : existing.amount;
  const date = req.body.date ?? existing.date;
  const source = req.body.source !== undefined ? req.body.source : existing.source;
  const payment_method = req.body.payment_method !== undefined ? req.body.payment_method : existing.payment_method;
  const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;

  const account = await prisma.account.findUnique({ where: { id: account_id } });
  if (!account) throw new ValidationError('account_id does not reference a valid account');

  if (type === 'transfer') {
    if (!to_account_id) throw new ValidationError('to_account_id is required for transfers');
    if (Number(to_account_id) === Number(account_id)) throw new ValidationError('to_account_id must differ from account_id');
    const toAccount = await prisma.account.findUnique({ where: { id: to_account_id } });
    if (!toAccount) throw new ValidationError('to_account_id does not reference a valid account');
  }

  if (category_id && type !== 'transfer') {
    const cat = await prisma.category.findUnique({ where: { id: category_id } });
    if (!cat) throw new ValidationError('category_id does not reference a valid category');
    if (cat.type !== type) throw new ValidationError(`category type "${cat.type}" does not match transaction type "${type}"`);
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type,
      amount,
      date,
      account_id,
      to_account_id: type === 'transfer' ? to_account_id : null,
      category_id: type !== 'transfer' ? (category_id || null) : null,
      source: type === 'income' ? (source || null) : null,
      payment_method: type === 'expense' ? (payment_method || null) : null,
      notes: notes || null,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    },
  });

  if (Array.isArray(req.body.tags)) await setTags(id, req.body.tags);

  const row = await prisma.transaction.findUnique({
    where: { id },
    include: transactionInclude,
  });
  res.json(formatTransaction(row));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });
  await prisma.transaction.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
