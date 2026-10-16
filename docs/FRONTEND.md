# TallyBard — Frontend & Release Guide

## 1. Sitemap & route table

The web app (`apps/web/`) serves both the public marketing site and the zero-login demo application from a single History-API router (`src/js/router.js`) with a Render SPA rewrite (`/* → /index.html`).

### Marketing layout (`src/js/main.js` → `siteLayout`)

Top navigation (6 items + GitHub icon + theme toggle):

| Route | Source | Purpose |
|---|---|---|
| `/` | `src/js/pages/home.js` | 10-section homepage: Hero + synthetic chase-queue mock, Problem & audience, 4-step How it works, Features, Privacy by design, Why open (licence table + `Built with PriorLabs-TabPFN`), Real backtest results (`dist/data/results.json`), Built-with text list, Honest limitations & FAQ, Footer |
| `/app` ("Try the demo") | `src/js/app/shell.js` | Opens the zero-login demo pre-loaded with the synthetic ledger |
| `/how-it-works` | `src/js/pages/how.js` | End-to-end data flow, point-in-time feature table, hybrid BM25 + DiskANN RRF search, tone ladder, weekly Mastra workflow |
| `/privacy` | `src/js/pages/privacy.js` | Plain-language egress boundary table (sidecar vs Ollama vs AI Studio vs Sentry) |
| `/results` | `src/js/pages/results.js` | Full N=50/100/300 time-split table read from `/data/results.json` (generated from `docs/backtest.json`; shows *Results pending* if absent) |
| `/open-source` | `src/js/pages/open-source.js` | Self-host quickstart, component licence table (MIT vs Gemma ToU vs Prior Labs Apache-2.0+attr vs TabPFN-3.5 non-commercial), PayMind prior-art credit |

### App shell (`/app/*` — `src/js/app/shell.js`)

Persistent sidebar on desktop (`≥56rem`), fixed 5-item bottom tab bar on mobile (`<56rem`), plus header shortcuts for Privacy and Model switch:

| Route | Screen | Primary action |
|---|---|---|
| `/app` | `overview.js` | **Open chase queue** — shows synthetic ledger totals, top 5 ranked receivables, recent drafts, and browser-local demo imports |
| `/app/import` | `import.js` | **Extract rows** — paste CSV or Bangla/English credit notes → review editable table → confirm (stored in `localStorage` only when `WEB_DEMO_MODE=true`; writes to Postgres when `false`) |
| `/app/queue` | `queue.js` | **Draft** — ranked `amount × P(paid >7d late)` queue with tone (`friendly`/`firm`/`final`) and language (`bn`/`en`/`mixed`) selectors + **Re-score** button |
| `/app/nudges` | `nudges.js` | **Approve → get WhatsApp link** — lists drafted/approved/sent nudges; approval reveals the `wa.me` click-to-send link (nothing sends itself) |
| `/app/ask` | `ask.js` | **Ask** — ledger Q&A via the `tallybard` Mastra agent with per-browser session thread (`sessionStorage`) |
| `/app/privacy` | `privacy.js` | Live egress report from the `privacy_report` tool |
| `/app/models` | `models.js` | Live backend/model/sidecar status from `system_status` (read-only in shared demo; switched via `MODEL_BACKEND` env var) |

---

## 2. Design decisions

- **Palette & feel**: warm paper (`#faf7f2`) and ink (`#171c1a`) in light mode, deep slate (`#121615`) in dark mode, deep teal primary (`#0c6b68` / `#5cd4ce`) and warm amber accent (`#b87914` / `#eab85c`) — no purple "AI" gradients.
- **Original mascot**: `#i-bird` inline SVG symbol in `src/index.html` — a small round teal bard-bird carrying a golden quill.
- **Typography**: system + self-hosted-ready stack with explicit Bengali script fallbacks (`"Noto Sans Bengali", "Nirmala UI", "Kohinoor Bangla"`). Zero third-party font or script requests.
- **Accessibility**: WCAG AA contrast across light/dark tokens; 3px focus ring (`:focus-visible`); `prefers-reduced-motion: reduce` disables animations/transitions; skip-to-content link; risk levels always render icon + text label (`High 84%`, `Medium 51%`, `Low 22%`, `Not scored`) — never colour alone.
- **Strict CSP**: zero inline `<script>` blocks and zero `style="..."` attributes anywhere in shipped HTML/JS (enforced by `tests/boundaries.test.mjs`). Config is injected into `<meta name="tallybard-config">` at build time.
- **Zero-login & sleep resilience**:
  - Persistent banner on every `/app/*` screen: *"Demo uses synthetic data. Do not enter real client data here; self-host for real use."* + **Reset demo** button + downloadable `/sample-ledger.csv`.
  - `warmUp()` (`src/js/api.js`) pings `GET /health` with exponential backoff (`1s → 8s`, up to 65s budget) and renders a friendly *"Waking the server…"* screen while Render instances spin up.
- **Copilot boundary isolation**:
  - `src/js/app/nudge-slot.js` dynamically imports `../components/nudge-card.js` (owned by `docs/copilot-cli-task.md`) and falls back to inline rendering until that branch lands.
  - `src/js/app/csv-wrapper.js` dynamically imports `../csv.js` (owned by GitHub issue #2) before sending remaining free-text lines to the `import_text` tool.

---

## 3. Run, build, and test locally

```sh
# 1. Build static output (src/ + public/ + docs/backtest.json → dist/)
cd apps/web
npm run build

# 2. Run the 20 unit & boundary tests (Node >= 20 built-in test runner, zero deps)
npm test

# 3. Serve dist/ with SPA fallback on http://localhost:5173
npm run dev
```

Build-time environment variables (all optional locally):

| Variable | Default | Purpose |
|---|---|---|
| `WEB_API_URL` | `http://localhost:4111` | Public origin of the Mastra API service |
| `WEB_DEMO_MODE` | `true` | `true` keeps confirmed imports in browser `localStorage` and hides destructive ledger mutations; `false` writes to Postgres for self-hosted deployments |
| `WEB_REPO_URL` | `https://github.com/SayemR0018/tallyBard` | Repository link in nav/footer |

---

## 4. Deploying on Render (`render.yaml`)

1. Push the repository to GitHub and click **New → Blueprint** in Render, selecting this repo.
2. Render creates three services from `render.yaml`:
   - `tallybard-web` (Static Site — `node apps/web/build.mjs`, publishes `apps/web/dist`, rewrites `/* → /index.html`, sets CSP/nosniff/Referrer-Policy headers).
   - `tallybard-api` (Node 24 — `npm ci && npx mastra build`, health check `GET /health`).
   - `tallybard-sidecar` (Python 3.12 — `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check `GET /health`).
3. Paste the `sync: false` secrets in the Render dashboard:

| Service | Secret env var | Value to paste |
|---|---|---|
| `tallybard-api` | `DATABASE_URL` | Tiger Cloud read-only Postgres DSN |
| `tallybard-api` | `DATABASE_URL_RW` | Tiger Cloud read-write Postgres DSN |
| `tallybard-api` | `GOOGLE_API_KEY` | Google AI Studio key (used when `MODEL_BACKEND=aistudio`) |
| `tallybard-api` | `SENTRY_DSN` | Sentry DSN (GenAI prompt/output capture stays OFF in production) |
| `tallybard-api` | `OLLAMA_BASE_URL` | Self-hosted Ollama Caddy URL (only needed when `MODEL_BACKEND=ollama`) |
| `tallybard-api` | `OLLAMA_API_KEY` | Bearer token for the Ollama Caddy reverse proxy |
| `tallybard-sidecar` | `DATABASE_URL` | Tiger Cloud read-only Postgres DSN |
| `tallybard-sidecar` | `TABPFN_TOKEN` | Prior Labs token (needed for first weight download or `TABPFN_MODE=api`) |

If your Render service names get suffixes (e.g. `tallybard-api-xxxx.onrender.com`), update `WEB_API_URL` on `tallybard-web` (and the `connect-src` host in `render.yaml`), plus `WEB_ORIGIN` and `RISK_SIDECAR_URL` on `tallybard-api`.

---

## 5. Known limitations & operational notes

- **Sidecar memory**: local TabPFN-3.5 (PyTorch + safetensors weights) uses **~2.26 GB RSS warm** (measured 2026-10-16). It will OOM on Render's 512 MB / 2 GB plans; `render.yaml` pins `plan: pro` (4 GB). To run the sidecar on a smaller tier, set `TABPFN_MODE=api` with `TABPFN_TOKEN`.
- **Cold scoring latency**: the first `/score` call after a sidecar restart takes ~25–60s on CPU while TabPFN fits on the 573 labelled rows. `chase_queue` caches the score map for 90s (`rescore: true` bypasses the cache).
- **Demo persistence**: in `WEB_DEMO_MODE=true`, confirmed imports stay in `localStorage` so anonymous visitors cannot pollute or wipe the shared synthetic ledger. Server-scoped anonymous demo sessions would require a nullable `session_id text` + `expires_at timestamptz` column on `clients`/`receivables` (not added to preserve schema stability).
- **Screenshots**: desktop and mobile captures live in `docs/screenshots/`.
