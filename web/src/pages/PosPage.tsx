import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Customer, PaymentMethod, Product } from '../lib/types';
import { Card } from '../components/Card';
import { money } from '../lib/format';
import { CheckCircle2, ClipboardList, Printer, Plus, Save, User } from 'lucide-react';
import { clsx } from 'clsx';
import { apiPathWithToken } from '../lib/api';
import { getErrorMessage } from '../lib/errors';

type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  qty: number;
  discount: number;
  discountMode: DiscountMode;
};

type DiscountMode = 'amount' | 'percent';

type ParkedCart = {
  id: string;
  name: string;
  saved_at: string;
  cart: CartItem[];
  // legacy fields (older versions stored an overall sale discount)
  discount?: number;
  discountMode?: DiscountMode;
  payment: PaymentMethod;
  saleDate: string;
  customerId: string;
  customerName: string;
};

const PARKED_KEY = 'elman_pos_parked_carts_v1';

function nowForDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  const [parked, setParked] = useState<ParkedCart[]>([]);

  // Sale date (can be past/future)
  const [saleDate, setSaleDate] = useState<string>(() => nowForDateTimeLocal());

  // Customer
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get<Product[]>('/api/products'), api.get<Customer[]>('/api/customers')])
      .then(([p, c]) => {
        if (!mounted) return;
        setProducts(p);
        setCustomers(c);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(getErrorMessage(e, 'Failed to load data'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const computedCart = useMemo(() => {
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const safe = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const lines = cart.map((it) => {
      const unitPrice = safe(it.unit_price);
      const qty = Math.max(1, Math.floor(safe(it.qty)));
      const lineTotal = unitPrice * qty;

      const rawDiscount = safe(it.discount);
      const discountAmt =
        it.discountMode === 'percent'
          ? (lineTotal * clamp(rawDiscount, 0, 100)) / 100
          : clamp(rawDiscount, 0, lineTotal);

      const discount = round2(discountAmt);
      const after = Math.max(0, round2(lineTotal - discount));
      const effectiveUnitPrice = qty > 0 ? round2(after / qty) : 0;

      return {
        ...it,
        qty,
        unitPrice,
        lineTotal: round2(lineTotal),
        discount,
        after,
        effectiveUnitPrice
      };
    });

    const subtotal = round2(lines.reduce((s, it) => s + it.lineTotal, 0));
    const discountTotal = round2(lines.reduce((s, it) => s + it.discount, 0));
    const total = round2(Math.max(0, subtotal - discountTotal));

    return { lines, subtotal, discountTotal, total };
  }, [cart]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  );

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerName(selectedCustomer.name);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    // load parked carts
    try {
      const raw = localStorage.getItem(PARKED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ParkedCart[];
      if (Array.isArray(parsed)) setParked(parsed);
    } catch {
      // ignore
    }
  }, []);

  function persistParked(next: ParkedCart[]) {
    setParked(next);
    try {
      localStorage.setItem(PARKED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function normalizeCart(raw: unknown): CartItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((it) => ({
      product_id:
        it && typeof it === 'object' && 'product_id' in it ? String((it as { product_id?: unknown }).product_id ?? '') : '',
      name: it && typeof it === 'object' && 'name' in it ? String((it as { name?: unknown }).name ?? '') : '',
      unit_price:
        it && typeof it === 'object' && 'unit_price' in it
          ? Number((it as { unit_price?: unknown }).unit_price ?? 0)
          : 0,
      qty: it && typeof it === 'object' && 'qty' in it ? Number((it as { qty?: unknown }).qty ?? 1) : 1,
      discount:
        it && typeof it === 'object' && 'discount' in it ? Number((it as { discount?: unknown }).discount ?? 0) : 0,
      discountMode:
        it && typeof it === 'object' && 'discountMode' in it && (it as { discountMode?: unknown }).discountMode === 'percent'
          ? 'percent'
          : 'amount'
    }));
  }

  function parkCart() {
    if (!cart.length) return;
    const name = prompt('Name this parked cart (optional):', customerName.trim() || 'Parked cart');
    const id = `${Date.now()}`;
    const item: ParkedCart = {
      id,
      name: (name ?? '').trim() || 'Parked cart',
      saved_at: new Date().toISOString(),
      cart,
      discount: 0,
      discountMode: 'amount',
      payment,
      saleDate,
      customerId,
      customerName
    };
    const next = [item, ...parked].slice(0, 20);
    persistParked(next);
    // clear current
    setCart([]);
    setCustomerId('');
    setCustomerName('');
    setLastReceipt(null);
  }

  function resumeCart(id: string) {
    const found = parked.find((p) => p.id === id);
    if (!found) return;
    setCart(normalizeCart(found.cart));
    setPayment(found.payment);
    setSaleDate(found.saleDate);
    setCustomerId(found.customerId);
    setCustomerName(found.customerName);
    setLastReceipt(null);
    persistParked(parked.filter((p) => p.id !== id));
  }

  function deleteParked(id: string) {
    persistParked(parked.filter((p) => p.id !== id));
  }

  function addToCart() {
    if (!selectedProduct) return;
    const q = Math.max(1, Math.floor(qty || 1));
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product_id === selectedProduct.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + q };
        return next;
      }
      return [
        ...prev,
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          unit_price: Number(selectedProduct.price),
          qty: q,
          discount: 0,
          discountMode: 'amount'
        }
      ];
    });
  }

  async function completeSale() {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ receipt_ref: string }>('/api/sales', {
        cashier: 'Main Cashier',
        sale_date: saleDate ? new Date(saleDate).toISOString() : undefined,
        customer: customerName.trim() ? customerName.trim() : undefined,
        customer_id: customerId ? customerId : undefined,
        payment_method: payment,
        // discounts are applied per-item via unit_price overrides
        discount: 0,
        unpaid: false,
        items: computedCart.lines.map((c) => ({
          product_id: c.product_id,
          qty: c.qty,
          unit_price: c.effectiveUnitPrice
        }))
      });
      setLastReceipt(res.receipt_ref);
      setCart([]);
      setCustomerId('');
      setCustomerName('');
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Sale failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className='mb-6'>
        <div className='text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100'>POS</div>
        <div className='mt-1 text-slate-500 dark:text-slate-400'>Create and complete sales transactions</div>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
        {/* left */}
        <div className='lg:col-span-7'>
          <Card className='p-6'>
            <div className='flex items-center gap-2 text-lg font-bold'>
              <span className='inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-brand-200'>
                <Plus size={18} />
              </span>
              <span className='text-slate-900 dark:text-slate-100'>Add Item</span>
            </div>

            <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-12'>
              <div className='md:col-span-7'>
                <div className='text-sm font-medium text-slate-600 dark:text-slate-300'>Product</div>
                <select
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-brand-300'
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value=''>Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {loading && <div className='mt-2 text-sm text-slate-500 dark:text-slate-400'>Loading...</div>}
                {error && <div className='mt-2 text-sm text-red-600'>{error}</div>}
              </div>

              <div className='md:col-span-3'>
                <div className='text-sm font-medium text-slate-600 dark:text-slate-300'>Qty</div>
                <input
                  type='number'
                  min={1}
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-brand-300'
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>

              <div className='md:col-span-2'>
                <div className='text-sm font-medium text-slate-600'>&nbsp;</div>
                <button
                  type='button'
                  onClick={addToCart}
                  disabled={!selectedProduct}
                  className='mt-2 w-full rounded-xl bg-brand-500 px-3 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Add
                </button>
              </div>
            </div>

            {/* Sale Date */}
            <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-12'>
              <div className='md:col-span-5'>
                <div className='text-sm font-medium text-slate-600 dark:text-slate-300'>Sale Date</div>
                <input
                  type='datetime-local'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-brand-300'
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>
              <div className='md:col-span-7'>
                <div className='mt-7 text-xs text-slate-500 dark:text-slate-400'>
                  You can set past or future dates. This will be saved in History.
                </div>
              </div>
            </div>

            {/* Customer */}
            <div className='mt-5 grid grid-cols-1 gap-4 md:grid-cols-12'>
              <div className='md:col-span-5'>
                <div className='text-sm font-medium text-slate-600 dark:text-slate-300'>Customer (CRM)</div>
                <select
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-brand-300'
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value=''>Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` - ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className='md:col-span-7'>
                <div className='text-sm font-medium text-slate-600 dark:text-slate-300'>Customer Name</div>
                <div className='relative mt-2'>
                  <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500'>
                    <User size={16} />
                  </span>
                  <input
                    className='w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-300'
                    placeholder='Optional: type a customer name'
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setCustomerId('');
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className='mt-6 p-6'>
            <div className='flex items-center justify-between'>
              <div className='text-lg font-bold text-slate-900 dark:text-slate-100'>Current Cart</div>
              <div className='rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'>
                {cart.length} items
              </div>
            </div>

            <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
              <div className='text-xs text-slate-500 dark:text-slate-400'>
                {parked.length ? `${parked.length} parked` : 'No parked carts'}
              </div>
              {computedCart.discountTotal > 0 ? (
                <div className='rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-200'>
                  Item discounts: −{money(computedCart.discountTotal)}
                </div>
              ) : null}
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={parkCart}
                  disabled={!cart.length}
                  className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                >
                  <Save size={16} />
                  Park cart
                </button>
              </div>
            </div>

            {parked.length ? (
              <div className='mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
                <table className='w-full text-left text-sm'>
                  <thead className='bg-slate-50 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300'>
                    <tr>
                      <th className='px-4 py-3 font-medium'>Parked carts</th>
                      <th className='px-4 py-3 font-medium'>Items</th>
                      <th className='px-4 py-3 font-medium'></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parked.slice(0, 5).map((p) => (
                      <tr key={p.id} className='border-t border-slate-200 dark:border-slate-800'>
                        <td className='px-4 py-3 font-medium text-slate-900 dark:text-slate-100'>{p.name}</td>
                        <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{p.cart.length}</td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center justify-end gap-2'>
                            <button
                              type='button'
                              onClick={() => resumeCart(p.id)}
                              className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                            >
                              <ClipboardList size={16} />
                              Resume
                            </button>
                            <button
                              type='button'
                              onClick={() => deleteParked(p.id)}
                              className='rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 dark:border-rose-900/60 dark:bg-slate-950/50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className='mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
              <table className='w-full text-left text-sm'>
                <thead className='bg-slate-50 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>Item Name</th>
                    <th className='px-4 py-3 font-medium'>Price</th>
                    <th className='px-4 py-3 font-medium'>Qty</th>
                    <th className='px-4 py-3 font-medium'>Discount</th>
                    <th className='px-4 py-3 font-medium text-right'>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td className='px-4 py-10 text-center text-slate-500 dark:text-slate-400' colSpan={5}>
                        No items added yet
                      </td>
                    </tr>
                  ) : (
                    <>
                      {computedCart.lines.map((it) => (
                        <tr key={it.product_id} className='border-t border-slate-200 dark:border-slate-800'>
                          <td className='px-4 py-3 font-medium text-slate-900 dark:text-slate-100'>
                            {it.name}
                          </td>
                          <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{money(it.unitPrice)}</td>
                          <td className='px-4 py-3 text-slate-600 dark:text-slate-300'>{it.qty}</td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-2'>
                              <button
                                type='button'
                                className='rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                                title='Toggle discount type'
                                onClick={() =>
                                  setCart((prev) =>
                                    prev.map((x) =>
                                      x.product_id === it.product_id
                                        ? {
                                            ...x,
                                            discountMode: x.discountMode === 'amount' ? 'percent' : 'amount'
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                {it.discountMode === 'amount' ? '$' : '%'}
                              </button>
                              <input
                                type='number'
                                min={0}
                                step='0.01'
                                className='w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-300 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100'
                                value={Number.isFinite(Number(it.discount)) ? it.discount : 0}
                                onChange={(e) =>
                                  setCart((prev) =>
                                    prev.map((x) =>
                                      x.product_id === it.product_id
                                        ? { ...x, discount: Number(e.target.value) }
                                        : x
                                    )
                                  )
                                }
                              />
                              {it.discount > 0 ? (
                                <span className='text-xs font-semibold text-brand-700 dark:text-brand-200'>
                                  −{money(it.discount)}
                                </span>
                              ) : (
                                <span className='text-xs text-slate-500 dark:text-slate-400'>—</span>
                              )}
                            </div>
                          </td>
                          <td className='px-4 py-3 text-right'>
                            {it.discount > 0 ? (
                              <div>
                                <div className='text-sm font-semibold text-slate-500 line-through dark:text-slate-400'>
                                  {money(it.lineTotal)}
                                </div>
                                <div className='text-base font-extrabold text-slate-900 dark:text-slate-100'>
                                  {money(it.after)}
                                </div>
                              </div>
                            ) : (
                              <div className='text-base font-semibold text-slate-900 dark:text-slate-100'>
                                {money(it.lineTotal)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}

                      <tr className='border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-950/40'>
                        <td colSpan={4} className='px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300'>
                          Subtotal
                        </td>
                        <td className='px-4 py-3 text-right text-sm font-extrabold text-slate-900 dark:text-slate-100'>
                          {money(computedCart.subtotal)}
                        </td>
                      </tr>
                      {computedCart.discountTotal > 0 ? (
                        <tr className='border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-950/40'>
                          <td colSpan={4} className='px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300'>
                            Discount
                          </td>
                          <td className='px-4 py-3 text-right text-sm font-extrabold text-brand-700 dark:text-brand-200'>
                            −{money(computedCart.discountTotal)}
                          </td>
                        </tr>
                      ) : null}
                      <tr className='border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-950/40'>
                        <td colSpan={4} className='px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300'>
                          Total
                        </td>
                        <td className='px-4 py-3 text-right text-sm font-extrabold text-slate-900 dark:text-slate-100'>
                          {money(computedCart.total)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* right */}
        <div className='lg:col-span-5'>
          <div className='rounded-2xl bg-slate-900 p-6 text-white shadow-soft'>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-slate-300'>Subtotal</div>
              <div className='text-sm font-semibold'>{money(computedCart.subtotal)}</div>
            </div>

            <div className='mt-4 flex items-center justify-between gap-3'>
              <div className='text-sm text-slate-300'>Item discounts</div>
              <div className='rounded-xl bg-slate-800 px-3 py-2 text-right text-sm font-semibold text-white'>
                −{money(computedCart.discountTotal)}
              </div>
            </div>

            <div className='mt-5 border-t border-slate-700 pt-5'>
              <div className='flex items-end justify-between'>
                <div className='text-lg font-bold'>Total</div>
                <div className='text-4xl font-extrabold tracking-tight'>{money(computedCart.total)}</div>
              </div>
            </div>
          </div>

          {lastReceipt ? (
            <Card className='mt-6 p-6'>
              <div className='text-lg font-bold text-slate-900 dark:text-slate-100'>Last sale</div>
              <div className='mt-1 text-sm text-slate-600 dark:text-slate-300'>Receipt: {lastReceipt}</div>
              <div className='mt-4 flex flex-wrap gap-2'>
                <a
                  className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                  href={apiPathWithToken(`/api/sales/${lastReceipt}/pdf`)}
                  target='_blank'
                  rel='noreferrer'
                >
                  <Printer size={16} />
                  Print / PDF
                </a>
              </div>
            </Card>
          ) : null}

          <Card className='mt-6 p-6'>
            <div className='text-lg font-bold text-slate-900 dark:text-slate-100'>Payment Method</div>
            <div className='mt-4 grid grid-cols-3 gap-3'>
              {(['Cash', 'Zaad', 'Edahab'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => setPayment(m)}
                  className={clsx(
                    'rounded-2xl border px-3 py-4 text-center text-sm font-semibold transition',
                    payment === m
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900'
                  )}
                >
                  {m === 'Cash' ? 'Cash' : m.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type='button'
              onClick={completeSale}
              disabled={!cart.length || submitting}
              className='mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60'
            >
              <CheckCircle2 size={18} />
              {submitting ? 'Completing...' : 'Complete Sale'}
            </button>
          </Card>

          <div className='mt-4 text-xs text-slate-500 dark:text-slate-400'>Tip: Manage customer info in the Customers tab.</div>
        </div>
      </div>
    </div>
  );
}