# TallyBard API (Mastra)

TypeScript Mastra service: 11 zod-schematized tools, the `tallybard` agent,
and the `weekly-chase` workflow (suspends for human approval). Postgres-backed
memory/storage on Tiger Cloud. Sentry via `instrument.mjs` + `@mastra/otel-bridge`.

```sh
npm ci
npm run dev        # mastra dev with Sentry preloaded → http://localhost:4111
npm run typecheck
npm run smoke      # exercises the tools end-to-end (needs .env + sidecar)
npm run build && npm start   # production
```

Routes the web app uses: `POST /api/tools/:toolId/execute` (`{ data }`),
`POST /api/agents/tallybard/generate`, `GET /health`.

Env: see `../../.env.example`. Secrets never leave the server; CORS is limited
to `WEB_ORIGIN`; a per-IP rate limit (120 req/min) guards the public demo.
