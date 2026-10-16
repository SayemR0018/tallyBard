#!/usr/bin/env node
/**
 * Zero-dependency, deterministic build:
 *   src/  → dist/            (html, css, js copied as-is — modern browsers run ES modules natively)
 *   public/ → dist/          (static assets)
 *   docs/backtest.json → dist/data/results.json   (real numbers only; omitted if missing)
 *   <meta name="tallybard-config"> rewritten from env:
 *     WEB_API_URL   public API origin (default http://localhost:4111)
 *     WEB_DEMO_MODE "true" (default) | "false" — false = self-host: imports write to the ledger
 *
 * Usage: node build.mjs            (from apps/web)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const src = join(here, "src");
const pub = join(here, "public");
const dist = join(here, "dist");

export function buildConfig(env = process.env) {
  return {
    apiUrl: (env.WEB_API_URL || "http://localhost:4111").replace(/\/$/, ""),
    demoMode: String(env.WEB_DEMO_MODE ?? "true").toLowerCase() !== "false",
    repoUrl: env.WEB_REPO_URL || "https://github.com/SayemR0018/tallyBard",
    version: env.RENDER_GIT_COMMIT?.slice(0, 7) || env.WEB_VERSION || "dev",
  };
}

/** Transform docs/backtest.json → the small shape the site reads. Pure: easy to test. */
export function toResults(backtest) {
  if (!backtest || !Array.isArray(backtest.splits)) return null;
  const pick = (m) => (m ? { auc: m.auc ?? null, brier: m.brier ?? null } : null);
  return {
    generated_at: backtest.generated_at ?? null,
    data: backtest.data ?? "synthetic",
    disclaimer: backtest.disclaimer ?? "Synthetic benchmark — pipeline evidence, not real clients.",
    packages: backtest.packages ?? {},
    n_labelled: backtest.n_labelled ?? null,
    splits: backtest.splits.map((s) => ({
      n_train: s.n_train,
      n_test: s.n_test,
      baseline: pick(s.baseline),
      tabpfn35: pick(s.tabpfn35),
      tabpfnv2: pick(s.tabpfnv2),
    })),
  };
}

export function injectConfig(htmlText, cfg) {
  const json = JSON.stringify(cfg).replace(/'/g, "&#39;");
  const re = /<meta name="tallybard-config" content='[^']*' \/>/;
  if (!re.test(htmlText)) throw new Error("index.html is missing the tallybard-config meta tag");
  return htmlText.replace(re, `<meta name="tallybard-config" content='${json}' />`);
}

function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(src, dist, { recursive: true });
  if (existsSync(pub)) cpSync(pub, dist, { recursive: true });

  const cfg = buildConfig();
  const indexPath = join(dist, "index.html");
  writeFileSync(indexPath, injectConfig(readFileSync(indexPath, "utf8"), cfg));

  const bt = join(repo, "docs", "backtest.json");
  let resultsNote = "no docs/backtest.json → site shows 'Results pending'";
  if (existsSync(bt)) {
    const results = toResults(JSON.parse(readFileSync(bt, "utf8")));
    if (results) {
      mkdirSync(join(dist, "data"), { recursive: true });
      writeFileSync(join(dist, "data", "results.json"), JSON.stringify(results, null, 2) + "\n");
      resultsNote = `results.json from docs/backtest.json (${results.splits.length} splits)`;
    }
  }
  console.log(`[web build] apiUrl=${cfg.apiUrl} demoMode=${cfg.demoMode} version=${cfg.version}`);
  console.log(`[web build] ${resultsNote}`);
  console.log(`[web build] → ${dist}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
