import { prisma } from '../db/prisma.js';

export const transactionInclude = {
  account: { select: { name: true, icon: true } },
  to_account: { select: { name: true } },
  category: { select: { name: true, icon: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
};

export function formatTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    account_id: row.account_id,
    to_account_id: row.to_account_id,
    category_id: row.category_id,
    source: row.source,
    payment_method: row.payment_method,
    notes: row.notes,
    recurring_id: row.recurring_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account_name: row.account?.name ?? null,
    account_icon: row.account?.icon ?? null,
    to_account_name: row.to_account?.name ?? null,
    category_name: row.category?.name ?? null,
    category_icon: row.category?.icon ?? null,
    category_color: row.category?.color ?? null,
    tags: (row.tags || []).map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
  };
}

export async function getTagsFor(transactionId) {
  const rows = await prisma.transactionTag.findMany({
    where: { transaction_id: transactionId },
    include: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  });
  return rows.map((r) => ({ id: r.tag.id, name: r.tag.name }));
}

export async function setTags(transactionId, tagNames = []) {
  await prisma.transactionTag.deleteMany({ where: { transaction_id: transactionId } });

  const cleaned = [...new Set(tagNames.map((t) => String(t).trim()).filter(Boolean))];
  for (const name of cleaned) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await prisma.transactionTag.upsert({
      where: { transaction_id_tag_id: { transaction_id: transactionId, tag_id: tag.id } },
      create: { transaction_id: transactionId, tag_id: tag.id },
      update: {},
    });
  }
}
