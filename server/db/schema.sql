-- PostgreSQL schema for Elman Crochet POS

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK(low_stock_threshold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  receipt_ref TEXT NOT NULL UNIQUE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cashier TEXT NOT NULL,
  customer TEXT,
  customer_id BIGINT REFERENCES customers(id),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash','Zaad','Edahab')),
  subtotal NUMERIC(12,2) NOT NULL CHECK(subtotal >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(discount >= 0),
  total NUMERIC(12,2) NOT NULL CHECK(total >= 0),
  unpaid BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK(qty > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK(line_total >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  change_type TEXT NOT NULL CHECK(change_type IN ('SALE','RESTOCK','ADJUSTMENT')),
  qty_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL CHECK(category IN ('Inventory Purchase','Vendor Bill','Electricity','Rent','Other')),
  vendor TEXT,
  notes TEXT,
  total_amount NUMERIC(12,2) NOT NULL CHECK(total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_items (
  id BIGSERIAL PRIMARY KEY,
  expense_id BIGINT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK(line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_product ON inventory_log(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items(expense_id);