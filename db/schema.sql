-- ============================================================================
-- TallyBard Database Schema v2
-- Open-source collections copilot for credit sellers
-- Tiger Cloud Postgres 18: timescaledb + pgvector + pgvectorscale + pg_textsearch
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale;
CREATE EXTENSION IF NOT EXISTS pg_textsearch;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- Table: clients
-- Debtor/customer identity. Notes that feed search live in client_notes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    preferred_language TEXT NOT NULL DEFAULT 'bn'
        CHECK (preferred_language IN ('bn', 'en', 'mixed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: client_notes
-- Searchable history per client: preferences, promises, context. This is the
-- corpus hybrid search (BM25 + vector, fused with RRF) runs over.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    embedding vector(768),              -- EmbeddingGemma native dim
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);

-- Semantic leg: DiskANN index via pgvectorscale (cosine)
CREATE INDEX IF NOT EXISTS idx_client_notes_embedding
    ON client_notes USING diskann (embedding vector_cosine_ops);

-- Keyword leg: BM25 via pg_textsearch. 'simple' config: Postgres has no
-- Bangla text search configuration; simple splits on whitespace/punctuation
-- without stemming, which is the honest choice for bn/en mixed notes.
CREATE INDEX IF NOT EXISTS idx_client_notes_bm25
    ON client_notes USING bm25 (body) WITH (text_config = 'simple');

-- ----------------------------------------------------------------------------
-- Table: receivables
-- Invoices AND informal credit entries (udhaar/baki/fiado).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    kind TEXT NOT NULL DEFAULT 'invoice'
        CHECK (kind IN ('invoice', 'udhaar', 'fiado', 'other')),
    channel TEXT NOT NULL DEFAULT 'whatsapp'
        CHECK (channel IN ('whatsapp', 'sms', 'other')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'overdue', 'paid', 'cancelled', 'disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivables_client_id ON receivables(client_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_issued_at ON receivables(issued_at);

DROP TRIGGER IF EXISTS trg_receivables_updated_at ON receivables;
CREATE TRIGGER trg_receivables_updated_at BEFORE UPDATE ON receivables
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: payment_events (TimescaleDB hypertable)
-- Append-only payment ledger; powers late-rate features and the audit trail.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    paid_at TIMESTAMPTZ NOT NULL,
    method TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, paid_at)
);

SELECT create_hypertable('payment_events', 'paid_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_payment_events_receivable
    ON payment_events(receivable_id, paid_at DESC);

-- ----------------------------------------------------------------------------
-- Table: nudges
-- Drafted/approved/sent reminders. embedding powers "never repeat a nudge".
-- status: draft -> approved -> sent (or discarded). Nothing auto-sends.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
    tone TEXT NOT NULL DEFAULT 'friendly'
        CHECK (tone IN ('friendly', 'firm', 'final')),
    language TEXT NOT NULL DEFAULT 'bn'
        CHECK (language IN ('bn', 'en', 'mixed')),
    draft_text TEXT NOT NULL,
    embedding vector(768),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'sent', 'discarded')),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nudges_receivable_id ON nudges(receivable_id);
CREATE INDEX IF NOT EXISTS idx_nudges_status ON nudges(status);
CREATE INDEX IF NOT EXISTS idx_nudges_embedding
    ON nudges USING diskann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_nudges_bm25
    ON nudges USING bm25 (draft_text) WITH (text_config = 'simple');

-- ----------------------------------------------------------------------------
-- Function: hybrid_search_notes
-- Reciprocal Rank Fusion over DiskANN vector search + BM25. Rows without an
-- embedding simply contribute only their BM25 rank, so the function degrades
-- gracefully before embeddings are backfilled. Lower <@> score = better.
-- ----------------------------------------------------------------------------
-- NOTE: pg_textsearch's planner hook requires the query text as a literal
-- (parameterized <@> calls cannot use the BM25 index), so these functions are
-- plpgsql and inline safely-quoted literals via format().
CREATE OR REPLACE FUNCTION hybrid_search_notes(
    q_text TEXT,
    q_embedding vector(768) DEFAULT NULL,
    match_count INT DEFAULT 10,
    p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
    note_id UUID, client_id UUID, body TEXT,
    rrf_score DOUBLE PRECISION, vec_rank INT, bm25_rank INT
)
LANGUAGE plpgsql STABLE AS $func$
BEGIN
    RETURN QUERY EXECUTE format($q$
        WITH vec AS (
            SELECT id, row_number() OVER (ORDER BY embedding <=> %1$L::vector) AS r
            FROM client_notes
            WHERE %1$L::vector IS NOT NULL AND embedding IS NOT NULL
              AND (%2$L::uuid IS NULL OR client_id = %2$L::uuid)
            LIMIT %3$s * 4
        ),
        bm_raw AS (
            SELECT id, body <@> %4$L AS score
            FROM client_notes
            WHERE (%2$L::uuid IS NULL OR client_id = %2$L::uuid)
            ORDER BY body <@> %4$L ASC
            LIMIT %3$s * 4
        ),
        bm AS (
            SELECT id, row_number() OVER (ORDER BY score ASC) AS r
            FROM bm_raw WHERE score < 0
        ),
        ids AS (SELECT id FROM vec UNION SELECT id FROM bm)
        SELECT n.id, n.client_id, n.body,
               (COALESCE(1.0 / (60 + v.r), 0) + COALESCE(1.0 / (60 + b.r), 0))::float8 AS rrf_score,
               v.r::INT, b.r::INT
        FROM ids
        JOIN client_notes n ON n.id = ids.id
        LEFT JOIN vec v ON v.id = ids.id
        LEFT JOIN bm  b ON b.id = ids.id
        ORDER BY rrf_score DESC
        LIMIT %3$s
    $q$, q_embedding::text, p_client_id, match_count, q_text);
END
$func$;

-- ----------------------------------------------------------------------------
-- Function: hybrid_search_nudges — same fusion over past nudge drafts.
-- Used to avoid repeating ourselves to the same client.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hybrid_search_nudges(
    q_text TEXT,
    q_embedding vector(768) DEFAULT NULL,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    nudge_id UUID, receivable_id UUID, draft_text TEXT,
    rrf_score DOUBLE PRECISION, vec_rank INT, bm25_rank INT
)
LANGUAGE plpgsql STABLE AS $func$
BEGIN
    RETURN QUERY EXECUTE format($q$
        WITH vec AS (
            SELECT id, row_number() OVER (ORDER BY embedding <=> %1$L::vector) AS r
            FROM nudges
            WHERE %1$L::vector IS NOT NULL AND embedding IS NOT NULL
            LIMIT %2$s * 4
        ),
        bm_raw AS (
            SELECT id, draft_text <@> %3$L AS score
            FROM nudges
            ORDER BY draft_text <@> %3$L ASC
            LIMIT %2$s * 4
        ),
        bm AS (
            SELECT id, row_number() OVER (ORDER BY score ASC) AS r
            FROM bm_raw WHERE score < 0
        ),
        ids AS (SELECT id FROM vec UNION SELECT id FROM bm)
        SELECT n.id, n.receivable_id, n.draft_text,
               (COALESCE(1.0 / (60 + v.r), 0) + COALESCE(1.0 / (60 + b.r), 0))::float8 AS rrf_score,
               v.r::INT, b.r::INT
        FROM ids
        JOIN nudges n ON n.id = ids.id
        LEFT JOIN vec v ON v.id = ids.id
        LEFT JOIN bm  b ON b.id = ids.id
        ORDER BY rrf_score DESC
        LIMIT %2$s
    $q$, q_embedding::text, match_count, q_text);
END
$func$;
