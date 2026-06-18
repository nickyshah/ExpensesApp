import { prisma } from '../prisma.js';
import { nextDueDate, todayISO, addDays, toISODate } from '../utils/dateUtils.js';

export async function markBillPaid(billId, { date, accountId, amount, notes } = {}) {
  const bill = await prisma.recurringBill.findUnique({ where: { id: billId } });
  if (!bill) throw new Error('Recurring bill not found');

  const paidDate = date || todayISO();
  const useAccount = accountId || bill.account_id;
  const useAmount = amount != null ? amount : bill.amount;

  const transaction = await prisma.transaction.create({
    data: {
      type: 'expense',
      amount: useAmount,
      date: paidDate,
      account_id: useAccount,
      category_id: bill.category_id,
      payment_method: bill.payment_method,
      notes: notes || `${bill.name} (recurring)`,
      recurring_id: bill.id,
    },
  });

  const newDueDate = nextDueDate(bill.next_due_date, bill.frequency);
  const updatedBill = await prisma.recurringBill.update({
    where: { id: bill.id },
    data: { next_due_date: newDueDate },
  });

  return { transaction, bill: updatedBill };
}

export async function getUpcomingBills(withinDays = 14) {
  const today = todayISO();
  const cutoff = addDays(today, withinDays);

  const bills = await prisma.recurringBill.findMany({
    where: { is_active: 1, next_due_date: { lte: cutoff } },
    include: {
      category: { select: { name: true, icon: true } },
      account: { select: { name: true } },
    },
    orderBy: { next_due_date: 'asc' },
  });

  return bills.map((b) => ({
    ...b,
    category_name: b.category?.name,
    category_icon: b.category?.icon,
    account_name: b.account?.name,
    is_overdue: b.next_due_date < today,
  }));
}
