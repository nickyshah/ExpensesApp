'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Simple confirm dialog for destructive actions (delete, etc).
 */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-5 animate-in fade-in zoom-in-95">
        <div className="flex items-start gap-3 mb-4">
          <div className={`shrink-0 rounded-full p-2 ${danger ? 'bg-expense-light text-expense' : 'bg-brand-100 text-brand-600'}`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base">{title}</h3>
            {message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
