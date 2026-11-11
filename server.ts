import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { db, generateNextInvoiceNumber, getSetting, setSetting, withTransaction } from './server/db.ts';
import { backfillDemoProductImages, clearDemoData, seedDemoData } from './server/seed.ts';
import {
  autoAssignMissingProductImages,
  resolveAndCacheProductImage,
  triggerStartupImageBackfill,
} from './server/productImages.ts';

// Seed 3-day Pakistani Kiryana demo data on fresh start and backfill exact single-product photos
seedDemoData(false);
backfillDemoProductImages();
triggerStartupImageBackfill();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use('/src/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));

function nowLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowLocalTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function nowIsoLocal(): string {
  return `${nowLocalDate()}T${nowLocalTime()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function demoFilterSql(includeDemoParam: unknown, alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return includeDemoParam === '0' ? ` AND ${prefix}is_demo = 0 ` : '';
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Settings
app.get('/api/settings', (_req, res) => {
  const demoCount = (db.prepare('SELECT COUNT(*) as c FROM products WHERE is_demo = 1').get() as { c: number }).c
    + (db.prepare('SELECT COUNT(*) as c FROM sales WHERE is_demo = 1').get() as { c: number }).c;

  res.json({
    shop_name: getSetting('shop_name', 'Al-Madina Asan Kiryana Store'),
    shop_address: getSetting('shop_address', 'Main Bazaar, Lahore, Pakistan'),
    shop_phone: getSetting('shop_phone', '0300-1234567'),
    invoice_footer: getSetting('invoice_footer', 'Shukriya! Dobara tashreef laayein.'),
    expense_management_enabled: getSetting('expense_management_enabled', '1') === '1',
    demo_data_present: demoCount > 0,
  });
});

app.put('/api/settings', (req, res) => {
  try {
    const body = req.body ?? {};
    if (typeof body.shop_name === 'string' && body.shop_name.trim()) {
      setSetting('shop_name', body.shop_name.trim().slice(0, 120));
    }
    if (typeof body.shop_address === 'string') {
      setSetting('shop_address', body.shop_address.trim().slice(0, 200));
    }
    if (typeof body.shop_phone === 'string') {
      setSetting('shop_phone', body.shop_phone.trim().slice(0, 40));
    }
    if (typeof body.invoice_footer === 'string') {
      setSetting('invoice_footer', body.invoice_footer.trim().slice(0, 200));
    }
    if (typeof body.expense_management_enabled === 'boolean') {
      setSetting('expense_management_enabled', body.expense_management_enabled ? '1' : '0');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update settings' });
  }
});

// Demo Data Controls
app.post('/api/demo/load', (_req, res) => {
  try {
    const result = seedDemoData(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load demo data' });
  }
});

app.post('/api/demo/clear', (_req, res) => {
  try {
    const result = clearDemoData();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove demo data' });
  }
});

// Products
app.get('/api/products', (req, res) => {
  const includeArchived = req.query.includeArchived === '1';
  const lowStockOnly = req.query.lowStock === '1';
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const demoSql = demoFilterSql(req.query.includeDemo);

  let sql = `SELECT * FROM products WHERE 1=1 ${demoSql}`;
  if (!includeArchived) {
    sql += ` AND is_archived = 0 `;
  }
  if (lowStockOnly) {
    sql += ` AND current_stock <= min_stock `;
  }
  sql += ` ORDER BY is_archived ASC, name ASC `;

  let rows = db.prepare(sql).all() as Record<string, unknown>[];
  if (search) {
    rows = rows.filter((r) => {
      const name = String(r.name ?? '').toLowerCase();
      const barcode = String(r.barcode ?? '').toLowerCase();
      const code = String(r.product_code ?? '').toLowerCase();
      const cat = String(r.category ?? '').toLowerCase();
      return name.includes(search) || barcode.includes(search) || code.includes(search) || cat.includes(search);
    });
  }
  res.json(rows);
});

app.post('/api/products/auto-image-preview', async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const category = String(req.body?.category ?? 'General').trim();
    const skipIndex = Number(req.body?.skipIndex ?? 0);
    if (!name) {
      return res.status(400).json({ error: 'Enter a product name first to fetch its matching image.' });
    }
    const imageUrl = await resolveAndCacheProductImage(name, category, {
      skipIndex: Number.isFinite(skipIndex) ? skipIndex : 0,
      forceRefresh: skipIndex > 0,
    });
    if (!imageUrl) {
      return res.status(404).json({ error: `Could not find a matching pack image for "${name}". Try uploading manually.` });
    }
    res.json({ image_data: imageUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch product image' });
  }
});

app.post('/api/products/auto-assign-images', async (req, res) => {
  try {
    const forceAll = Boolean(req.body?.forceAll);
    const result = await autoAssignMissingProductImages(forceAll);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to auto-assign product images' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const barcode = String(body.barcode ?? '').trim();
    const product_code = String(body.product_code ?? '').trim();
    const category = String(body.category ?? 'General').trim() || 'General';
    const purchase_price = Number(body.purchase_price);
    const sales_price = Number(body.sales_price);
    const current_stock = Number(body.current_stock ?? 0);
    const min_stock = Number(body.min_stock ?? 0);
    const unit = String(body.unit ?? 'Piece').trim();
    let image_data = typeof body.image_data === 'string' ? body.image_data.trim() : '';

    if (!name) return res.status(400).json({ error: 'Product name is required.' });
    if (!Number.isFinite(purchase_price) || purchase_price < 0) {
      return res.status(400).json({ error: 'Purchase price must be 0 or greater.' });
    }
    if (!Number.isFinite(sales_price) || sales_price <= 0) {
      return res.status(400).json({ error: 'Sales price must be greater than Rs. 0.' });
    }
    if (!Number.isFinite(current_stock) || current_stock < 0) {
      return res.status(400).json({ error: 'Current stock cannot be negative.' });
    }
    if (!Number.isFinite(min_stock) || min_stock < 0) {
      return res.status(400).json({ error: 'Minimum stock cannot be negative.' });
    }
    if (!['Piece', 'Packet', 'Box', 'Kg', 'Gram', 'Liter'].includes(unit)) {
      return res.status(400).json({ error: 'Invalid unit selected.' });
    }

    // Auto-fetch exact matching pack image when user did not manually upload one
    if (!image_data) {
      image_data = await resolveAndCacheProductImage(name, category);
    }

    const created = withTransaction(() => {
      const now = nowIsoLocal();
      const autoCode =
        product_code || `PRD-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const info = db
        .prepare(
          `INSERT INTO products (
            name, barcode, product_code, category, purchase_price, sales_price,
            current_stock, min_stock, unit, image_data, is_archived, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
        )
        .run(
          name,
          barcode,
          autoCode,
          category,
          round2(purchase_price),
          round2(sales_price),
          round3(current_stock),
          round3(min_stock),
          unit,
          image_data,
          now,
          now
        );
      const pid = Number(info.lastInsertRowid);
      if (current_stock > 0) {
        db.prepare(
          `INSERT INTO stock_movements (
            product_id, product_name, change_qty, previous_stock, new_stock,
            movement_type, reference_id, note, created_at, is_demo
          ) VALUES (?, ?, ?, 0, ?, 'INITIAL', '', 'Opening stock added', ?, 0)`
        ).run(pid, name, round3(current_stock), round3(current_stock), now);
      }
      return db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const body = req.body ?? {};
    const name = String(body.name ?? existing.name).trim();
    const barcode = String(body.barcode ?? existing.barcode).trim();
    const product_code = String(body.product_code ?? existing.product_code).trim();
    const category = String(body.category ?? existing.category).trim() || 'General';
    const purchase_price = Number(body.purchase_price ?? existing.purchase_price);
    const sales_price = Number(body.sales_price ?? existing.sales_price);
    const min_stock = Number(body.min_stock ?? existing.min_stock);
    const unit = String(body.unit ?? existing.unit).trim();
    let image_data = typeof body.image_data === 'string' ? body.image_data.trim() : String(existing.image_data ?? '').trim();
    const is_archived = body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : Number(existing.is_archived);

    if (!name) return res.status(400).json({ error: 'Product name is required.' });
    if (!Number.isFinite(purchase_price) || purchase_price < 0) {
      return res.status(400).json({ error: 'Purchase price cannot be negative.' });
    }
    if (!Number.isFinite(sales_price) || sales_price <= 0) {
      return res.status(400).json({ error: 'Sales price must be greater than Rs. 0.' });
    }
    if (!Number.isFinite(min_stock) || min_stock < 0) {
      return res.status(400).json({ error: 'Minimum stock cannot be negative.' });
    }

    if (!image_data) {
      image_data = await resolveAndCacheProductImage(name, category);
    }

    const updated = withTransaction(() => {
      const now = nowIsoLocal();
      db.prepare(
        `UPDATE products SET
          name = ?, barcode = ?, product_code = ?, category = ?,
          purchase_price = ?, sales_price = ?, min_stock = ?, unit = ?,
          image_data = ?, is_archived = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        name,
        barcode,
        product_code,
        category,
        round2(purchase_price),
        round2(sales_price),
        round3(min_stock),
        unit,
        image_data,
        is_archived,
        now,
        id
      );
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update product' });
  }
});

app.post('/api/products/:id/stock', (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const change_qty = Number(body.change_qty);
    const note = String(body.note ?? '').trim();

    if (!Number.isFinite(change_qty) || change_qty === 0) {
      return res.status(400).json({ error: 'Stock change quantity must be a non-zero number.' });
    }

    const updated = withTransaction(() => {
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as
        | { id: number; name: string; current_stock: number; is_demo: number }
        | undefined;
      if (!existing) throw new Error('Product not found.');

      const prevStock = Number(existing.current_stock);
      const newStock = round3(prevStock + change_qty);
      if (newStock < 0) {
        throw new Error(`Cannot reduce stock below 0. Current stock is ${prevStock}.`);
      }

      const now = nowIsoLocal();
      db.prepare('UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, id);
      db.prepare(
        `INSERT INTO stock_movements (
          product_id, product_name, change_qty, previous_stock, new_stock,
          movement_type, reference_id, note, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?)`
      ).run(
        id,
        existing.name,
        round3(change_qty),
        prevStock,
        newStock,
        change_qty > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        note || (change_qty > 0 ? 'Manual stock added' : 'Manual stock reduction'),
        now,
        existing.is_demo ? 1 : 0
      );
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update stock' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const usedInSales = (db.prepare('SELECT COUNT(*) as c FROM sale_items WHERE product_id = ?').get(id) as { c: number }).c;
    if (usedInSales > 0) {
      db.prepare('UPDATE products SET is_archived = 1, updated_at = ? WHERE id = ?').run(nowIsoLocal(), id);
      return res.json({ archived: true, message: 'Product archived to preserve historical invoice records.' });
    }

    withTransaction(() => {
      db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });
    res.json({ deleted: true, message: 'Product deleted permanently.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete product' });
  }
});

app.get('/api/stock-movements', (req, res) => {
  const productId = req.query.productId ? Number(req.query.productId) : null;
  const demoSql = demoFilterSql(req.query.includeDemo);
  if (productId) {
    const rows = db
      .prepare(`SELECT * FROM stock_movements WHERE product_id = ? ${demoSql} ORDER BY id DESC LIMIT 100`)
      .all(productId);
    return res.json(rows);
  }
  const rows = db.prepare(`SELECT * FROM stock_movements WHERE 1=1 ${demoSql} ORDER BY id DESC LIMIT 150`).all();
  res.json(rows);
});

// Customers & Udhaar Khata
app.get('/api/customers', (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const demoSql = demoFilterSql(req.query.includeDemo);
  let rows = db.prepare(`SELECT * FROM customers WHERE 1=1 ${demoSql} ORDER BY remaining_balance DESC, name ASC`).all() as Record<
    string,
    unknown
  >[];
  if (search) {
    rows = rows.filter(
      (c) =>
        String(c.name ?? '').toLowerCase().includes(search) ||
        String(c.mobile ?? '').toLowerCase().includes(search) ||
        String(c.address ?? '').toLowerCase().includes(search)
    );
  }
  res.json(rows);
});

app.get('/api/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  const ledger = db.prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC').all(id);
  res.json({ customer, ledger });
});

app.post('/api/customers', (req, res) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const mobile = String(body.mobile ?? '').trim();
    const address = String(body.address ?? '').trim();
    const opening_balance = Number(body.opening_balance ?? 0);

    if (!name) return res.status(400).json({ error: 'Customer name is required.' });
    if (!Number.isFinite(opening_balance) || opening_balance < 0) {
      return res.status(400).json({ error: 'Opening balance cannot be negative.' });
    }

    const created = withTransaction(() => {
      const now = nowIsoLocal();
      const bal = round2(opening_balance);
      const info = db
        .prepare(
          `INSERT INTO customers (
            name, mobile, address, opening_balance, total_udhaar, total_paid, remaining_balance,
            is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`
        )
        .run(name, mobile, address, bal, bal, bal, now, now);
      const cid = Number(info.lastInsertRowid);
      if (bal > 0) {
        db.prepare(
          `INSERT INTO customer_ledger (
            customer_id, sale_id, payment_id, invoice_number, description,
            debit, credit, balance_after, created_at, is_demo
          ) VALUES (?, NULL, NULL, '', 'Opening Udhaar Balance', ?, 0, ?, ?, 0)`
        ).run(cid, bal, bal, now);
      }
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(cid);
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Customer not found.' });

    const body = req.body ?? {};
    const name = String(body.name ?? existing.name).trim();
    const mobile = String(body.mobile ?? existing.mobile).trim();
    const address = String(body.address ?? existing.address).trim();
    if (!name) return res.status(400).json({ error: 'Customer name is required.' });

    db.prepare('UPDATE customers SET name = ?, mobile = ?, address = ?, updated_at = ? WHERE id = ?').run(
      name,
      mobile,
      address,
      nowIsoLocal(),
      id
    );
    res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update customer' });
  }
});

app.post('/api/customers/:id/udhaar', (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note ?? '').trim() || 'Manual Udhaar Given';

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Udhaar amount must be greater than Rs. 0.' });
    }

    const result = withTransaction(() => {
      const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as
        | { id: number; remaining_balance: number; is_demo: number }
        | undefined;
      if (!cust) throw new Error('Customer not found.');

      const now = nowIsoLocal();
      const amt = round2(amount);
      const newBal = round2(Number(cust.remaining_balance) + amt);

      db.prepare(
        `UPDATE customers
         SET total_udhaar = total_udhaar + ?, remaining_balance = ?, updated_at = ?
         WHERE id = ?`
      ).run(amt, newBal, now, id);

      db.prepare(
        `INSERT INTO customer_ledger (
          customer_id, sale_id, payment_id, invoice_number, description,
          debit, credit, balance_after, created_at, is_demo
        ) VALUES (?, NULL, NULL, '', ?, ?, 0, ?, ?, 0)`
      ).run(id, note, amt, newBal, now);

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      const ledger = db.prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC').all(id);
      return { customer, ledger };
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record Udhaar' });
  }
});

app.post('/api/customers/:id/payment', (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note ?? '').trim() || 'Payment Received';

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than Rs. 0.' });
    }

    const result = withTransaction(() => {
      const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as
        | { id: number; remaining_balance: number; is_demo: number }
        | undefined;
      if (!cust) throw new Error('Customer not found.');

      const currentBal = round2(Number(cust.remaining_balance));
      const amt = round2(amount);
      if (amt > currentBal + 0.001) {
        throw new Error(`Payment amount (Rs. ${amt}) exceeds remaining Udhaar balance (Rs. ${currentBal}).`);
      }

      const now = nowIsoLocal();
      const newBal = Math.max(0, round2(currentBal - amt));

      const payInfo = db
        .prepare(
          `INSERT INTO payments (
            customer_id, sale_id, invoice_number, amount, payment_type, note, created_at, is_demo
          ) VALUES (?, NULL, '', ?, 'UDHAAR_PAYMENT', ?, ?, 0)`
        )
        .run(id, amt, note, now);

      db.prepare(
        `UPDATE customers
         SET total_paid = total_paid + ?, remaining_balance = ?, updated_at = ?
         WHERE id = ?`
      ).run(amt, newBal, now, id);

      db.prepare(
        `INSERT INTO customer_ledger (
          customer_id, sale_id, payment_id, invoice_number, description,
          debit, credit, balance_after, created_at, is_demo
        ) VALUES (?, NULL, ?, '', ?, 0, ?, ?, ?, 0)`
      ).run(id, Number(payInfo.lastInsertRowid), note, amt, newBal, now);

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      const ledger = db.prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC').all(id);
      return { customer, ledger };
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to receive payment' });
  }
});

// Sales & Counter Billing
function fetchSaleWithItems(saleId: number) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as Record<string, unknown> | undefined;
  if (!sale) return null;
  const items = db
    .prepare(
      `SELECT si.*, COALESCE(p.image_data, '') as image_data
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`
    )
    .all(saleId);
  return { ...sale, items };
}

app.get('/api/sales', (req, res) => {
  const date = req.query.date ? String(req.query.date) : '';
  const startDate = req.query.startDate ? String(req.query.startDate) : '';
  const endDate = req.query.endDate ? String(req.query.endDate) : '';
  const month = req.query.month ? String(req.query.month) : '';
  const invoice = String(req.query.invoice ?? '').trim().toLowerCase();
  const limit = Number(req.query.limit ?? 200);
  const demoSql = demoFilterSql(req.query.includeDemo, 's');

  let sql = `
    SELECT s.*,
      (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count,
      (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as total_quantity
    FROM sales s
    WHERE 1=1 ${demoSql}
  `;
  const params: Array<string | number | null> = [];
  if (date) {
    sql += ` AND s.sale_date = ? `;
    params.push(date);
  }
  if (startDate && endDate) {
    sql += ` AND s.sale_date >= ? AND s.sale_date <= ? `;
    params.push(startDate, endDate);
  }
  if (month) {
    sql += ` AND substr(s.sale_date, 1, 7) = ? `;
    params.push(month);
  }
  if (invoice) {
    sql += ` AND (LOWER(s.invoice_number) LIKE ? OR LOWER(s.customer_name) LIKE ?) `;
    params.push(`%${invoice}%`, `%${invoice}%`);
  }
  sql += ` ORDER BY s.sale_date DESC, s.sale_time DESC, s.id DESC LIMIT ? `;
  params.push(Number.isFinite(limit) && limit > 0 ? limit : 200);

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/sales/:id', (req, res) => {
  const id = Number(req.params.id);
  const sale = fetchSaleWithItems(id);
  if (!sale) return res.status(404).json({ error: 'Invoice not found.' });
  res.json(sale);
});

app.post('/api/sales', (req, res) => {
  try {
    const body = req.body ?? {};
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const discount = Number(body.discount ?? 0);
    const paymentMethod = String(body.paymentMethod ?? 'Cash');
    const customerId = body.customerId ? Number(body.customerId) : null;
    const notes = String(body.notes ?? '').trim();
    const rawPaidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : 0;

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Missing transaction idempotency key.' });
    }
    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Add at least one product.' });
    }
    if (!['Cash', 'Partial', 'Udhaar'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }
    if (!Number.isFinite(discount) || discount < 0) {
      return res.status(400).json({ error: 'Discount cannot be negative.' });
    }

    // Check duplicate bill submission BEFORE opening write lock
    const existingByKey = db.prepare('SELECT id FROM sales WHERE idempotency_key = ?').get(idempotencyKey) as
      | { id: number }
      | undefined;
    if (existingByKey) {
      return res.json({ duplicate: true, sale: fetchSaleWithItems(existingByKey.id) });
    }

    const result = withTransaction(() => {
      // Re-check inside exclusive transaction
      const dupCheck = db.prepare('SELECT id FROM sales WHERE idempotency_key = ?').get(idempotencyKey) as
        | { id: number }
        | undefined;
      if (dupCheck) {
        return { duplicate: true, sale: fetchSaleWithItems(dupCheck.id) };
      }

      const saleDate = nowLocalDate();
      const saleTime = nowLocalTime();
      const createdAt = `${saleDate}T${saleTime}`;

      // Combine duplicate product rows cleanly if any
      const mergedItems = new Map<number, number>();
      for (const raw of items) {
        const pid = Number(raw.productId);
        const qty = round3(Number(raw.quantity));
        if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) {
          throw new Error('Each item must have a valid product and positive quantity.');
        }
        mergedItems.set(pid, round3((mergedItems.get(pid) ?? 0) + qty));
      }

      let subtotal = 0;
      let totalPurchaseCost = 0;

      const preparedItems: Array<{
        productId: number;
        productName: string;
        unit: string;
        quantity: number;
        prevStock: number;
        newStock: number;
        purchasePrice: number;
        sellingPrice: number;
        itemTotal: number;
        itemProfit: number;
      }> = [];

      for (const [pid, qty] of mergedItems.entries()) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ? AND is_archived = 0').get(pid) as
          | {
              id: number;
              name: string;
              unit: string;
              purchase_price: number;
              sales_price: number;
              current_stock: number;
            }
          | undefined;
        if (!prod) {
          throw new Error(`Product #${pid} not found or archived.`);
        }
        const prevStock = Number(prod.current_stock);
        if (prevStock + 0.0001 < qty) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prevStock} ${prod.unit}, Requested: ${qty} ${prod.unit}.`);
        }

        const newStock = Math.max(0, round3(prevStock - qty));
        const purchaseAtSale = round2(Number(prod.purchase_price));
        const sellingPrice = round2(Number(prod.sales_price));
        const itemTotal = round2(sellingPrice * qty);
        const itemCost = round2(purchaseAtSale * qty);
        const itemProfit = round2(itemTotal - itemCost);

        subtotal = round2(subtotal + itemTotal);
        totalPurchaseCost = round2(totalPurchaseCost + itemCost);

        preparedItems.push({
          productId: pid,
          productName: prod.name,
          unit: prod.unit,
          quantity: qty,
          prevStock,
          newStock,
          purchasePrice: purchaseAtSale,
          sellingPrice,
          itemTotal,
          itemProfit,
        });
      }

      if (discount > subtotal) {
        throw new Error(`Discount (Rs. ${discount}) cannot exceed subtotal (Rs. ${subtotal}).`);
      }

      const grandTotal = round2(subtotal - discount);
      // Gross Profit = Total Selling Amount - Total Purchase Cost - Discounts
      const grossProfit = round2(subtotal - totalPurchaseCost - discount);

      let paidAmount = 0;
      let remainingAmount = 0;

      if (paymentMethod === 'Cash') {
        if (rawPaidAmount > 0 && rawPaidAmount < grandTotal) {
          throw new Error('Cash received cannot be less than Grand Total. Select Partial or Udhaar for credit.');
        }
        paidAmount = grandTotal;
        remainingAmount = 0;
      } else if (paymentMethod === 'Udhaar') {
        if (!customerId) {
          throw new Error('Please select a customer for an Udhaar bill.');
        }
        paidAmount = 0;
        remainingAmount = grandTotal;
      } else {
        // Partial
        if (!customerId) {
          throw new Error('Please select a customer for a Partial payment bill.');
        }
        if (!Number.isFinite(rawPaidAmount) || rawPaidAmount < 0 || rawPaidAmount >= grandTotal) {
          throw new Error('For Partial payment, paid amount must be between Rs. 0 and less than Grand Total.');
        }
        paidAmount = round2(rawPaidAmount);
        remainingAmount = round2(grandTotal - paidAmount);
      }

      let customerName = 'Walk-in Customer';
      let customerRecord: { id: number; name: string; remaining_balance: number } | undefined;
      if (customerId) {
        customerRecord = db.prepare('SELECT id, name, remaining_balance FROM customers WHERE id = ?').get(customerId) as
          | { id: number; name: string; remaining_balance: number }
          | undefined;
        if (!customerRecord) {
          throw new Error('Selected customer does not exist.');
        }
        customerName = customerRecord.name;
      }

      const invoiceNumber = generateNextInvoiceNumber();

      const saleInsert = db
        .prepare(
          `INSERT INTO sales (
            invoice_number, idempotency_key, sale_date, sale_time, created_at,
            subtotal, discount, grand_total, total_purchase_cost, gross_profit,
            paid_amount, remaining_amount, payment_method, customer_id, customer_name, notes, is_demo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          invoiceNumber,
          idempotencyKey,
          saleDate,
          saleTime,
          createdAt,
          subtotal,
          round2(discount),
          grandTotal,
          totalPurchaseCost,
          grossProfit,
          paidAmount,
          remainingAmount,
          paymentMethod,
          customerId,
          customerName,
          notes
        );

      const saleId = Number(saleInsert.lastInsertRowid);

      const insertItemStmt = db.prepare(
        `INSERT INTO sale_items (
          sale_id, product_id, product_name, unit, quantity,
          purchase_price_at_sale, selling_price, item_total, item_profit, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      );
      const updateStockStmt = db.prepare('UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?');
      const insertMoveStmt = db.prepare(
        `INSERT INTO stock_movements (
          product_id, product_name, change_qty, previous_stock, new_stock,
          movement_type, reference_id, note, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, 'SALE', ?, ?, ?, 0)`
      );

      for (const item of preparedItems) {
        insertItemStmt.run(
          saleId,
          item.productId,
          item.productName,
          item.unit,
          item.quantity,
          item.purchasePrice,
          item.sellingPrice,
          item.itemTotal,
          item.itemProfit
        );
        updateStockStmt.run(item.newStock, createdAt, item.productId);
        insertMoveStmt.run(
          item.productId,
          item.productName,
          round3(-item.quantity),
          item.prevStock,
          item.newStock,
          invoiceNumber,
          `Sold on invoice ${invoiceNumber}`,
          createdAt
        );
      }

      if (customerRecord && (paymentMethod === 'Udhaar' || paymentMethod === 'Partial')) {
        const newBal = round2(Number(customerRecord.remaining_balance) + remainingAmount);
        db.prepare(
          `UPDATE customers
           SET total_udhaar = total_udhaar + ?,
               total_paid = total_paid + ?,
               remaining_balance = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(grandTotal, paidAmount, newBal, createdAt, customerRecord.id);

        let paymentId: number | null = null;
        if (paidAmount > 0) {
          const pInfo = db
            .prepare(
              `INSERT INTO payments (
                customer_id, sale_id, invoice_number, amount, payment_type, note, created_at, is_demo
              ) VALUES (?, ?, ?, ?, 'PARTIAL_AT_SALE', 'Paid at billing counter', ?, 0)`
            )
            .run(customerRecord.id, saleId, invoiceNumber, paidAmount, createdAt);
          paymentId = Number(pInfo.lastInsertRowid);
        }

        db.prepare(
          `INSERT INTO customer_ledger (
            customer_id, sale_id, payment_id, invoice_number, description,
            debit, credit, balance_after, created_at, is_demo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        ).run(
          customerRecord.id,
          saleId,
          paymentId,
          invoiceNumber,
          `${paymentMethod} Bill (${invoiceNumber})`,
          grandTotal,
          paidAmount,
          newBal,
          createdAt
        );
      }

      return { duplicate: false, sale: fetchSaleWithItems(saleId) };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save bill' });
  }
});

// Reports
function buildDailySummary(date: string, includeDemo: unknown) {
  const demoSql = demoFilterSql(includeDemo);
  const demoSqlS = demoFilterSql(includeDemo, 's');
  const agg = db
    .prepare(
      `SELECT
         COALESCE(SUM(grand_total), 0) as total_sales,
         COALESCE(SUM(gross_profit), 0) as total_profit,
         COALESCE(SUM(total_purchase_cost), 0) as total_purchase_cost,
         COUNT(*) as total_bills,
         COALESCE(SUM(paid_amount), 0) as cash_received,
         COALESCE(SUM(CASE WHEN payment_method IN ('Udhaar', 'Partial') THEN grand_total ELSE 0 END), 0) as credit_sales,
         COALESCE(SUM(discount), 0) as discounts,
         COALESCE(SUM(remaining_amount), 0) as total_udhaar_created
       FROM sales
       WHERE sale_date = ? ${demoSql}`
    )
    .get(date) as Record<string, number>;

  const itemAgg = db
    .prepare(
      `SELECT COALESCE(SUM(si.quantity), 0) as total_items_sold
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.sale_date = ? ${demoSqlS}`
    )
    .get(date) as { total_items_sold: number };

  const udhaarAgg = db
    .prepare(`SELECT COALESCE(SUM(remaining_balance), 0) as total_outstanding_udhaar FROM customers WHERE 1=1 ${demoSql}`)
    .get() as { total_outstanding_udhaar: number };

  const hourly = db
    .prepare(
      `SELECT substr(sale_time, 1, 2) || ':00' as hour,
              COALESCE(SUM(grand_total), 0) as sales,
              COALESCE(SUM(gross_profit), 0) as profit,
              COUNT(*) as bills
       FROM sales
       WHERE sale_date = ? ${demoSql}
       GROUP BY substr(sale_time, 1, 2)
       ORDER BY hour ASC`
    )
    .all(date);

  return {
    summary: {
      date,
      total_sales: round2(agg.total_sales ?? 0),
      total_profit: round2(agg.total_profit ?? 0),
      total_purchase_cost: round2(agg.total_purchase_cost ?? 0),
      total_bills: Number(agg.total_bills ?? 0),
      total_items_sold: round3(itemAgg.total_items_sold ?? 0),
      cash_received: round2(agg.cash_received ?? 0),
      credit_sales: round2(agg.credit_sales ?? 0),
      discounts: round2(agg.discounts ?? 0),
      total_udhaar_created: round2(agg.total_udhaar_created ?? 0),
      total_outstanding_udhaar: round2(udhaarAgg.total_outstanding_udhaar ?? 0),
    },
    hourly,
  };
}

app.get('/api/reports/daily', (req, res) => {
  const date = String(req.query.date || nowLocalDate());
  res.json(buildDailySummary(date, req.query.includeDemo));
});

app.get('/api/reports/dashboard', (req, res) => {
  const today = nowLocalDate();
  const demoSql = demoFilterSql(req.query.includeDemo);
  const { summary: todaySummary } = buildDailySummary(today, req.query.includeDemo);

  const lowStockProducts = db
    .prepare(`SELECT * FROM products WHERE is_archived = 0 AND current_stock <= min_stock ${demoSql} ORDER BY (current_stock - min_stock) ASC`)
    .all();

  const totalProducts = (
    db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_archived = 0 ${demoSql}`).get() as { c: number }
  ).c;

  // Last 7 days trend
  const trend: Array<{ date: string; sales: number; profit: number; bills: number }> = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(grand_total), 0) as sales,
                COALESCE(SUM(gross_profit), 0) as profit,
                COUNT(*) as bills
         FROM sales WHERE sale_date = ? ${demoSql}`
      )
      .get(dateStr) as { sales: number; profit: number; bills: number };
    trend.push({
      date: dateStr,
      sales: round2(row.sales ?? 0),
      profit: round2(row.profit ?? 0),
      bills: Number(row.bills ?? 0),
    });
  }

  const recentInvoices = db
    .prepare(`SELECT * FROM sales WHERE 1=1 ${demoSql} ORDER BY sale_date DESC, sale_time DESC, id DESC LIMIT 8`)
    .all();

  res.json({
    today: todaySummary,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    totalProducts,
    trend,
    recentInvoices,
  });
});

app.get('/api/reports/monthly', (req, res) => {
  const demoSql = demoFilterSql(req.query.includeDemo);
  const selectedMonth = req.query.month ? String(req.query.month) : nowLocalDate().slice(0, 7);

  const salesByMonth = db
    .prepare(
      `SELECT substr(sale_date, 1, 7) as month,
              COALESCE(SUM(grand_total), 0) as total_sales,
              COALESCE(SUM(total_purchase_cost), 0) as total_purchase_cost,
              COALESCE(SUM(gross_profit), 0) as gross_profit,
              COUNT(*) as bill_count
       FROM sales
       WHERE 1=1 ${demoSql}
       GROUP BY substr(sale_date, 1, 7)
       ORDER BY month DESC`
    )
    .all() as Array<{
    month: string;
    total_sales: number;
    total_purchase_cost: number;
    gross_profit: number;
    bill_count: number;
  }>;

  const expensesEnabled = getSetting('expense_management_enabled', '1') === '1';
  const expensesByMonthRows = db
    .prepare(
      `SELECT substr(expense_date, 1, 7) as month,
              COALESCE(SUM(amount), 0) as total_expenses
       FROM expenses
       WHERE 1=1 ${demoSql}
       GROUP BY substr(expense_date, 1, 7)`
    )
    .all() as Array<{ month: string; total_expenses: number }>;

  const expenseMap = new Map<string, number>();
  for (const row of expensesByMonthRows) {
    expenseMap.set(row.month, round2(row.total_expenses));
  }

  const monthSet = new Set<string>(salesByMonth.map((r) => r.month));
  for (const r of expensesByMonthRows) monthSet.add(r.month);
  monthSet.add(selectedMonth);

  const salesMap = new Map(salesByMonth.map((r) => [r.month, r]));
  const months = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const s = salesMap.get(month);
      const totalSales = round2(s?.total_sales ?? 0);
      const totalCost = round2(s?.total_purchase_cost ?? 0);
      const grossProfit = round2(s?.gross_profit ?? 0);
      const totalExpenses = expensesEnabled ? round2(expenseMap.get(month) ?? 0) : 0;
      const netProfit = round2(grossProfit - totalExpenses);

      const [yr, mo] = month.split('-');
      const dt = new Date(Number(yr), Number(mo) - 1, 1);
      const label = dt.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });

      return {
        month,
        label,
        total_sales: totalSales,
        total_purchase_cost: totalCost,
        gross_profit: grossProfit,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        bill_count: Number(s?.bill_count ?? 0),
      };
    });

  const dailyBreakdown = db
    .prepare(
      `SELECT sale_date as date,
              COALESCE(SUM(grand_total), 0) as total_sales,
              COALESCE(SUM(total_purchase_cost), 0) as total_purchase_cost,
              COALESCE(SUM(gross_profit), 0) as gross_profit,
              COALESCE(SUM(discount), 0) as discounts,
              COUNT(*) as bill_count
       FROM sales
       WHERE substr(sale_date, 1, 7) = ? ${demoSql}
       GROUP BY sale_date
       ORDER BY sale_date ASC`
    )
    .all(selectedMonth);

  res.json({ months, selectedMonth, dailyBreakdown, expensesEnabled });
});

// Expenses
app.get('/api/expenses', (req, res) => {
  const month = req.query.month ? String(req.query.month) : '';
  const demoSql = demoFilterSql(req.query.includeDemo);
  let sql = `SELECT * FROM expenses WHERE 1=1 ${demoSql}`;
  const params: Array<string | number | null> = [];
  if (month) {
    sql += ` AND substr(expense_date, 1, 7) = ? `;
    params.push(month);
  }
  sql += ` ORDER BY expense_date DESC, id DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/expenses', (req, res) => {
  try {
    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const category = String(body.category ?? 'General').trim() || 'General';
    const amount = Number(body.amount);
    const expense_date = String(body.expense_date || nowLocalDate());
    const note = String(body.note ?? '').trim();

    if (!title) return res.status(400).json({ error: 'Expense title is required.' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be greater than Rs. 0.' });
    }

    const info = db
      .prepare(
        `INSERT INTO expenses (title, category, amount, expense_date, note, created_at, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      )
      .run(title, category, round2(amount), expense_date, note, nowIsoLocal());

    res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(Number(info.lastInsertRowid)));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save expense' });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ deleted: true });
});

// Excel Export Preview & Real .xlsx Download
function queryExportRows(startDate: string, endDate: string, includeDemo: unknown) {
  const demoSql = demoFilterSql(includeDemo, 's');
  const lineRows = db
    .prepare(
      `SELECT
         s.invoice_number,
         s.sale_date,
         s.sale_time,
         si.product_name,
         si.unit,
         si.quantity,
         si.purchase_price_at_sale,
         si.selling_price,
         si.item_total,
         si.item_profit,
         s.discount as invoice_discount,
         s.grand_total as invoice_total,
         s.gross_profit as invoice_profit,
         s.payment_method,
         s.customer_name,
         s.paid_amount,
         s.remaining_amount,
         s.is_demo
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.sale_date >= ? AND s.sale_date <= ? ${demoSql}
       ORDER BY s.sale_date ASC, s.sale_time ASC, s.id ASC, si.id ASC`
    )
    .all(startDate, endDate) as Record<string, unknown>[];

  const invoiceRows = db
    .prepare(
      `SELECT
         invoice_number,
         sale_date,
         sale_time,
         customer_name,
         payment_method,
         subtotal,
         discount,
         grand_total,
         total_purchase_cost,
         gross_profit,
         paid_amount,
         remaining_amount,
         is_demo
       FROM sales s
       WHERE s.sale_date >= ? AND s.sale_date <= ? ${demoSql}
       ORDER BY s.sale_date ASC, s.sale_time ASC, s.id ASC`
    )
    .all(startDate, endDate) as Record<string, unknown>[];

  return { lineRows, invoiceRows };
}

app.get('/api/export/preview', (req, res) => {
  const startDate = String(req.query.startDate || nowLocalDate());
  const endDate = String(req.query.endDate || nowLocalDate());
  const { lineRows, invoiceRows } = queryExportRows(startDate, endDate, req.query.includeDemo);
  const totalSales = round2(invoiceRows.reduce((acc, r) => acc + Number(r.grand_total ?? 0), 0));
  const totalProfit = round2(invoiceRows.reduce((acc, r) => acc + Number(r.gross_profit ?? 0), 0));
  res.json({
    startDate,
    endDate,
    invoiceCount: invoiceRows.length,
    lineItemCount: lineRows.length,
    totalSales,
    totalProfit,
    sampleRows: lineRows.slice(0, 50),
  });
});

app.get('/api/export/excel', (req, res) => {
  try {
    const startDate = String(req.query.startDate || nowLocalDate());
    const endDate = String(req.query.endDate || nowLocalDate());
    const { lineRows, invoiceRows } = queryExportRows(startDate, endDate, req.query.includeDemo);

    const itemSheetData = lineRows.map((r) => ({
      'Invoice Number': String(r.invoice_number),
      'Date': String(r.sale_date),
      'Time': String(r.sale_time),
      'Product Name': String(r.product_name),
      'Unit': String(r.unit),
      'Quantity': Number(r.quantity),
      'Purchase Price (Rs.)': Number(r.purchase_price_at_sale),
      'Selling Price (Rs.)': Number(r.selling_price),
      'Item Total (Rs.)': Number(r.item_total),
      'Item Profit (Rs.)': Number(r.item_profit),
      'Invoice Total (Rs.)': Number(r.invoice_total),
      'Invoice Profit (Rs.)': Number(r.invoice_profit),
      'Payment Method': String(r.payment_method),
      'Customer Name': String(r.customer_name),
      'Paid Amount (Rs.)': Number(r.paid_amount),
      'Remaining Amount (Rs.)': Number(r.remaining_amount),
      'Record Type': Number(r.is_demo) === 1 ? 'DEMO' : 'REAL',
    }));

    const summarySheetData = invoiceRows.map((r) => ({
      'Invoice Number': String(r.invoice_number),
      'Date': String(r.sale_date),
      'Time': String(r.sale_time),
      'Customer Name': String(r.customer_name),
      'Payment Method': String(r.payment_method),
      'Subtotal (Rs.)': Number(r.subtotal),
      'Discount (Rs.)': Number(r.discount),
      'Grand Total (Rs.)': Number(r.grand_total),
      'Purchase Cost (Rs.)': Number(r.total_purchase_cost),
      'Gross Profit (Rs.)': Number(r.gross_profit),
      'Paid Amount (Rs.)': Number(r.paid_amount),
      'Remaining Amount (Rs.)': Number(r.remaining_amount),
      'Record Type': Number(r.is_demo) === 1 ? 'DEMO' : 'REAL',
    }));

    const wb = XLSX.utils.book_new();
    const wsItems = XLSX.utils.json_to_sheet(
      itemSheetData.length > 0
        ? itemSheetData
        : [{ Message: `No sales records found between ${startDate} and ${endDate}` }]
    );
    const wsInvoices = XLSX.utils.json_to_sheet(
      summarySheetData.length > 0
        ? summarySheetData
        : [{ Message: `No invoices found between ${startDate} and ${endDate}` }]
    );

    wsItems['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 10 },
      { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 22 }, { wch: 16 },
      { wch: 18 }, { wch: 10 },
    ];
    wsInvoices['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 15 },
      { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
      { wch: 16 }, { wch: 18 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, wsItems, 'Sales Details');
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices Summary');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `Asan_Kiryana_Sales_${startDate}_to_${endDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate Excel file' });
  }
});

// Serve Frontend (Vite middleware in dev, static dist/ in production)
async function startServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`COUNTER BILLING – ASAN KIRYANA running on http://localhost:${PORT}`);
  });
}

startServer();
