# TallyBard — Status

All times Asia/Dhaka.

## 2026-10-16 20:15 (frontend redesign + Render release pass)

- **Done since last entry:** Full frontend redesign on `feat/modern-frontend` (safety tag `pre-frontend-redesign`): 10-section marketing homepage (`/`, `/how-it-works`, `/privacy`, `/results`, `/open-source`) + 7-screen zero-login demo app (`/app`, `/app/import`, `/app/queue`, `/app/nudges`, `/app/ask`, `/app/privacy`, `/app/models`) with desktop sidebar and mobile bottom tab bar. Added `GET /health`, `list_nudges`, `system_status`, and a 90s score cache on `chase_queue`. Added deterministic zero-dependency `apps/web/build.mjs` + 20 `node --test` unit/boundary checks. Updated `render.yaml` (SPA rewrite, strict CSP/nosniff/Referrer-Policy headers, `/health` checks) and `.github/workflows/ci.yml` (`web` job). Wrote `docs/FRONTEND.md` and captured 9 desktop/mobile screenshots in `docs/screenshots/`.
- **Blocked-on-me:** Render Blueprint deploy + paste `sync: false` secrets; DO droplet approval if running Ollama benchmarks; assign Copilot issues #2/#3 and run `docs/copilot-cli-task.md` under Entire.

## 2026-10-16 20:15

- **Done since last entry:** T12 `render.yaml` committed (web static + api starter + sidecar **pro/4GB** — measured sidecar warm RSS **2,255 MB** so 2GB standard would OOM). T16 `docs/results.md` — real numbers only. T11 `apps/api/scripts/bench.ts` + first real bench: aistudio/`gemma-4-26b-a4b-it` 15 calls p50=20.5s p95=26.2s; `embed_dim=768` confirmed via `outputDimensionality`. T15 README rewritten (arch, quickstart, partner map, honest results + limitations, PayMind credit, "Built with PriorLabs-TabPFN"). T18 `docs/outreach.md` — 3 drafts (freelancer en, tutor bn, shopkeeper bn+en).
- **Droplet costs (verified digitalocean.com/pricing, awaiting your OK — T10/H4):**
  - GPU bench: **RTX 4000 Ada, 20GB VRAM, 8 vCPU/32GB, $0.76/hr → ~$2.28 for 3h**, then destroy.
  - CPU demo (always-on): **Basic 4GB/2vCPU ≈ $24/mo** recommended for ollama + embeddinggemma + gemma4:e2b; 2GB/$12 likely too tight with both models resident.
- **Blocked-on-me:** droplet creation OK (above) — after that: ollama bench + demo URL; assign issues #2/#3 to Copilot agent; run copilot-cli-task in Copilot CLI w/ Entire; Sentry trace check; Render blueprint deploy + env vars; phone-check wa.me link; destroy GPU droplet; merge Copilot PRs; demo video/screenshots; post rewrite (T17 draft pending); send outreach (T18 drafts ready).
- **T17:** `docs/post-draft.md` written locally (challenge template, real numbers, limitations, PayMind credit, Devin-vs-Copilot build honesty). **Not staged to DEV** — needs your voice + your OK.
- **Next:** all remaining work is blocked on your handoffs below.

## 2026-10-16 19:40

- **Done since last entry:** T09 web scaffold committed — zero-build static SPA (`apps/web/`): import (extract→confirm), chase queue (TabPFN risk + draft + wa.me approve link), ask-your-ledger chat, privacy panel + backend badge, synthetic banner. Verified against live Mastra tool routes (`POST /api/tools/:id/execute`, `{data}` body). T13 CI: added `api` job (Node 24, `npm ci`, typecheck) + leakage-test step; `contents: read` preserved. T14: `docs/copilot-cli-task.md` (NudgeCard + `node --test` brief for Copilot CLI under Entire) + GitHub issues **#2** (CSV edge-cases: Bangla numerals, quotes, currency) and **#3** (wire mark_paid/mark_sent) filed via REST.
- **Blocked-on-me:** assign issues #2/#3 to Copilot coding agent; run `docs/copilot-cli-task.md` in Copilot CLI with Entire; Sentry trace check (needs a live generate with DSN); DO droplet sizes/costs OK; Render deploy.
- **Next:** T11 bench harness finish → T12 render.yaml → T15 README → T16 results.md.
- **Key numbers:** ~14 commits; smoke loop green (stats/queue/score/draft/privacy all real calls).

## 2026-10-16 19:05

- **Done since last entry:** T04 generator expanded to 600 receivables. T05 sidecar complete — leakage tests pass (4/4), real backtest committed (`docs/backtest.json`): baseline **wins at N=50** (AUC 0.655 vs 3.5's 0.533); at N=300 v2 0.681 / 3.5 0.672 / baseline 0.670. T10 `scripts/bootstrap-ollama.sh` written (CPU-demo + GPU-bench variants; no resources created). T06 Mastra API — all 9 tools, agent, weekly-chase workflow with suspend/resume, rate limit + CORS; typecheck clean; live smoke passed: stats + queue (TabPFN v3.5 scores, e.g. p=0.843 → priority 39,457) + 137 open scored in one batched call + real mixed bn/en draft via `gemma-4-26b-a4b-it` + privacy report. T08 wired — `@mastra/otel-bridge` + `instrument.mjs` Sentry.init verified booting; prod keeps genAI inputs/outputs OFF (`GenAIContentGate` + `dataCollection`); `SENTRY_CAPTURE_CONTENT=1` is the local-only screenshot mode.
- **Fixes:** `pg` SSL → strip `ssl*` params, explicit `rejectUnauthorized:false` (Tiger CA chain). `/score` now batches predict (was 1 forward pass per row). AI Studio chat default → `gemma-4-26b-a4b-it` (31b hit free-tier rate limits). Embeddings request `outputDimensionality=768`.
- **Blocked-on-me:** confirm a trace reaches Sentry dashboard (needs a real run with DSN — verify tonight). DO droplet sizes/costs approval for T10 actual creation.
- **Next:** T09 UI scaffold → T13 CI → T14 Copilot issues + copilot-cli-task.md.
- **Key numbers:** 60 clients / 600 receivables / 463 paid / 137 open scored; sidecar cold /score ≈ 61s (TabPFN refit), warm batch ≈ fast; commits ≈ 12.
