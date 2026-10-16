import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig, toResults, injectConfig } from "../build.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("buildConfig reads env with safe defaults and strips trailing slash", () => {
  const c = buildConfig({});
  assert.equal(c.apiUrl, "http://localhost:4111");
  assert.equal(c.demoMode, true);
  const d = buildConfig({ WEB_API_URL: "https://api.example.com/", WEB_DEMO_MODE: "false", RENDER_GIT_COMMIT: "abcdef1234" });
  assert.equal(d.apiUrl, "https://api.example.com");
  assert.equal(d.demoMode, false);
  assert.equal(d.version, "abcdef1");
});

test("toResults keeps only real metrics and the synthetic disclaimer", () => {
  const r = toResults({
    generated_at: "2026-10-16T06:19:45Z",
    disclaimer: "Synthetic benchmark",
    splits: [{ n_train: 50, n_test: 523, baseline: { auc: 0.65, brier: 0.24 }, tabpfn35: { auc: 0.53, brier: 0.25 } }],
  });
  assert.equal(r.splits.length, 1);
  assert.equal(r.splits[0].baseline.auc, 0.65);
  assert.equal(r.splits[0].tabpfnv2, null);
  assert.match(r.disclaimer, /Synthetic/);
});

test("toResults returns null for missing/invalid input (→ Results pending)", () => {
  assert.equal(toResults(null), null);
  assert.equal(toResults({}), null);
});

test("the committed docs/backtest.json converts cleanly", () => {
  const p = join(here, "../../../docs/backtest.json");
  if (!existsSync(p)) return; // allowed to be absent; site shows pending state
  const r = toResults(JSON.parse(readFileSync(p, "utf8")));
  assert.ok(r.splits.length >= 1);
  for (const s of r.splits) assert.ok(s.n_train > 0 && s.baseline?.auc != null);
});

test("injectConfig rewrites the meta tag and refuses HTML without it", () => {
  const html = `<meta name="tallybard-config" content='{"apiUrl":"x"}' />`;
  const out = injectConfig(html, { apiUrl: "https://a", demoMode: true });
  assert.match(out, /content='\{"apiUrl":"https:\/\/a","demoMode":true\}'/);
  assert.throws(() => injectConfig("<html></html>", {}));
});

test("no secrets or secret-looking env names in the client source", () => {
  const src = join(here, "../src");
  const files = walk(src);
  for (const f of files) {
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /(SENTRY_DSN|GOOGLE_API_KEY|DATABASE_URL|TABPFN_TOKEN|OLLAMA_API_KEY)/, `${f} references a server-side secret name`);
  }
});

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
}
