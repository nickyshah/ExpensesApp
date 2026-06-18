'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/state/store';
import BottomNav from '@/components/layout/BottomNav';
import ToastContainer from '@/components/ui/Toast';
import LockScreen from '@/components/pages/Lock';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const initApp = useStore((s) => s.initApp);
  const authChecked = useStore((s) => s.authChecked);
  const authenticated = useStore((s) => s.authenticated);
  const pinEnabled = useStore((s) => s.pinEnabled);
  const fetchAccounts = useStore((s) => s.fetchAccounts);
  const fetchCategories = useStore((s) => s.fetchCategories);

  useEffect(() => {
    initApp();
  }, [initApp]);

  useEffect(() => {
    if (authenticated) {
      fetchAccounts();
      fetchCategories();
    }
  }, [authenticated, fetchAccounts, fetchCategories]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-white mb-2">Expenses App</p>
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (pinEnabled && !authenticated) {
    return (
      <>
        <ToastContainer />
        <LockScreen />
      </>
    );
  }

  const hideNav = pathname === '/settings';

  return (
    <>
      <ToastContainer />
      <main className="max-w-2xl mx-auto">{children}</main>
      {!hideNav && <BottomNav />}
    </>
  );
}
