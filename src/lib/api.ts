import type {
  Customer,
  CustomerLedgerEntry,
  DailySalesSummary,
  Expense,
  MonthlySummary,
  PaymentMethod,
  Product,
  Sale,
  ShopSettings,
  StockMovement,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error || `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const api = {
  getSettings: () => request<ShopSettings>('/api/settings'),
  updateSettings: (payload: Partial<ShopSettings>) =>
    request<{ ok: boolean }>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  loadDemoData: () => request<{ seeded: boolean; message: string }>('/api/demo/load', { method: 'POST' }),
  clearDemoData: () => request<{ cleared: boolean; message: string }>('/api/demo/clear', { method: 'POST' }),

  getProducts: (params?: { search?: string; includeArchived?: boolean; lowStock?: boolean; includeDemo?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.includeArchived) q.set('includeArchived', '1');
    if (params?.lowStock) q.set('lowStock', '1');
    if (params?.includeDemo === false) q.set('includeDemo', '0');
    return request<Product[]>(`/api/products?${q.toString()}`);
  },
  createProduct: (payload: Partial<Product>) =>
    request<Product>('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: number, payload: Partial<Product>) =>
    request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adjustStock: (id: number, change_qty: number, note: string) =>
    request<Product>(`/api/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ change_qty, note }),
    }),
  deleteProduct: (id: number) =>
    request<{ archived?: boolean; deleted?: boolean; message: string }>(`/api/products/${id}`, { method: 'DELETE' }),
  previewAutoProductImage: (name: string, category: string, skipIndex = 0) =>
    request<{ image_data: string }>('/api/products/auto-image-preview', {
      method: 'POST',
      body: JSON.stringify({ name, category, skipIndex }),
    }),
  autoAssignProductImages: (forceAll = false) =>
    request<{ updated: number; totalChecked: number }>('/api/products/auto-assign-images', {
      method: 'POST',
      body: JSON.stringify({ forceAll }),
    }),
  getStockMovements: (productId?: number, includeDemo = true) => {
    const q = new URLSearchParams();
    if (productId) q.set('productId', String(productId));
    if (!includeDemo) q.set('includeDemo', '0');
    return request<StockMovement[]>(`/api/stock-movements?${q.toString()}`);
  },

  getCustomers: (search?: string, includeDemo = true) => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (!includeDemo) q.set('includeDemo', '0');
    return request<Customer[]>(`/api/customers?${q.toString()}`);
  },
  getCustomerDetail: (id: number) =>
    request<{ customer: Customer; ledger: CustomerLedgerEntry[] }>(`/api/customers/${id}`),
  createCustomer: (payload: { name: string; mobile: string; address: string; opening_balance: number }) =>
    request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id: number, payload: { name: string; mobile: string; address: string }) =>
    request<Customer>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  giveCustomerUdhaar: (id: number, amount: number, note: string) =>
    request<{ customer: Customer; ledger: CustomerLedgerEntry[] }>(`/api/customers/${id}/udhaar`, {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),
  receiveCustomerPayment: (id: number, amount: number, note: string) =>
    request<{ customer: Customer; ledger: CustomerLedgerEntry[] }>(`/api/customers/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),

  getSales: (params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
    invoice?: string;
    limit?: number;
    includeDemo?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.month) q.set('month', params.month);
    if (params?.invoice) q.set('invoice', params.invoice);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.includeDemo === false) q.set('includeDemo', '0');
    return request<Sale[]>(`/api/sales?${q.toString()}`);
  },
  getSaleById: (id: number) => request<Sale>(`/api/sales/${id}`),
  createSale: (payload: {
    idempotencyKey: string;
    items: { productId: number; quantity: number }[];
    discount: number;
    paymentMethod: PaymentMethod;
    paidAmount: number;
    customerId: number | null;
    notes?: string;
  }) => request<{ duplicate: boolean; sale: Sale }>('/api/sales', { method: 'POST', body: JSON.stringify(payload) }),

  getDashboardReport: (includeDemo = true) =>
    request<{
      today: DailySalesSummary;
      lowStockCount: number;
      lowStockProducts: Product[];
      totalProducts: number;
      trend: { date: string; sales: number; profit: number; bills: number }[];
      recentInvoices: Sale[];
    }>(`/api/reports/dashboard?includeDemo=${includeDemo ? '1' : '0'}`),

  getDailyReport: (date: string, includeDemo = true) =>
    request<{
      summary: DailySalesSummary;
      hourly: { hour: string; sales: number; profit: number; bills: number }[];
    }>(`/api/reports/daily?date=${encodeURIComponent(date)}&includeDemo=${includeDemo ? '1' : '0'}`),

  getMonthlyReport: (month: string, includeDemo = true) =>
    request<{
      months: MonthlySummary[];
      selectedMonth: string;
      dailyBreakdown: {
        date: string;
        total_sales: number;
        total_purchase_cost: number;
        gross_profit: number;
        discounts: number;
        bill_count: number;
      }[];
      expensesEnabled: boolean;
    }>(`/api/reports/monthly?month=${encodeURIComponent(month)}&includeDemo=${includeDemo ? '1' : '0'}`),

  getExpenses: (month?: string, includeDemo = true) => {
    const q = new URLSearchParams();
    if (month) q.set('month', month);
    if (!includeDemo) q.set('includeDemo', '0');
    return request<Expense[]>(`/api/expenses?${q.toString()}`);
  },
  createExpense: (payload: { title: string; category: string; amount: number; expense_date: string; note?: string }) =>
    request<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  deleteExpense: (id: number) => request<{ deleted: boolean }>(`/api/expenses/${id}`, { method: 'DELETE' }),

  getExportPreview: (startDate: string, endDate: string, includeDemo = true) =>
    request<{
      startDate: string;
      endDate: string;
      invoiceCount: number;
      lineItemCount: number;
      totalSales: number;
      totalProfit: number;
      sampleRows: Record<string, unknown>[];
    }>(`/api/export/preview?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&includeDemo=${includeDemo ? '1' : '0'}`),
};
