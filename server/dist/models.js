import mongoose, { Schema } from 'mongoose';
const CustomerSchema = new Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    notes: { type: String },
    created_at: { type: Date, default: () => new Date() }
}, { collection: 'customers' });
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ email: 1 });
export const Customer = mongoose.models.Customer ||
    mongoose.model('Customer', CustomerSchema);
const ProductSchema = new Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, required: true, min: 0, default: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    low_stock_threshold: { type: Number, required: true, min: 0, default: 0 },
    archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date },
    created_at: { type: Date, default: () => new Date() }
}, { collection: 'products' });
ProductSchema.index({ name: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ sku: 1 }, { unique: true, sparse: true });
ProductSchema.index({ archived: 1, name: 1 });
export const Product = mongoose.models.Product ||
    mongoose.model('Product', ProductSchema);
const InventoryLogSchema = new Schema({
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    change_type: { type: String, required: true },
    qty_change: { type: Number, required: true },
    reason: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() }
}, { collection: 'inventory_log' });
InventoryLogSchema.index({ created_at: -1 });
InventoryLogSchema.index({ product_id: 1, created_at: -1 });
export const InventoryLog = mongoose.models.InventoryLog ||
    mongoose.model('InventoryLog', InventoryLogSchema);
const SaleItemSchema = new Schema({
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 }
}, { _id: false });
const SaleSchema = new Schema({
    receipt_ref: { type: String, required: true, unique: true },
    sale_date: { type: Date, default: () => new Date() },
    cashier: { type: String, required: true },
    customer: { type: String },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    payment_method: { type: String, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    unpaid: { type: Boolean, required: true, default: false },
    refunded_total: { type: Number, required: true, min: 0, default: 0 },
    fully_refunded: { type: Boolean, required: true, default: false },
    items: { type: [SaleItemSchema], default: [] }
}, { collection: 'sales' });
SaleSchema.index({ sale_date: -1 });
SaleSchema.index({ receipt_ref: 1 }, { unique: true });
SaleSchema.index({ customer: 1 });
export const Sale = mongoose.models.Sale || mongoose.model('Sale', SaleSchema);
const RefundItemSchema = new Schema({
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 }
}, { _id: false });
const RefundSchema = new Schema({
    sale_id: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
    receipt_ref: { type: String, required: true },
    refund_date: { type: Date, default: () => new Date() },
    cashier: { type: String, required: true },
    reason: { type: String, required: true },
    total_refund: { type: Number, required: true, min: 0 },
    items: { type: [RefundItemSchema], default: [] }
}, { collection: 'refunds' });
RefundSchema.index({ receipt_ref: 1, refund_date: -1 });
export const Refund = mongoose.models.Refund ||
    mongoose.model('Refund', RefundSchema);
const UserSchema = new Schema({
    username: { type: String, required: true, trim: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() }
}, { collection: 'users' });
UserSchema.index({ username: 1 }, { unique: true });
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
const AuditLogSchema = new Schema({
    at: { type: Date, default: () => new Date() },
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    role: { type: String },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entity_id: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    user_agent: { type: String }
}, { collection: 'audit_log' });
AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ entity: 1, at: -1 });
export const AuditLog = mongoose.models.AuditLog ||
    mongoose.model('AuditLog', AuditLogSchema);
const ExpenseItemSchema = new Schema({
    item_name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.0001, default: 1 },
    unit_price: { type: Number, required: true, min: 0, default: 0 },
    line_total: { type: Number, required: true, min: 0 }
}, { _id: false });
const ExpenseSchema = new Schema({
    expense_date: { type: Date, default: () => new Date() },
    category: { type: String, required: true },
    vendor: { type: String },
    notes: { type: String },
    total_amount: { type: Number, required: true, min: 0 },
    created_at: { type: Date, default: () => new Date() },
    items: { type: [ExpenseItemSchema], default: [] }
}, { collection: 'expenses' });
ExpenseSchema.index({ expense_date: -1 });
ExpenseSchema.index({ category: 1 });
export const Expense = mongoose.models.Expense ||
    mongoose.model('Expense', ExpenseSchema);
