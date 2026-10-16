# TallyBard — Build Plan (Hacktoberfest Open-Source AI Challenge, Week 2 "Side Hustle")

Approved 2026-10-16 with amendments A1–A10. Owner targets: core loop (import → score → queue → draft → approve) by **Fri 20:00 Dhaka**, feature-complete cut-off **Sat 14:00 Dhaka**, post published by **Sun 22:00 Dhaka** (hard deadline Oct 18 11:59 PM PDT = Mon Oct 19 12:59 Dhaka).

## What we are building

An open-source, self-hostable collections copilot for people who sell on credit (freelancers, tutors, shops running baki/udhaar, community treasurers). It imports invoices and informal credit entries, scores P(paid >7 days late) per open receivable with TabPFN backed by an honest time-split backtest vs a "client past late rate" baseline, ranks a chase queue by amount × risk, and drafts language-aware WhatsApp nudges (Bangla/English/mixed; friendly → firm → final) grounded in Tiger hybrid search (BM25 + vector + RRF) so messages never repeat. A human approves everything — output is a wa.me link or copy. Nothing is sent automatically. All demo data is synthetic and labelled as such.

Stack: static UI + Mastra API (TypeScript) + Python risk sidecar (FastAPI), deployed via `render.yaml`; Tiger Cloud Postgres (pgvector + pgvectorscale DiskANN + pg_textsearch BM25 + TimescaleDB hypertable); Gemma 4 chat + EmbeddingGemma (768-dim) via Ollama, with Google AI Studio fallback; Sentry Agent Tracing; Entire + DevRelay for agent-session evidence; Copilot coding agent for scoped issues.

## Rules of evidence

- Every task reports real command output. Never write "should work".
- `docs/results.md` contains only numbers from real runs, with the command and date.
- Backtest results are labelled a **synthetic benchmark**, not evidence about real clients.
- README includes "Built with PriorLabs-TabPFN", the synthetic-data notice, honest limitations, and credit to PayMind (dev.to/fracabu) as prior art (no code reuse).

## Amendments in force

- **A1** `.env` is populated locally; never print or chat secrets; verified `git check-ignore .env`.
- **A2** `SHOW server_version` before enabling extensions; below PG 17 → provision a new Tiger service (cost → ask first).
- **A3** Sidecar venv is Python 3.12 via `uv python install 3.12` (matches CI/Render), not system 3.14.
- **A4** `TABPFN_MODE=local|api`. Backtest runs locally with open weights and `backtest.json` is committed. For Render: measure sidecar peak RAM + weights download time, then recommend instance size with cost before creating anything.
- **A5** Features are point-in-time (only data before each receivable's issue date) with a leakage unit test; AUC + Brier for TabPFN-3.5, TabPFN v2 (if its licence allows commercial use — verify text), and baseline at N=50/100/300; ≤20 min search for a clearly-licensed public payments dataset for a second backtest, else state the limitation.
- **A6** GPU droplet is benchmark-only, ≤3 h then destroyed (16–24 GB VRAM, cost shown first). Public demo runs on an always-on small CPU droplet: Ollama + embeddinggemma (+ gemma4:e2b if it fits) behind Caddy + bearer; AI Studio chat fallback. Any cloud resource: exact size + cost shown, wait for OK.
- **A7** Entire: `entire enable --agent copilot-cli`; `docs/copilot-cli-task.md` is a self-contained brief for the nudge-card UI + tests, run in Copilot CLI so a real captured session exists. Never fake/relabel captures; DevRelay `submit_agent_session` only for supported agents, mention Devin in prose.
- **A8** Sentry `dataCollection.genAI` inputs/outputs OFF in prod; a local-only config turns them ON for synthetic-data screenshot runs.
- **A9** Public demo: synthetic data only, secrets server-side, API rate limiting, CORS limited to web origin.
- **A10** UI split: Devin builds scaffold + import + queue views; nudge card component and CSV edge-case handling are reserved for Copilot issues — do not touch those files until PRs merge.

## Tasks

| # | Task | Owner | Deps | Acceptance | Est |
|---|---|---|---|---|---|
| T01 | Hygiene: PLAN/STATUS docs, delete verified stray duplicates, commit db/ | agent | — | clean `git status` | 15m |
| T02 | Install Entire + `entire enable --agent copilot-cli` | agent | — | `entire status` enabled | 20m |
| T03 | Schema v2 on Tiger: `client_notes` + embedding(768), `payment_events` hypertable, `nudges` + embedding + status/approved_at, tone `friendly/firm/final`, whatsapp default, `udhaar` kind; extensions `vector, vectorscale, pg_textsearch, timescaledb`; BM25 idx (text_config `simple`), DiskANN idx, `hybrid_search()` RRF SQL fn | agent | .env | applies clean; RRF returns rows; hypertable works | 60m |
| T04 | `db/generate_synthetic.py`: ~60 clients / ~300 receivables / payment_events; bn+en synthetic names, +880 fake phones; latent late-payment signal; emits seeds.sql + CSV | agent | T03 | deterministic seed; sane label distribution | 60m |
| T05 | Risk sidecar: `/features` (anonymized numeric/categorical only — PII assertion test), `/score`, `/backtest` (point-in-time features, leakage test, AUC+Brier, N=50/100/300, TabPFN-3.5 + v2-if-licensed + baseline); pin requirements | agent | T03,T04 | `backtest.json` committed; tests pass | 2h |
| T06 | Mastra API: @mastra/pg storage+memory on Tiger; tools: `import_text`, `score_receivables`, `chase_queue` (amount×risk), `draft_nudge` (tone+lang+RRF hybrid, dedup), `approve_nudge`→wa.me, `mark_sent`/`mark_paid`, `privacy_report`; named agent; weekly chase workflow with suspend/resume; rate limit + CORS | agent | T03,T05 | `mastra dev` boots; tools invoked; workflow pauses+resumes | 3h |
| T07 | Model switch: ollama (OpenAI-compatible + bearer via Caddy; gemma4:e4b + embeddinggemma) vs aistudio; `MODEL_BACKEND` env | agent | T06; droplet | same prompt both paths; embed dim=768 assert | 60m |
| T08 | Sentry: instrument.mjs, @sentry/node ^11, @mastra/observability, genAI collection OFF prod / local-only ON config | agent | T06 | named trace w/o prompt bodies (prod), screenshot run (local) | 60m |
| T09 | Static UI scaffold: layout, API client, import→confirm table, chase queue, ask-ledger chat, privacy panel | agent | T06 | manual loop E2E minus nudge card | 3h |
| T10 | `scripts/bootstrap-ollama.sh`: ollama, model pulls, Caddy+bearer, ufw, systemd (CPU-demo + GPU-bench variants) | agent | — | fresh droplet → authed `/v1/models` | 45m |
| T11 | `scripts/bench.ts`: fixed prompts × backends → p50/p95, tokens → docs/results.md | agent | T07,H4 | measured numbers only | 60m |
| T12 | `render.yaml`: web static + api + sidecar, env stubs | agent | T05,T06,T09 | blueprint validates; deploys green (H5) | 45m |
| T13 | CI: add Node job (npm ci + build/typecheck) | agent | T06 | green CI | 20m |
| T14 | Copilot issues (nudge card UI + tests; CSV edge cases) + docs/copilot-cli-task.md | agent drafts / user assigns | T09 scaffold | issues filed; brief written | 30m |
| T15 | README: mermaid arch, quickstart, partner-tech map, post-deadline heading, attributions, limitations | agent | late | complete | 60m |
| T16 | docs/results.md: backtest + bench numbers, commands, dates | agent | T05,T11 | real numbers | folded |
| T17 | Post draft per DEV template (`#devchallenge #hf26challenge`), staged draft only via DevRelay | agent | late | draft for user rewrite | 90m |
| T18 | First-user outreach drafts (freelancer/tutor/shopkeeper, bn+en) | agent drafts / user sends | T09 | 3 messages | 30m |

## Handoffs (user actions)

- **H1** keys: DONE for .env contents; pending — Prior Labs licence accepted by user (done); confirm nothing else missing.
- **H2** Assign Copilot issues (~10m).
- **H3** Review backtest → approve claims wording (15m).
- **H4** Create/destroy GPU droplet — benchmark only, ≤3 h, cost shown first (30m).
- **H5** Render blueprint deploy + env vars (20m).
- **H6** Phone check wa.me link + Sentry traces + confirm droplet destroyed (20m).
- **H7** Merge PRs (rolling).
- **H8** Record demo + screenshots (45m).
- **H9** Rewrite post in own voice + send first-user messages + publish (Sun, by 22:00).

## Cut-lines (in order) and never-cut

1. EmbeddingGemma → AI Studio embeddings or vector-only (BM25 carries).
2. Drop DO GPU benchmark → DO hosts only sidecar/demo API.
3. Suspend/resume workflow → simple Approve button.
4. Copilot gets only 2 issues.

**Never cut:** TabPFN backtest, a Sentry trace, Tiger hybrid search, the deploy.

## Risks

- TabPFN-3.5 licence is non-commercial — demo fine; no commercial claims for scoring; attribution required.
- pg_textsearch on existing Tiger service may need pause/restart; fallback vector-only.
- No Bangla Postgres text config — `simple` only; embeddings carry semantics.
- Gemma 4 emits thinking `<|channel|>` tags — disable/strip for JSON extraction.
- Mastra suspend state must persist via @mastra/pg (Render cold starts).
- Entire lacks a Devin hook — copilot-cli path per A7.
