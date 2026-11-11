import { useState } from 'react';
import { CheckCircle2, Copy, Download, MessageCircle, Printer, X } from 'lucide-react';
import type { Sale, ShopSettings } from '../types';
import { formatDisplayDate, formatQty, formatRs } from '../lib/format';
import { buildWhatsAppReceiptText, downloadInvoicePdf, type ReceiptFormat } from '../lib/pdf';

interface InvoiceModalProps {
  sale: Sale | null;
  settings: ShopSettings;
  isConfirmation?: boolean;
  onClose: () => void;
}

export function InvoiceModal({ sale, settings, isConfirmation = false, onClose }: InvoiceModalProps) {
  const [format, setFormat] = useState<ReceiptFormat>('80mm');
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!sale) return null;

  const items = sale.items ?? [];

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppReceiptText(sale, settings);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildWhatsAppReceiptText(sale, settings))}`;

  const containerWidthClass =
    format === '58mm'
      ? 'max-w-[260px] print-58mm text-xs'
      : format === '80mm'
        ? 'max-w-[340px] print-80mm text-xs'
        : 'max-w-2xl print-a4 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Top Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            {isConfirmation && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-base">
                {isConfirmation ? 'Bill Saved Successfully' : `Invoice ${sale.invoice_number}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sale.invoice_number} · {formatDisplayDate(sale.sale_date)} · {sale.sale_time}
                {sale.is_demo === 1 ? ' · DEMO DATA' : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-xs">
              {(['58mm', '80mm', 'a4'] as ReceiptFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    format === f
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {f === 'a4' ? 'A4 Invoice' : `${f} Thermal`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              type="button"
              onClick={() => downloadInvoicePdf(sale, settings, format)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              title="Copy formatted receipt text"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Preview Area */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950/60 max-h-[75vh] overflow-y-auto flex flex-col items-center">
          <div className="no-print w-full max-w-2xl flex justify-end mb-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showCostDetails}
                onChange={(e) => setShowCostDetails(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              Show saved purchase cost &amp; profit breakdown (Admin view)
            </label>
          </div>

          <div
            className={`w-full ${containerWidthClass} bg-white text-slate-900 border border-slate-300 shadow-xs p-5 font-mono`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="font-display font-bold text-base uppercase tracking-tight">{settings.shop_name}</div>
              {settings.shop_address && <div className="text-[11px] text-slate-600 mt-0.5">{settings.shop_address}</div>}
              {settings.shop_phone && <div className="text-[11px] text-slate-600">Tel: {settings.shop_phone}</div>}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice:</span>
                <span className="font-bold">{sale.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date &amp; Time:</span>
                <span>
                  {formatDisplayDate(sale.sale_date)} {sale.sale_time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Customer:</span>
                <span className="font-semibold">{sale.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment:</span>
                <span className="font-semibold">{sale.payment_method}</span>
              </div>
            </div>

            <table className="w-full text-[11px] border-collapse mb-3">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-1 font-semibold">Item</th>
                  <th className="py-1 text-right font-semibold">Qty</th>
                  <th className="py-1 text-right font-semibold">Rate</th>
                  <th className="py-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {items.map((item, idx) => (
                  <tr key={item.id ?? idx}>
                    <td className="py-1.5 pr-1">
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      {showCostDetails && (
                        <div className="text-[10px] text-emerald-700">
                          Cost: {formatRs(item.purchase_price_at_sale)} · Profit: {formatRs(item.item_profit)}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">{formatQty(item.quantity, item.unit)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{formatRs(item.selling_price)}</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{formatRs(item.item_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-slate-300 pt-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRs(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>Discount</span>
                  <span>- {formatRs(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-1.5 mt-1">
                <span>GRAND TOTAL</span>
                <span>{formatRs(sale.grand_total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Paid Amount</span>
                <span className="font-semibold">{formatRs(sale.paid_amount)}</span>
              </div>
              {sale.remaining_amount > 0 && (
                <div className="flex justify-between text-rose-700 font-semibold">
                  <span>Remaining Udhaar</span>
                  <span>{formatRs(sale.remaining_amount)}</span>
                </div>
              )}
              {showCostDetails && (
                <div className="flex justify-between text-emerald-700 font-semibold border-t border-dashed border-slate-300 pt-1.5 mt-1.5">
                  <span>Bill Gross Profit (Cost: {formatRs(sale.total_purchase_cost)})</span>
                  <span>{formatRs(sale.gross_profit)}</span>
                </div>
              )}
            </div>

            {settings.invoice_footer && (
              <div className="text-center text-[10px] text-slate-600 border-t border-dashed border-slate-300 mt-3 pt-2.5">
                {settings.invoice_footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
