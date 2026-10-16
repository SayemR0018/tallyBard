# TallyBard — Status

All times Asia/Dhaka.

## 2026-10-16 19:05

- **Done since last entry:** T04 generator expanded to 600 receivables. T05 sidecar complete — leakage tests pass (4/4), real backtest committed (`docs/backtest.json`): baseline **wins at N=50** (AUC 0.655 vs 3.5's 0.533); at N=300 v2 0.681 / 3.5 0.672 / baseline 0.670. T10 `scripts/bootstrap-ollama.sh` written (CPU-demo + GPU-bench variants; no resources created). T06 Mastra API — all 9 tools, agent, weekly-chase workflow with suspend/resume, rate limit + CORS; typecheck clean; live smoke passed: stats + queue (TabPFN v3.5 scores, e.g. p=0.843 → priority 39,457) + 137 open scored in one batched call + real mixed bn/en draft via `gemma-4-26b-a4b-it` + privacy report. T08 wired — `@mastra/otel-bridge` + `instrument.mjs` Sentry.init verified booting; prod keeps genAI inputs/outputs OFF (`GenAIContentGate` + `dataCollection`); `SENTRY_CAPTURE_CONTENT=1` is the local-only screenshot mode.
- **Fixes:** `pg` SSL → strip `ssl*` params, explicit `rejectUnauthorized:false` (Tiger CA chain). `/score` now batches predict (was 1 forward pass per row). AI Studio chat default → `gemma-4-26b-a4b-it` (31b hit free-tier rate limits). Embeddings request `outputDimensionality=768`.
- **Blocked-on-me:** confirm a trace reaches Sentry dashboard (needs a real run with DSN — verify tonight). DO droplet sizes/costs approval for T10 actual creation.
- **Next:** T09 UI scaffold → T13 CI → T14 Copilot issues + copilot-cli-task.md.
- **Key numbers:** 60 clients / 600 receivables / 463 paid / 137 open scored; sidecar cold /score ≈ 61s (TabPFN refit), warm batch ≈ fast; commits ≈ 12.
