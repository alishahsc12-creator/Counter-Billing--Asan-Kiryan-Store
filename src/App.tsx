import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings as SettingsIcon,
  Store,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { Customer, NavTab, Product, Sale, ShopSettings } from './types';
import { api } from './lib/api';
import { DashboardScreen } from './screens/DashboardScreen';
import { BillingCounterScreen } from './screens/BillingCounterScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { TodaySalesScreen } from './screens/TodaySalesScreen';
import { PreviousSalesScreen } from './screens/PreviousSalesScreen';
import { MonthlyReportsScreen } from './screens/MonthlyReportsScreen';
import { ExcelExportScreen } from './screens/ExcelExportScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { InvoiceModal } from './components/InvoiceModal';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'billing', label: 'Billing Counter', icon: Receipt },
  { id: 'products', label: 'Products & Stock', icon: Package },
  { id: 'customers', label: 'Customers & Udhaar', icon: Users },
  { id: 'today_sales', label: "Today's Sales", icon: BarChart3 },
  { id: 'previous_sales', label: 'Previous Sales', icon: History },
  { id: 'monthly_reports', label: 'Monthly Reports', icon: CalendarClock },
  { id: 'excel_export', label: 'Excel Export', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: 'Al-Madina Asan Kiryana Store',
  shop_address: 'Main Bazaar, Lahore, Pakistan',
  shop_phone: '0300-1234567',
  invoice_footer: 'Shukriya! Dobara tashreef laayein.',
  expense_management_enabled: true,
  demo_data_present: false,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('billing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('asan_kiryana_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof api.getDashboardReport>> | null>(null);
  const [loadingCore, setLoadingCore] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [activeInvoiceModal, setActiveInvoiceModal] = useState<{ sale: Sale; isConfirmation: boolean } | null>(null);
  const [lastSavedSale, setLastSavedSale] = useState<Sale | null>(null);
  const [clearingDemo, setClearingDemo] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('asan_kiryana_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage failure
    }
  }, [darkMode]);

  const refreshAll = useCallback(async () => {
    try {
      const [sett, prodList, custList, dash] = await Promise.all([
        api.getSettings(),
        api.getProducts({ includeArchived: true }),
        api.getCustomers(),
        api.getDashboardReport(true),
      ]);
      setSettings(sett);
      setProducts(prodList);
      setCustomers(custList);
      setDashboardData(dash);
      setRefreshTick((t) => t + 1);
    } finally {
      setLoadingCore(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleOpenInvoiceById = async (saleId: number) => {
    try {
      const fullSale = await api.getSaleById(saleId);
      setActiveInvoiceModal({ sale: fullSale, isConfirmation: false });
    } catch {
      // ignore
    }
  };

  const handleSaleCompleted = async (sale: Sale) => {
    setLastSavedSale(sale);
    setActiveInvoiceModal({ sale, isConfirmation: true });
    await refreshAll();
  };

  const handleClearDemoBanner = async () => {
    setClearingDemo(true);
    try {
      await api.clearDemoData();
      await refreshAll();
    } finally {
      setClearingDemo(false);
    }
  };

  const lowStockCount = dashboardData?.lowStockCount ?? 0;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Dark Navy) */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-[#0b1528] text-slate-100 border-r border-slate-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm tracking-tight text-white truncate">
                ASAN KIRYANA
              </div>
              <div className="text-[11px] text-emerald-400 font-medium truncate">Counter Billing POS</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'products' && lowStockCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-bold">
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/90 space-y-3">
          <div className="text-xs text-slate-400 truncate">{settings.shop_name}</div>
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
            {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
              COUNTER BILLING – ASAN KIRYANA
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeTab !== 'billing' && (
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
              >
                <Receipt className="w-4 h-4" />
                Billing Counter
              </button>
            )}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Toggle light/dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Demo Data Notice Banner */}
        {settings.demo_data_present && (
          <div className="no-print bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              <strong>DEMO DATA ACTIVE:</strong> Sample 3-day Kiryana records (20 products, 8 customers, 15 invoices) are labeled <strong>DEMO</strong>. Your real bills remain separate.
            </span>
            <button
              type="button"
              disabled={clearingDemo}
              onClick={handleClearDemoBanner}
              className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300 hover:underline whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingDemo ? 'Removing...' : 'Remove Demo Data'}
            </button>
          </div>
        )}

        {/* Active Screen Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardScreen
              data={dashboardData}
              loading={loadingCore}
              onNavigate={setActiveTab}
              onViewInvoice={handleOpenInvoiceById}
            />
          )}

          {activeTab === 'billing' && (
            <BillingCounterScreen
              products={products}
              customers={customers}
              lastSavedSale={lastSavedSale}
              onSaleCompleted={handleSaleCompleted}
              onCustomerCreated={() => refreshAll()}
              onReprintSale={(sale) => setActiveInvoiceModal({ sale, isConfirmation: false })}
            />
          )}

          {activeTab === 'products' && <ProductsScreen products={products} onRefresh={refreshAll} />}

          {activeTab === 'customers' && (
            <CustomersScreen customers={customers} settings={settings} onRefresh={refreshAll} />
          )}

          {activeTab === 'today_sales' && (
            <TodaySalesScreen
              settings={settings}
              onViewInvoice={handleOpenInvoiceById}
              refreshTrigger={refreshTick}
            />
          )}

          {activeTab === 'previous_sales' && (
            <PreviousSalesScreen settings={settings} onViewInvoice={handleOpenInvoiceById} />
          )}

          {activeTab === 'monthly_reports' && <MonthlyReportsScreen refreshTrigger={refreshTick} />}

          {activeTab === 'excel_export' && <ExcelExportScreen />}

          {activeTab === 'settings' && <SettingsScreen settings={settings} onUpdated={refreshAll} />}
        </main>
      </div>

      {/* Invoice Confirmation / Print / PDF / WhatsApp Modal */}
      <InvoiceModal
        sale={activeInvoiceModal?.sale ?? null}
        settings={settings}
        isConfirmation={activeInvoiceModal?.isConfirmation ?? false}
        onClose={() => setActiveInvoiceModal(null)}
      />
    </div>
  );
}
