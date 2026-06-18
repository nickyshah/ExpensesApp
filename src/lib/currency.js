const formatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatterNoCents = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a number as AUD currency, e.g. $1,234.56 */
export function formatCurrency(amount, { showCents = true } = {}) {
  const value = Number(amount) || 0;
  return showCents ? formatter.format(value) : formatterNoCents.format(value);
}

/** Format with explicit sign for income (+) / expense (-) */
export function formatSignedCurrency(amount, type) {
  const value = Math.abs(Number(amount) || 0);
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  return `${sign}${formatCurrency(value)}`;
}

/** Format a date string (YYYY-MM-DD) as e.g. "15 Jun 2026" */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a date string as e.g. "15 Jun" (no year) */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/** Returns today's date as YYYY-MM-DD */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns current month as YYYY-MM */
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human-friendly group label for transaction lists: Today, Yesterday, This Month, Month Year */
export function groupLabelForDate(dateStr) {
  const today = todayISO();
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');

  const diffDays = Math.round((t - d) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  if (d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth()) {
    return 'Earlier This Month';
  }

  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
