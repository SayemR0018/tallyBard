/**
 * Dev convenience: load repo-root .env into process.env (never prints values).
 * In production (Render), real env vars already exist and take precedence.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
try {
  for (const line of readFileSync(resolve(root, ".env"), "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env — fine in production */
}
