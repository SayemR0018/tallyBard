# TallyBard web (`apps/web`)

Zero-dependency static site + zero-login demo SPA for TallyBard. Ships plain ES modules and CSS custom properties — `build.mjs` copies `src/` + `public/` to `dist/`, embeds `docs/backtest.json` as `dist/data/results.json`, and writes non-secret build config into `<meta name="tallybard-config">`.

## Commands

```sh
npm run build   # src/ + public/ + docs/backtest.json → dist/
npm test        # 20 unit + CSP/secret/Copilot-boundary tests (node --test)
npm run check   # build + test (run in CI)
npm run dev     # http://localhost:5173 serving dist/ with SPA fallback
```

See [`docs/FRONTEND.md`](../../docs/FRONTEND.md) for the full route table, design system notes, Copilot wrapper boundaries (`nudge-slot.js`, `csv-wrapper.js`), and Render blueprint setup.
