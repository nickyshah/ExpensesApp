import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { getSetting, setSetting } from './lib/settings.js';
import { formatTransaction, setTags, transactionInclude } from './lib/transactions.js';
import { getAllAccountBalances, getAccountBalance, getTotalBalance } from './services/balanceService.js';
import { exportTransactionsCSV, importTransactionsCSV } from './services/csvService.js';
import { getUpcomingBills, markBillPaid } from './services/recurringService.js';
import { requireFields, ValidationError, isValidDate, isValidAmount, isValidMonth } from './utils/validators.js';
import { currentMonth, startOfMonth, endOfMonth, todayISO, addDays } from './utils/dateUtils.js';
import { createSessionToken, verifySessionToken, COOKIE_NAME } from './session.js';

const VALID_TX_TYPES = ['income', 'expense', 'transfer'];
const VALID_PAYMENT_METHODS = ['bank', 'cash', 'card'];
const VALID_SOURCES = ['Salary', 'Bank Transfer', 'Cash Deposit', 'Refund', 'Other'];
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

function validateTransactionBody(body, { partial = false } = {}) {
  const { type } = body;
  if (!partial || body.type !== undefined) {
    if (!VALID_TX_TYPES.includes(type)) throw new ValidationError('type must be income, expense, or transfer');
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
  if (effectiveType === 'transfer' && body.to_account_id !== undefined && Number(body.to_account_id) === Number(body.account_id)) {
    throw new ValidationError('to_account_id must differ from account_id for transfers');
  }
}

function buildTransactionWhere(query) {
  const {
    search, type, category_id, payment_method, account_id,
    date_from, date_to, amount_min, amount_max, tag,
  } = query;

  const where = { AND: [] };
  const insensitive = { mode: 'insensitive' };

  if (search) {
    where.AND.push({
      OR: [
        { notes: { contains: search, ...insensitive } },
        { category: { name: { contains: search, ...insensitive } } },
        { account: { name: { contains: search, ...insensitive } } },
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

function deltaForTotal(t) {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0;
}

export const routes = [
  { method: 'GET', pattern: /^\/health$/, handler: health },
  { method: 'GET', pattern: /^\/auth\/status$/, handler: authStatus },
  { method: 'POST', pattern: /^\/auth\/login$/, handler: authLogin },
  { method: 'POST', pattern: /^\/auth\/logout$/, handler: authLogout },
  { method: 'GET', pattern: /^\/settings\/public$/, handler: settingsPublic },
  { method: 'GET', pattern: /^\/settings$/, handler: settingsGet },
  { method: 'PUT', pattern: /^\/settings$/, handler: settingsPut },
  { method: 'POST', pattern: /^\/settings\/pin$/, handler: settingsPinSet },
  { method: 'DELETE', pattern: /^\/settings\/pin$/, handler: settingsPinDelete },
  { method: 'GET', pattern: /^\/accounts$/, handler: accountsList },
  { method: 'GET', pattern: /^\/accounts\/(\d+)$/, handler: accountsGet, params: ['id'] },
  { method: 'POST', pattern: /^\/accounts$/, handler: accountsCreate },
  { method: 'PUT', pattern: /^\/accounts\/(\d+)$/, handler: accountsUpdate, params: ['id'] },
  { method: 'DELETE', pattern: /^\/accounts\/(\d+)$/, handler: accountsDelete, params: ['id'] },
  { method: 'GET', pattern: /^\/transactions\/recent$/, handler: transactionsRecent },
  { method: 'GET', pattern: /^\/transactions$/, handler: transactionsList },
  { method: 'GET', pattern: /^\/transactions\/(\d+)$/, handler: transactionsGet, params: ['id'] },
  { method: 'POST', pattern: /^\/transactions$/, handler: transactionsCreate },
  { method: 'PUT', pattern: /^\/transactions\/(\d+)$/, handler: transactionsUpdate, params: ['id'] },
  { method: 'DELETE', pattern: /^\/transactions\/(\d+)$/, handler: transactionsDelete, params: ['id'] },
  { method: 'GET', pattern: /^\/categories$/, handler: categoriesList },
  { method: 'POST', pattern: /^\/categories$/, handler: categoriesCreate },
  { method: 'PUT', pattern: /^\/categories\/(\d+)$/, handler: categoriesUpdate, params: ['id'] },
  { method: 'DELETE', pattern: /^\/categories\/(\d+)$/, handler: categoriesDelete, params: ['id'] },
  { method: 'GET', pattern: /^\/budgets$/, handler: budgetsList },
  { method: 'PUT', pattern: /^\/budgets$/, handler: budgetsPut },
  { method: 'POST', pattern: /^\/budgets\/copy-from-template$/, handler: budgetsCopyTemplate },
  { method: 'DELETE', pattern: /^\/budgets$/, handler: budgetsDelete },
  { method: 'GET', pattern: /^\/recurring$/, handler: recurringList },
  { method: 'POST', pattern: /^\/recurring$/, handler: recurringCreate },
  { method: 'PUT', pattern: /^\/recurring\/(\d+)$/, handler: recurringUpdate, params: ['id'] },
  { method: 'DELETE', pattern: /^\/recurring\/(\d+)$/, handler: recurringDelete, params: ['id'] },
  { method: 'POST', pattern: /^\/recurring\/(\d+)\/pay$/, handler: recurringPay, params: ['id'] },
  { method: 'GET', pattern: /^\/reports\/dashboard$/, handler: reportsDashboard },
  { method: 'GET', pattern: /^\/reports\/category-breakdown$/, handler: reportsCategoryBreakdown },
  { method: 'GET', pattern: /^\/reports\/balance-history$/, handler: reportsBalanceHistory },
  { method: 'GET', pattern: /^\/reports\/income-vs-expenses$/, handler: reportsIncomeVsExpenses },
  { method: 'GET', pattern: /^\/reports\/summary$/, handler: reportsSummary },
  { method: 'GET', pattern: /^\/tags$/, handler: tagsList },
  { method: 'GET', pattern: /^\/data\/export\/csv$/, handler: dataExportCsv },
  { method: 'POST', pattern: /^\/data\/import\/csv$/, handler: dataImportCsv },
  { method: 'GET', pattern: /^\/data\/export\/json$/, handler: dataExportJson },
];

async function health(ctx) {
  return ctx.jsonResponse({ status: 'ok', time: new Date().toISOString() });
}

async function authStatus(ctx) {
  const pinEnabled = (await getSetting('pin_enabled')) === '1';
  if (!pinEnabled) return ctx.jsonResponse({ pinEnabled: false, authenticated: true });
  const token = await ctx.cookie(COOKIE_NAME);
  const authenticated = !!(token && verifySessionToken(token));
  return ctx.jsonResponse({ pinEnabled: true, authenticated });
}

async function authLogin(ctx) {
  const body = await ctx.json();
  requireFields(body, ['pin']);
  const pinEnabled = (await getSetting('pin_enabled')) === '1';
  if (!pinEnabled) return ctx.jsonResponse({ success: true });
  const hash = await getSetting('pin_hash');
  if (!hash || !bcrypt.compareSync(String(body.pin), hash)) {
    throw new ValidationError('Incorrect PIN');
  }
  const token = createSessionToken();
  const res = ctx.jsonResponse({ success: true });
  return ctx.withSessionCookie(res, token);
}

async function authLogout(ctx) {
  return ctx.clearSessionCookie();
}

async function settingsPublic(ctx) {
  return ctx.jsonResponse({
    pinEnabled: (await getSetting('pin_enabled')) === '1',
    theme: (await getSetting('theme')) || 'system',
    currency: (await getSetting('currency')) || 'AUD',
    locale: (await getSetting('locale')) || 'en-AU',
  });
}

async function settingsGet(ctx) {
  return settingsPublic(ctx);
}

async function settingsPut(ctx) {
  const { theme, currency, locale } = await ctx.json();
  if (theme && !['light', 'dark', 'system'].includes(theme)) throw new ValidationError('invalid theme');
  if (theme) await setSetting('theme', theme);
  if (currency) await setSetting('currency', currency);
  if (locale) await setSetting('locale', locale);
  return ctx.jsonResponse({ success: true });
}

async function settingsPinSet(ctx) {
  const { pin } = await ctx.json();
  requireFields({ pin }, ['pin']);
  if (!/^\d{4,8}$/.test(pin)) throw new ValidationError('PIN must be 4-8 digits');
  const hash = bcrypt.hashSync(pin, 10);
  await setSetting('pin_hash', hash);
  await setSetting('pin_enabled', '1');
  return ctx.jsonResponse({ success: true });
}

async function settingsPinDelete(ctx) {
  const { pin } = await ctx.json();
  requireFields({ pin }, ['pin']);
  const hash = await getSetting('pin_hash');
  if (!hash || !bcrypt.compareSync(pin, hash)) throw new ValidationError('Incorrect PIN');
  await setSetting('pin_enabled', '0');
  await setSetting('pin_hash', '');
  return ctx.clearSessionCookie({ success: true });
}

async function accountsList(ctx) {
  const accounts = await getAllAccountBalances();
  const total = await getTotalBalance();
  return ctx.jsonResponse({ accounts, total });
}

async function accountsGet(ctx) {
  const id = Number(ctx.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return ctx.jsonResponse({ error: 'Account not found' }, 404);
  const balance = await getAccountBalance(account.id);
  return ctx.jsonResponse({ ...account, balance });
}

async function accountsCreate(ctx) {
  const { name, type, icon, opening_balance } = await ctx.json();
  requireFields({ name }, ['name']);
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
  return ctx.jsonResponse({ ...account, balance }, 201);
}

async function accountsUpdate(ctx) {
  const id = Number(ctx.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return ctx.jsonResponse({ error: 'Account not found' }, 404);
  const { name, icon, opening_balance, is_archived, sort_order } = await ctx.json();
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
  return ctx.jsonResponse({ ...updated, balance });
}

async function accountsDelete(ctx) {
  const id = Number(ctx.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return ctx.jsonResponse({ error: 'Account not found' }, 404);
  const [inUse, usedByRecurring] = await Promise.all([
    prisma.transaction.count({ where: { OR: [{ account_id: id }, { to_account_id: id }] } }),
    prisma.recurringBill.count({ where: { account_id: id } }),
  ]);
  if (inUse > 0 || usedByRecurring > 0) {
    throw new ValidationError('Cannot delete an account with existing transactions or recurring bills. Archive it instead.');
  }
  await prisma.account.delete({ where: { id } });
  return ctx.jsonResponse({ success: true });
}

async function transactionsList(ctx) {
  const { limit = 50, offset = 0, sort = 'desc', ...filters } = ctx.query;
  const where = buildTransactionWhere(filters);
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
  return ctx.jsonResponse({
    transactions: rows.map(formatTransaction),
    total,
    limit: Number(limit),
    offset: Number(offset),
  });
}

async function transactionsRecent(ctx) {
  const limit = Number(ctx.query.limit) || 7;
  const rows = await prisma.transaction.findMany({
    include: transactionInclude,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return ctx.jsonResponse(rows.map(formatTransaction));
}

async function transactionsGet(ctx) {
  const row = await prisma.transaction.findUnique({
    where: { id: Number(ctx.params.id) },
    include: {
      account: { select: { name: true } },
      to_account: { select: { name: true } },
      category: { select: { name: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });
  if (!row) return ctx.jsonResponse({ error: 'Transaction not found' }, 404);
  return ctx.jsonResponse(formatTransaction(row));
}

async function transactionsCreate(ctx) {
  const body = await ctx.json();
  validateTransactionBody(body);
  const {
    type, amount, date, account_id, to_account_id, category_id,
    source, payment_method, notes, tags,
  } = body;

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
  const row = await prisma.transaction.findUnique({ where: { id: created.id }, include: transactionInclude });
  return ctx.jsonResponse(formatTransaction(row), 201);
}

async function transactionsUpdate(ctx) {
  const id = Number(ctx.params.id);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return ctx.jsonResponse({ error: 'Transaction not found' }, 404);

  const body = await ctx.json();
  validateTransactionBody({ ...body, _existingType: existing.type }, { partial: true });

  const type = body.type ?? existing.type;
  const account_id = body.account_id ?? existing.account_id;
  const to_account_id = body.to_account_id !== undefined ? body.to_account_id : existing.to_account_id;
  const category_id = body.category_id !== undefined ? body.category_id : existing.category_id;
  const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;
  const date = body.date ?? existing.date;
  const source = body.source !== undefined ? body.source : existing.source;
  const payment_method = body.payment_method !== undefined ? body.payment_method : existing.payment_method;
  const notes = body.notes !== undefined ? body.notes : existing.notes;

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
    },
  });

  if (Array.isArray(body.tags)) await setTags(id, body.tags);
  const row = await prisma.transaction.findUnique({ where: { id }, include: transactionInclude });
  return ctx.jsonResponse(formatTransaction(row));
}

async function transactionsDelete(ctx) {
  const id = Number(ctx.params.id);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return ctx.jsonResponse({ error: 'Transaction not found' }, 404);
  await prisma.transaction.delete({ where: { id } });
  return ctx.jsonResponse({ success: true });
}

async function categoriesList(ctx) {
  const { type, includeArchived } = ctx.query;
  const where = {};
  if (type) where.type = type;
  if (!includeArchived) where.is_archived = 0;
  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  });
  return ctx.jsonResponse(categories);
}

async function categoriesCreate(ctx) {
  const { name, type, icon, color } = await ctx.json();
  requireFields({ name, type }, ['name', 'type']);
  if (!['income', 'expense'].includes(type)) throw new ValidationError('type must be income or expense');
  const maxOrder = await prisma.category.aggregate({ where: { type }, _max: { sort_order: true } });
  try {
    const cat = await prisma.category.create({
      data: {
        name,
        type,
        icon: icon || '🏷️',
        color: color || '#808080',
        is_default: 0,
        sort_order: (maxOrder._max.sort_order ?? -1) + 1,
      },
    });
    return ctx.jsonResponse(cat, 201);
  } catch (e) {
    if (e.code === 'P2002') throw new ValidationError('A category with that name and type already exists');
    throw e;
  }
}

async function categoriesUpdate(ctx) {
  const id = Number(ctx.params.id);
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return ctx.jsonResponse({ error: 'Category not found' }, 404);
  const { name, icon, color, is_archived, sort_order } = await ctx.json();
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(is_archived != null && { is_archived: Number(is_archived) }),
      ...(sort_order != null && { sort_order: Number(sort_order) }),
    },
  });
  return ctx.jsonResponse(updated);
}

async function categoriesDelete(ctx) {
  const id = Number(ctx.params.id);
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return ctx.jsonResponse({ error: 'Category not found' }, 404);
  if (cat.is_default) throw new ValidationError('Cannot delete a default category. Archive it instead.');
  const [txCount, recurringCount, budgetCount] = await Promise.all([
    prisma.transaction.count({ where: { category_id: id } }),
    prisma.recurringBill.count({ where: { category_id: id } }),
    prisma.budget.count({ where: { category_id: id } }),
  ]);
  if (txCount + recurringCount + budgetCount > 0) {
    throw new ValidationError('Cannot delete a category that is in use. Archive it instead.');
  }
  await prisma.category.delete({ where: { id } });
  return ctx.jsonResponse({ success: true });
}

async function budgetsList(ctx) {
  const month = ctx.query.month && isValidMonth(ctx.query.month) ? ctx.query.month : currentMonth();
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
  return ctx.jsonResponse({ month, budgets: result, totals });
}

async function budgetsPut(ctx) {
  const { category_id, month, amount } = await ctx.json();
  requireFields({ category_id, month, amount }, ['category_id', 'month', 'amount']);
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
  return ctx.jsonResponse(budget);
}

async function budgetsCopyTemplate(ctx) {
  const body = await ctx.json().catch(() => ({}));
  const month = body.month && isValidMonth(body.month) ? body.month : currentMonth();
  const templates = await prisma.budgetTemplate.findMany();
  await prisma.$transaction(async (tx) => {
    for (const t of templates) {
      const existing = await tx.budget.findUnique({
        where: { category_id_month: { category_id: t.category_id, month } },
      });
      if (!existing) {
        await tx.budget.create({ data: { category_id: t.category_id, month, amount: t.amount } });
      }
    }
  });
  return ctx.jsonResponse({ success: true, month, applied: templates.length });
}

async function budgetsDelete(ctx) {
  const { category_id, month } = ctx.query;
  requireFields({ category_id, month }, ['category_id', 'month']);
  await prisma.budget.delete({
    where: { category_id_month: { category_id: Number(category_id), month } },
  });
  return ctx.jsonResponse({ success: true });
}

async function recurringList(ctx) {
  const { active, upcoming } = ctx.query;
  if (upcoming) {
    return ctx.jsonResponse(await getUpcomingBills(Number(upcoming) || 14));
  }
  const where = {};
  if (active !== undefined) where.is_active = Number(active);
  const bills = await prisma.recurringBill.findMany({
    where,
    include: billInclude,
    orderBy: { next_due_date: 'asc' },
  });
  return ctx.jsonResponse(bills.map(formatBill));
}

async function recurringCreate(ctx) {
  const body = await ctx.json();
  requireFields(body, ['name', 'amount', 'frequency', 'next_due_date', 'account_id', 'category_id']);
  const { name, amount, frequency, next_due_date, account_id, category_id, payment_method, notes } = body;
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
  return ctx.jsonResponse(bill, 201);
}

async function recurringUpdate(ctx) {
  const id = Number(ctx.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return ctx.jsonResponse({ error: 'Recurring bill not found' }, 404);
  const body = await ctx.json();
  const { name, amount, frequency, next_due_date, account_id, category_id, payment_method, notes, is_active } = body;
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
  return ctx.jsonResponse(updated);
}

async function recurringDelete(ctx) {
  const id = Number(ctx.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return ctx.jsonResponse({ error: 'Recurring bill not found' }, 404);
  await prisma.recurringBill.delete({ where: { id } });
  return ctx.jsonResponse({ success: true });
}

async function recurringPay(ctx) {
  const id = Number(ctx.params.id);
  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill) return ctx.jsonResponse({ error: 'Recurring bill not found' }, 404);
  const body = await ctx.json().catch(() => ({}));
  const { date, account_id, amount, notes } = body;
  if (date && !isValidDate(date)) throw new ValidationError('date must be YYYY-MM-DD');
  if (amount != null && !isValidAmount(amount)) throw new ValidationError('amount must be a positive number');
  const result = await markBillPaid(bill.id, { date, accountId: account_id, amount, notes });
  return ctx.jsonResponse(result);
}

async function reportsDashboard(ctx) {
  const today = todayISO();
  const month = currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const accounts = await getAllAccountBalances();
  const total = await getTotalBalance();
  const bankBalance = accounts.filter((a) => a.type === 'bank' || a.type === 'savings').reduce((s, a) => s + a.balance, 0);
  const cashBalance = accounts.filter((a) => a.type === 'cash').reduce((s, a) => s + a.balance, 0);
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
  return ctx.jsonResponse({
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
}

async function reportsCategoryBreakdown(ctx) {
  const month = ctx.query.month && isValidMonth(ctx.query.month) ? ctx.query.month : currentMonth();
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const type = ctx.query.type === 'income' ? 'income' : 'expense';
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
  return ctx.jsonResponse({
    month, type, total: grandTotal,
    categories: rows.map((r) => ({
      ...r,
      percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
    })),
  });
}

async function reportsBalanceHistory(ctx) {
  const days = Math.min(Number(ctx.query.days) || 90, 730);
  const accounts = await prisma.account.findMany({ where: { is_archived: 0 } });
  const openingTotal = accounts.reduce((s, a) => s + a.opening_balance, 0);
  const allTxns = await prisma.transaction.findMany({
    select: { date: true, type: true, amount: true, account_id: true, to_account_id: true },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  const startISO = addDays(todayISO(), -(days - 1));
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
    cursor = addDays(cursor, 1);
  }
  return ctx.jsonResponse({ days, history });
}

async function reportsIncomeVsExpenses(ctx) {
  const months = Math.min(Number(ctx.query.months) || 12, 36);
  const rows = await prisma.$queryRaw`
    SELECT LEFT(date, 7) AS month,
           SUM(CASE WHEN type='income' THEN amount ELSE 0 END)::float AS income,
           SUM(CASE WHEN type='expense' THEN amount ELSE 0 END)::float AS expense
    FROM transactions
    WHERE type IN ('income','expense')
    GROUP BY month
    ORDER BY month DESC
    LIMIT ${months}
  `;
  return ctx.jsonResponse({ data: rows.reverse() });
}

async function reportsSummary(ctx) {
  const month = ctx.query.month && isValidMonth(ctx.query.month) ? ctx.query.month : currentMonth();
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
  return ctx.jsonResponse({
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
}

async function tagsList(ctx) {
  const { search } = ctx.query;
  const tags = await prisma.tag.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: search ? 20 : undefined,
  });
  return ctx.jsonResponse(tags);
}

async function dataExportCsv(ctx) {
  const csv = await exportTransactionsCSV();
  const filename = `expenses-app-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return ctx.textResponse(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}

async function dataImportCsv(ctx) {
  const form = await ctx.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return ctx.jsonResponse({ error: 'No file uploaded' }, 400);
  }
  const text = await file.text();
  const result = await importTransactionsCSV(text);
  return ctx.jsonResponse(result);
}

async function dataExportJson(ctx) {
  const [accounts, categories, tags, transaction_tags, transactions, recurring_bills, budgets, budget_templates] = await Promise.all([
    prisma.account.findMany(),
    prisma.category.findMany(),
    prisma.tag.findMany(),
    prisma.transactionTag.findMany(),
    prisma.transaction.findMany(),
    prisma.recurringBill.findMany(),
    prisma.budget.findMany(),
    prisma.budgetTemplate.findMany(),
  ]);
  const data = {
    accounts,
    categories,
    tags,
    transaction_tags,
    transactions,
    recurring_bills,
    budgets,
    budget_templates,
    exported_at: new Date().toISOString(),
  };
  const filename = `expenses-app-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
