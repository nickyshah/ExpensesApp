'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { formatCurrency, formatDateShort } from '../../lib/currency.js';

const ACTION_WIDTH = 140; // px, two buttons of 70px each

/**
 * A single transaction row supporting left-swipe to reveal Edit/Delete.
 */
export default function TransactionItem({ transaction, onEdit, onDelete, showDate = false }) {
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef(null);
  const currentTranslate = useRef(0);
  const dragging = useRef(false);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  }

  function onTouchMove(e) {
    if (!dragging.current) return;
    const delta = e.touches[0].clientX - startX.current;
    let next = currentTranslate.current + delta;
    next = Math.max(-ACTION_WIDTH, Math.min(0, next));
    setTranslateX(next);
  }

  function onTouchEnd() {
    dragging.current = false;
    // snap open or closed
    const next = translateX < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
    setTranslateX(next);
    currentTranslate.current = next;
  }

  function closeSwipe() {
    setTranslateX(0);
    currentTranslate.current = 0;
  }

  const { type, amount, category_name, category_icon, account_name, to_account_name, notes, date, payment_method, tags } = transaction;

  const isIncome = type === 'income';
  const isTransfer = type === 'transfer';
  const isExpense = type === 'expense';

  const amountColor = isIncome ? 'text-income' : isTransfer ? 'text-gray-500 dark:text-gray-400' : 'text-expense';
  const sign = isIncome ? '+' : isTransfer ? '' : '-';
  const icon = isTransfer ? '🔁' : (category_icon || '💰');
  const title = isTransfer ? `${account_name} → ${to_account_name}` : (category_name || (isIncome ? 'Income' : 'Expense'));

  return (
    <div className="swipe-container rounded-xl">
      {/* Action buttons revealed on swipe */}
      <div className="swipe-actions" style={{ width: ACTION_WIDTH }}>
        <button
          onClick={() => { onEdit(transaction); closeSwipe(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-600 text-white text-xs font-semibold"
        >
          <Pencil size={18} />
          Edit
        </button>
        <button
          onClick={() => { onDelete(transaction); closeSwipe(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-expense text-white text-xs font-semibold"
        >
          <Trash2 size={18} />
          Delete
        </button>
      </div>

      {/* Foreground content */}
      <div
        className="swipe-content bg-white dark:bg-gray-900 flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => translateX !== 0 ? closeSwipe() : onEdit(transaction)}
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
          <p className="text-xs text-gray-400 truncate">
            {showDate && `${formatDateShort(date)} · `}
            {isExpense && payment_method && `${payment_method.charAt(0).toUpperCase() + payment_method.slice(1)}`}
            {!isExpense && !isTransfer && account_name}
            {notes ? ` · ${notes}` : ''}
          </p>
          {tags?.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {tags.map((t) => (
                <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">#{t.name}</span>
              ))}
            </div>
          )}
        </div>
        <div className={`font-bold text-sm shrink-0 ${amountColor}`}>
          {sign}{formatCurrency(amount)}
        </div>
      </div>
    </div>
  );
}
