import pg from "pg";

const { Pool } = pg;

// Tiger Cloud serves a cert chain that pg's sslmode=verify-full mapping
// rejects; TLS stays on, we just don't pin the CA (like psql sslmode=require).
// Strip ssl* params from the DSN so our explicit ssl option wins.
const ssl = { rejectUnauthorized: false };
function dsn(url?: string): string | undefined {
  if (!url) return url;
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith("ssl")) u.searchParams.delete(k);
  return u.toString();
}

/** Read-write pool for ledger writes (DATABASE_URL_RW). */
export const pool = new Pool({
  connectionString: dsn(process.env.DATABASE_URL_RW || process.env.DATABASE_URL),
  ssl,
});

/** Read-only DSN for analytics-style queries (defence in depth). */
export const readPool = new Pool({
  connectionString: dsn(process.env.DATABASE_URL || process.env.DATABASE_URL_RW),
  ssl,
});

export function vectorLiteral(v: number[] | null): string | null {
  return v ? `[${v.join(",")}]` : null;
}
