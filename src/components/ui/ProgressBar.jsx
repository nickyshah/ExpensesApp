'use client';

/**
 * Budget progress: light gray under 75%, mid gray 75–100%, dark gray over budget.
 */
export default function ProgressBar({ value, max, className = '' }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const overBudget = max > 0 && value > max;

  let colorClass = 'bg-income';
  if (overBudget) colorClass = 'bg-expense';
  else if (percent >= 75) colorClass = 'bg-gray-500';

  return (
    <div className={`progress-track ${className}`}>
      <div className={`progress-bar ${colorClass}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function budgetColor(value, max) {
  if (max <= 0) return 'text-gray-400';
  const percent = (value / max) * 100;
  if (value > max) return 'text-expense';
  if (percent >= 75) return 'text-gray-500';
  return 'text-income';
}
