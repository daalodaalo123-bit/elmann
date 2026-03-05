import mongoose, { Schema } from 'mongoose';

export type CustomerDoc = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: Date;
};

const CustomerSchema = new Schema<CustomerDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    notes: { type: String },
    created_at: { type: Date, default: () => new Date() }
  },
  { collection: 'customers' }
);
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ email: 1 });

export const Customer =
  (mongoose.models.Customer as mongoose.Model<CustomerDoc>) ||
  mongoose.model<CustomerDoc>('Customer', CustomerSchema);

export type ProductDoc = {
  name: string;
  category: string;
  sku?: string;
  price: number;
  unit_cost: number;
  stock: number;
  low_stock_threshold: number;
  archived: boolean;
  archived_at?: Date;
  created_at: Date;
};

const ProductSchema = new Schema<ProductDoc>(
  {
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
  },
  { collection: 'products' }
);
ProductSchema.index({ name: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ sku: 1 }, { unique: true, sparse: true });
ProductSchema.index({ archived: 1, name: 1 });

export const Product =
  (mongoose.models.Product as mongoose.Model<ProductDoc>) ||
  mongoose.model<ProductDoc>('Product', ProductSchema);

export type InventoryLogDoc = {
  product_id: mongoose.Types.ObjectId;
  product_name: string;
  change_type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'REFUND';
  qty_change: number;
  reason: string;
  created_at: Date;
};

const InventoryLogSchema = new Schema<InventoryLogDoc>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    change_type: { type: String, required: true },
    qty_change: { type: Number, required: true },
    reason: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() }
  },
  { collection: 'inventory_log' }
);
InventoryLogSchema.index({ created_at: -1 });
InventoryLogSchema.index({ product_id: 1, created_at: -1 });

export const InventoryLog =
  (mongoose.models.InventoryLog as mongoose.Model<InventoryLogDoc>) ||
  mongoose.model<InventoryLogDoc>('InventoryLog', InventoryLogSchema);

export type SaleItem = {
  product_id: mongoose.Types.ObjectId;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

const SaleItemSchema = new Schema<SaleItem>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

export type SaleDoc = {
  receipt_ref: string;
  sale_date: Date;
  cashier: string;
  customer?: string;
  customer_id?: mongoose.Types.ObjectId;
  payment_method: 'Cash' | 'Zaad' | 'Edahab';
  subtotal: number;
  discount: number;
  total: number;
  unpaid: boolean;
  refunded_total: number;
  fully_refunded: boolean;
  items: SaleItem[];
};

const SaleSchema = new Schema<SaleDoc>(
  {
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
  },
  { collection: 'sales' }
);
SaleSchema.index({ sale_date: -1 });
SaleSchema.index({ receipt_ref: 1 }, { unique: true });
SaleSchema.index({ customer: 1 });

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDoc>) || mongoose.model<SaleDoc>('Sale', SaleSchema);

export type RefundItem = {
  product_id: mongoose.Types.ObjectId;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

const RefundItemSchema = new Schema<RefundItem>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

export type RefundDoc = {
  sale_id: mongoose.Types.ObjectId;
  receipt_ref: string;
  refund_date: Date;
  cashier: string;
  reason: string;
  total_refund: number;
  items: RefundItem[];
};

const RefundSchema = new Schema<RefundDoc>(
  {
    sale_id: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
    receipt_ref: { type: String, required: true },
    refund_date: { type: Date, default: () => new Date() },
    cashier: { type: String, required: true },
    reason: { type: String, required: true },
    total_refund: { type: Number, required: true, min: 0 },
    items: { type: [RefundItemSchema], default: [] }
  },
  { collection: 'refunds' }
);
RefundSchema.index({ receipt_ref: 1, refund_date: -1 });

export const Refund =
  (mongoose.models.Refund as mongoose.Model<RefundDoc>) ||
  mongoose.model<RefundDoc>('Refund', RefundSchema);

export type UserDoc = {
  username: string;
  password_hash: string;
  role: 'owner' | 'cashier';
  created_at: Date;
};

const UserSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, trim: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() }
  },
  { collection: 'users' }
);
UserSchema.index({ username: 1 }, { unique: true });

export const User =
  (mongoose.models.User as mongoose.Model<UserDoc>) || mongoose.model<UserDoc>('User', UserSchema);

export type AuditLogDoc = {
  at: Date;
  user_id?: mongoose.Types.ObjectId;
  username?: string;
  role?: string;
  action: string;
  entity: string;
  entity_id?: string;
  meta?: any;
  ip?: string;
  user_agent?: string;
};

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
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
  },
  { collection: 'audit_log' }
);
AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ entity: 1, at: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogDoc>) ||
  mongoose.model<AuditLogDoc>('AuditLog', AuditLogSchema);

export type ExpenseItem = {
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const ExpenseItemSchema = new Schema<ExpenseItem>(
  {
    item_name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.0001, default: 1 },
    unit_price: { type: Number, required: true, min: 0, default: 0 },
    line_total: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

export type ExpenseDoc = {
  expense_date: Date;
  category: 'Inventory Purchase' | 'Vendor Bill' | 'Electricity' | 'Rent' | 'Other';
  vendor?: string;
  notes?: string;
  total_amount: number;
  created_at: Date;
  items: ExpenseItem[];
};

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    expense_date: { type: Date, default: () => new Date() },
    category: { type: String, required: true },
    vendor: { type: String },
    notes: { type: String },
    total_amount: { type: Number, required: true, min: 0 },
    created_at: { type: Date, default: () => new Date() },
    items: { type: [ExpenseItemSchema], default: [] }
  },
  { collection: 'expenses' }
);
ExpenseSchema.index({ expense_date: -1 });
ExpenseSchema.index({ category: 1 });

export const Expense =
  (mongoose.models.Expense as mongoose.Model<ExpenseDoc>) ||
  mongoose.model<ExpenseDoc>('Expense', ExpenseSchema);