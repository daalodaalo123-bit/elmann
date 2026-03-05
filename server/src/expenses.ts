import mongoose from 'mongoose';
import { Expense } from './models.js';

export async function listExpenses(queryArg?: { search?: string }) {
  const q = (queryArg?.search ?? '').trim();
  const filter: any = {};
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ category: re }, { vendor: re }, { notes: re }];
  }

  const rows = await Expense.find(filter).sort({ expense_date: -1 }).limit(300).lean();

  return rows.map((e: any) => ({
    id: String(e._id),
    expense_date: e.expense_date,
    category: e.category,
    vendor: e.vendor ?? null,
    notes: e.notes ?? null,
    total_amount: e.total_amount,
    items_count: (e.items?.length ?? 0)
  }));
}

export async function getExpense(id: string) {
  const _id = new mongoose.Types.ObjectId(id);
  const e = await Expense.findById(_id).lean();
  if (!e) return undefined;

  return {
    id: String(e._id),
    expense_date: e.expense_date,
    category: e.category,
    vendor: e.vendor ?? null,
    notes: e.notes ?? null,
    total_amount: e.total_amount,
    created_at: e.created_at,
    items: (e.items ?? []).map((it: any) => ({
      id: `${String(e._id)}:${it.item_name}:${it.line_total}`,
      item_name: it.item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total
    }))
  };
}

export async function createExpense(input: any) {
  const expense_date = input.expense_date ? new Date(String(input.expense_date)) : new Date();

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = rawItems.map((it: any) => {
    const quantity = Number(it.quantity ?? 1);
    const unit_price = Number(it.unit_price ?? 0);
    const line_total = quantity * unit_price;
    return {
      item_name: String(it.item_name),
      quantity,
      unit_price,
      line_total
    };
  });

  const amount = input.amount != null ? Number(input.amount) : null;
  const itemsTotal = items.reduce((s: number, x: any) => s + x.line_total, 0);
  const total_amount = amount != null ? amount : itemsTotal;

  if (!Number.isFinite(total_amount) || total_amount < 0) throw new Error('Invalid total amount');
  if (amount == null && items.length === 0) throw new Error('Please add items or enter an amount');

  const e = await Expense.create({
    expense_date,
    category: input.category,
    vendor: input.vendor,
    notes: input.notes,
    total_amount,
    items
  });

  return String(e._id);
}

export async function deleteExpense(id: string) {
  const _id = new mongoose.Types.ObjectId(id);
  const del = await Expense.deleteOne({ _id });
  if (!del.deletedCount) throw new Error('Expense not found');
  return { ok: true };
}