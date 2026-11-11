import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'asan_kiryana.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    barcode TEXT NOT NULL DEFAULT '',
    product_code TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    purchase_price REAL NOT NULL DEFAULT 0,
    sales_price REAL NOT NULL DEFAULT 0,
    current_stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Piece',
    image_data TEXT NOT NULL DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
  CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    change_qty REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    movement_type TEXT NOT NULL,
    reference_id TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    opening_balance REAL NOT NULL DEFAULT 0,
    total_udhaar REAL NOT NULL DEFAULT 0,
    total_paid REAL NOT NULL DEFAULT 0,
    remaining_balance REAL NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    sale_date TEXT NOT NULL,
    sale_time TEXT NOT NULL,
    created_at TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    total_purchase_cost REAL NOT NULL DEFAULT 0,
    gross_profit REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    remaining_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
    notes TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
  CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    purchase_price_at_sale REAL NOT NULL,
    selling_price REAL NOT NULL,
    item_total REAL NOT NULL,
    item_profit REAL NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    invoice_number TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL,
    payment_type TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS customer_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    payment_id INTEGER,
    invoice_number TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    balance_after REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_customer ON customer_ledger(customer_id);

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function ensureDefaultSettings() {
  const defaults: Record<string, string> = {
    shop_name: 'Al-Madina Asan Kiryana Store',
    shop_address: 'Main Bazaar, Lahore, Pakistan',
    shop_phone: '0300-1234567',
    invoice_footer: 'Shukriya! Dobara tashreef laayein.',
    expense_management_enabled: '1',
    next_invoice_seq: '1001',
  };
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) {
    stmt.run(k, v);
  }
}

ensureDefaultSettings();

export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value
  );
}

export function generateNextInvoiceNumber(): string {
  let seq = Number(getSetting('next_invoice_seq', '1001'));
  if (!Number.isFinite(seq) || seq < 1) seq = 1001;

  while (true) {
    const candidate = `AK-${String(seq).padStart(5, '0')}`;
    const exists = db.prepare('SELECT id FROM sales WHERE invoice_number = ?').get(candidate);
    if (!exists) {
      setSetting('next_invoice_seq', String(seq + 1));
      return candidate;
    }
    seq += 1;
  }
}
