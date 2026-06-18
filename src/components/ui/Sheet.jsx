'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Bottom sheet on mobile, centered modal on desktop.
 */
export default function Sheet({ open, onClose, title, children, fullHeight = false }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl
          ${fullHeight ? 'h-[92vh]' : 'max-h-[92vh]'} flex flex-col animate-in slide-in-from-bottom`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
}
