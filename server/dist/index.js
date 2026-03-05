import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { connectDb, dbStatus } from './db/db.js';
import { findUserByUsername, hashPassword, signToken, verifyPassword } from './auth.js';
import { audit } from './audit.js';
import { requireAuth, requireRole } from './middleware/authz.js';
import { CreateCustomerSchema, CreateExpenseSchema, CreateProductSchema, CreateSaleSchema, DecreaseStockSchema, RefundSaleSchema, RestockSchema, UpdateCustomerSchema, UpdateProductSchema } from './schemas.js';
import { archiveProduct, createProduct, decreaseStockProduct, deleteProductPermanently, inventorySummary, listProducts, productStockHistory, restockProduct, updateProduct } from './inventory.js';
import { createSale, deleteSaleByReceipt, getSaleByReceipt, getSalesHistory, refundSaleByReceipt, salesReport } from './sales.js';
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from './customers.js';
import { createExpense, deleteExpense, getExpense, listExpenses } from './expenses.js';
import { sendPdf, hr, kv, money, tableHeader, tableRow, title } from './pdf.js';
import { customerInsightsReport, lowStockReport, profitReport, topProductsReport } from './reports.js';
import { AuditLog, Customer, Expense, InventoryLog, Product, Refund, Sale, User } from './models.js';
// Ensure local env file reliably overrides any pre-existing environment variables (Windows often has stale env)
dotenv.config({ override: true });
const app = express();
app.use(cors());
app.use(express.json());
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// Ensure DB connected for API routes (including /api/auth/*)
app.use(asyncHandler(async (req, _res, next) => {
    if (req.path.startsWith('/api')) {
        await connectDb();
    }
    next();
}));
// --- Auth routes (no auth required) ---
app.post('/api/auth/bootstrap', asyncHandler(async (req, res) => {
    const secret = process.env.BOOTSTRAP_SECRET?.trim();
    if (!secret)
        return res.status(500).json({ error: 'BOOTSTRAP_SECRET is not set on server' });
    const provided = String(req.headers['x-bootstrap-secret'] ?? '').trim();
    if (provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(6)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const count = await User.countDocuments({});
    if (count > 0)
        return res.status(400).json({ error: 'Already bootstrapped' });
    const password_hash = await hashPassword(parsed.data.password);
    const u = await User.create({ username: parsed.data.username.trim(), password_hash, role: 'owner' });
    await audit(req, { id: String(u._id), username: u.username, role: 'owner' }, 'auth.bootstrap', 'user', String(u._id));
    res.json({ ok: true });
}));
// Admin password reset (protected by BOOTSTRAP_SECRET)
// Use when the instance is already bootstrapped but you lost the password.
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const secret = process.env.BOOTSTRAP_SECRET?.trim();
    if (!secret)
        return res.status(500).json({ error: 'BOOTSTRAP_SECRET is not set on server' });
    const provided = String(req.headers['x-bootstrap-secret'] ?? '').trim();
    if (provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const schema = z.object({
        username: z.string().min(1),
        new_password: z.string().min(6)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const username = parsed.data.username.trim();
    const password_hash = await hashPassword(parsed.data.new_password);
    const result = await User.updateOne({ username }, { $set: { password_hash } });
    if (!result.matchedCount)
        return res.status(404).json({ error: 'User not found' });
    await audit(req, null, 'auth.reset_password', 'user', username, { username, password: '***' });
    res.json({ ok: true });
}));
app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const errorMsg = Object.values(errors).flat().join(', ') || 'Invalid input';
        return res.status(400).json({ error: errorMsg });
    }
    const u = await findUserByUsername(parsed.data.username.trim());
    if (!u)
        return res.status(401).json({ error: 'Invalid username or password' });
    const ok = await verifyPassword(parsed.data.password, u.password_hash);
    if (!ok)
        return res.status(401).json({ error: 'Invalid username or password' });
    const user = { id: u.id, username: u.username, role: u.role };
    const token = signToken(user);
    await audit(req, user, 'auth.login', 'user', u.id);
    res.json({ token, user });
}));
app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
}));
// Public health endpoint under /api for Vercel (so it can be rewritten from /health)
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'Elman API', time: new Date().toISOString(), db: dbStatus() });
});
// Require auth for all remaining /api routes
app.use('/api', requireAuth);
// connect to MongoDB Atlas (best-effort)
connectDb().catch((err) => {
    console.error('Failed to connect to MongoDB', err);
});
app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'Elman API', time: new Date().toISOString(), db: dbStatus() });
});
// --- Customers (CRM) ---
app.get('/api/customers', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(await listCustomers(search));
}));
app.post('/api/customers', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = CreateCustomerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const id = await createCustomer(parsed.data);
    await audit(req, req.user ?? null, 'customer.create', 'customer', String(id));
    res.status(201).json({ id });
}));
app.put('/api/customers/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = UpdateCustomerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    await updateCustomer(String(req.params.id), parsed.data);
    await audit(req, req.user ?? null, 'customer.update', 'customer', String(req.params.id), parsed.data);
    res.json({ ok: true });
}));
app.delete('/api/customers/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    try {
        await deleteCustomer(String(req.params.id));
        await audit(req, req.user ?? null, 'customer.delete', 'customer', String(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Failed to delete customer' });
    }
}));
// --- Expenses ---
app.get('/api/expenses', requireRole(['owner']), asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(await listExpenses({ search }));
}));
app.get('/api/expenses/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    const exp = await getExpense(String(req.params.id));
    if (!exp)
        return res.status(404).json({ error: 'Not found' });
    res.json(exp);
}));
app.get('/api/expenses/:id/pdf', requireRole(['owner']), asyncHandler(async (req, res) => {
    const exp = await getExpense(String(req.params.id));
    if (!exp)
        return res.status(404).json({ error: 'Not found' });
    sendPdf(res, `expense-${exp.id}.pdf`, (doc) => {
        title(doc, 'ELMAN â€” Expense');
        kv(doc, 'Date', new Date(exp.expense_date).toLocaleString());
        kv(doc, 'Type', String(exp.category));
        kv(doc, 'Vendor', exp.vendor ?? '');
        kv(doc, 'Notes', exp.notes ?? '');
        hr(doc);
        title(doc, 'Items');
        const widths = [260, 70, 90, 90];
        tableHeader(doc, ['Name', 'Qty', 'Unit', 'Total'], widths);
        if (!exp.items.length) {
            tableRow(doc, ['(no items â€” bill/utility)', '', '', ''], widths);
        }
        else {
            for (const it of exp.items) {
                tableRow(doc, [String(it.item_name), String(it.quantity), money(it.unit_price), money(it.line_total)], widths);
            }
        }
        hr(doc);
        kv(doc, 'Total Amount', money(exp.total_amount));
    });
}));
app.post('/api/expenses', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = CreateExpenseSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    try {
        const id = await createExpense(parsed.data);
        await audit(req, req.user ?? null, 'expense.create', 'expense', String(id), parsed.data);
        res.status(201).json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Expense failed' });
    }
}));
app.delete('/api/expenses/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    try {
        await deleteExpense(String(req.params.id));
        await audit(req, req.user ?? null, 'expense.delete', 'expense', String(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Failed to delete expense' });
    }
}));
// Products / Inventory
app.get('/api/products', requireRole(['owner', 'cashier']), asyncHandler(async (_req, res) => {
    res.json(await listProducts());
}));
// --- Users (Owner only) ---
app.get('/api/users', requireRole(['owner']), asyncHandler(async (_req, res) => {
    const rows = await User.find({}).sort({ created_at: -1 }).select('username role created_at').lean();
    res.json(rows.map((u) => ({ id: String(u._id), username: u.username, role: u.role, created_at: u.created_at })));
}));
app.post('/api/users', requireRole(['owner']), asyncHandler(async (req, res) => {
    const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        role: z.enum(['owner', 'cashier']).default('cashier')
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const username = parsed.data.username.trim();
    const password_hash = await hashPassword(parsed.data.password);
    try {
        const u = await User.create({ username, password_hash, role: parsed.data.role });
        await audit(req, req.user ?? null, 'user.create', 'user', String(u._id), { username, role: parsed.data.role });
        res.status(201).json({ id: String(u._id) });
    }
    catch (e) {
        const msg = e?.code === 11000 ? 'Username already exists' : (e?.message ?? 'User create failed');
        res.status(400).json({ error: msg });
    }
}));
app.put('/api/users/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    const schema = z.object({
        password: z.string().min(6).optional(),
        role: z.enum(['owner', 'cashier']).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const patch = {};
    if (parsed.data.password) {
        patch.password_hash = await hashPassword(parsed.data.password);
    }
    if (parsed.data.role) {
        patch.role = parsed.data.role;
    }
    await User.updateOne({ _id: req.params.id }, { $set: patch });
    await audit(req, req.user ?? null, 'user.update', 'user', String(req.params.id), { ...parsed.data, password: parsed.data.password ? '***' : undefined });
    res.json({ ok: true });
}));
// --- Audit (Owner only) ---
app.get('/api/audit', requireRole(['owner']), asyncHandler(async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 200)));
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const filter = {};
    if (entity)
        filter.entity = entity;
    if (action)
        filter.action = action;
    const rows = await AuditLog.find(filter).sort({ at: -1 }).limit(limit).lean();
    res.json(rows.map((r) => ({
        id: String(r._id),
        at: r.at,
        username: r.username ?? null,
        role: r.role ?? null,
        action: r.action,
        entity: r.entity,
        entity_id: r.entity_id ?? null,
        meta: r.meta ?? null
    })));
}));
app.post('/api/products', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const id = await createProduct(parsed.data);
    await audit(req, req.user ?? null, 'product.create', 'product', String(id), parsed.data);
    res.status(201).json({ id });
}));
app.put('/api/products/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = UpdateProductSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    await updateProduct(String(req.params.id), parsed.data);
    await audit(req, req.user ?? null, 'product.update', 'product', String(req.params.id), parsed.data);
    res.json({ ok: true });
}));
app.delete('/api/products/:id', requireRole(['owner']), asyncHandler(async (req, res) => {
    try {
        await archiveProduct(String(req.params.id));
        await audit(req, req.user ?? null, 'product.archive', 'product', String(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Failed to remove product' });
    }
}));
app.delete('/api/products/:id/permanent', requireRole(['owner']), asyncHandler(async (req, res) => {
    try {
        await deleteProductPermanently(String(req.params.id));
        await audit(req, req.user ?? null, 'product.delete', 'product', String(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Failed to delete product' });
    }
}));
app.post('/api/products/:id/restock', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = RestockSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    await restockProduct(String(req.params.id), parsed.data.qty, parsed.data.reason);
    await audit(req, req.user ?? null, 'product.restock', 'product', String(req.params.id), parsed.data);
    res.json({ ok: true });
}));
app.post('/api/products/:id/decrease', requireRole(['owner']), asyncHandler(async (req, res) => {
    const parsed = DecreaseStockSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    await decreaseStockProduct(String(req.params.id), parsed.data.qty, parsed.data.reason);
    await audit(req, req.user ?? null, 'product.decrease', 'product', String(req.params.id), parsed.data);
    res.json({ ok: true });
}));
app.get('/api/products/:id/history', requireRole(['owner']), asyncHandler(async (req, res) => {
    res.json(await productStockHistory(String(req.params.id)));
}));
app.get('/api/reports/inventory', requireRole(['owner']), asyncHandler(async (_req, res) => {
    res.json(await inventorySummary());
}));
app.get('/api/reports/profit', requireRole(['owner']), asyncHandler(async (req, res) => {
    const p = String(req.query.period ?? 'monthly') ?? 'monthly';
    if (p !== 'daily' && p !== 'weekly' && p !== 'monthly') {
        return res.status(400).json({ error: 'Invalid period' });
    }
    res.json(await profitReport(p));
}));
app.get('/api/reports/top-products', requireRole(['owner']), asyncHandler(async (req, res) => {
    const p = String(req.query.period ?? 'monthly') ?? 'monthly';
    if (p !== 'daily' && p !== 'weekly' && p !== 'monthly') {
        return res.status(400).json({ error: 'Invalid period' });
    }
    res.json(await topProductsReport(p));
}));
app.get('/api/reports/customer-insights', requireRole(['owner']), asyncHandler(async (req, res) => {
    const p = String(req.query.period ?? 'monthly') ?? 'monthly';
    if (p !== 'daily' && p !== 'weekly' && p !== 'monthly') {
        return res.status(400).json({ error: 'Invalid period' });
    }
    res.json(await customerInsightsReport(p));
}));
app.get('/api/reports/low-stock', requireRole(['owner']), asyncHandler(async (_req, res) => {
    res.json(await lowStockReport());
}));
app.get('/api/reports/inventory/pdf', requireRole(['owner']), asyncHandler(async (_req, res) => {
    const report = await inventorySummary();
    sendPdf(res, 'inventory-history.pdf', (doc) => {
        title(doc, 'ELMAN â€” Inventory Movement History');
        kv(doc, 'Printed', new Date().toLocaleString());
        hr(doc);
        const widths = [140, 180, 60, 140];
        tableHeader(doc, ['Date', 'Product', 'Change', 'Reason'], widths);
        for (const h of report.history) {
            tableRow(doc, [
                new Date(String(h.date)).toLocaleString(),
                String(h.product),
                String(h.change),
                String(h.reason)
            ], widths);
        }
        hr(doc);
        kv(doc, 'Total Products', String(report.totals?.total_products ?? 0));
        kv(doc, 'Low Stock Items', String(report.totals?.low_stock_items ?? 0));
        kv(doc, 'Inventory Value', money(report.totals?.total_inventory_value ?? 0));
    });
}));
// --- Admin / Danger Zone ---
app.post('/api/admin/wipe', requireRole(['owner']), asyncHandler(async (req, res) => {
    const schema = z.object({
        confirm: z.string().min(1),
        includeUsers: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    if (parsed.data.confirm.trim().toUpperCase() !== 'DELETE ALL') {
        return res.status(400).json({ error: 'Type DELETE ALL to confirm' });
    }
    const includeUsers = Boolean(parsed.data.includeUsers);
    const deleted = {};
    deleted.customers = (await Customer.deleteMany({})).deletedCount ?? 0;
    deleted.products = (await Product.deleteMany({})).deletedCount ?? 0;
    deleted.inventory_log = (await InventoryLog.deleteMany({})).deletedCount ?? 0;
    deleted.sales = (await Sale.deleteMany({})).deletedCount ?? 0;
    deleted.refunds = (await Refund.deleteMany({})).deletedCount ?? 0;
    deleted.expenses = (await Expense.deleteMany({})).deletedCount ?? 0;
    deleted.audit_log = (await AuditLog.deleteMany({})).deletedCount ?? 0;
    if (includeUsers)
        deleted.users = (await User.deleteMany({})).deletedCount ?? 0;
    await audit(req, req.user ?? null, 'admin.wipe', 'admin', 'wipe', { includeUsers, deleted });
    res.json({ ok: true, deleted });
}));
// Sales / POS
app.post('/api/sales', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const parsed = CreateSaleSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    try {
        const result = await createSale(parsed.data);
        await audit(req, req.user ?? null, 'sale.create', 'sale', String(result?.sale_id ?? ''), { receipt_ref: result?.receipt_ref });
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Sale failed' });
    }
}));
app.get('/api/sales/history', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(await getSalesHistory({ search }));
}));
app.get('/api/sales/:receipt_ref', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const receipt_ref = String(req.params.receipt_ref);
    const sale = await getSaleByReceipt(receipt_ref);
    if (!sale)
        return res.status(404).json({ error: 'Not found' });
    res.json(sale);
}));
app.delete('/api/sales/:receipt_ref', requireRole(['owner']), asyncHandler(async (req, res) => {
    try {
        const receipt_ref = String(req.params.receipt_ref);
        await deleteSaleByReceipt(receipt_ref);
        await audit(req, req.user ?? null, 'sale.delete', 'sale', receipt_ref);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Failed to delete sale' });
    }
}));
app.post('/api/sales/:receipt_ref/refund', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const parsed = RefundSaleSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const receipt_ref = String(req.params.receipt_ref);
    const result = await refundSaleByReceipt(receipt_ref, parsed.data);
    await audit(req, req.user ?? null, 'sale.refund', 'sale', receipt_ref, parsed.data);
    res.json(result);
}));
app.get('/api/sales/:receipt_ref/pdf', requireRole(['owner', 'cashier']), asyncHandler(async (req, res) => {
    const receipt_ref = String(req.params.receipt_ref);
    const sale = await getSaleByReceipt(receipt_ref);
    if (!sale)
        return res.status(404).json({ error: 'Not found' });
    sendPdf(res, `receipt-${receipt_ref}.pdf`, (doc) => {
        title(doc, 'ELMAN â€” Sales Receipt');
        kv(doc, 'Receipt Ref', String(sale.receipt_ref));
        kv(doc, 'Date', new Date(sale.sale_date).toLocaleString());
        kv(doc, 'Cashier', String(sale.cashier));
        kv(doc, 'Customer', sale.customer ?? '');
        kv(doc, 'Payment', String(sale.payment_method));
        hr(doc);
        const widths = [240, 60, 90, 90];
        tableHeader(doc, ['Item', 'Qty', 'Unit', 'Total'], widths);
        for (const it of sale.items) {
            tableRow(doc, [String(it.product_name), String(it.qty), money(it.unit_price), money(it.line_total)], widths);
        }
        hr(doc);
        kv(doc, 'Subtotal', money(sale.subtotal));
        kv(doc, 'Discount', money(sale.discount));
        kv(doc, 'Total', money(sale.total));
    });
}));
app.get('/api/reports/sales', asyncHandler(async (req, res) => {
    const periodSchema = z.enum(['daily', 'weekly', 'monthly']);
    const period = periodSchema.safeParse(req.query.period ?? 'daily');
    if (!period.success)
        return res.status(400).json({ error: 'Invalid period' });
    res.json(await salesReport(period.data));
}));
// Express error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    const rawMsg = err && typeof err.message === 'string' && err.message.trim()
        ? err.message.trim()
        : String(err ?? 'Server error');
    // If the DB is misconfigured/unreachable, return a safe + actionable message (and avoid leaking raw DB errors)
    const lower = rawMsg.toLowerCase();
    const isDbAuth = lower.includes('authentication failed') ||
        lower.includes('bad auth') ||
        err?.codeName === 'AtlasError' ||
        err?.name === 'MongoServerError';
    const isDbConn = isDbAuth ||
        lower.includes('mongoparseerror') ||
        lower.includes('mongoose') ||
        lower.includes('mongodb_uri') ||
        lower.includes('server selection') ||
        lower.includes('ecconnrefused') ||
        lower.includes('timed out') ||
        lower.includes('failed to connect to mongodb');
    if (isDbConn) {
        return res.status(503).json({
            error: 'Database connection failed. Check server env MONGODB_URI (Atlas username/password, IP allowlist, and that you pasted only the URI value).'
        });
    }
    res.status(500).json({ error: rawMsg });
});
// In Vercel we serve the web app separately via static output + rewrites.
// Local/prod server deployments may still serve the built web app directly.
if (!process.env.VERCEL) {
    const webDist = path.resolve(process.cwd(), '..', 'web', 'dist');
    if (fs.existsSync(webDist)) {
        app.use(express.static(webDist));
        // SPA fallback
        app.get('*', (req, res) => {
            if (req.path.startsWith('/api') || req.path === '/health') {
                return res.status(404).json({ error: 'Not found' });
            }
            res.sendFile(path.join(webDist, 'index.html'));
        });
    }
}
export default app;
// Local dev / non-Vercel environments run as a normal server process.
if (!process.env.VERCEL) {
    const port = Number(process.env.PORT ?? 5050);
    app.listen(port, () => {
        console.log(`Elman server listening on http://localhost:${port}`);
    });
}
