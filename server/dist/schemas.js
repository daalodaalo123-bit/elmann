import { z } from 'zod';
export const PaymentMethodSchema = z.enum(['Cash', 'Zaad', 'Edahab']);
export const CreateProductSchema = z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    sku: z.string().min(1).optional(),
    price: z.number().nonnegative(),
    unit_cost: z.number().nonnegative().default(0),
    stock: z.number().int().nonnegative().default(0),
    low_stock_threshold: z.number().int().nonnegative().default(0)
});
export const UpdateProductSchema = CreateProductSchema.partial();
export const RestockSchema = z.object({
    qty: z.number().int().positive(),
    reason: z.string().min(1).default('Restock')
});
export const DecreaseStockSchema = z.object({
    qty: z.number().int().positive(),
    reason: z.string().min(1).default('Stock adjustment')
});
export const CreateCustomerSchema = z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    notes: z.string().optional()
});
export const UpdateCustomerSchema = CreateCustomerSchema.partial();
// MongoDB ObjectIds are strings
export const CreateSaleSchema = z.object({
    sale_date: z.string().optional(),
    cashier: z.string().min(1),
    customer: z.string().optional(),
    customer_id: z.string().min(1).optional(),
    payment_method: PaymentMethodSchema,
    discount: z.number().nonnegative().default(0),
    unpaid: z.boolean().default(false),
    items: z
        .array(z.object({
        product_id: z.string().min(1),
        qty: z.number().int().positive(),
        unit_price: z.number().nonnegative().optional()
    }))
        .min(1)
});
export const RefundSaleSchema = z.object({
    cashier: z.string().min(1).default('Main Cashier'),
    reason: z.string().min(1).default('Refund'),
    items: z
        .array(z.object({
        product_id: z.string().min(1),
        qty: z.number().int().positive()
    }))
        .min(1)
});
export const ExpenseCategorySchema = z.enum([
    'Inventory Purchase',
    'Vendor Bill',
    'Electricity',
    'Rent',
    'Other'
]);
export const CreateExpenseSchema = z.object({
    expense_date: z.string().optional(),
    category: ExpenseCategorySchema,
    vendor: z.string().optional(),
    notes: z.string().optional(),
    // If provided, this is used as total_amount (useful for electricity/vendor bills)
    amount: z.number().nonnegative().optional(),
    // Itemized purchases
    items: z
        .array(z.object({
        item_name: z.string().min(1),
        quantity: z.number().positive().default(1),
        unit_price: z.number().nonnegative().default(0)
    }))
        .optional()
});
