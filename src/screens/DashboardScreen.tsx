import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  FileText,
  PackageCheck,
  Receipt,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NavTab, Product, Sale } from '../types';
import { formatDisplayDate, formatQty, formatRs } from '../lib/format';
import { ProductThumb } from '../components/ProductThumb';

interface DashboardData {
  today: {
    date: string;
    total_sales: number;
    total_profit: number;
    total_bills: number;
    total_items_sold: number;
    cash_received: number;
    credit_sales: number;
    discounts: number;
    total_udhaar_created: number;
    total_outstanding_udhaar: number;
  };
  lowStockCount: number;
  lowStockProducts: Product[];
  totalProducts: number;
  trend: { date: string; sales: number; profit: number; bills: number }[];
  recentInvoices: Sale[];
}

interface DashboardScreenProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (tab: NavTab) => void;
  onViewInvoice: (saleId: number) => void;
}

export function DashboardScreen({ data, loading, onNavigate, onViewInvoice }: DashboardScreenProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
      </div>
    );
  }

  const { today, lowStockCount, lowStockProducts, totalProducts, trend, recentInvoices } = data;

  return (
    <div className="space-y-6">
      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Shop Counter Overview
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDisplayDate(today.date)} · {totalProducts} active products in inventory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-xs transition-colors whitespace-nowrap"
          >
            <Receipt className="w-4 h-4" />
            Open Billing Counter
          </button>
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Manage Stock
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Today&apos;s Sales</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatRs(today.total_sales)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {today.total_bills} bills · {formatQty(today.total_items_sold)} items sold
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Today&apos;s Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatRs(today.total_profit)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Cash Received: {formatRs(today.cash_received)}
          </div>
        </div>

        <div
          onClick={() => onNavigate('customers')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('customers')}
          className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Outstanding Udhaar</span>
            <Users className="w-4 h-4 text-navy-600 dark:text-slate-300" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatRs(today.total_outstanding_udhaar)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Today&apos;s Credit Bills: {formatRs(today.credit_sales)}
          </div>
        </div>

        <div
          onClick={() => onNavigate('products')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('products')}
          className={`cursor-pointer rounded-xl border p-5 transition-colors ${
            lowStockCount > 0
              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={lowStockCount > 0 ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
              Low Stock Alerts
            </span>
            <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              lowStockCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {lowStockCount} {lowStockCount === 1 ? 'Product' : 'Products'}
          </div>
          <div className={`mt-1.5 text-xs ${lowStockCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
            {lowStockCount > 0 ? 'Restock attention required' : 'All items above minimum level'}
          </div>
        </div>
      </div>

      {/* Main Chart + Low Stock Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
                7-Day Sales &amp; Profit Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily revenue vs gross profit in Pakistani Rupees (Rs.)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('today_sales')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Today&apos;s Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
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
                    name === 'sales' ? 'Sales' : 'Gross Profit',
                  ]}
                  labelFormatter={(label: unknown) => formatDisplayDate(String(label))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="sales" name="sales" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="profit" fill="#15803d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Warnings */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              Low Stock Warnings
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              View All
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <PackageCheck className="w-8 h-8 text-emerald-600 mb-2" />
              All products are stocked above minimum level.
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProductThumb name={p.name} imageData={p.image_data} category={p.category} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-rose-900 dark:text-rose-200 truncate">{p.name}</div>
                      <div className="text-xs text-rose-700 dark:text-rose-400 tabular-nums">
                        Stock: {formatQty(p.current_stock, p.unit)} · Min: {formatQty(p.min_stock, p.unit)}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                    LOW STOCK
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              Recent Counter Bills
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('previous_sales')}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Search Previous Sales
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-semibold">Invoice #</th>
                <th className="px-5 py-3 font-semibold">Date &amp; Time</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold text-right">Total</th>
                <th className="px-5 py-3 font-semibold text-right">Profit</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                    No bills saved yet. Open Billing Counter to create your first invoice.
                  </td>
                </tr>
              ) : (
                recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {inv.invoice_number}
                      {inv.is_demo === 1 && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-amber-700 dark:text-amber-400">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {formatDisplayDate(inv.sale_date)} · {inv.sale_time}
                    </td>
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-200">{inv.customer_name}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{inv.payment_method}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatRs(inv.grand_total)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRs(inv.gross_profit)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(inv.id)}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        View / Print
                      </button>
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
