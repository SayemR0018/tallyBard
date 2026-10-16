#!/usr/bin/env node
/**
 * Dev server for dist/ with SPA fallback (mirrors Render's /* → /index.html rewrite).
 * Usage: npm run build && npm run dev   → http://localhost:5173
 * Env: PORT (default 5173)
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

if (!existsSync(dist)) {
  console.error("dist/ not found — run `npm run build` first");
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = resolve(dist, "." + normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html"); // SPA fallback
  res.writeHead(200, {
    "content-type": types[extname(file)] || "application/octet-stream",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`TallyBard web → http://localhost:${port}  (SPA fallback on)`));
