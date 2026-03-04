import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import type { Product } from '../lib/types';
import { money } from '../lib/format';
import { Coins, TrendingUp } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';

function Stat(props: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success';
}) {
  const tone =
    props.tone === 'success'
      ? 'from-emerald-50 to-white ring-emerald-200/70 dark:from-emerald-950/35 dark:to-slate-950 dark:ring-emerald-900/60'
      : 'from-brand-50 to-white ring-brand-200/70 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-800';

  return (
    <Card className={`relative overflow-hidden border-0 bg-gradient-to-br p-6 ring-1 ${tone}`}>
      <div className='pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-200/30 blur-2xl dark:bg-brand-500/10' />
      <div className='relative flex items-start justify-between gap-4'>
        <div>
          <div className='text-sm font-semibold text-slate-600 dark:text-slate-300'>{props.title}</div>
          <div className='mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>
            {props.value}
          </div>
          {props.hint ? <div className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{props.hint}</div> : null}
        </div>
        <div className='rounded-2xl bg-white/70 p-3 text-slate-800 shadow-soft ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:text-slate-100 dark:ring-slate-800'>
          <span className='text-brand-700 dark:text-brand-300'>{props.icon}</span>
        </div>
      </div>
    </Card>
  );
}

export function InventoryValuePage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<Product[]>('/api/products')
      .then((d) => {
        if (!mounted) return;
        setRows(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(getErrorMessage(e, 'Failed to load inventory value'));
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
    const safe = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);
    const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);

    const byRow = rows.map((p) => {
      const stock = safe(p.stock);
      const unitCost = safe(p.unit_cost);
      const sell = safe(p.price);
      const costValue = unitCost * stock;
      const sellValue = sell * stock;
      return { p, stock, unitCost, sell, costValue, sellValue, profitValue: sellValue - costValue };
    });

    const totalCost = sum(byRow.map((r) => r.costValue));
    const totalSell = sum(byRow.map((r) => r.sellValue));

    return {
      byRow,
      totalCost,
      totalSell,
      totalProfit: totalSell - totalCost
    };
  }, [rows]);

  return (
    <div>
      <div className='mb-6 flex items-start justify-between gap-4'>
        <div>
          <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Inventory Value</div>
          <div className='mt-1 text-slate-500 dark:text-slate-400'>Buy vs sell totals (price × stock)</div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        <Stat
          title='Total buy value'
          value={loading ? '—' : money(computed.totalCost)}
          hint='Buy price × stock'
          icon={<Coins size={18} />}
        />
        <Stat
          title='Total sell value'
          value={loading ? '—' : money(computed.totalSell)}
          hint='Sell price × stock'
          icon={<TrendingUp size={18} />}
        />
        <Stat
          title='Possible profit'
          value={loading ? '—' : money(computed.totalProfit)}
          hint='(Sell − buy) × stock'
          tone='success'
          icon={<TrendingUp size={18} />}
        />
      </div>

      <Card className='mt-6 overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-white dark:bg-slate-950/50'>
              <tr className='border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'>
                <th className='px-5 py-4 font-medium'>Product</th>
                <th className='px-5 py-4 font-medium'>Stock</th>
                <th className='px-5 py-4 font-medium'>Buy</th>
                <th className='px-5 py-4 font-medium'>Sell</th>
                <th className='px-5 py-4 font-medium'>Buy total</th>
                <th className='px-5 py-4 font-medium'>Sell total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-slate-500 dark:text-slate-400'>
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-red-600'>
                    {error}
                  </td>
                </tr>
              ) : computed.byRow.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-slate-500 dark:text-slate-400'>
                    No products yet.
                  </td>
                </tr>
              ) : (
                computed.byRow.map((r) => (
                  <tr key={r.p.id} className='border-b border-slate-100 dark:border-slate-800'>
                    <td className='px-5 py-4 font-medium text-slate-900 dark:text-slate-100'>{r.p.name}</td>
                    <td className='px-5 py-4 text-slate-700 dark:text-slate-200'>{r.stock}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{money(r.unitCost)}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{money(r.sell)}</td>
                    <td className='px-5 py-4 font-semibold text-slate-900 dark:text-slate-100'>{money(r.costValue)}</td>
                    <td className='px-5 py-4 font-semibold text-slate-900 dark:text-slate-100'>{money(r.sellValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

