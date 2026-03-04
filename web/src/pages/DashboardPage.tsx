import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import type {
  Customer,
  CustomerInsightsReport,
  ExpenseListRow,
  InventoryReport,
  ProfitReport,
  SalesHistoryRow
} from '../lib/types';
import { money } from '../lib/format';
import { Boxes, CircleDollarSign, ShoppingBag, TriangleAlert, Users } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';

function asDate(v: string): Date | null {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function isWithinDays(dateStr: string, days: number): boolean {
  const d = asDate(dateStr);
  if (!d) return false;
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return d.getTime() >= now - ms;
}

function StatCard(props: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'danger';
  accent?: 'gold' | 'emerald' | 'indigo' | 'rose';
}) {
  const base =
    props.tone === 'danger'
      ? 'from-rose-200 via-rose-50 to-white ring-rose-300/80 dark:from-rose-950/70 dark:via-rose-950/30 dark:to-slate-950 dark:ring-rose-800/70'
      : props.accent === 'emerald'
        ? 'from-emerald-200 via-emerald-50 to-white ring-emerald-300/80 dark:from-emerald-950/65 dark:via-emerald-950/30 dark:to-slate-950 dark:ring-emerald-800/70'
        : props.accent === 'indigo'
          ? 'from-indigo-200 via-indigo-50 to-white ring-indigo-300/80 dark:from-indigo-950/65 dark:via-indigo-950/30 dark:to-slate-950 dark:ring-indigo-800/70'
          : props.accent === 'rose'
            ? 'from-rose-200 via-rose-50 to-white ring-rose-300/80 dark:from-rose-950/70 dark:via-rose-950/30 dark:to-slate-950 dark:ring-rose-800/70'
            : 'from-brand-200 via-brand-50 to-white ring-brand-300/80 dark:from-brand-900/40 dark:via-slate-900 dark:to-slate-950 dark:ring-brand-800/60';

  const glow =
    props.tone === 'danger'
      ? 'bg-rose-400/55 dark:bg-rose-400/20'
      : props.accent === 'emerald'
        ? 'bg-emerald-400/55 dark:bg-emerald-400/20'
        : props.accent === 'indigo'
          ? 'bg-indigo-400/55 dark:bg-indigo-400/20'
          : props.accent === 'rose'
            ? 'bg-rose-400/55 dark:bg-rose-400/20'
            : 'bg-brand-400/55 dark:bg-brand-400/20';

  const iconColor =
    props.tone === 'danger'
      ? 'text-rose-700 dark:text-rose-300'
      : props.accent === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-300'
        : props.accent === 'indigo'
          ? 'text-indigo-700 dark:text-indigo-300'
          : props.accent === 'rose'
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-brand-700 dark:text-brand-300';

  return (
    <Card className={`group relative overflow-hidden border-0 bg-gradient-to-br p-6 ring-1 ${base}`}>
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${glow}`} />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/50 to-transparent dark:from-slate-950/60' />
      <div className='relative flex items-start justify-between gap-4'>
        <div>
          <div className='text-sm font-semibold text-slate-600 dark:text-slate-300'>{props.title}</div>
          <div className='mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>
            {props.value}
          </div>
          {props.hint ? <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{props.hint}</div> : null}
        </div>
        <div className='rounded-2xl bg-white/70 p-3 text-slate-800 shadow-soft ring-1 ring-slate-200/70 transition group-hover:scale-[1.02] dark:bg-slate-950/50 dark:text-slate-100 dark:ring-slate-800'>
          <span className={iconColor}>{props.icon}</span>
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [sales, setSales] = useState<SalesHistoryRow[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseListRow[] | null>(null);
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsightsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get<Customer[]>('/api/customers'),
      api.get<InventoryReport>('/api/reports/inventory'),
      api.get<SalesHistoryRow[]>('/api/sales/history'),
      api.get<ExpenseListRow[]>('/api/expenses'),
      api.get<ProfitReport>('/api/reports/profit?period=monthly'),
      api.get<CustomerInsightsReport>('/api/reports/customer-insights?period=monthly')
    ])
      .then(([c, inv, s, e, pr, ci]) => {
        if (!mounted) return;
        setCustomers(c);
        setInventory(inv);
        setSales(s);
        setExpenses(e);
        setProfit(pr);
        setCustomerInsights(ci);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(getErrorMessage(e, 'Failed to load dashboard stats'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    const invTotals = inventory?.totals ?? {
      total_products: 0,
      low_stock_items: 0,
      total_inventory_value: 0
    };

    const salesRows = sales ?? [];
    const expRows = expenses ?? [];

    const sales30d = salesRows.filter((r) => isWithinDays(r.date, 30));
    const expenses30d = expRows.filter((r) => isWithinDays(r.expense_date, 30));

    const sum = (xs: number[]) => xs.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
    const sales30dRevenue = sum(sales30d.map((r) => Number(r.total)));
    const expenses30dTotal = sum(expenses30d.map((r) => Number(r.total_amount)));

    return {
      customersCount: customers?.length ?? 0,
      invTotals,
      profitTotals: profit?.totals ?? null,
      sales30dRevenue,
      expenses30dTotal,
      net30d: sales30dRevenue - expenses30dTotal,
      topCustomers: (customerInsights?.rows ?? []).slice(0, 10)
    };
  }, [customers, customerInsights, expenses, inventory, profit, sales]);

  const updatedAt = useMemo(() => new Date().toLocaleString(), []);

  return (
    <div className='relative'>
      <div className='pointer-events-none absolute inset-x-0 -top-10 h-44 bg-gradient-to-b from-brand-50/80 via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/40' />
      <div className='mb-7 flex items-start justify-between gap-4'>
        <div>
          <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Dashboard</div>
          <div className='mt-1 text-slate-500 dark:text-slate-400'>Quick statistics and insights</div>
        </div>
        <div className='text-right'>
          <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Last loaded</div>
          <div className='mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200'>{updatedAt}</div>
        </div>
      </div>

      {error ? (
        <Card className='p-6'>
          <div className='text-sm font-semibold text-red-700'>{error}</div>
          <div className='mt-1 text-sm text-slate-600'>
            Make sure the API is running on <span className='font-semibold'>localhost:5050</span>.
          </div>
        </Card>
      ) : null}

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title='Customers'
          value={loading ? '—' : String(computed.customersCount)}
          hint='Saved in CRM'
          accent='indigo'
          icon={<Users size={18} />}
        />
        <StatCard
          title='Products'
          value={loading ? '—' : String(computed.invTotals.total_products)}
          hint='Total items in inventory'
          accent='gold'
          icon={<Boxes size={18} />}
        />
        <StatCard
          title='Low stock'
          value={loading ? '—' : String(computed.invTotals.low_stock_items)}
          hint='Need restock soon'
          tone={computed.invTotals.low_stock_items > 0 ? 'danger' : 'default'}
          accent='rose'
          icon={<TriangleAlert size={18} />}
        />
        <StatCard
          title='Inventory value'
          value={loading ? '—' : money(Number(computed.invTotals.total_inventory_value))}
          hint='Stock × price'
          accent='emerald'
          icon={<ShoppingBag size={18} />}
        />
      </div>

      <div className='mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <Card className='relative overflow-hidden border-0 bg-gradient-to-br from-brand-200/70 via-brand-50 to-white p-6 ring-1 ring-brand-300/80 dark:from-brand-900/30 dark:via-indigo-950/30 dark:to-slate-950 dark:ring-brand-800/60'>
            <div className='pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-indigo-200/25 blur-2xl dark:bg-indigo-500/10' />
            <div className='pointer-events-none absolute -right-10 -bottom-16 h-44 w-44 rounded-full bg-emerald-200/25 blur-2xl dark:bg-emerald-500/10' />

            <div className='relative flex items-center justify-between gap-4'>
              <div>
                <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>This month snapshot</div>
                <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Revenue, expenses, and profit</div>
              </div>
              <div className='rounded-2xl bg-white/70 p-3 shadow-soft ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
                <span className='text-brand-700'>
                  <CircleDollarSign size={18} />
                </span>
              </div>
            </div>

            <div className='relative mt-5 grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
                <div className='text-sm font-semibold text-slate-600 dark:text-slate-300'>Revenue</div>
                <div className='mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100'>
                  {loading ? '—' : money(Number(computed.profitTotals?.revenue ?? 0))}
                </div>
                <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
                  {loading ? '—' : `${Number(computed.profitTotals?.transactions ?? 0)} transactions`}
                </div>
              </div>
              <div className='rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
                <div className='text-sm font-semibold text-slate-600 dark:text-slate-300'>Expenses</div>
                <div className='mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100'>
                  {loading ? '—' : money(Number(computed.profitTotals?.expenses ?? 0))}
                </div>
                <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>This month</div>
              </div>
              <div className='rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
                <div className='text-sm font-semibold text-slate-600 dark:text-slate-300'>Net profit</div>
                <div
                  className={
                    (computed.profitTotals?.net_profit ?? 0) >= 0
                      ? 'mt-2 text-2xl font-extrabold text-emerald-700'
                      : 'mt-2 text-2xl font-extrabold text-rose-700'
                  }
                >
                  {loading ? '—' : money(Number(computed.profitTotals?.net_profit ?? 0))}
                </div>
                <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
                  Gross: {loading ? '—' : money(Number(computed.profitTotals?.gross_profit ?? 0))}
                </div>
              </div>
            </div>

            <div className='relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
              <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Last 30 days (from history)</div>
              <div className='flex items-center gap-3 text-sm'>
                <span className='font-semibold text-slate-700 dark:text-slate-200'>Sales:</span>
                <span className='font-extrabold text-slate-900 dark:text-slate-100'>{loading ? '—' : money(computed.sales30dRevenue)}</span>
                <span className='font-semibold text-slate-700 dark:text-slate-200'>Expenses:</span>
                <span className='font-extrabold text-slate-900 dark:text-slate-100'>
                  {loading ? '—' : money(computed.expenses30dTotal)}
                </span>
                <span className='font-semibold text-slate-700 dark:text-slate-200'>Net:</span>
                <span className={computed.net30d >= 0 ? 'font-extrabold text-emerald-700' : 'font-extrabold text-rose-700'}>
                  {loading ? '—' : money(computed.net30d)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className='lg:col-span-5'>
          <Card className='overflow-hidden border-0 ring-1 ring-brand-200/70 dark:ring-slate-800'>
            <div className='bg-gradient-to-r from-brand-200/60 via-brand-50 to-indigo-100/70 p-6 dark:from-brand-900/20 dark:via-slate-950 dark:to-indigo-950/50'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Top customers</div>
                  <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>This month</div>
                </div>
                <div className='rounded-2xl bg-white/70 p-3 shadow-soft ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-slate-800'>
                  <span className='text-indigo-700'>
                    <Users size={18} />
                  </span>
                </div>
              </div>
            </div>

            <div className='overflow-x-auto'>
              <table className='w-full text-left text-sm'>
                <thead className='bg-white dark:bg-slate-950/50'>
                  <tr className='border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'>
                    <th className='px-5 py-4 font-medium'>Customer</th>
                    <th className='px-5 py-4 font-medium'>Revenue</th>
                    <th className='px-5 py-4 font-medium'>Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className='px-5 py-10 text-center text-slate-500'>
                        Loading...
                      </td>
                    </tr>
                  ) : computed.topCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className='px-5 py-10 text-center text-slate-500'>
                        No customer activity yet.
                      </td>
                    </tr>
                  ) : (
                    computed.topCustomers.map((r) => (
                      <tr key={r.customer} className='border-b border-slate-100 dark:border-slate-800'>
                        <td className='px-5 py-4 font-medium text-slate-900 dark:text-slate-100'>{r.customer}</td>
                        <td className='px-5 py-4 font-semibold text-slate-900 dark:text-slate-100'>{money(Number(r.revenue))}</td>
                        <td className='px-5 py-4 font-semibold text-slate-900 dark:text-slate-100'>{money(Number(r.unpaid_total))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className='border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400'>
              Tip: unpaid totals come from sales marked as unpaid.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


