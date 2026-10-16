# db

Tiger Cloud Postgres schema and seeds.

- `schema.sql` — full schema v2. Apply with `uv run scripts/db.py -f db/schema.sql`
  (idempotent: `CREATE OR REPLACE` / `IF NOT EXISTS` throughout).
- `generate_synthetic.py` — writes `seeds.sql` + `data/ledger.csv` (all synthetic).
- `seeds.sql` — generated output; regenerate, don't hand-edit.

Schema notes:

- `payment_events` is a TimescaleDB hypertable.
- `client_notes.embedding` / `nudges.embedding` are `vector(768)` (EmbeddingGemma)
  with pgvectorscale DiskANN indexes; BM25 via pg_textsearch (`text_config=simple`
  — Postgres has no Bangla config).
- `hybrid_search_notes` / `hybrid_search_nudges` fuse both legs with Reciprocal
  Rank Fusion. They are plpgsql + `format()` because pg_textsearch needs the
  query text as a literal to use the BM25 index.
- `DATABASE_URL` in `.env` is Tiger's read-only string; `DATABASE_URL_RW`
  (options stripped) is used for migrations/app writes.
