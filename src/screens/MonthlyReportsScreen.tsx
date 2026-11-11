import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Expense, MonthlySummary } from '../types';
import { formatDisplayDate, formatRs, getLocalDateStr } from '../lib/format';
import { api } from '../lib/api';

interface MonthlyReportsScreenProps {
  refreshTrigger: number;
}

export function MonthlyReportsScreen({ refreshTrigger }: MonthlyReportsScreenProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalDateStr().slice(0, 7));
  const [months, setMonths] = useState<MonthlySummary[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<
    {
      date: string;
      total_sales: number;
      total_purchase_cost: number;
      gross_profit: number;
      discounts: number;
      bill_count: number;
    }[]
  >([]);
  const [expensesEnabled, setExpensesEnabled] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Expense form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Utilities');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => getLocalDateStr());
  const [savingExpense, setSavingExpense] = useState(false);

  const loadData = async (month: string) => {
    setLoading(true);
    try {
      const [report, expList] = await Promise.all([
        api.getMonthlyReport(month, true),
        api.getExpenses(month, true),
      ]);
      setMonths(report.months);
      setDailyBreakdown(report.dailyBreakdown);
      setExpensesEnabled(report.expensesEnabled);
      setExpenses(expList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth, refreshTrigger]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !Number(expAmount)) return;
    setSavingExpense(true);
    try {
      await api.createExpense({
        title: expTitle.trim(),
        category: expCategory,
        amount: Number(expAmount),
        expense_date: expDate,
      });
      setExpTitle('');
      setExpAmount('');
      await loadData(selectedMonth);
    } finally {
      setSavingExpense(false);
    }
  };

  const activeMonthRow = months.find((m) => m.month === selectedMonth);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Monthly Sales &amp; Profit Reports
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monthly totals, historical purchase cost deduction, expenses, net profit, and daily breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-emerald-600" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Selected Month Highlight Strip */}
      {activeMonthRow && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Total Sales</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatRs(activeMonthRow.total_sales)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Purchase Cost</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {formatRs(activeMonthRow.total_purchase_cost)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Gross Profit</div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatRs(activeMonthRow.gross_profit)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Expenses</div>
            <div className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatRs(activeMonthRow.total_expenses)}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Net Profit</div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
              {formatRs(activeMonthRow.net_profit)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Number of Bills</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {activeMonthRow.bill_count}
            </div>
          </div>
        </div>
      )}

      {/* All Months Summary Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
            All Months Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Month &amp; Year</th>
                <th className="px-4 py-3 font-semibold text-right">Bills</th>
                <th className="px-4 py-3 font-semibold text-right">Total Sales</th>
                <th className="px-4 py-3 font-semibold text-right">Purchase Cost</th>
                <th className="px-4 py-3 font-semibold text-right">Gross Profit</th>
                {expensesEnabled && <th className="px-4 py-3 font-semibold text-right">Expenses</th>}
                <th className="px-4 py-3 font-semibold text-right">Net Profit</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {months.map((m) => {
                const isSelected = m.month === selectedMonth;
                return (
                  <tr
                    key={m.month}
                    className={
                      isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{m.label}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{m.bill_count}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatRs(m.total_sales)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {formatRs(m.total_purchase_cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRs(m.gross_profit)}
                    </td>
                    {expensesEnabled && (
                      <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatRs(m.total_expenses)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {formatRs(m.net_profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedMonth(m.month)}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        {isSelected ? 'Viewing' : 'View Daily'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Breakdown Chart & Table for Selected Month */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              Daily Breakdown · {activeMonthRow?.label ?? selectedMonth}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Day-by-day sales, purchase cost, discounts, and gross profit
            </p>
          </div>

          {dailyBreakdown.length > 0 && (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tickFormatter={(v: number) => `Rs.${v}`} tick={{ fontSize: 11, fill: '#64748b' }} width={64} />
                  <Tooltip
                    formatter={(val: unknown, name: unknown) => [
                      formatRs(Number(val ?? 0)),
                      name === 'total_sales' ? 'Sales' : 'Gross Profit',
                    ]}
                    labelFormatter={(l: unknown) => formatDisplayDate(String(l))}
                  />
                  <Bar dataKey="total_sales" fill="#0f172a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="gross_profit" fill="#15803d" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">Bills</th>
                  <th className="px-3 py-2.5 text-right">Sales</th>
                  <th className="px-3 py-2.5 text-right">Cost</th>
                  <th className="px-3 py-2.5 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Loading breakdown...
                    </td>
                  </tr>
                ) : dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No sales recorded in this month.
                    </td>
                  </tr>
                ) : (
                  dailyBreakdown.map((d) => (
                    <tr key={d.date}>
                      <td className="px-3 py-2 font-mono">{formatDisplayDate(d.date)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{d.bill_count}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                        {formatRs(d.total_sales)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500 tabular-nums">
                        {formatRs(d.total_purchase_cost)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatRs(d.gross_profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shop Expenses for Net Profit */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              Shop Expenses ({selectedMonth})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {expensesEnabled
                ? 'Deducted from Gross Profit to compute Net Profit'
                : 'Expense deduction is turned off in Settings'}
            </p>
          </div>

          {expensesEnabled && (
            <form onSubmit={handleAddExpense} className="space-y-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Expense title (e.g. Shop Rent)"
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Amount (Rs.)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
                />
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Staff">Staff</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="General">General</option>
                </select>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Expense
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
            {expenses.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No expenses logged for {selectedMonth}.</div>
            ) : (
              expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {exp.title}
                      {exp.is_demo === 1 && <span className="ml-1.5 text-[10px] text-amber-600">DEMO</span>}
                    </div>
                    <div className="text-slate-500 font-mono">
                      {formatDisplayDate(exp.expense_date)} · {exp.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatRs(exp.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteExpense(exp.id);
                        await loadData(selectedMonth);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
