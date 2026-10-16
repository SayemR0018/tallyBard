# TallyBard — Status

All times Asia/Dhaka.

## 2026-10-16 11:20

- **Done:** T01 hygiene (PLAN/STATUS committed, stray `MLH-week2/db/` verified identical + deleted). T02 Entire 0.11.5 installed + `entire enable --agent copilot-cli` (9 hooks, committed). T03 schema v2 applied to `tallybard-db` — **server_version 18.6**; enabled `vectorscale 0.9.0` + `pg_textsearch 1.5.1` (no restart needed); `payment_events` hypertable; DiskANN + BM25 indexes on client_notes/nudges; `hybrid_search_notes`/`hybrid_search_nudges` (RRF) verified returning ranked rows on smoke data (rows cleaned up after). Found + fixed: `.env` `DATABASE_URL` was Tiger **read-only** string → added `DATABASE_URL_RW` (options stripped).
- **Notable:** pg_textsearch `<@>` requires a literal query text — hybrid fns are plpgsql `format()`. BM25 leg works without embeddings (graceful degradation pre-backfill).
- **Blocked-on-me:** none right now.
- **Next:** T04 synthetic generator → T05 risk sidecar (py3.12 venv, tabpfn) → T10 bootstrap script → T06 Mastra.
- **Key numbers:** 7 commits. Deadlines: core loop Fri 20:00; feature cut-off Sat 14:00; publish Sun 22:00.
