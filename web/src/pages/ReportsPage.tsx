import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import { apiPathWithToken } from '../lib/api';
import type { InventoryReport } from '../lib/types';
import { money } from '../lib/format';
import { getErrorMessage } from '../lib/errors';

function formatDateTime(v: string): string {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function ReportsPage() {
  const [data, setData] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<InventoryReport>('/api/reports/inventory')
      .then((d) => {
        if (!mounted) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(getErrorMessage(e, 'Failed to load reports'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <div className='no-print mb-6 flex items-start justify-between gap-4'>
        <div>
          <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Inventory Reports</div>
          <div className='mt-1 text-slate-500 dark:text-slate-400'>Summary and movement history</div>
        </div>
        <a
          href={apiPathWithToken('/api/reports/inventory/pdf')}
          className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
        >
          <Download size={16} />
          Download PDF
        </a>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        <Card className='p-6'>
          <div className='text-sm text-slate-500'>Total Products</div>
          <div className='mt-2 text-3xl font-extrabold'>
            {loading ? 'â€”' : String(data?.totals.total_products ?? 0)}
          </div>
        </Card>
        <Card className='p-6'>
          <div className='text-sm text-red-600'>Low Stock Items</div>
          <div className='mt-2 text-3xl font-extrabold text-red-600'>
            {loading ? 'â€”' : String(data?.totals.low_stock_items ?? 0)}
          </div>
        </Card>
        <Card className='p-6'>
          <div className='text-sm text-slate-500'>Total Inventory Value</div>
          <div className='mt-2 text-3xl font-extrabold'>
            {loading ? 'â€”' : money(Number(data?.totals.total_inventory_value ?? 0))}
          </div>
        </Card>
      </div>

      <Card className='mt-6 p-6'>
        <div className='text-xl font-extrabold text-slate-900 dark:text-slate-100'>Inventory Movement History</div>
        <div className='mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-slate-50 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300'>
              <tr>
                <th className='px-4 py-3 font-medium'>Date</th>
                <th className='px-4 py-3 font-medium'>Product</th>
                <th className='px-4 py-3 font-medium'>Change</th>
                <th className='px-4 py-3 font-medium'>Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className='px-4 py-10 text-center text-slate-500 dark:text-slate-400'>
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className='px-4 py-10 text-center text-red-600'>
                    {error}
                  </td>
                </tr>
              ) : (data?.history?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className='px-4 py-10 text-center text-slate-500 dark:text-slate-400'>
                    No movement history yet.
                  </td>
                </tr>
              ) : (
                data!.history.map((h, idx) => (
                  <tr key={idx} className='border-t border-slate-200 dark:border-slate-800'>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{formatDateTime(h.date)}</td>
                    <td className='px-4 py-3 font-medium text-slate-900 dark:text-slate-100'>{h.product}</td>
                    <td className='px-4 py-3 text-slate-900 dark:text-slate-100'>{h.change}</td>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{h.reason}</td>
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