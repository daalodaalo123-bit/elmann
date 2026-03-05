import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import { apiPathWithToken } from '../lib/api';
import type {
  ExpenseCategory,
  ExpenseDetail,
  ExpenseItem,
  ExpenseListRow
} from '../lib/types';
import { money } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/authContext';

const categories: ExpenseCategory[] = [
  'Inventory Purchase',
  'Vendor Bill',
  'Electricity',
  'Rent',
  'Other'
];

type ExpenseForm = {
  expense_date: string;
  category: ExpenseCategory;
  vendor: string;
  notes: string;
  amount: number | '';
  items: ExpenseItem[];
};

function nowForDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

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

function cleanText(v: string | null | undefined): string {
  if (!v) return 'Ã¢â‚¬â€';
  return String(v).replaceAll('ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â', 'Ã¢â‚¬â€').replaceAll('AÃ¯Â¿Â½Ã¯Â¿Â½,Ã¯Â¿Â½Ã¯Â¿Â½??', 'Ã¢â‚¬â€');
}

const defaultItem = (): ExpenseItem => ({ item_name: '', quantity: 1, unit_price: 0 });

export function ExpensesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExpenseListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Details modal
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<ExpenseForm>({
    expense_date: nowForDateTimeLocal(),
    category: 'Inventory Purchase',
    vendor: '',
    notes: '',
    amount: '',
    items: [defaultItem()]
  });

  const query = useMemo(() => search.trim(), [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ExpenseListRow[]>(
        `/api/expenses${query ? `?search=${encodeURIComponent(query)}` : ''}`
      );
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 150);
    return () => clearTimeout(t);
  }, [load, query]);

  async function openExpense(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api.get<ExpenseDetail>(`/api/expenses/${id}`);
      setDetail(d);
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to load expense'));
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeExpense() {
    setOpenId(null);
    setDetail(null);
  }

  async function deleteExpensePermanently() {
    if (user?.role !== 'owner' || !openId) return;
    const ok = confirm('Delete this expense permanently? This cannot be undone.');
    if (!ok) return;
    try {
      await api.del(`/api/expenses/${openId}`);
      closeExpense();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to delete expense'));
    }
  }

  const itemsTotal = useMemo(() => {
    return form.items.reduce(
      (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
      0
    );
  }, [form.items]);

  const computedTotal = useMemo(() => {
    const amt = form.amount === '' ? null : Number(form.amount);
    return amt != null ? amt : itemsTotal;
  }, [form.amount, itemsTotal]);

  function openAdd() {
    setForm({
      expense_date: nowForDateTimeLocal(),
      category: 'Inventory Purchase',
      vendor: '',
      notes: '',
      amount: '',
      items: [defaultItem()]
    });
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
  }

  function setItem(idx: number, patch: Partial<ExpenseItem>) {
    setForm((prev) => {
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, items: next };
    });
  }

  function removeItem(idx: number) {
    setForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx);
      return { ...prev, items: next.length ? next : [defaultItem()] };
    });
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, defaultItem()] }));
  }

  async function submit() {
    const cleanedItems = form.items
      .map((it) => ({
        item_name: it.item_name.trim(),
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0)
      }))
      .filter((it) => it.item_name);

    const amount = form.amount === '' ? undefined : Number(form.amount);

    if (!amount && cleanedItems.length === 0) {
      alert('Add at least one item OR enter an amount (for bills/utilities).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/expenses', {
        expense_date: form.expense_date ? new Date(form.expense_date).toISOString() : undefined,
        category: form.category,
        vendor: form.vendor.trim() || undefined,
        notes: form.notes.trim() || undefined,
        amount,
        items: cleanedItems.length ? cleanedItems : undefined
      });
      closeAdd();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to save expense'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className='mb-6 flex items-start justify-between gap-4'>
        <div>
          <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Expenses</div>
          <div className='mt-1 text-slate-500 dark:text-slate-400'>Track purchases, vendor bills, and utilities</div>
        </div>
        <button
          className='rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'
          onClick={openAdd}
          type='button'
        >
          + Add Expense
        </button>
      </div>

      <div className='mb-4'>
        <input
          className='w-full max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500'
          placeholder='Search category/vendor/notes...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className='overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-white dark:bg-slate-950/50'>
              <tr className='border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'>
                <th className='px-5 py-4 font-medium'>Date</th>
                <th className='px-5 py-4 font-medium'>Type</th>
                <th className='px-5 py-4 font-medium'>Vendor</th>
                <th className='px-5 py-4 font-medium'>Notes</th>
                <th className='px-5 py-4 font-medium'>Items</th>
                <th className='px-5 py-4 font-medium'>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-slate-500 dark:text-slate-400'>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-slate-500 dark:text-slate-400'>
                    No expenses yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className='cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40'
                    onClick={() => openExpense(r.id)}
                    title='Click to view details'
                  >
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{formatDateTime(r.expense_date)}</td>
                    <td className='px-5 py-4 font-medium text-slate-900 dark:text-slate-100'>{r.category}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{cleanText(r.vendor)}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{cleanText(r.notes)}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{r.items_count ?? 0}</td>
                    <td className='px-5 py-4 font-semibold text-slate-900 dark:text-slate-100'>
                      {money(Number(r.total_amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Details modal */}
      {openId != null && (
        <div className='modal-overlay fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='modal-content my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-950 dark:ring-1 dark:ring-slate-800 sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Expense Details</div>
              <div className='flex items-center gap-2'>
                {user?.role === 'owner' ? (
                  <button
                    type='button'
                    onClick={deleteExpensePermanently}
                    className='no-print inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-950/50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                    title='Delete permanently'
                  >
                    Delete
                  </button>
                ) : null}
                <a
                  className='no-print rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                  href={apiPathWithToken(`/api/expenses/${openId}/pdf`)}
                >
                  Download PDF
                </a>
                <button
                  type='button'
                  onClick={closeExpense}
                  className='no-print rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                  aria-label='Close'
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {detailLoading || !detail ? (
              <div className='mt-6 text-sm text-slate-500 dark:text-slate-400'>Loading details...</div>
            ) : (
              <div className='mt-6 space-y-5'>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-12'>
                  <div className='md:col-span-4'>
                    <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Date</div>
                    <div className='mt-1 font-semibold text-slate-900 dark:text-slate-100'>
                      {formatDateTime(detail.expense_date)}
                    </div>
                  </div>
                  <div className='md:col-span-4'>
                    <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Type</div>
                    <div className='mt-1 font-semibold text-slate-900 dark:text-slate-100'>{detail.category}</div>
                  </div>
                  <div className='md:col-span-4'>
                    <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Total</div>
                    <div className='mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100'>
                      {money(Number(detail.total_amount))}
                    </div>
                  </div>

                  <div className='md:col-span-6'>
                    <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Vendor</div>
                    <div className='mt-1 text-slate-800 dark:text-slate-200'>{cleanText(detail.vendor)}</div>
                  </div>
                  <div className='md:col-span-6'>
                    <div className='text-xs font-semibold text-slate-500 dark:text-slate-400'>Notes</div>
                    <div className='mt-1 text-slate-800 dark:text-slate-200'>{cleanText(detail.notes)}</div>
                  </div>
                </div>

                <div>
                  <div className='text-sm font-extrabold text-slate-900 dark:text-slate-100'>Items</div>
                  <div className='mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
                    <table className='w-full text-left text-sm'>
                      <thead className='bg-slate-50 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300'>
                        <tr>
                          <th className='px-4 py-3 font-medium'>Name</th>
                          <th className='px-4 py-3 font-medium'>Qty</th>
                          <th className='px-4 py-3 font-medium'>Unit price</th>
                          <th className='px-4 py-3 font-medium'>Line total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className='px-4 py-8 text-center text-slate-500 dark:text-slate-400'>
                              No item lines (this may be a bill/utility).
                            </td>
                          </tr>
                        ) : (
                          detail.items.map((it) => (
                            <tr key={it.id} className='border-t border-slate-200 dark:border-slate-800'>
                              <td className='px-4 py-3 font-medium text-slate-900 dark:text-slate-100'>{it.item_name}</td>
                              <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{it.quantity}</td>
                              <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{money(Number(it.unit_price))}</td>
                              <td className='px-4 py-3 font-semibold text-slate-900 dark:text-slate-100'>
                                {money(Number(it.line_total))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className='modal-overlay fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='modal-content my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-950 dark:ring-1 dark:ring-slate-800 sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Add Expense</div>
              <button
                type='button'
                onClick={closeAdd}
                className='no-print rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-12'>
              <div className='md:col-span-4'>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Date</div>
                <input
                  type='datetime-local'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
              <div className='md:col-span-4'>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Type</div>
                <select
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as ExpenseCategory })
                  }
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className='md:col-span-4'>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Vendor (optional)</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                />
              </div>

              <div className='md:col-span-8'>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Notes (optional)</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className='md:col-span-4'>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Amount (for bills)</div>
                <input
                  type='number'
                  min={0}
                  step='0.01'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                />
              </div>
            </div>

            <div className='mt-6'>
              <div className='flex items-center justify-between'>
                <div className='text-sm font-extrabold text-slate-900 dark:text-slate-100'>Items (optional)</div>
                <button
                  type='button'
                  onClick={addItem}
                  className='no-print inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                >
                  <Plus size={16} />
                  Add item
                </button>
              </div>

              <div className='mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
                <table className='w-full text-left text-sm'>
                  <thead className='bg-slate-50 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300'>
                    <tr>
                      <th className='px-4 py-3 font-medium'>Item name</th>
                      <th className='px-4 py-3 font-medium'>Qty</th>
                      <th className='px-4 py-3 font-medium'>Unit price</th>
                      <th className='px-4 py-3 font-medium'>Line total</th>
                      <th className='px-4 py-3 font-medium no-print'></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => {
                      const lt = Number(it.quantity || 0) * Number(it.unit_price || 0);
                      return (
                        <tr key={idx} className='border-t border-slate-200 dark:border-slate-800'>
                          <td className='px-4 py-2'>
                            <input
                              className='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100'
                              value={it.item_name}
                              onChange={(e) => setItem(idx, { item_name: e.target.value })}
                            />
                          </td>
                          <td className='px-4 py-2'>
                            <input
                              type='number'
                              min={0}
                              step='1'
                              className='w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100'
                              value={it.quantity}
                              onChange={(e) =>
                                setItem(idx, { quantity: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className='px-4 py-2'>
                            <input
                              type='number'
                              min={0}
                              step='0.01'
                              className='w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100'
                              value={it.unit_price}
                              onChange={(e) =>
                                setItem(idx, { unit_price: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className='px-4 py-2 font-semibold text-slate-900 dark:text-slate-100'>{money(lt)}</td>
                          <td className='px-4 py-2 no-print'>
                            <button
                              type='button'
                              onClick={() => removeItem(idx)}
                              className='rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                              aria-label='Remove'
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className='mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/50 dark:ring-1 dark:ring-slate-800'>
                <div className='text-sm text-slate-600 dark:text-slate-300'>Computed total</div>
                <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>{money(computedTotal)}</div>
              </div>

              <button
                type='button'
                onClick={submit}
                disabled={submitting}
                className='no-print mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:opacity-60'
              >
                {submitting ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}