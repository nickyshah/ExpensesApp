import { create } from 'zustand';
import { api, syncOutbox } from '../api/client.js';
import { getPendingCount } from '../lib/offlineDb.js';

export const useStore = create((set, get) => ({
  // -------------------- Global / App --------------------
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSync: 0,
  authChecked: false,
  authenticated: true,
  pinEnabled: false,
  theme: 'system',

  initApp: async () => {
    // Auth status
    try {
      const status = await api.get('/auth/status');
      set({ pinEnabled: status.pinEnabled, authenticated: status.authenticated, authChecked: true });
    } catch {
      set({ authChecked: true, authenticated: true });
    }

    // Theme
    try {
      const settings = await api.get('/settings/public');
      set({ theme: settings.theme || 'system' });
      get().applyTheme(settings.theme || 'system');
    } catch {
      get().applyTheme('system');
    }

    get().refreshPendingCount();

    window.addEventListener('online', () => {
      set({ isOnline: true });
      get().handleReconnect();
    });
    window.addEventListener('offline', () => set({ isOnline: false }));
  },

  applyTheme: (theme) => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
  },

  setTheme: async (theme) => {
    set({ theme });
    get().applyTheme(theme);
    await api.put('/settings', { theme });
  },

  refreshPendingCount: async () => {
    const count = await getPendingCount();
    set({ pendingSync: count });
  },

  handleReconnect: async () => {
    const result = await syncOutbox();
    get().refreshPendingCount();
    if (result.succeeded > 0) {
      // Refresh data after successful sync
      await Promise.all([
        get().fetchDashboard(),
        get().fetchAccounts(),
        get().fetchTransactions(),
      ]);
    }
    return result;
  },

  login: async (pin) => {
    await api.post('/auth/login', { pin });
    set({ authenticated: true });
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ authenticated: false });
  },

  // -------------------- Accounts --------------------
  accounts: [],
  totalBalance: 0,

  fetchAccounts: async () => {
    const data = await api.get('/accounts');
    set({ accounts: data.accounts || [], totalBalance: data.total || 0 });
    return data;
  },

  createAccount: async (payload) => {
    await api.post('/accounts', payload);
    await get().fetchAccounts();
  },

  updateAccount: async (id, payload) => {
    await api.put(`/accounts/${id}`, payload);
    await get().fetchAccounts();
  },

  deleteAccount: async (id) => {
    await api.delete(`/accounts/${id}`);
    await get().fetchAccounts();
  },

  // -------------------- Categories --------------------
  categories: [],

  fetchCategories: async () => {
    const data = await api.get('/categories');
    set({ categories: data || [] });
    return data;
  },

  createCategory: async (payload) => {
    const cat = await api.post('/categories', payload);
    await get().fetchCategories();
    return cat;
  },

  updateCategory: async (id, payload) => {
    await api.put(`/categories/${id}`, payload);
    await get().fetchCategories();
  },

  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}`);
    await get().fetchCategories();
  },

  // -------------------- Dashboard --------------------
  dashboard: null,

  fetchDashboard: async () => {
    const data = await api.get('/reports/dashboard');
    set({ dashboard: data });
    return data;
  },

  // -------------------- Transactions --------------------
  transactions: [],
  transactionsTotal: 0,
  recentTransactions: [],

  fetchTransactions: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    const data = await api.get(`/transactions${qs ? `?${qs}` : ''}`);
    set({ transactions: data.transactions || [], transactionsTotal: data.total || 0 });
    return data;
  },

  fetchRecentTransactions: async (limit = 7) => {
    const data = await api.get(`/transactions/recent?limit=${limit}`);
    set({ recentTransactions: data || [] });
    return data;
  },

  createTransaction: async (payload) => {
    const result = await api.post('/transactions', payload);
    await Promise.all([get().fetchDashboard(), get().fetchAccounts(), get().fetchRecentTransactions(), get().refreshPendingCount()]);
    return result;
  },

  updateTransaction: async (id, payload) => {
    const result = await api.put(`/transactions/${id}`, payload);
    await Promise.all([get().fetchDashboard(), get().fetchAccounts(), get().fetchRecentTransactions(), get().refreshPendingCount()]);
    return result;
  },

  deleteTransaction: async (id) => {
    await api.delete(`/transactions/${id}`);
    await Promise.all([get().fetchDashboard(), get().fetchAccounts(), get().fetchRecentTransactions(), get().refreshPendingCount()]);
  },

  // -------------------- Recurring Bills --------------------
  recurringBills: [],
  upcomingBills: [],

  fetchRecurringBills: async () => {
    const data = await api.get('/recurring');
    set({ recurringBills: data || [] });
    return data;
  },

  fetchUpcomingBills: async (withinDays = 14) => {
    const data = await api.get(`/recurring?upcoming=${withinDays}`);
    set({ upcomingBills: data || [] });
    return data;
  },

  createRecurringBill: async (payload) => {
    await api.post('/recurring', payload);
    await Promise.all([get().fetchRecurringBills(), get().fetchUpcomingBills()]);
  },

  updateRecurringBill: async (id, payload) => {
    await api.put(`/recurring/${id}`, payload);
    await Promise.all([get().fetchRecurringBills(), get().fetchUpcomingBills()]);
  },

  deleteRecurringBill: async (id) => {
    await api.delete(`/recurring/${id}`);
    await Promise.all([get().fetchRecurringBills(), get().fetchUpcomingBills()]);
  },

  markBillPaid: async (id, payload = {}) => {
    const result = await api.post(`/recurring/${id}/pay`, payload);
    await Promise.all([
      get().fetchRecurringBills(),
      get().fetchUpcomingBills(),
      get().fetchDashboard(),
      get().fetchAccounts(),
      get().fetchRecentTransactions(),
    ]);
    return result;
  },

  // -------------------- Budgets --------------------
  budgets: null,

  fetchBudgets: async (month) => {
    const data = await api.get(`/budgets${month ? `?month=${month}` : ''}`);
    set({ budgets: data });
    return data;
  },

  setBudget: async (category_id, month, amount) => {
    await api.put('/budgets', { category_id, month, amount });
    await get().fetchBudgets(month);
  },

  deleteBudget: async (category_id, month) => {
    await api.delete(`/budgets?category_id=${category_id}&month=${month}`);
    await get().fetchBudgets(month);
  },

  copyBudgetTemplate: async (month) => {
    await api.post('/budgets/copy-from-template', { month });
    await get().fetchBudgets(month);
  },

  // -------------------- Reports --------------------
  categoryBreakdown: null,
  balanceHistory: null,
  incomeVsExpenses: null,
  monthSummary: null,

  fetchCategoryBreakdown: async (month, type = 'expense') => {
    const data = await api.get(`/reports/category-breakdown?month=${month}&type=${type}`);
    set({ categoryBreakdown: data });
    return data;
  },

  fetchBalanceHistory: async (days = 90) => {
    const data = await api.get(`/reports/balance-history?days=${days}`);
    set({ balanceHistory: data });
    return data;
  },

  fetchIncomeVsExpenses: async (months = 12) => {
    const data = await api.get(`/reports/income-vs-expenses?months=${months}`);
    set({ incomeVsExpenses: data });
    return data;
  },

  fetchMonthSummary: async (month) => {
    const data = await api.get(`/reports/summary?month=${month}`);
    set({ monthSummary: data });
    return data;
  },
}));
