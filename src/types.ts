export type ProductUnit = 'Piece' | 'Packet' | 'Box' | 'Kg' | 'Gram' | 'Liter';

export type PaymentMethod = 'Cash' | 'Partial' | 'Udhaar';

export interface Product {
  id: number;
  name: string;
  barcode: string;
  product_code: string;
  category: string;
  purchase_price: number;
  sales_price: number;
  current_stock: number;
  min_stock: number;
  unit: ProductUnit;
  image_data: string;
  is_archived: number;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  change_qty: number;
  previous_stock: number;
  new_stock: number;
  movement_type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'INITIAL';
  reference_id: string;
  note: string;
  created_at: string;
  is_demo: number;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  address: string;
  opening_balance: number;
  total_udhaar: number;
  total_paid: number;
  remaining_balance: number;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedgerEntry {
  id: number;
  customer_id: number;
  sale_id: number | null;
  payment_id: number | null;
  invoice_number: string;
  description: string;
  debit: number;
  credit: number;
  balance_after: number;
  created_at: string;
  is_demo: number;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  unit: ProductUnit;
  quantity: number;
  purchase_price_at_sale: number;
  selling_price: number;
  item_total: number;
  item_profit: number;
  image_data?: string;
}

export interface Sale {
  id: number;
  invoice_number: string;
  idempotency_key: string;
  sale_date: string; // YYYY-MM-DD
  sale_time: string; // HH:mm:ss
  created_at: string;
  subtotal: number;
  discount: number;
  grand_total: number;
  total_purchase_cost: number;
  gross_profit: number;
  paid_amount: number;
  remaining_amount: number;
  payment_method: PaymentMethod;
  customer_id: number | null;
  customer_name: string;
  notes: string;
  is_demo: number;
  items?: SaleItem[];
  items_count?: number;
  total_quantity?: number;
}

export interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  note: string;
  created_at: string;
  is_demo: number;
}

export interface ShopSettings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  invoice_footer: string;
  expense_management_enabled: boolean;
  demo_data_present: boolean;
}

export interface DailySalesSummary {
  date: string;
  total_sales: number;
  total_profit: number;
  total_purchase_cost: number;
  total_bills: number;
  total_items_sold: number;
  cash_received: number;
  credit_sales: number;
  discounts: number;
  total_udhaar_created: number;
  total_outstanding_udhaar: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  label: string;
  total_sales: number;
  total_purchase_cost: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  bill_count: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type NavTab =
  | 'dashboard'
  | 'billing'
  | 'products'
  | 'customers'
  | 'today_sales'
  | 'previous_sales'
  | 'monthly_reports'
  | 'excel_export'
  | 'settings';
