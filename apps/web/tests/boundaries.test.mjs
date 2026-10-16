import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../src");

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
}

test("strict CSP: no inline <script> or style= attributes in shipped source", () => {
  for (const f of walk(src)) {
    if (!/\.(html|js)$/.test(f)) continue;
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /<script(?![^>]*\bsrc=)[^>]*>/, `${f}: inline <script> would violate script-src 'self'`);
    assert.doesNotMatch(t, /\sstyle="/, `${f}: inline style= would violate style-src 'self'`);
  }
});

test("no third-party scripts, fonts, analytics or trackers", () => {
  const index = readFileSync(join(src, "index.html"), "utf8");
  assert.doesNotMatch(index, /https?:\/\/[^"']*(googleapis|gstatic|analytics|gtag|plausible|hotjar|segment|fonts\.)/i);
  assert.doesNotMatch(index, /<link[^>]+rel="stylesheet"[^>]+href="https?:/);
});

test("Copilot-owned files are not pre-empted (issue #2, copilot-cli-task.md)", () => {
  assert.equal(existsSync(join(src, "js/csv.js")), false, "csv.js belongs to issue #2");
  assert.equal(existsSync(join(src, "js/app/nudge-card.js")), false, "nudge-card.js belongs to the Copilot CLI task");
});

test("every screen labels the data as synthetic somewhere on the shell", () => {
  const shell = readFileSync(join(src, "js/app/shell.js"), "utf8");
  assert.match(shell, /synthetic/i);
  const index = readFileSync(join(src, "index.html"), "utf8");
  assert.doesNotMatch(index, /login|sign ?in|signup|password/i, "zero-login: no auth UI");
});
