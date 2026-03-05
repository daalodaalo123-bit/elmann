import { useEffect, useMemo, useState } from 'react';
import { History, Pencil, Trash2, X } from 'lucide-react';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import type { Product, ProductHistoryRow } from '../lib/types';
import { money } from '../lib/format';
import { getErrorMessage } from '../lib/errors';

type ProductForm = {
  name: string;
  category: string;
  unit_cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
};

type RestockForm = {
  productId: string;
  productName: string;
  qty: number;
  reason: string;
};

type RemoveStockForm = {
  productId: string;
  productName: string;
  qty: number;
  reason: string;
};

type DeleteProductForm = {
  productId: string;
  productName: string;
};

type EditProductForm = {
  productId: string;
  productName: string;
  price: number;
  unit_cost: number;
  sku: string;
  low_stock_threshold: number;
};

const defaultForm: ProductForm = {
  name: '',
  category: 'Crochet',
  unit_cost: 0,
  price: 0,
  stock: 0,
  low_stock_threshold: 5
};

export function InventoryPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ProductForm>(defaultForm);

  const [restock, setRestock] = useState<RestockForm | null>(null);
  const [removeStock, setRemoveStock] = useState<RemoveStockForm | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<DeleteProductForm | null>(null);
  const [editProduct, setEditProduct] = useState<EditProductForm | null>(null);
  const [historyFor, setHistoryFor] = useState<{ productId: string; productName: string } | null>(
    null
  );
  const [historyRows, setHistoryRows] = useState<ProductHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Product[]>('/api/products');
      setRows(data);
      setError(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load inventory'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  function openAdd() {
    setForm(defaultForm);
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
  }

  async function addProduct() {
    if (!form.name.trim()) {
      alert('Please enter product name');
      return;
    }
    if (!form.category.trim()) {
      alert('Please enter category');
      return;
    }

    try {
      await api.post('/api/products', {
        ...form,
        stock: Math.max(0, Math.floor(form.stock || 0)),
        low_stock_threshold: Math.max(0, Math.floor(form.low_stock_threshold || 0)),
        price: Math.max(0, Number(form.price || 0)),
        unit_cost: Math.max(0, Number(form.unit_cost || 0))
      });
      closeAdd();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to add product'));
    }
  }

  function openRestock(p: Product) {
    setRestock({
      productId: String(p.id),
      productName: p.name,
      qty: 1,
      reason: 'Restock'
    });
  }

  function closeRestock() {
    setRestock(null);
  }

  function openRemoveStock(p: Product) {
    setRemoveStock({
      productId: String(p.id),
      productName: p.name,
      qty: 1,
      reason: 'Damaged / Lost'
    });
  }

  function closeRemoveStock() {
    setRemoveStock(null);
  }

  function openDeleteProduct(p: Product) {
    setDeleteProduct({ productId: String(p.id), productName: p.name });
  }

  function closeDeleteProduct() {
    setDeleteProduct(null);
  }

  function openEdit(p: Product) {
    setEditProduct({
      productId: String(p.id),
      productName: p.name,
      price: Number(p.price ?? 0),
      unit_cost: Number(p.unit_cost ?? 0),
      sku: String(p.sku ?? ''),
      low_stock_threshold: Number(p.low_stock_threshold ?? 0)
    });
  }

  function closeEdit() {
    setEditProduct(null);
  }

  async function submitRestock() {
    if (!restock) return;
    const qty = Math.max(1, Math.floor(restock.qty || 1));
    const reason = restock.reason?.trim() || 'Restock';

    try {
      await api.post(`/api/products/${restock.productId}/restock`, { qty, reason });
      closeRestock();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to restock'));
    }
  }

  async function submitRemoveStock() {
    if (!removeStock) return;
    const qty = Math.max(1, Math.floor(removeStock.qty || 1));
    const reason = removeStock.reason?.trim() || 'Stock adjustment';

    try {
      await api.post(`/api/products/${removeStock.productId}/decrease`, { qty, reason });
      closeRemoveStock();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to remove stock'));
    }
  }

  async function submitEdit() {
    if (!editProduct) return;
    const price = Math.max(0, Number(editProduct.price || 0));
    const unit_cost = Math.max(0, Number(editProduct.unit_cost || 0));
    const sku = editProduct.sku.trim() || undefined;
    const low_stock_threshold = Math.max(0, Math.floor(editProduct.low_stock_threshold || 0));

    try {
      await api.put(`/api/products/${editProduct.productId}`, { price, unit_cost, sku, low_stock_threshold });
      closeEdit();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to update product'));
    }
  }

  async function submitDeleteProduct() {
    if (!deleteProduct) return;
    try {
      await api.del(`/api/products/${deleteProduct.productId}`);
      // Optimistic UI: remove row immediately, then refresh to stay in sync.
      setRows((prev) => prev.filter((r) => String(r.id) !== String(deleteProduct.productId)));
      closeDeleteProduct();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to remove product'));
    }
  }

  async function submitHardDeleteProduct() {
    if (!deleteProduct) return;
    const ok = confirm(
      `Delete "${deleteProduct.productName}" permanently from MongoDB?\n\nThis cannot be undone.`
    );
    if (!ok) return;
    try {
      await api.del(`/api/products/${deleteProduct.productId}/permanent`);
      setRows((prev) => prev.filter((r) => String(r.id) !== String(deleteProduct.productId)));
      closeDeleteProduct();
      await load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to delete product'));
    }
  }

  async function openHistory(p: Product) {
    setHistoryFor({ productId: String(p.id), productName: p.name });
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const rows = await api.get<ProductHistoryRow[]>(`/api/products/${p.id}/history`);
      setHistoryRows(rows);
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to load history'));
      setHistoryFor(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryFor(null);
    setHistoryRows([]);
  }

  return (
    <div>
      <div className='mb-6 flex items-start justify-between gap-4'>
        <div>
          <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>Inventory</div>
          <div className='mt-1 text-slate-500 dark:text-slate-400'>Manage products and stock levels</div>
        </div>
        <button
          className='rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'
          onClick={openAdd}
          type='button'
        >
          + Add Product
        </button>
      </div>

      <Card className='overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-white dark:bg-slate-950/50'>
              <tr className='border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'>
                <th className='px-5 py-4 font-medium'>Product</th>
                <th className='px-5 py-4 font-medium'>Category</th>
                <th className='px-5 py-4 font-medium'>Buy</th>
                <th className='px-5 py-4 font-medium'>Sell</th>
                <th className='px-5 py-4 font-medium'>Stock</th>
                <th className='px-5 py-4 font-medium'>Actions</th>
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
              ) : empty ? (
                <tr>
                  <td colSpan={6} className='px-5 py-10 text-center text-slate-500 dark:text-slate-400'>
                    No products yet. Click "Add Product".
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className='border-b border-slate-100 dark:border-slate-800'>
                    <td className='px-5 py-4 font-medium text-slate-900 dark:text-slate-100'>{p.name}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{p.category}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{money(Number(p.unit_cost ?? 0))}</td>
                    <td className='px-5 py-4 text-slate-600 dark:text-slate-300'>{money(Number(p.price ?? 0))}</td>
                    <td className='px-5 py-4'>
                      <span
                        className={
                          Number(p.stock) <= Number(p.low_stock_threshold)
                            ? 'rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className='px-5 py-4'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => openHistory(p)}
                          className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                          title='View stock history'
                        >
                          <History size={16} />
                          History
                        </button>
                        <button
                          type='button'
                          onClick={() => openEdit(p)}
                          className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                          title='Edit price'
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => openRestock(p)}
                          className='rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                        >
                          Restock
                        </button>
                        <button
                          type='button'
                          onClick={() => openRemoveStock(p)}
                          className='rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                        >
                          Remove Stock
                        </button>
                        <button
                          type='button'
                          onClick={() => openDeleteProduct(p)}
                          className='inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 dark:border-rose-900/60 dark:bg-slate-950/50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                          title='Remove product from inventory'
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-950 dark:ring-1 dark:ring-slate-800 sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Add New Product</div>
              <button
                type='button'
                onClick={closeAdd}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-6 space-y-5'>
              <div>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Name</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Category</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                <div>
                  <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Buy price ($)</div>
                  <input
                    type='number'
                    min={0}
                    step='0.01'
                    className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Sell price ($)</div>
                  <input
                    type='number'
                    min={0}
                    step='0.01'
                    className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Initial Stock</div>
                  <input
                    type='number'
                    min={0}
                    step='1'
                    className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Low Stock Alert Threshold</div>
                <input
                  type='number'
                  min={0}
                  step='1'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'
                  value={form.low_stock_threshold}
                  onChange={(e) =>
                    setForm({ ...form, low_stock_threshold: Number(e.target.value) })
                  }
                />
              </div>

              <button
                type='button'
                onClick={addProduct}
                className='mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {restock && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900'>Restock Product</div>
              <button
                type='button'
                onClick={closeRestock}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-2 text-sm text-slate-500'>{restock.productName}</div>

            <div className='mt-6 space-y-5'>
              <div>
                <div className='text-sm font-semibold text-slate-700'>Quantity</div>
                <input
                  type='number'
                  min={1}
                  step='1'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={restock.qty}
                  onChange={(e) => setRestock({ ...restock, qty: Number(e.target.value) })}
                />
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700'>Reason</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={restock.reason}
                  onChange={(e) => setRestock({ ...restock, reason: e.target.value })}
                />
              </div>

              <button
                type='button'
                onClick={submitRestock}
                className='mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'
              >
                Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {editProduct && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900'>Edit Product</div>
              <button
                type='button'
                onClick={closeEdit}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-2 text-sm text-slate-500'>{editProduct.productName}</div>

            <div className='mt-6 space-y-5'>
              <div>
                <div className='text-sm font-semibold text-slate-700'>SKU / Barcode (optional)</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={editProduct.sku}
                  onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })}
                />
                <div className='mt-1 text-xs text-slate-500'>Use this for barcode scanning later.</div>
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700'>Sell price ($)</div>
                <input
                  type='number'
                  min={0}
                  step='0.01'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={editProduct.price}
                  onChange={(e) => setEditProduct({ ...editProduct, price: Number(e.target.value) })}
                />
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700'>Buy price ($)</div>
                <input
                  type='number'
                  min={0}
                  step='0.01'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={editProduct.unit_cost}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, unit_cost: Number(e.target.value) })
                  }
                />
                <div className='mt-1 text-xs text-slate-500'>Used for profit reports.</div>
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700'>Low stock threshold</div>
                <input
                  type='number'
                  min={0}
                  step='1'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={editProduct.low_stock_threshold}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, low_stock_threshold: Number(e.target.value) })
                  }
                />
              </div>

              <button
                type='button'
                onClick={submitEdit}
                className='mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-soft sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900'>Stock History</div>
              <button
                type='button'
                onClick={closeHistory}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-2 text-sm text-slate-500'>{historyFor.productName}</div>

            <div className='mt-5 overflow-x-auto rounded-xl border border-slate-200'>
              <table className='w-full text-left text-sm'>
                <thead className='bg-slate-50 text-slate-600'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>Date</th>
                    <th className='px-4 py-3 font-medium'>Type</th>
                    <th className='px-4 py-3 font-medium'>Qty</th>
                    <th className='px-4 py-3 font-medium'>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={4} className='px-4 py-10 text-center text-slate-500'>
                        Loading...
                      </td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className='px-4 py-10 text-center text-slate-500'>
                        No history yet.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((h, idx) => (
                      <tr key={idx} className='border-t border-slate-200'>
                        <td className='px-4 py-3 text-slate-600'>
                          {new Date(String(h.date)).toLocaleString()}
                        </td>
                        <td className='px-4 py-3 font-medium text-slate-900'>{h.change_type}</td>
                        <td className='px-4 py-3 font-semibold text-slate-900'>{h.qty_change}</td>
                        <td className='px-4 py-3 text-slate-600'>{h.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {removeStock && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900'>Remove Stock</div>
              <button
                type='button'
                onClick={closeRemoveStock}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-2 text-sm text-slate-500'>{removeStock.productName}</div>

            <div className='mt-6 space-y-5'>
              <div>
                <div className='text-sm font-semibold text-slate-700'>Quantity</div>
                <input
                  type='number'
                  min={1}
                  step='1'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={removeStock.qty}
                  onChange={(e) => setRemoveStock({ ...removeStock, qty: Number(e.target.value) })}
                />
              </div>

              <div>
                <div className='text-sm font-semibold text-slate-700'>Reason</div>
                <input
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300'
                  value={removeStock.reason}
                  onChange={(e) => setRemoveStock({ ...removeStock, reason: e.target.value })}
                />
              </div>

              <button
                type='button'
                onClick={submitRemoveStock}
                className='mt-2 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-red-700'
              >
                Remove Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteProduct && (
        <div className='fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center'>
          <div className='my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-950 dark:ring-1 dark:ring-slate-800 sm:p-8'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-extrabold text-slate-900 dark:text-slate-100'>Remove Product</div>
              <button
                type='button'
                onClick={closeDeleteProduct}
                className='rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                aria-label='Close'
              >
                <X size={18} />
              </button>
            </div>

            <div className='mt-2 text-sm text-slate-600 dark:text-slate-300'>
              This removes the product from Inventory and POS. Sales history stays intact.
            </div>

            <div className='mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'>
              You are about to remove <span className='font-semibold'>{deleteProduct.productName}</span>.
            </div>

            <div className='mt-6 flex items-center justify-end gap-3'>
              <button
                type='button'
                onClick={closeDeleteProduct}
                className='rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={submitDeleteProduct}
                className='rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-red-700'
              >
                Archive (hide)
              </button>
              <button
                type='button'
                onClick={submitHardDeleteProduct}
                className='rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-rose-700'
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}