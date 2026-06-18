import { prisma } from '../db/prisma.js';

/**
 * Returns the current balance for a single account:
 * opening_balance + income - expense + transfers_in - transfers_out
 */
export async function getAccountBalance(accountId) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return null;

  const [income, expense, transfersOut, transfersIn] = await Promise.all([
    prisma.transaction.aggregate({
      where: { account_id: accountId, type: 'income' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { account_id: accountId, type: 'expense' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { account_id: accountId, type: 'transfer' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { to_account_id: accountId, type: 'transfer' },
      _sum: { amount: true },
    }),
  ]);

  return account.opening_balance
    + (income._sum.amount || 0)
    - (expense._sum.amount || 0)
    - (transfersOut._sum.amount || 0)
    + (transfersIn._sum.amount || 0);
}

export async function getAllAccountBalances() {
  const accounts = await prisma.account.findMany({
    where: { is_archived: 0 },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  });
  const balances = await Promise.all(accounts.map((a) => getAccountBalance(a.id)));
  return accounts.map((a, i) => ({ ...a, balance: balances[i] }));
}

export async function getTotalBalance() {
  const accounts = await getAllAccountBalances();
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}
