import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { CartItem, Customer, PaymentMethod, Product, Sale } from '../types';
import { formatQty, formatRs } from '../lib/format';
import { api } from '../lib/api';
import { ProductThumb } from '../components/ProductThumb';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface BillingCounterScreenProps {
  products: Product[];
  customers: Customer[];
  lastSavedSale: Sale | null;
  onSaleCompleted: (sale: Sale) => void;
  onCustomerCreated: (customer: Customer) => void;
  onReprintSale: (sale: Sale) => void;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BillingCounterScreen({
  products,
  customers,
  lastSavedSale,
  onSaleCompleted,
  onCustomerCreated,
  onReprintSale,
}: BillingCounterScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [amountReceivedInput, setAmountReceivedInput] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => makeIdempotencyKey());
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Quick Add Customer Modal inside Counter
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const scannerBufferRef = useRef<string>('');

  const activeProducts = useMemo(() => products.filter((p) => p.is_archived === 0), [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of activeProducts) set.add(p.category || 'General');
    return ['All', ...Array.from(set).sort()];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [activeProducts, search, selectedCategory]);

  // Global USB Barcode Scanner listener (rapid keystrokes ending in Enter when not typing in another field)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInput) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 80) {
        scannerBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = scannerBufferRef.current.trim();
        scannerBufferRef.current = '';
        if (code.length >= 3) {
          addProductByBarcodeOrCode(code);
        }
      } else if (e.key.length === 1) {
        scannerBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const addToCart = (product: Product, addQty = 1) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (product.current_stock <= 0) {
      setErrorMsg(`"${product.name}" is out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        const nextQty = Math.round((existing.quantity + addQty) * 1000) / 1000;
        if (nextQty > product.current_stock + 0.0001) {
          setErrorMsg(`Only ${formatQty(product.current_stock, product.unit)} of "${product.name}" available in stock.`);
          return prev;
        }
        return prev.map((c) => (c.product.id === product.id ? { ...c, quantity: nextQty } : c));
      }
      const initialQty = Math.min(addQty, product.current_stock);
      return [...prev, { product, quantity: Math.round(initialQty * 1000) / 1000 }];
    });
  };

  const addProductByBarcodeOrCode = (code: string) => {
    const clean = code.trim().toLowerCase();
    const match = activeProducts.find(
      (p) => p.barcode.toLowerCase() === clean || p.product_code.toLowerCase() === clean
    );
    if (match) {
      addToCart(match, 1);
      setSearch('');
    } else {
      setErrorMsg(`No product found with barcode or code "${code}".`);
    }
  };

  const updateCartQty = (productId: number, rawValue: string) => {
    setErrorMsg('');
    if (rawValue === '') {
      setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, quantity: 0 } : c)));
      return;
    }
    const val = Number(rawValue);
    if (!Number.isFinite(val) || val < 0) return;

    const item = cart.find((c) => c.product.id === productId);
    if (!item) return;

    if (val > item.product.current_stock + 0.0001) {
      setErrorMsg(`Maximum available stock for "${item.product.name}" is ${formatQty(item.product.current_stock, item.product.unit)}.`);
      return;
    }

    setCart((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity: Math.round(val * 1000) / 1000 } : c))
    );
  };

  const stepCartQty = (productId: number, delta: number) => {
    setErrorMsg('');
    const item = cart.find((c) => c.product.id === productId);
    if (!item) return;
    const next = Math.round((item.quantity + delta) * 1000) / 1000;
    if (next <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      return;
    }
    if (next > item.product.current_stock + 0.0001) {
      setErrorMsg(`Only ${formatQty(item.product.current_stock, item.product.unit)} available in stock.`);
      return;
    }
    setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, quantity: next } : c)));
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('0');
    setAmountReceivedInput('');
    setPaymentMethod('Cash');
    setSelectedCustomerId('');
    setNotes('');
    setErrorMsg('');
    setIdempotencyKey(makeIdempotencyKey());
  };

  const subtotal = useMemo(
    () => Math.round(cart.reduce((sum, item) => sum + item.product.sales_price * item.quantity, 0) * 100) / 100,
    [cart]
  );

  const discount = Math.max(0, Math.round((Number(discountInput) || 0) * 100) / 100);
  const grandTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  const parsedReceived = amountReceivedInput === '' ? (paymentMethod === 'Cash' ? grandTotal : 0) : Math.max(0, Number(amountReceivedInput) || 0);

  const remainingBalance =
    paymentMethod === 'Cash'
      ? 0
      : paymentMethod === 'Udhaar'
        ? grandTotal
        : Math.max(0, Math.round((grandTotal - parsedReceived) * 100) / 100);

  const changeDue =
    paymentMethod === 'Cash' && parsedReceived > grandTotal
      ? Math.round((parsedReceived - grandTotal) * 100) / 100
      : 0;

  const handleSaveBill = async () => {
    if (saving) return; // Prevent duplicate click
    setErrorMsg('');
    setSuccessMsg('');

    const validItems = cart.filter((c) => c.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one product with quantity greater than 0.');
      return;
    }
    if (discount > subtotal) {
      setErrorMsg(`Discount (${formatRs(discount)}) cannot exceed subtotal (${formatRs(subtotal)}).`);
      return;
    }
    if ((paymentMethod === 'Udhaar' || paymentMethod === 'Partial') && !selectedCustomerId) {
      setErrorMsg(`Please select a customer for ${paymentMethod} billing.`);
      return;
    }
    if (paymentMethod === 'Cash' && amountReceivedInput !== '' && parsedReceived < grandTotal) {
      setErrorMsg('Cash received is less than Grand Total. Switch to Partial or Udhaar if credit is given.');
      return;
    }
    if (paymentMethod === 'Partial' && (parsedReceived <= 0 || parsedReceived >= grandTotal)) {
      setErrorMsg('For Partial payment, enter an amount greater than Rs. 0 and less than Grand Total.');
      return;
    }

    setSaving(true);
    try {
      const paidForApi =
        paymentMethod === 'Cash' ? grandTotal : paymentMethod === 'Udhaar' ? 0 : Math.round(parsedReceived * 100) / 100;

      const res = await api.createSale({
        idempotencyKey,
        items: validItems.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        discount,
        paymentMethod,
        paidAmount: paidForApi,
        customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
        notes,
      });

      clearCart();
      setSuccessMsg(`Invoice ${res.sale.invoice_number} saved (${formatRs(res.sale.grand_total)}).`);
      onSaleCompleted(res.sale);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    setCreatingCustomer(true);
    try {
      const created = await api.createCustomer({
        name: newCustName.trim(),
        mobile: newCustMobile.trim(),
        address: newCustAddress.trim(),
        opening_balance: 0,
      });
      onCustomerCreated(created);
      setSelectedCustomerId(created.id);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustAddress('');
      setAddCustomerOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* LEFT: Product Search & Quick Tap Grid */}
      <div className="xl:col-span-7 space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    e.preventDefault();
                    const exact = activeProducts.find(
                      (p) =>
                        p.barcode.toLowerCase() === search.trim().toLowerCase() ||
                        p.product_code.toLowerCase() === search.trim().toLowerCase()
                    );
                    if (exact) {
                      addToCart(exact, 1);
                      setSearch('');
                    } else if (filteredProducts.length === 1) {
                      addToCart(filteredProducts[0], 1);
                      setSearch('');
                    }
                  }
                }}
                placeholder="Search product name, barcode, or code (Press / to focus)..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              Scan Barcode
            </button>

            {lastSavedSale && (
              <button
                type="button"
                onClick={() => onReprintSale(lastSavedSale)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
              >
                <Printer className="w-4 h-4 text-emerald-600" />
                Reprint {lastSavedSale.invoice_number}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ScanBarcode className="w-3.5 h-3.5 text-emerald-600" />
              USB barcode scanner ready · Press Enter on exact barcode to auto-add
            </span>
            <span>{filteredProducts.length} items shown</span>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching products found.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const outOfStock = product.current_stock <= 0;
              const lowStock = !outOfStock && product.current_stock <= product.min_stock;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(product, 1)}
                  className={`text-left rounded-xl border p-2.5 transition-all flex flex-col gap-2 ${
                    outOfStock
                      ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40'
                      : lowStock
                        ? 'border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 hover:border-emerald-600 hover:shadow-xs active:scale-[0.99]'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-600 hover:shadow-xs active:scale-[0.99]'
                  }`}
                >
                  <ProductThumb name={product.name} imageData={product.image_data} category={product.category} size="card" />
                  <div className="min-w-0 w-full flex-1 flex flex-col justify-between">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                      {product.name}
                    </div>
                    <div className="mt-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatRs(product.sales_price)}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">/{product.unit}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-mono text-slate-400 truncate">{product.product_code || product.barcode}</span>
                        <span
                          className={`font-medium tabular-nums shrink-0 ${
                            outOfStock || lowStock ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {outOfStock ? 'Out' : formatQty(product.current_stock, product.unit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Billing Cart & Payment Panel */}
      <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span className="font-display font-semibold text-sm">Current Bill Cart</span>
            <span className="text-xs text-slate-300 font-mono">({cart.length} items)</span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cart Line Items */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
          {cart.length === 0 ? (
            <div className="py-12 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Tap a product or scan a barcode to start billing.
            </div>
          ) : (
            cart.map(({ product: cartProduct, quantity }) => {
              const product = activeProducts.find((p) => p.id === cartProduct.id) ?? cartProduct;
              const lineTotal = Math.round(product.sales_price * quantity * 100) / 100;
              const isDecimalUnit = ['Kg', 'Gram', 'Liter'].includes(product.unit);
              const step = isDecimalUnit ? 0.5 : 1;

              return (
                <div key={product.id} className="px-4 py-3 flex items-center gap-3">
                  <ProductThumb name={product.name} imageData={product.image_data} category={product.category} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {formatRs(product.sales_price)} / {product.unit}
                    </div>
                  </div>

                  {/* Qty Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => stepCartQty(product.id, -step)}
                      className="w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step={isDecimalUnit ? '0.05' : '1'}
                      value={quantity === 0 ? '' : quantity}
                      onChange={(e) => updateCartQty(product.id, e.target.value)}
                      className="w-16 h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => stepCartQty(product.id, step)}
                      className="w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Subtotal + Remove */}
                  <div className="w-24 text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatRs(lineTotal)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(product.id)}
                    aria-label="Remove item"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Payment Section */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3.5">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="font-mono font-semibold tabular-nums">{formatRs(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="bill-discount" className="text-slate-600 dark:text-slate-300">
                Discount (Rs.)
              </label>
              <input
                id="bill-discount"
                type="number"
                min="0"
                step="1"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-right font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-base text-slate-900 dark:text-slate-100">Grand Total</span>
              <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatRs(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'Partial', 'Udhaar'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method === 'Udhaar') setAmountReceivedInput('0');
                    if (method === 'Cash') setAmountReceivedInput('');
                    if (method === 'Partial' && amountReceivedInput === '') setAmountReceivedInput('');
                  }}
                  className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    paymentMethod === method
                      ? method === 'Udhaar'
                        ? 'bg-rose-700 border-rose-700 text-white'
                        : 'bg-emerald-700 border-emerald-700 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="billing-customer" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Customer {paymentMethod === 'Cash' ? '(Optional)' : '(Required for Credit)'}
              </label>
              <button
                type="button"
                onClick={() => setAddCustomerOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                New Customer
              </button>
            </div>
            <select
              id="billing-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ''} — Bal: {formatRs(c.remaining_balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Received */}
          {paymentMethod !== 'Udhaar' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="amount-received" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Amount Received (Rs.)
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmountReceivedInput(String(grandTotal))}
                    className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                  >
                    Exact
                  </button>
                  {[500, 1000, 5000].map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setAmountReceivedInput(String(note))}
                      className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="amount-received"
                type="number"
                min="0"
                step="1"
                placeholder={paymentMethod === 'Cash' ? String(grandTotal) : 'Enter partial cash received'}
                value={amountReceivedInput}
                onChange={(e) => setAmountReceivedInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          {/* Balance Summary */}
          <div className="flex items-center justify-between text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
            {changeDue > 0 ? (
              <>
                <span className="text-slate-600 dark:text-slate-300 font-medium">Return Change to Customer</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatRs(changeDue)}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-600 dark:text-slate-300 font-medium">Remaining Udhaar Balance</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    remainingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {formatRs(remainingBalance)}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={saving || cart.length === 0}
            onClick={handleSaveBill}
            className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold text-base shadow-sm transition-colors"
          >
            {saving ? 'Saving Bill...' : `SAVE BILL · ${formatRs(grandTotal)}`}
          </button>
        </div>
      </div>

      {/* Camera Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={addProductByBarcodeOrCode}
      />

      {/* Quick Add Customer Modal */}
      {addCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleQuickCreateCustomer}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl"
          >
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
              Quick Add Customer
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. Haji Muhammad Yousuf"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                value={newCustMobile}
                onChange={(e) => setNewCustMobile(e.target.value)}
                placeholder="0300-1234567"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Address
              </label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="Mohalla / Street"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddCustomerOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingCustomer}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
              >
                {creatingCustomer ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
