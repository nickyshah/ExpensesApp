import './globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Expenses App - Budget Tracker',
  description: 'Personal budget tracker for Australia',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Expenses App',
  },
};

export const viewport = {
  themeColor: '#1a1a1a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
