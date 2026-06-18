export function todayISO() {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  const targetMonth = d.getMonth() + months;
  const targetDate = new Date(d.getFullYear(), targetMonth, d.getDate());
  if (targetDate.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    targetDate.setDate(0);
  }
  return toISODate(targetDate);
}

export function nextDueDate(dateStr, frequency) {
  switch (frequency) {
    case 'weekly':
      return addDays(dateStr, 7);
    case 'fortnightly':
      return addDays(dateStr, 14);
    case 'monthly':
      return addMonths(dateStr, 1);
    case 'quarterly':
      return addMonths(dateStr, 3);
    case 'yearly':
      return addMonths(dateStr, 12);
    default:
      return addMonths(dateStr, 1);
  }
}

export function startOfMonth(monthStr) {
  return `${monthStr}-01`;
}

export function endOfMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(last).padStart(2, '0')}`;
}
