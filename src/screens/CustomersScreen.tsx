import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Edit3,
  MessageCircle,
  Printer,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Customer, CustomerLedgerEntry, ShopSettings } from '../types';
import { formatDisplayDateTime, formatRs, sanitizeMobileForWhatsApp } from '../lib/format';
import { api } from '../lib/api';

interface CustomersScreenProps {
  customers: Customer[];
  settings: ShopSettings;
  onRefresh: () => void;
}

export function CustomersScreen({ customers, settings, onRefresh }: CustomersScreenProps) {
  const [search, setSearch] = useState('');
  const [onlyUdhaar, setOnlyUdhaar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [savingForm, setSavingForm] = useState(false);

  // Selected Customer Ledger Drawer/View
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Payment / Give Udhaar Modal
  const [txModalMode, setTxModalMode] = useState<'payment' | 'udhaar' | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [savingTx, setSavingTx] = useState(false);

  const totalOutstandingUdhaar = useMemo(
    () => Math.round(customers.reduce((sum, c) => sum + Number(c.remaining_balance || 0), 0) * 100) / 100,
    [customers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (onlyUdhaar && c.remaining_balance <= 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, search, onlyUdhaar]);

  const openCustomerLedger = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setLoadingLedger(true);
    setErrorMsg('');
    try {
      const res = await api.getCustomerDetail(cust.id);
      setSelectedCustomer(res.customer);
      setLedger(res.ledger);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load customer ledger.');
    } finally {
      setLoadingLedger(false);
    }
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setName('');
    setMobile('');
    setAddress('');
    setOpeningBalance('0');
    setErrorMsg('');
    setFormOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setMobile(c.mobile);
    setAddress(c.address);
    setOpeningBalance(String(c.opening_balance));
    setErrorMsg('');
    setFormOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavingForm(true);
    try {
      if (editingCustomer) {
        const updated = await api.updateCustomer(editingCustomer.id, {
          name: name.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
        });
        if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated);
      } else {
        const created = await api.createCustomer({
          name: name.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          opening_balance: Number(openingBalance) || 0,
        });
        await openCustomerLedger(created);
      }
      setFormOpen(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save customer.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !txModalMode) return;
    setErrorMsg('');
    const amt = Number(txAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg('Please enter an amount greater than Rs. 0.');
      return;
    }

    setSavingTx(true);
    try {
      const res =
        txModalMode === 'payment'
          ? await api.receiveCustomerPayment(selectedCustomer.id, amt, txNote.trim() || 'Payment Received')
          : await api.giveCustomerUdhaar(selectedCustomer.id, amt, txNote.trim() || 'Manual Udhaar Given');
      setSelectedCustomer(res.customer);
      setLedger(res.ledger);
      setTxModalMode(null);
      setTxAmount('');
      setTxNote('');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setSavingTx(false);
    }
  };

  const getWhatsAppReminderUrl = (cust: Customer) => {
    const msg = `Assalam-o-Alaikum ${cust.name}, this is a gentle reminder from ${settings.shop_name}. Your remaining Udhaar Khata balance is ${formatRs(cust.remaining_balance)}. Shukriya!`;
    const phone = cust.mobile ? sanitizeMobileForWhatsApp(cust.mobile) : '';
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-5">
      {/* Header + Prominent Total Udhaar Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Customers &amp; Udhaar Khata
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Digital shop Khata · Track credit sales, receive payments, print statements, and send WhatsApp reminders
          </p>
        </div>

        <button
          type="button"
          onClick={openAddCustomer}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-xs whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Total Outstanding Udhaar Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-slate-300 font-medium">Total Outstanding Market Udhaar</div>
            <div className="font-mono text-3xl font-bold text-white tabular-nums mt-0.5">
              {formatRs(totalOutstandingUdhaar)}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-300 space-y-1">
          <div>{customers.length} registered customers</div>
          <div>{customers.filter((c) => c.remaining_balance > 0).length} customers with pending balance</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Customer Directory */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer name or mobile..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUdhaar}
                  onChange={(e) => setOnlyUdhaar(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Show customers with Udhaar balance only
              </label>
              <span className="text-slate-400">{filtered.length} shown</span>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No customers found.
              </div>
            ) : (
              filtered.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => openCustomerLedger(cust)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openCustomerLedger(cust)}
                    className={`cursor-pointer p-4 transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/35'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {cust.name}
                        {cust.is_demo === 1 && (
                          <span className="ml-2 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {cust.mobile || 'No mobile'} {cust.address ? `· ${cust.address}` : ''}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono text-sm font-bold tabular-nums ${
                          cust.remaining_balance > 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatRs(cust.remaining_balance)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {cust.remaining_balance > 0 ? 'Remaining' : 'Settled'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Customer Detail & Khata Ledger */}
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {!selectedCustomer ? (
            <div className="py-24 px-6 text-center text-slate-500 dark:text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <div className="font-display font-semibold text-slate-700 dark:text-slate-300">
                Select a customer to open their Khata Ledger
              </div>
              <p className="text-xs mt-1">
                View debit/credit history, receive partial or full payments, give Udhaar, or print statements.
              </p>
            </div>
          ) : (
            <div className="print-a4">
              {/* Customer Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                        {selectedCustomer.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => openEditCustomer(selectedCustomer)}
                        className="no-print p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Edit Customer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedCustomer.mobile || 'No phone'} {selectedCustomer.address ? `· ${selectedCustomer.address}` : ''}
                    </p>
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTxModalMode('udhaar');
                        setTxAmount('');
                        setTxNote('');
                        setErrorMsg('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Give Udhaar
                    </button>
                    <button
                      type="button"
                      disabled={selectedCustomer.remaining_balance <= 0}
                      onClick={() => {
                        setTxModalMode('payment');
                        setTxAmount(String(selectedCustomer.remaining_balance));
                        setTxNote('');
                        setErrorMsg('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Receive Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Ledger
                    </button>
                    <a
                      href={getWhatsAppReminderUrl(selectedCustomer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Reminder
                    </a>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-[11px] text-slate-500">Opening Balance</div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {formatRs(selectedCustomer.opening_balance)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-[11px] text-slate-500">Total Udhaar</div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                      {formatRs(selectedCustomer.total_udhaar)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-[11px] text-slate-500">Total Paid</div>
                    <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                      {formatRs(selectedCustomer.total_paid)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3">
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">Remaining Balance</div>
                    <div className="font-mono text-sm font-bold text-rose-700 dark:text-rose-300 tabular-nums mt-0.5">
                      {formatRs(selectedCustomer.remaining_balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                {loadingLedger ? (
                  <div className="p-8 text-center text-sm text-slate-500">Loading ledger entries...</div>
                ) : ledger.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No transactions recorded yet for this customer.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                        <th className="px-4 py-3 font-semibold">Invoice #</th>
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 font-semibold text-right">Debit (Udhaar)</th>
                        <th className="px-4 py-3 font-semibold text-right">Credit (Paid)</th>
                        <th className="px-4 py-3 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {ledger.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDisplayDateTime(row.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                            {row.invoice_number || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{row.description}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                            {row.debit > 0 ? formatRs(row.debit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {row.credit > 0 ? formatRs(row.credit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatRs(row.balance_after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            {!editingCustomer && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Opening Udhaar Balance (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
              >
                {savingForm ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receive Payment / Give Udhaar Modal */}
      {txModalMode && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <form
            onSubmit={handleSaveTx}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                {txModalMode === 'payment' ? 'Receive Udhaar Payment' : 'Give Manual Udhaar'}
              </h3>
              <button type="button" onClick={() => setTxModalMode(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono">
                Current Remaining Balance: {formatRs(selectedCustomer.remaining_balance)}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Amount (Rs.) *</label>
                {txModalMode === 'payment' && selectedCustomer.remaining_balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setTxAmount(String(selectedCustomer.remaining_balance))}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Full Balance ({formatRs(selectedCustomer.remaining_balance)})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description / Note
              </label>
              <input
                type="text"
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder={txModalMode === 'payment' ? 'e.g. Cash received at counter' : 'e.g. Cash advance / Credit items'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxModalMode(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTx}
                className={`px-4 py-2 rounded-lg text-white text-sm font-semibold ${
                  txModalMode === 'payment' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {savingTx ? 'Saving...' : txModalMode === 'payment' ? 'Save Payment' : 'Save Udhaar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
