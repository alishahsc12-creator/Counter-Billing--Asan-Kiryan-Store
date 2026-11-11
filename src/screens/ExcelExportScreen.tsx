import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { formatDisplayDate, formatRs, getLocalDateStr, getOffsetDateStr } from '../lib/format';
import { api } from '../lib/api';

export function ExcelExportScreen() {
  const [startDate, setStartDate] = useState<string>(() => getOffsetDateStr(-2));
  const [endDate, setEndDate] = useState<string>(() => getLocalDateStr());
  const [includeDemo, setIncludeDemo] = useState(true);
  const [preview, setPreview] = useState<{
    invoiceCount: number;
    lineItemCount: number;
    totalSales: number;
    totalProfit: number;
    sampleRows: Record<string, unknown>[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.getExportPreview(startDate, endDate, includeDemo);
      setPreview(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [startDate, endDate, includeDemo]);

  const exportUrl = `/api/export/excel?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&includeDemo=${includeDemo ? '1' : '0'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Excel Export (.xlsx)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Download a real multi-sheet Microsoft Excel (.xlsx) workbook with full invoice, product, cost, profit, and Udhaar columns
          </p>
        </div>

        <a
          href={exportUrl}
          download
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          <FileSpreadsheet className="w-5 h-5" />
          EXPORT TO EXCEL
        </a>
      </div>

      {/* Date Range Selector Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="excel-start" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <input
              id="excel-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="excel-end" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              End Date
            </label>
            <input
              id="excel-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const t = getLocalDateStr();
                setStartDate(t);
                setEndDate(t);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Today Only
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate(getOffsetDateStr(-2));
                setEndDate(getLocalDateStr());
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Last 3 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                setStartDate(firstDay);
                setEndDate(getLocalDateStr());
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              This Month
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 ml-auto cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600"
            />
            Include Demo Records
          </label>
        </div>

        {/* Summary Strip */}
        {preview && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
              <div className="text-[11px] text-slate-500">Invoices Matched</div>
              <div className="font-mono text-lg font-bold tabular-nums">{preview.invoiceCount}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
              <div className="text-[11px] text-slate-500">Sold Item Rows</div>
              <div className="font-mono text-lg font-bold tabular-nums">{preview.lineItemCount}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
              <div className="text-[11px] text-slate-500">Total Sales</div>
              <div className="font-mono text-lg font-bold tabular-nums">{formatRs(preview.totalSales)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
              <div className="text-[11px] text-slate-500">Gross Profit</div>
              <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatRs(preview.totalProfit)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Columns Preview Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
            Excel Export Preview ({formatDisplayDate(startDate)} to {formatDisplayDate(endDate)})
          </h3>
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Download .xlsx Workbook
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3.5 py-3 font-semibold">Invoice #</th>
                <th className="px-3.5 py-3 font-semibold">Date &amp; Time</th>
                <th className="px-3.5 py-3 font-semibold">Product</th>
                <th className="px-3.5 py-3 font-semibold text-right">Qty</th>
                <th className="px-3.5 py-3 font-semibold text-right">Purchase Price</th>
                <th className="px-3.5 py-3 font-semibold text-right">Selling Price</th>
                <th className="px-3.5 py-3 font-semibold text-right">Item Total</th>
                <th className="px-3.5 py-3 font-semibold text-right">Item Profit</th>
                <th className="px-3.5 py-3 font-semibold">Method</th>
                <th className="px-3.5 py-3 font-semibold">Customer</th>
                <th className="px-3.5 py-3 font-semibold text-right">Paid</th>
                <th className="px-3.5 py-3 font-semibold text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    Preparing preview...
                  </td>
                </tr>
              ) : !preview || preview.sampleRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    No sales records in selected date range.
                  </td>
                </tr>
              ) : (
                preview.sampleRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-2.5 font-mono font-semibold">{String(row.invoice_number)}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                      {String(row.sale_date)} {String(row.sale_time).slice(0, 5)}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium">{String(row.product_name)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      {String(row.quantity)} {String(row.unit)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      {formatRs(Number(row.purchase_price_at_sale))}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      {formatRs(Number(row.selling_price))}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {formatRs(Number(row.item_total))}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRs(Number(row.item_profit))}
                    </td>
                    <td className="px-3.5 py-2.5">{String(row.payment_method)}</td>
                    <td className="px-3.5 py-2.5">{String(row.customer_name)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      {formatRs(Number(row.paid_amount))}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatRs(Number(row.remaining_amount))}
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
