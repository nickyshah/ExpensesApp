# Expenses App — Personal Budget Tracker

A self-hosted, mobile-first PWA for tracking personal finances in AUD.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Dashboard** | Total balance, bank vs cash, today's net flow, monthly summary |
| **Accounts** | Bank, Cash, Savings, Credit Card — with opening balances |
| **Transactions** | Income / Expense / Transfer with full history, search & filters |
| **Swipe gestures** | Swipe left on any transaction to Edit or Delete |
| **Categories** | 20 expense + 8 income defaults, fully customisable |
| **Recurring Bills** | Weekly → Yearly, one-tap "Mark as Paid", overdue alerts |
| **Budgets** | Monthly per-category budgets with progress bars (green/yellow/red) |
| **Reports** | Pie chart, balance line, income vs expense bar, monthly stats |
| **PWA** | Installable on iOS/Android, works fully offline |
| **Dark mode** | System, light, or dark — saved to settings |
| **PIN lock** | Optional 4–8 digit PIN to protect on app open |
| **Export** | CSV export, full JSON export, raw SQLite backup |
| **Import** | CSV import with auto-creation of missing accounts/categories |

---

## 🚀 Quick Start (Local)

### Prerequisites
- **Node.js 20 or later**
- npm 8+

### 1. Clone & Install

```bash
git clone <your-repo-url> expenses-app
cd expenses-app
npm install
```

### 2. Run in Development

```bash
npm run dev
# → App + API at http://localhost:3001
```

Open **http://localhost:3001** in your browser. On mobile, access it via your local IP (e.g. `http://192.168.1.x:3001`) and tap "Add to Home Screen" to install as a PWA.

### 3. Run in Production

```bash
npm run build
npm start
# → Everything at http://localhost:3001
```

---

## 🌐 Production Deployment

Run the app with `npm run build && npm start`, then put a reverse proxy in front (nginx example):

```nginx
server {
    listen 80;
    server_name budget.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Add SSL with Certbot: `sudo certbot --nginx -d budget.yourdomain.com`

---

## 📱 Install as PWA (Mobile)

### iOS (Safari):
1. Open the app URL in Safari
2. Tap the **Share** button → **Add to Home Screen**
3. Tap **Add** — it appears on your home screen like a native app

### Android (Chrome):
1. Open the app URL in Chrome
2. Tap the **⋮ menu** → **Add to Home Screen**
3. Or look for the **install banner** at the bottom of the screen

---

## 📊 CSV Import Format

To bulk-import transactions (e.g. from bank exports), create a CSV with these columns:

| Column | Required | Values |
|---|---|---|
| `type` | ✅ | `income`, `expense`, `transfer` |
| `date` | ✅ | `YYYY-MM-DD` |
| `amount` | ✅ | Positive number (e.g. `42.50`) |
| `account` | ✅ | Account name (auto-created if missing) |
| `to_account` | Only for transfers | Account name |
| `category` | Recommended | Category name (auto-created if missing) |
| `source` | Income only | `Salary`, `Bank Transfer`, `Cash Deposit`, `Refund`, `Other` |
| `payment_method` | Expense only | `bank`, `cash`, `card` |
| `notes` | Optional | Free text |
| `tags` | Optional | Pipe-separated, e.g. `food\|weekly` |

Example:
```csv
type,date,amount,account,category,payment_method,notes,tags
expense,2026-06-01,85.40,Bank,Groceries,card,Woolworths weekly shop,food|weekly
expense,2026-06-02,4.50,Cash,Coffee,cash,Morning flat white,coffee
income,2026-06-14,3500,Bank,Salary,,June salary,
```

---

## 🗄️ Database

Expenses App uses a single SQLite file (`server/data/expenses-app.db`). No database server needed.

- **Location:** `server/data/expenses-app.db` (or path set by `DATA_DIR`)
- **Backup:** Download directly from Settings → Download Database Backup
- **Migrate to new server:** Copy the `.db` file to the new server's data directory

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port the server listens on |
| `DATA_DIR` | `./server/data` | Directory for the SQLite database |
| `NODE_ENV` | `development` | Set to `production` when deploying |

---

## 📁 Project Structure

```
expenses-app/
├── prisma/              # Prisma schema (SQLite)
│   └── schema.prisma
├── server/              # Express API
│   ├── src/
│   │   ├── db/             # Prisma client + seed
│   │   ├── routes/         # REST API routes
│   │   ├── services/       # Balance, recurring, CSV logic
│   │   └── utils/          # Date helpers, validation
│   └── data/            # SQLite database (gitignored)
│
├── src/                 # Next.js App Router frontend
│   ├── app/                # Routes (/, /transactions, /budgets, etc.)
│   ├── components/         # UI, charts, forms, pages
│   ├── state/              # Zustand store
│   ├── api/                # Fetch wrapper + offline queue
│   └── lib/                # AUD formatter, offline DB
│
├── server.mjs           # Custom server (Next.js + Express API)
├── public/              # Static assets, PWA manifest
└── README.md
```

---

## 🛡️ Security Notes

- Expenses App is designed for **single-user, self-hosted** use on your own network or VPS
- The optional PIN lock protects access in the browser/PWA — it's not a substitute for network-level security
- If exposing to the internet, **always use HTTPS** (Certbot/Cloudflare)
- All data stays on your server — nothing is sent to any third party

---

## 🙏 Built With

- **Backend:** Node.js + Express + Prisma + SQLite
- **Frontend:** Next.js 15 + React 18 + Tailwind CSS + Zustand + Recharts
- **Icons:** Lucide React
