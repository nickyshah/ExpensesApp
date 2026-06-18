import { prisma } from '../db/prisma.js';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { isValidDate, isValidAmount } from '../utils/validators.js';

const CSV_COLUMNS = [
  'id', 'type', 'date', 'amount', 'account', 'to_account', 'category',
  'source', 'payment_method', 'notes', 'tags',
];

export async function exportTransactionsCSV() {
  const rows = await prisma.transaction.findMany({
    include: {
      account: { select: { name: true } },
      to_account: { select: { name: true } },
      category: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  });

  const records = rows.map((r) => ({
    id: r.id,
    type: r.type,
    date: r.date,
    amount: r.amount,
    account: r.account?.name || '',
    to_account: r.to_account?.name || '',
    category: r.category?.name || '',
    source: r.source || '',
    payment_method: r.payment_method || '',
    notes: (r.notes || '').replace(/\n/g, ' '),
    tags: r.tags.map((t) => t.tag.name).join('|'),
  }));

  return stringify(records, { header: true, columns: CSV_COLUMNS });
}

export async function importTransactionsCSV(csvText) {
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  let imported = 0;
  let skipped = 0;
  const errors = [];

  async function resolveAccountId(name) {
    if (!name) return null;
    const existing = await prisma.account.findUnique({ where: { name } });
    if (existing) return existing.id;
    const created = await prisma.account.create({
      data: { name, type: 'other', opening_balance: 0, sort_order: 999 },
    });
    return created.id;
  }

  async function resolveCategoryId(name, type) {
    if (!name) return null;
    const existing = await prisma.category.findFirst({ where: { name, type } });
    if (existing) return existing.id;
    const created = await prisma.category.create({
      data: { name, type, icon: '🏷️', is_default: 0, sort_order: 999 },
    });
    return created.id;
  }

  await prisma.$transaction(async (tx) => {
    for (let idx = 0; idx < records.length; idx++) {
      const rec = records[idx];
      const rowNum = idx + 2;
      const type = (rec.type || '').toLowerCase().trim();

      if (!['income', 'expense', 'transfer'].includes(type)) {
        errors.push(`Row ${rowNum}: invalid type "${rec.type}"`);
        skipped++;
        continue;
      }
      if (!isValidDate(rec.date)) {
        errors.push(`Row ${rowNum}: invalid date "${rec.date}"`);
        skipped++;
        continue;
      }
      if (!isValidAmount(rec.amount)) {
        errors.push(`Row ${rowNum}: invalid amount "${rec.amount}"`);
        skipped++;
        continue;
      }

      const accountId = await resolveAccountId(rec.account);
      if (!accountId) {
        errors.push(`Row ${rowNum}: missing account`);
        skipped++;
        continue;
      }

      const toAccountId = type === 'transfer' ? await resolveAccountId(rec.to_account) : null;
      const categoryType = type === 'income' ? 'income' : 'expense';
      const categoryId = type !== 'transfer' ? await resolveCategoryId(rec.category, categoryType) : null;

      const txn = await tx.transaction.create({
        data: {
          type,
          amount: Number(rec.amount),
          date: rec.date,
          account_id: accountId,
          to_account_id: toAccountId,
          category_id: categoryId,
          source: rec.source || null,
          payment_method: rec.payment_method || null,
          notes: rec.notes || null,
        },
      });

      const tagNames = (rec.tags || '').split('|').map((t) => t.trim()).filter(Boolean);
      for (const name of tagNames) {
        const tag = await tx.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        await tx.transactionTag.create({
          data: { transaction_id: txn.id, tag_id: tag.id },
        });
      }

      imported++;
    }
  });

  return { imported, skipped, errors };
}
