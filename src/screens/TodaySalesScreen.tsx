import { useEffect, useState } from 'react';
import { Download, Eye, Printer, RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailySalesSummary, Sale, ShopSettings } from '../types';
import { formatDisplayDate, formatQty, formatRs, getLocalDateStr } from '../lib/format';
import { api } from '../lib/api';
import { downloadInvoicePdf } from '../lib/pdf';

interface TodaySalesScreenProps {
  settings: ShopSettings;
  onViewInvoice: (saleId: number) => void;
  refreshTrigger: number;
}

export function TodaySalesScreen({ settings, onViewInvoice, refreshTrigger }: TodaySalesScreenProps) {
  const todayStr = getLocalDateStr();
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [hourly, setHourly] = useState<{ hour: string; sales: number; profit: number; bills: number }[]>([]);
  const [invoices, setInvoices] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const loadToday = async () => {
    setLoading(true);
    try {
      const [rep, salesList] = await Promise.all([
        api.getDailyReport(todayStr, true),
        api.getSales({ date: todayStr, includeDemo: true }),
      ]);
      setSummary(rep.summary);
      setHourly(rep.hourly);
      setInvoices(salesList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
  }, [todayStr, refreshTrigger]);

  const metrics = summary
    ? [
        { label: "Today's Total Sales", value: formatRs(summary.total_sales), accent: 'text-slate-900 dark:text-slate-100' },
        { label: "Today's Total Profit", value: formatRs(summary.total_profit), accent: 'text-emerald-700 dark:text-emerald-400' },
        { label: 'Total Bills', value: String(summary.total_bills), accent: 'text-slate-900 dark:text-slate-100' },
        { label: 'Total Items Sold', value: formatQty(summary.total_items_sold), accent: 'text-slate-900 dark:text-slate-100' },
        { label: 'Cash Received', value: formatRs(summary.cash_received), accent: 'text-emerald-700 dark:text-emerald-400' },
        { label: 'Credit Sales (Udhaar + Partial)', value: formatRs(summary.credit_sales), accent: 'text-amber-700 dark:text-amber-400' },
        { label: 'Discounts Given', value: formatRs(summary.discounts), accent: 'text-rose-600 dark:text-rose-400' },
        { label: 'Total Outstanding Udhaar', value: formatRs(summary.total_outstanding_udhaar), accent: 'text-rose-700 dark:text-rose-400' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Today&apos;s Sales Dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live counter billing totals for {formatDisplayDate(todayStr)}
          </p>
        </div>

        <button
          type="button"
          onClick={loadToday}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 8-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</div>
            <div className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${m.accent}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Hourly Sales Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Today&apos;s Hourly Sales &amp; Profit
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Profit calculated using purchase price saved at the time of each sale
        </p>

        {hourly.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-500">
            No bills recorded yet today.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => `Rs.${v}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatRs(Number(value ?? 0)),
                    name === 'sales' ? 'Sales' : 'Profit',
                  ]}
                />
                <Area type="monotone" dataKey="sales" stroke="#0f172a" fill="#0f172a" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="#15803d" fill="#15803d" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Today's Invoices */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
            Today&apos;s Invoices ({invoices.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice #</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Paid</th>
                <th className="px-4 py-3 font-semibold text-right">Profit</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No invoices for today yet.
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
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.sale_time}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inv.payment_method}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatRs(inv.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatRs(inv.paid_amount)}</td>
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
                          View / <Printer className="w-3 h-3 inline" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const full = await api.getSaleById(inv.id);
                            downloadInvoicePdf(full, settings, 'a4');
                          }}
                          title="Download A4 PDF"
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
