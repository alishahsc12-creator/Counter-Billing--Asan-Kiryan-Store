import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, ShopSettings } from '../types';
import { formatDisplayDate, formatQty, formatRs } from './format';

export type ReceiptFormat = '58mm' | '80mm' | 'a4';

export function downloadInvoicePdf(sale: Sale, settings: ShopSettings, format: ReceiptFormat = 'a4'): void {
  const items = sale.items ?? [];

  if (format === 'a4') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.shop_name, 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (settings.shop_address) doc.text(settings.shop_address, 14, 24);
    if (settings.shop_phone) doc.text(`Phone: ${settings.shop_phone}`, 14, 29);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`INVOICE: ${sale.invoice_number}`, 196, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDisplayDate(sale.sale_date)} ${sale.sale_time}`, 196, 24, { align: 'right' });
    doc.text(`Customer: ${sale.customer_name}`, 196, 29, { align: 'right' });
    doc.text(`Payment: ${sale.payment_method}`, 196, 34, { align: 'right' });

    autoTable(doc, {
      startY: 42,
      head: [['#', 'Product', 'Qty', 'Rate', 'Total']],
      body: items.map((item, idx) => [
        String(idx + 1),
        item.product_name,
        formatQty(item.quantity, item.unit),
        formatRs(item.selling_price),
        formatRs(item.item_total),
      ]),
      styles: { fontSize: 9.5, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 12 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    const finalY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 100) + 8;
    doc.setFontSize(10.5);
    doc.text(`Subtotal: ${formatRs(sale.subtotal)}`, 196, finalY, { align: 'right' });
    doc.text(`Discount: ${formatRs(sale.discount)}`, 196, finalY + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Grand Total: ${formatRs(sale.grand_total)}`, 196, finalY + 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Paid Amount: ${formatRs(sale.paid_amount)}`, 196, finalY + 20, { align: 'right' });
    doc.text(`Remaining Balance: ${formatRs(sale.remaining_amount)}`, 196, finalY + 26, { align: 'right' });

    if (settings.invoice_footer) {
      doc.setFontSize(9.5);
      doc.text(settings.invoice_footer, 105, finalY + 38, { align: 'center' });
    }

    doc.save(`${sale.invoice_number}_A4.pdf`);
    return;
  }

  // 58mm or 80mm thermal PDF
  const widthMm = format === '58mm' ? 58 : 80;
  const estHeight = Math.max(115, 72 + items.length * 9);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, estHeight] });
  const center = widthMm / 2;
  const margin = 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(format === '58mm' ? 9.5 : 11);
  doc.text(settings.shop_name, center, 8, { align: 'center', maxWidth: widthMm - 6 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let y = 13;
  if (settings.shop_address) {
    doc.text(settings.shop_address, center, y, { align: 'center', maxWidth: widthMm - 6 });
    y += 4;
  }
  if (settings.shop_phone) {
    doc.text(`Tel: ${settings.shop_phone}`, center, y, { align: 'center' });
    y += 4;
  }

  doc.text(`Inv: ${sale.invoice_number} | ${sale.sale_date} ${sale.sale_time.slice(0, 5)}`, margin, y + 2);
  y += 6;
  doc.text(`Cust: ${sale.customer_name} (${sale.payment_method})`, margin, y);
  y += 3;
  doc.line(margin, y, widthMm - margin, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Item', margin, y);
  doc.text('Total', widthMm - margin, y, { align: 'right' });
  y += 4;
  doc.setFont('helvetica', 'normal');

  for (const item of items) {
    doc.text(`${item.product_name.slice(0, format === '58mm' ? 20 : 28)}`, margin, y);
    y += 3.5;
    doc.text(`${formatQty(item.quantity, item.unit)} x ${formatRs(item.selling_price)}`, margin + 1, y);
    doc.text(formatRs(item.item_total), widthMm - margin, y, { align: 'right' });
    y += 4.5;
  }

  doc.line(margin, y, widthMm - margin, y);
  y += 4;
  doc.text(`Subtotal:`, margin, y);
  doc.text(formatRs(sale.subtotal), widthMm - margin, y, { align: 'right' });
  y += 4;
  if (sale.discount > 0) {
    doc.text(`Discount:`, margin, y);
    doc.text(formatRs(sale.discount), widthMm - margin, y, { align: 'right' });
    y += 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(format === '58mm' ? 9 : 10);
  doc.text(`TOTAL:`, margin, y);
  doc.text(formatRs(sale.grand_total), widthMm - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Paid:`, margin, y);
  doc.text(formatRs(sale.paid_amount), widthMm - margin, y, { align: 'right' });
  y += 4;
  if (sale.remaining_amount > 0) {
    doc.text(`Remaining Udhaar:`, margin, y);
    doc.text(formatRs(sale.remaining_amount), widthMm - margin, y, { align: 'right' });
    y += 4;
  }
  if (settings.invoice_footer) {
    y += 3;
    doc.text(settings.invoice_footer, center, y, { align: 'center', maxWidth: widthMm - 6 });
  }

  doc.save(`${sale.invoice_number}_${format}.pdf`);
}

export function buildWhatsAppReceiptText(sale: Sale, settings: ShopSettings): string {
  const lines = [
    `*${settings.shop_name}*`,
    `Invoice: ${sale.invoice_number}`,
    `Date: ${formatDisplayDate(sale.sale_date)} ${sale.sale_time.slice(0, 5)}`,
    `Customer: ${sale.customer_name}`,
    `-------------------`,
    ...(sale.items ?? []).map(
      (i) => `${i.product_name} (${formatQty(i.quantity, i.unit)} x ${formatRs(i.selling_price)}) = ${formatRs(i.item_total)}`
    ),
    `-------------------`,
    `Subtotal: ${formatRs(sale.subtotal)}`,
    ...(sale.discount > 0 ? [`Discount: ${formatRs(sale.discount)}`] : []),
    `*Grand Total: ${formatRs(sale.grand_total)}*`,
    `Paid: ${formatRs(sale.paid_amount)} (${sale.payment_method})`,
    ...(sale.remaining_amount > 0 ? [`Remaining Balance: ${formatRs(sale.remaining_amount)}`] : []),
    settings.invoice_footer || 'Shukriya!',
  ];
  return lines.join('\n');
}
