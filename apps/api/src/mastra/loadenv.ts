/**
 * Dev convenience: load the nearest .env (walking up from cwd and from this
 * module) into process.env — never prints values. In production (Render),
 * real env vars already exist and take precedence. Mastra bundles to
 * .mastra/output and runs from there, so a fixed relative path is not enough.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

function findEnv(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 7; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadEnv(): void {
  const file =
    findEnv(process.cwd()) ?? findEnv(dirname(fileURLToPath(import.meta.url)));
  if (!file) return;
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();
