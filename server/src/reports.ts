import mongoose from 'mongoose';
import { Expense, Product, Sale } from './models.js';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export function periodStart(period: ReportPeriod): Date {
  const now = new Date();
  if (period === 'daily') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'weekly') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function dayKeyExpr(dateField: string) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      date: dateField as any
    }
  };
}

export async function profitReport(period: ReportPeriod) {
  const start = periodStart(period);

  const salesTotalsAgg = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    { $group: { _id: null, revenue: { $sum: '$total' }, transactions: { $sum: 1 } } },
    { $project: { _id: 0, revenue: { $round: ['$revenue', 2] }, transactions: 1 } }
  ]);

  const expensesTotalsAgg = await Expense.aggregate([
    { $match: { expense_date: { $gte: start } } },
    { $group: { _id: null, expenses: { $sum: '$total_amount' } } },
    { $project: { _id: 0, expenses: { $round: ['$expenses', 2] } } }
  ]);

  // Estimate gross profit using Product.unit_cost (current) joined by product_id.
  const grossAgg = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product_id',
        foreignField: '_id',
        as: 'prod'
      }
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        unit_cost: { $ifNull: ['$prod.unit_cost', 0] },
        qty: '$items.qty',
        unit_price: '$items.unit_price'
      }
    },
    {
      $group: {
        _id: null,
        gross_profit: { $sum: { $multiply: [{ $subtract: ['$unit_price', '$unit_cost'] }, '$qty'] } }
      }
    },
    { $project: { _id: 0, gross_profit: { $round: ['$gross_profit', 2] } } }
  ]);

  // Daily series for the selected period window (sales + expenses + gross profit)
  const salesByDayAgg = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    { $group: { _id: dayKeyExpr('$sale_date') as any, revenue: { $sum: '$total' } } },
    { $project: { _id: 0, day: '$_id', revenue: { $round: ['$revenue', 2] } } },
    { $sort: { day: 1 } }
  ]);

  const expensesByDayAgg = await Expense.aggregate([
    { $match: { expense_date: { $gte: start } } },
    { $group: { _id: dayKeyExpr('$expense_date') as any, expenses: { $sum: '$total_amount' } } },
    { $project: { _id: 0, day: '$_id', expenses: { $round: ['$expenses', 2] } } },
    { $sort: { day: 1 } }
  ]);

  // gross profit by day
  const grossByDayAgg = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product_id',
        foreignField: '_id',
        as: 'prod'
      }
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        day: dayKeyExpr('$sale_date') as any,
        unit_cost: { $ifNull: ['$prod.unit_cost', 0] },
        qty: '$items.qty',
        unit_price: '$items.unit_price'
      }
    },
    {
      $group: {
        _id: '$day',
        gross_profit: { $sum: { $multiply: [{ $subtract: ['$unit_price', '$unit_cost'] }, '$qty'] } }
      }
    },
    { $project: { _id: 0, day: '$_id', gross_profit: { $round: ['$gross_profit', 2] } } },
    { $sort: { day: 1 } }
  ]);

  const totals = {
    revenue: Number(salesTotalsAgg[0]?.revenue ?? 0),
    transactions: Number(salesTotalsAgg[0]?.transactions ?? 0),
    expenses: Number(expensesTotalsAgg[0]?.expenses ?? 0),
    gross_profit: Number(grossAgg[0]?.gross_profit ?? 0)
  };

  const net_profit = Number((totals.revenue - totals.expenses).toFixed(2));

  // Merge series by day
  const map = new Map<string, { day: string; revenue: number; expenses: number; gross_profit: number }>();
  for (const r of salesByDayAgg) {
    map.set(String(r.day), { day: String(r.day), revenue: Number(r.revenue ?? 0), expenses: 0, gross_profit: 0 });
  }
  for (const r of expensesByDayAgg) {
    const k = String(r.day);
    const prev = map.get(k) ?? { day: k, revenue: 0, expenses: 0, gross_profit: 0 };
    prev.expenses = Number(r.expenses ?? 0);
    map.set(k, prev);
  }
  for (const r of grossByDayAgg) {
    const k = String(r.day);
    const prev = map.get(k) ?? { day: k, revenue: 0, expenses: 0, gross_profit: 0 };
    prev.gross_profit = Number(r.gross_profit ?? 0);
    map.set(k, prev);
  }

  const series = [...map.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ ...d, net_profit: Number((d.revenue - d.expenses).toFixed(2)) }));

  return { period, start: start.toISOString(), totals: { ...totals, net_profit }, series };
}

export async function topProductsReport(period: ReportPeriod) {
  const start = periodStart(period);

  const rows = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product_id',
        foreignField: '_id',
        as: 'prod'
      }
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        product_id: '$items.product_id',
        product_name: '$items.product_name',
        qty: '$items.qty',
        revenue: '$items.line_total',
        unit_cost: { $ifNull: ['$prod.unit_cost', 0] }
      }
    },
    {
      $group: {
        _id: '$product_id',
        product_id: { $first: '$product_id' },
        product_name: { $first: '$product_name' },
        qty_sold: { $sum: '$qty' },
        revenue: { $sum: '$revenue' },
        profit: { $sum: { $multiply: [{ $subtract: ['$items.unit_price', '$unit_cost'] }, '$qty'] } }
      }
    },
    {
      $project: {
        _id: 0,
        product_id: { $toString: '$product_id' },
        product_name: 1,
        qty_sold: 1,
        revenue: { $round: ['$revenue', 2] },
        profit: { $round: ['$profit', 2] }
      }
    },
    { $sort: { qty_sold: -1 } },
    { $limit: 20 }
  ]);

  return { period, start: start.toISOString(), rows };
}

export async function customerInsightsReport(period: ReportPeriod) {
  const start = periodStart(period);
  const now = Date.now();
  const days = Math.max(1, Math.ceil((now - start.getTime()) / (24 * 60 * 60 * 1000)));

  const rows = await Sale.aggregate([
    { $match: { sale_date: { $gte: start } } },
    {
      $addFields: {
        customer_key: { $ifNull: ['$customer', '(No customer)'] },
        unpaid_total: { $cond: ['$unpaid', '$total', 0] }
      }
    },
    {
      $group: {
        _id: '$customer_key',
        customer: { $first: '$customer_key' },
        transactions: { $sum: 1 },
        revenue: { $sum: '$total' },
        unpaid_total: { $sum: '$unpaid_total' },
        last_purchase: { $max: '$sale_date' }
      }
    },
    {
      $project: {
        _id: 0,
        customer: 1,
        transactions: 1,
        revenue: { $round: ['$revenue', 2] },
        unpaid_total: { $round: ['$unpaid_total', 2] },
        last_purchase: 1
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 20 }
  ]);

  const enriched = rows.map((r: any) => ({
    ...r,
    purchase_frequency_per_day: Number((Number(r.transactions ?? 0) / days).toFixed(3))
  }));

  return { period, start: start.toISOString(), days, rows: enriched };
}

export async function lowStockReport() {
  const rows = await Product.find({ archived: { $ne: true } })
    .select('name category price stock low_stock_threshold sku unit_cost')
    .lean();
  const low = rows
    .filter((p: any) => Number(p.stock ?? 0) <= Number(p.low_stock_threshold ?? 0))
    .map((p: any) => {
      const stock = Number(p.stock ?? 0);
      const thr = Number(p.low_stock_threshold ?? 0);
      const target = Math.max(thr * 3, thr + 10, 10);
      const suggested_restock = Math.max(0, Math.ceil(target - stock));
      return {
        id: String(p._id),
        name: p.name,
        category: p.category,
        sku: p.sku ?? null,
        price: Number(p.price ?? 0),
        unit_cost: Number(p.unit_cost ?? 0),
        stock,
        low_stock_threshold: thr,
        suggested_restock
      };
    })
    .sort((a: any, b: any) => (a.stock - a.low_stock_threshold) - (b.stock - b.low_stock_threshold));

  return { total_low_stock: low.length, rows: low };
}


