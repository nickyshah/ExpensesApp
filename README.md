# Expenses App — Personal Budget Tracker

A mobile-first PWA for tracking personal finances in AUD, deployable on **Vercel** with **PostgreSQL**.

---

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Total balance, bank vs cash, today's net flow, monthly summary |
| **Accounts** | Bank, Cash, Savings, Credit Card — with opening balances |
| **Transactions** | Income / Expense / Transfer with full history, search & filters |
| **Categories** | 20 expense + 8 income defaults, fully customisable |
| **Recurring Bills** | Weekly → Yearly, one-tap "Mark as Paid", overdue alerts |
| **Budgets** | Monthly per-category budgets with progress bars |
| **Reports** | Pie chart, balance line, income vs expense bar, monthly stats |
| **PWA** | Installable on iOS/Android, works offline (cached reads + write queue) |
| **PIN lock** | Optional 4–8 digit PIN |
| **Export** | CSV export, full JSON export |

---

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- PostgreSQL database ([Neon](https://neon.tech), Vercel Postgres, or local Postgres)

### 1. Install

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL and SESSION_SECRET
```

### 2. Set up the database

```bash
npm run db:migrate   # or: npm run db:push for prototyping
npm run db:seed      # optional — also runs automatically on first API request
```

### 3. Run

```bash
npm run dev
# → http://localhost:3001
```

---

## Deploy to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add a **Postgres** database (Vercel Storage or Neon from Marketplace).
3. Set environment variables:
   - `DATABASE_URL` — pooled Postgres connection string
   - `SESSION_SECRET` — long random string for PIN session cookies
4. Deploy. The build runs `prisma migrate deploy` then `next build`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | Signs PIN session cookies |
| `PORT` | No | Local dev port (default `3001`) |

---

## Project Structure

```
expenses-app/
├── prisma/
│   ├── schema.prisma       # PostgreSQL schema
│   ├── migrations/         # Database migrations
│   └── seed.js             # CLI seed entry
├── src/
│   ├── app/                # Next.js App Router + API routes
│   │   └── api/[[...path]] # Catch-all API handler
│   ├── components/         # UI
│   ├── lib/server/         # API logic, services, auth
│   └── state/              # Zustand store
├── public/                 # PWA manifest, icons
└── vercel.json
```

---

## Security Notes

- Designed for **single-user** use — one PIN protects the app in the browser
- Always use **HTTPS** in production (Vercel provides this automatically)
- All data stays in your Postgres database

---

## Built With

- **Frontend:** Next.js 15 + React 18 + Tailwind CSS + Zustand + Recharts
- **Backend:** Next.js Route Handlers + Prisma + PostgreSQL
- **Deploy:** Vercel
