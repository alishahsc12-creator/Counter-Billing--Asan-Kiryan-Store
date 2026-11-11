import { useEffect, useState } from 'react';
import { CheckCircle2, Database, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { ShopSettings } from '../types';
import { api } from '../lib/api';

interface SettingsScreenProps {
  settings: ShopSettings;
  onUpdated: () => void;
}

export function SettingsScreen({ settings, onUpdated }: SettingsScreenProps) {
  const [shopName, setShopName] = useState(settings.shop_name);
  const [shopAddress, setShopAddress] = useState(settings.shop_address);
  const [shopPhone, setShopPhone] = useState(settings.shop_phone);
  const [invoiceFooter, setInvoiceFooter] = useState(settings.invoice_footer);
  const [expenseEnabled, setExpenseEnabled] = useState(settings.expense_management_enabled);
  const [saving, setSaving] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setShopName(settings.shop_name);
    setShopAddress(settings.shop_address);
    setShopPhone(settings.shop_phone);
    setInvoiceFooter(settings.invoice_footer);
    setExpenseEnabled(settings.expense_management_enabled);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await api.updateSettings({
        shop_name: shopName.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        invoice_footer: invoiceFooter.trim(),
        expense_management_enabled: expenseEnabled,
      });
      setFeedback('Shop settings saved successfully.');
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoBusy(true);
    setFeedback('');
    try {
      const res = await api.clearDemoData();
      setFeedback(res.message);
      onUpdated();
    } finally {
      setDemoBusy(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoBusy(true);
    setFeedback('');
    try {
      const res = await api.loadDemoData();
      setFeedback(res.message);
      onUpdated();
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
          Shop Settings &amp; Demo Data
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure receipt header/footer, expense management, and sample demonstration records
        </p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
          Store Profile (Printed on Thermal &amp; A4 Invoices)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Shop Name *
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Shop Phone
            </label>
            <input
              type="text"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Shop Address
            </label>
            <input
              type="text"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Receipt Footer Message
            </label>
            <input
              type="text"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 pt-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={expenseEnabled}
            onChange={(e) => setExpenseEnabled(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600"
          />
          Enable Shop Expense Management in Monthly Net Profit Reports
        </label>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Demo Data Management */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              3-Day Pakistani Kiryana Sample Data (DEMO DATA)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Demo records (20 Kiryana products, 8 customers, and 15 invoices across the last 3 days) are marked separately as DEMO DATA. Removing demo data never deletes or overwrites your real sales, products, or customer Udhaar records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {settings.demo_data_present ? (
            <button
              type="button"
              disabled={demoBusy}
              onClick={handleClearDemo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              {demoBusy ? 'Removing...' : 'Remove All Demo Data'}
            </button>
          ) : (
            <button
              type="button"
              disabled={demoBusy}
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              {demoBusy ? 'Loading...' : 'Load 3-Day Sample Demo Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
