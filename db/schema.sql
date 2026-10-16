-- ============================================================================
-- TallyBard Database Schema
-- Open-source collections copilot for credit sellers
-- Engineered with Tiger Data Postgres / Timescale best practices
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- Table: clients
-- Stores debtor/customer details, contact info, and semantic profile notes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    notes TEXT,
    notes_embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for semantic search on client notes using HNSW (cosine distance)
CREATE INDEX IF NOT EXISTS idx_clients_notes_embedding
    ON clients USING hnsw (notes_embedding vector_cosine_ops);

-- Index for client lookups
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ----------------------------------------------------------------------------
-- Table: receivables
-- Ledger tracking invoices, credit sales, due dates, payment status, and channels
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'overdue', 'paid', 'cancelled', 'disputed')),
    kind TEXT NOT NULL DEFAULT 'invoice',
    channel TEXT NOT NULL DEFAULT 'sms',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key & query performance indexes
CREATE INDEX IF NOT EXISTS idx_receivables_client_id ON receivables(client_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_issued_at ON receivables(issued_at);

-- ----------------------------------------------------------------------------
-- Table: nudges
-- Log of conversational collection reminders, generated drafts, and sent touchpoints
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
    tone TEXT NOT NULL DEFAULT 'polite' CHECK (tone IN ('gentle', 'polite', 'firm', 'urgent', 'legal')),
    language TEXT NOT NULL DEFAULT 'en',
    draft_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key & event ordering indexes
CREATE INDEX IF NOT EXISTS idx_nudges_receivable_id ON nudges(receivable_id);
CREATE INDEX IF NOT EXISTS idx_nudges_sent_at ON nudges(sent_at);
