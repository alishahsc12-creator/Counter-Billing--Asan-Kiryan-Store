import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Edit3,
  History,
  ImagePlus,
  Loader2,
  PackagePlus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Product, ProductUnit, StockMovement } from '../types';
import { compressProductImage, formatDisplayDateTime, formatQty, formatRs } from '../lib/format';
import { api } from '../lib/api';
import { ProductThumb } from '../components/ProductThumb';

interface ProductsScreenProps {
  products: Product[];
  onRefresh: () => void;
}

const UNITS: ProductUnit[] = ['Piece', 'Packet', 'Box', 'Kg', 'Gram', 'Liter'];
const CATEGORIES = [
  'Sugar & Salt',
  'Rice & Flour',
  'Oil & Ghee',
  'Tea & Milk',
  'Pulses',
  'Spices',
  'Biscuits & Drinks',
  'Soap & Detergent',
  'Personal Care',
  'General',
];

export function ProductsScreen({ products, onRefresh }: ProductsScreenProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'archived'>('all');
  const [errorMsg, setErrorMsg] = useState('');

  // Add / Edit Product Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('General');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [unit, setUnit] = useState<ProductUnit>('Piece');
  const [imageData, setImageData] = useState('');
  const [savingForm, setSavingForm] = useState(false);
  const [fetchingAutoImg, setFetchingAutoImg] = useState(false);
  const [autoSkipIdx, setAutoSkipIdx] = useState(0);
  const [batchAssigning, setBatchAssigning] = useState(false);

  // Stock Adjustment Modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockActionType, setStockActionType] = useState<'add' | 'remove'>('add');
  const [stockDelta, setStockDelta] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Stock History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState('All Stock History');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.is_archived === 0 && p.current_stock <= p.min_stock).length,
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filterMode === 'all' && p.is_archived === 1) return false;
      if (filterMode === 'low' && (p.is_archived === 1 || p.current_stock > p.min_stock)) return false;
      if (filterMode === 'archived' && p.is_archived === 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, filterMode]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setBarcode('');
    setProductCode('');
    setCategory('General');
    setPurchasePrice('');
    setSalesPrice('');
    setCurrentStock('0');
    setMinStock('5');
    setUnit('Piece');
    setImageData('');
    setAutoSkipIdx(0);
    setErrorMsg('');
    setFormOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setBarcode(p.barcode);
    setProductCode(p.product_code);
    setCategory(p.category || 'General');
    setPurchasePrice(String(p.purchase_price));
    setSalesPrice(String(p.sales_price));
    setCurrentStock(String(p.current_stock));
    setMinStock(String(p.min_stock));
    setUnit(p.unit);
    setImageData(p.image_data || '');
    setAutoSkipIdx(0);
    setErrorMsg('');
    setFormOpen(true);
  };

  const [dragActive, setDragActive] = useState(false);

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg('');
    try {
      const compressed = await compressProductImage(file);
      setImageData(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process product image.');
    }
  };

  const handleAutoFetchImage = async (nextMatch = false) => {
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Enter the Product Name first so we can fetch its matching pack image.');
      return;
    }
    setErrorMsg('');
    setFetchingAutoImg(true);
    const nextIdx = nextMatch ? autoSkipIdx + 1 : 0;
    try {
      const res = await api.previewAutoProductImage(cleanName, category, nextIdx);
      setImageData(res.image_data);
      setAutoSkipIdx(nextIdx);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to auto-fetch product image.');
    } finally {
      setFetchingAutoImg(false);
    }
  };

  const missingImageCount = useMemo(
    () => products.filter((p) => p.is_archived === 0 && (!p.image_data || !p.image_data.trim())).length,
    [products]
  );

  const handleBatchAutoAssign = async () => {
    setErrorMsg('');
    setBatchAssigning(true);
    try {
      await api.autoAssignProductImages(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to auto-assign missing images.');
    } finally {
      setBatchAssigning(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavingForm(true);
    try {
      const payload = {
        name: name.trim(),
        barcode: barcode.trim(),
        product_code: productCode.trim(),
        category,
        purchase_price: Number(purchasePrice),
        sales_price: Number(salesPrice),
        current_stock: Number(currentStock),
        min_stock: Number(minStock),
        unit,
        image_data: imageData,
      };
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setFormOpen(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    setErrorMsg('');
    const qty = Number(stockDelta);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Enter a positive quantity.');
      return;
    }
    const signedDelta = stockActionType === 'add' ? qty : -qty;
    setSavingStock(true);
    try {
      await api.adjustStock(stockModalProduct.id, signedDelta, stockNote.trim());
      setStockModalProduct(null);
      setStockDelta('');
      setStockNote('');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to adjust stock.');
    } finally {
      setSavingStock(false);
    }
  };

  const handleOpenHistory = async (product?: Product) => {
    setHistoryTitle(product ? `Stock History · ${product.name}` : 'Recent Stock Movements');
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const rows = await api.getStockMovements(product?.id);
      setMovements(rows);
    } catch {
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleArchiveOrDelete = async (p: Product) => {
    setErrorMsg('');
    try {
      await api.deleteProduct(p.id);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove product.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Products &amp; Stock Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage prices, upload product images, track inventory, and monitor low-stock alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {missingImageCount > 0 && (
            <button
              type="button"
              disabled={batchAssigning}
              onClick={handleBatchAutoAssign}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-sm font-semibold whitespace-nowrap disabled:opacity-60"
            >
              {batchAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {batchAssigning ? 'Fetching Images...' : `Auto-Match Missing Images (${missingImageCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleOpenHistory()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
          >
            <History className="w-4 h-4 text-slate-500" />
            Stock History
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-xs whitespace-nowrap"
          >
            <PackagePlus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Low Stock Alert Strip */}
      {lowStockCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
          <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-200 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>
              <strong>LOW STOCK WARNING:</strong> {lowStockCount} {lowStockCount === 1 ? 'product has' : 'products have'} reached or fallen below minimum stock level.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'low' ? 'all' : 'low')}
            className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold whitespace-nowrap"
          >
            {filterMode === 'low' ? 'Show All Products' : 'Filter Low Stock'}
          </button>
        </div>
      )}

      {errorMsg && !formOpen && !stockModalProduct && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Search & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, barcode, code, or category..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-md ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Active ({products.filter((p) => p.is_archived === 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('low')}
            className={`px-3 py-1.5 rounded-md ${
              filterMode === 'low'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Low Stock ({lowStockCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('archived')}
            className={`px-3 py-1.5 rounded-md ${
              filterMode === 'archived'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Archived ({products.filter((p) => p.is_archived === 1).length})
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Barcode / Code</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Purchase Price</th>
                <th className="px-4 py-3 font-semibold text-right">Sales Price</th>
                <th className="px-4 py-3 font-semibold text-right">Current Stock</th>
                <th className="px-4 py-3 font-semibold text-right">Min Stock</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No products match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.is_archived === 0 && p.current_stock <= p.min_stock;
                  return (
                    <tr
                      key={p.id}
                      className={
                        isLow
                          ? 'bg-rose-50/80 dark:bg-rose-950/35 hover:bg-rose-100/70 dark:hover:bg-rose-950/50'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb name={p.name} imageData={p.image_data} category={p.category} size="md" />
                          <div>
                            <div className={`font-semibold ${isLow ? 'text-rose-950 dark:text-rose-100' : 'text-slate-900 dark:text-slate-100'}`}>
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Unit: {p.unit}
                              {p.is_demo === 1 ? ' · DEMO' : ''}
                              {isLow && (
                                <span className="ml-2 font-bold text-rose-700 dark:text-rose-300">
                                  · LOW STOCK
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        <div>{p.barcode || '—'}</div>
                        <div className="text-slate-400">{p.product_code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.category}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatRs(p.purchase_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatRs(p.sales_price)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${
                          isLow ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatQty(p.current_stock, p.unit)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatQty(p.min_stock, p.unit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {p.is_archived === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockModalProduct(p);
                                setStockActionType('add');
                                setStockDelta('');
                                setStockNote('');
                                setErrorMsg('');
                              }}
                              title="Update Stock"
                              className="px-2.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                            >
                              Stock
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(p)}
                            title="View Stock History"
                            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {p.is_archived === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleArchiveOrDelete(p)}
                              title="Archive or Delete Product"
                              className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await api.updateProduct(p.id, { is_archived: 0 });
                                onRefresh();
                              }}
                              title="Restore Product"
                              className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                            >
                              <Archive className="w-3.5 h-3.5 inline mr-1" />
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                {editingProduct ? `Edit Product · ${editingProduct.name}` : 'Add New Kiryana Product'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Image Upload Block */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleImageFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
                  dragActive
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60'
                }`}
              >
                <ProductThumb name={name || 'Product'} imageData={imageData} category={category} size="lg" />
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Product Pack Photo
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload a photo or auto-fetch an exact matching pack image by product name. Leaving this empty will automatically fetch a matching image on save.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5" />
                      {imageData ? 'Change Image' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handleImageFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={fetchingAutoImg}
                      onClick={() => handleAutoFetchImage(Boolean(imageData))}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold disabled:opacity-60"
                    >
                      {fetchingAutoImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {fetchingAutoImg ? 'Finding...' : imageData ? 'Next Match' : 'Auto-Find Image'}
                    </button>
                    {imageData && (
                      <button
                        type="button"
                        onClick={() => setImageData('')}
                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tapal Danedar Tea 190g"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Product Code
                  </label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Unit *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ProductUnit)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Purchase Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Sales Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={salesPrice}
                    onChange={(e) => setSalesPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Opening Current Stock ({unit}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      required
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Minimum Stock Alert Level ({unit}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
              >
                {savingForm ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Update Stock Modal */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <form
            onSubmit={handleSaveStock}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Update Stock
              </h3>
              <button
                type="button"
                onClick={() => setStockModalProduct(null)}
                className="p-1 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
              <ProductThumb name={stockModalProduct.name} imageData={stockModalProduct.image_data} size="sm" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stockModalProduct.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Current Stock: {formatQty(stockModalProduct.current_stock, stockModalProduct.unit)}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStockActionType('add')}
                className={`py-2 rounded-lg text-sm font-semibold border ${
                  stockActionType === 'add'
                    ? 'bg-emerald-700 border-emerald-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                + Add Stock
              </button>
              <button
                type="button"
                onClick={() => setStockActionType('remove')}
                className={`py-2 rounded-lg text-sm font-semibold border ${
                  stockActionType === 'remove'
                    ? 'bg-rose-700 border-rose-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                - Reduce Stock
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantity ({stockModalProduct.unit}) *
              </label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                placeholder="Enter quantity"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder="e.g. New supplier delivery / Damaged"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStockModalProduct(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStock}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
              >
                {savingStock ? 'Updating...' : 'Save Stock Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Movement History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-display font-bold text-slate-900 dark:text-slate-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>{historyTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading stock movements...</div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No stock movement records found.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Date &amp; Time</th>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5 text-right">Change</th>
                      <th className="px-4 py-2.5 text-right">Before → After</th>
                      <th className="px-4 py-2.5">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                          {formatDisplayDateTime(m.created_at)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{m.product_name}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">{m.movement_type}</td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums ${
                            m.change_qty > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {m.previous_stock} → {m.new_stock}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{m.note || m.reference_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
