'use client';

import Link from 'next/link';
import { WifiOff, CloudUpload, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '@/state/store';

export default function TopBar({ title, right = null }) {
  const isOnline = useStore((s) => s.isOnline);
  const pendingSync = useStore((s) => s.pendingSync);

  return (
    <header className="sticky top-0 z-30 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-md safe-top">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="chip bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <WifiOff size={14} /> Offline
            </span>
          )}
          {isOnline && pendingSync > 0 && (
            <span className="chip bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              <CloudUpload size={14} /> Syncing {pendingSync}
            </span>
          )}
          {right}
          <Link
            href="/settings"
            className="p-2 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 active:scale-90 transition"
            aria-label="Settings"
          >
            <SettingsIcon size={22} className="text-gray-500" />
          </Link>
        </div>
      </div>
    </header>
  );
}
