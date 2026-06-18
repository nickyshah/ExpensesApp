'use client';

import { create } from 'zustand';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export const useToastStore = create((set, get) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 3000);
  },
}));

export function toast(message, type = 'info') {
  useToastStore.getState().show(message, type);
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};
const COLORS = {
  success: 'bg-income text-white',
  error: 'bg-expense text-white',
  info: 'bg-gray-800 text-white dark:bg-gray-700',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none safe-top">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`${COLORS[t.type]} rounded-xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-medium max-w-sm animate-in slide-in-from-top fade-in`}
          >
            <Icon size={18} className="shrink-0" />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
