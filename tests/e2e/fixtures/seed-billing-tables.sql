-- LexFlow Billing Tables (SPR-007)
-- Creates 6 billing tables + 5 enums
-- Run: cat seed-billing-tables.sql | docker exec -i lexflow-postgres psql -U lexflow -d lexflow_web

-- Enums
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft','sent','paid','void','partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE line_item_type AS ENUM ('time','expense','flat_fee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('check','ach','credit_card','trust_transfer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE expense_category AS ENUM ('filing_fee','service','travel','copying','postage','medical','expert','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE operating_tx_type AS ENUM ('fee_income','expense','refund','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES matters(id),
  user_id UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  hourly_rate_cents INTEGER NOT NULL,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense entries
CREATE TABLE IF NOT EXISTS expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES matters(id),
  user_id UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category expense_category NOT NULL DEFAULT 'other',
  receipt_document_id UUID REFERENCES documents(id),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES matters(id),
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  time_entry_id UUID REFERENCES time_entries(id),
  expense_entry_id UUID REFERENCES expense_entries(id),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type line_item_type NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  method payment_method NOT NULL,
  reference_number VARCHAR(100),
  trust_transaction_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operating transactions
CREATE TABLE IF NOT EXISTS operating_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type operating_tx_type NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  related_invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
