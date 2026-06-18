'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Sun, Moon, Monitor, Lock, Unlock, Download, Upload, Database, Plus, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/state/store';
import { api } from '@/api/client';
import Sheet from '@/components/ui/Sheet.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { toast } from '@/components/ui/Toast.jsx';

function PINSetup({ onDone }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pin.length < 4) { toast('PIN must be at least 4 digits', 'error'); return; }
    if (pin !== confirm) { toast('PINs do not match', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/settings/pin', { pin });
      toast('PIN set successfully', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <p className="text-sm text-gray-500">Set a PIN to lock the app when not in use. You'll need to enter it each time you open Expenses App.</p>
      <div>
        <label className="label">New PIN (4-8 digits)</label>
        <input type="password" inputMode="numeric" pattern="\d*" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} className="input text-2xl tracking-widest" placeholder="••••" autoFocus />
      </div>
      <div>
        <label className="label">Confirm PIN</label>
        <input type="password" inputMode="numeric" pattern="\d*" maxLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input text-2xl tracking-widest" placeholder="••••" />
      </div>
      <button type="submit" disabled={saving || !pin} className="btn-primary w-full disabled:opacity-60">{saving ? 'Setting PIN...' : 'Set PIN'}</button>
    </form>
  );
}

function DisablePIN({ onDone }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.delete('/settings/pin', { pin });
      toast('PIN removed', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <p className="text-sm text-gray-500">Enter your current PIN to disable lock screen protection.</p>
      <div>
        <label className="label">Current PIN</label>
        <input type="password" inputMode="numeric" pattern="\d*" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} className="input text-2xl tracking-widest" placeholder="••••" autoFocus />
      </div>
      <button type="submit" disabled={saving || !pin} className="btn-danger w-full disabled:opacity-60">{saving ? 'Disabling...' : 'Disable PIN'}</button>
    </form>
  );
}

function CategoryManager() {
  const categories = useStore((s) => s.categories);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const createCategory = useStore((s) => s.createCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);

  const [tab, setTab] = useState('expense');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const filtered = categories.filter((c) => c.type === tab && !c.is_archived);
  const archived = categories.filter((c) => c.type === tab && c.is_archived);

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) await updateCategory(editing.id, { name: name.trim(), icon });
      else await createCategory({ name: name.trim(), type: tab, icon });
      toast(editing ? 'Category updated' : 'Category created', 'success');
      setFormOpen(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await deleteCategory(deleteTarget.id);
      toast('Category deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['expense', 'income'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`chip flex-1 justify-center ${tab === t ? (t === 'income' ? 'bg-income text-white' : 'bg-expense text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <button onClick={() => { setEditing(null); setName(''); setIcon('🏷️'); setFormOpen(true); }} className="btn-secondary w-full text-sm">
        <Plus size={16} /> Add {tab} category
      </button>
      <div className="space-y-1">
        {filtered.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 card">
            <span className="text-xl">{c.icon}</span>
            <span className="flex-1 font-medium text-sm">{c.name}</span>
            {c.is_default && <span className="text-xs text-gray-400">default</span>}
            <button onClick={() => { setEditing(c); setName(c.name); setIcon(c.icon); setFormOpen(true); }} className="p-1.5 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
            {!c.is_default && <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-expense"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      {archived.length > 0 && <p className="text-xs text-gray-400">{archived.length} archived</p>}

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={handleSave} className="space-y-4 pb-4">
          <div>
            <label className="label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoFocus placeholder="Category name" />
          </div>
          <div>
            <label className="label">Icon</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="input w-20 text-2xl text-center" maxLength={2} />
          </div>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary w-full disabled:opacity-60">
            {saving ? 'Saving...' : editing ? 'Save' : 'Create'}
          </button>
        </form>
      </Sheet>

      <ConfirmDialog open={!!deleteTarget} title="Delete Category" message={`Delete "${deleteTarget?.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const pinEnabled = useStore((s) => s.pinEnabled);
  const initApp = useStore((s) => s.initApp);

  const [pinOpen, setPinOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  function SettingRow({ icon: Icon, label, sub, onClick, right, danger = false }) {
    return (
      <button onClick={onClick} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition rounded-xl ${danger ? 'text-expense' : ''}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? 'bg-expense-light' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <Icon size={18} className={danger ? 'text-expense' : 'text-gray-500'} />
        </div>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${danger ? 'text-expense' : ''}`}>{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </button>
    );
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/data/import/csv', formData);
      toast(`Imported ${result.imported} transactions${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`, 'success');
      initApp();
    } catch (err) { toast(err.message || 'Import failed', 'error'); }
    finally { setImporting(false); e.target.value = ''; }
  }

  function downloadURL(url) {
    const a = document.createElement('a');
    a.href = url; a.download = '';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  const THEMES = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="pb-24 min-h-screen">
      <div className="sticky top-0 z-30 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-md safe-top">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"><ArrowLeft size={22} /></button>
          <h1 className="text-2xl font-extrabold">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-5">
        {/* Theme */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Appearance</p>
          <div className="card overflow-hidden">
            <div className="p-4">
              <p className="font-semibold text-sm mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-medium transition
                      ${theme === value ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Security</p>
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            <SettingRow
              icon={pinEnabled ? Lock : Unlock}
              label={pinEnabled ? 'Change / Disable PIN' : 'Set up PIN lock'}
              sub={pinEnabled ? 'App is locked with a PIN' : 'Protect your financial data'}
              onClick={() => setPinOpen(true)}
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Categories</p>
          <div className="card overflow-hidden">
            <SettingRow icon={Plus} label="Manage Categories" sub="Add, edit, or remove categories" onClick={() => setCatOpen(true)} />
          </div>
        </div>

        {/* Data */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Data</p>
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            <SettingRow icon={Download} label="Export CSV" sub="Download all transactions as CSV" onClick={() => downloadURL('/api/data/export/csv')} />
            <SettingRow icon={Download} label="Full JSON Export" sub="All data including accounts, budgets, recurring" onClick={() => downloadURL('/api/data/export/json')} />
            <SettingRow icon={Database} label="Download Database Backup" sub="Raw SQLite .db file" onClick={() => downloadURL('/api/data/backup')} />
            <div className="relative">
              <SettingRow icon={Upload} label={importing ? 'Importing...' : 'Import CSV'} sub="Import transactions from CSV file" onClick={() => !importing && document.getElementById('csv-import').click()} />
              <input id="csv-import" type="file" accept=".csv,text/csv" className="sr-only" onChange={handleImport} />
            </div>
          </div>
        </div>

        {/* About */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">About</p>
          <div className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-brand-600 mb-1">Expenses App</p>
            <p className="text-sm text-gray-400">Personal budget tracker for Australia</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">v1.0.0 · Self-hosted · No data leaves your device</p>
          </div>
        </div>
      </div>

      {/* PIN Sheet */}
      <Sheet open={pinOpen} onClose={() => { setPinOpen(false); initApp(); }} title={pinEnabled ? 'Change PIN Lock' : 'Set PIN Lock'}>
        {pinEnabled
          ? <DisablePIN onDone={() => { setPinOpen(false); initApp(); }} />
          : <PINSetup onDone={() => { setPinOpen(false); initApp(); }} />}
      </Sheet>

      {/* Category Sheet */}
      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title="Manage Categories" fullHeight>
        <CategoryManager />
      </Sheet>
    </div>
  );
}
