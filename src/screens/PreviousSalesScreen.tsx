import { useEffect, useState } from 'react';
import { Calendar, Download, Eye, Printer, Search } from 'lucide-react';
import type { DailySalesSummary, Sale, ShopSettings } from '../types';
import { formatDisplayDate, formatQty, formatRs, getOffsetDateStr } from '../lib/format';
import { api } from '../lib/api';
import { downloadInvoicePdf } from '../lib/pdf';

interface PreviousSalesScreenProps {
  settings: ShopSettings;
  onViewInvoice: (saleId: number) => void;
}

export function PreviousSalesScreen({ settings, onViewInvoice }: PreviousSalesScreenProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => getOffsetDateStr(-1));
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'date' | 'search'>('date');
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [invoices, setInvoices] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const loadByDate = async (date: string) => {
    setLoading(true);
    try {
      const [rep, salesList] = await Promise.all([
        api.getDailyReport(date, true),
        api.getSales({ date, includeDemo: true }),
      ]);
      setSummary(rep.summary);
      setInvoices(salesList);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = invoiceQuery.trim();
    if (!q) {
      setFilterMode('date');
      loadByDate(selectedDate);
      return;
    }
    setFilterMode('search');
    setLoading(true);
    try {
      const results = await api.getSales({ invoice: q, limit: 100, includeDemo: true });
      setInvoices(results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filterMode === 'date') {
      loadByDate(selectedDate);
    }
  }, [selectedDate, filterMode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Previous Sales History
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Inspect any past date, verify daily profit, and reprint or download old invoices
          </p>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Today', offset: 0 },
            { label: 'Yesterday', offset: -1 },
            { label: '2 Days Ago', offset: -2 },
          ].map((preset) => {
            const d = getOffsetDateStr(preset.offset);
            const active = filterMode === 'date' && selectedDate === d;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setInvoiceQuery('');
                  setFilterMode('date');
                  setSelectedDate(d);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-emerald-700 border-emerald-700 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="prev-sales-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Select Any Past Date
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="prev-sales-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setInvoiceQuery('');
                setFilterMode('date');
                setSelectedDate(e.target.value);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <form onSubmit={handleInvoiceSearch} className="flex-1 min-w-[240px] flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              placeholder="Search by invoice number (e.g. AK-01005) or customer..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold whitespace-nowrap"
          >
            Find Invoice
          </button>
          {filterMode === 'search' && (
            <button
              type="button"
              onClick={() => {
                setInvoiceQuery('');
                setFilterMode('date');
                loadByDate(selectedDate);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Selected Date Summary Cards */}
      {filterMode === 'date' && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Total Sales</div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {formatRs(summary.total_sales)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Total Profit</div>
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {formatRs(summary.total_profit)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Total Invoices</div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {summary.total_bills}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Items Sold</div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {formatQty(summary.total_items_sold)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Cash Sales</div>
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {formatRs(summary.cash_received)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Credit Sales</div>
            <div className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
              {formatRs(summary.credit_sales)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <div className="text-[11px] text-slate-500">Discounts</div>
            <div className="font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
              {formatRs(summary.discounts)}
            </div>
          </div>
        </div>
      )}

      {/* Invoice List Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
            {filterMode === 'date'
              ? `Invoices for ${formatDisplayDate(selectedDate)} (${invoices.length})`
              : `Search Results for "${invoiceQuery}" (${invoices.length})`}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice #</th>
                <th className="px-4 py-3 font-semibold">Exact Date &amp; Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold text-right">Discount</th>
                <th className="px-4 py-3 font-semibold text-right">Grand Total</th>
                <th className="px-4 py-3 font-semibold text-right">Profit</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading historical invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No invoices found for the selected criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {inv.invoice_number}
                      {inv.is_demo === 1 && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-amber-700 dark:text-amber-400">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {formatDisplayDate(inv.sale_date)} · {inv.sale_time}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{inv.payment_method}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 tabular-nums">
                      {formatRs(inv.discount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatRs(inv.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRs(inv.gross_profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Open / <Printer className="w-3 h-3 inline" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const full = await api.getSaleById(inv.id);
                            downloadInvoicePdf(full, settings, 'a4');
                          }}
                          title="Download Invoice PDF"
                          className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
