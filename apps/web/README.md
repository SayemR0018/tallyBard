# TallyBard web UI

Zero-build static SPA (vanilla ES modules — no bundler). Deploys as a Render
static site or any static host.

## Run locally

```sh
# serve the files
python -m http.server 5173   # from apps/web
# Mastra API on :4111 (mastra dev) — or set a different API URL:
localStorage.setItem("tallybard_api_url", "http://localhost:4111")
```

Views: **Import** (paste/CSV → Gemma extraction → human confirm), **Chase
queue** (amount × TabPFN risk, draft nudge, wa.me approve link — nothing
auto-sends), **Ask your ledger** (agent chat, thread memory), **Privacy**
(exactly what leaves the server + active model backend).

All demo data is synthetic. The `NudgeCard` component and CSV edge-case
handling are intentionally scaffold-only — they are assigned to the Copilot
coding agent (see `docs/copilot-cli-task.md`).
