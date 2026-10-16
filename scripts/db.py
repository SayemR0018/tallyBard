# /// script
# requires-python = ">=3.12"
# dependencies = ["psycopg[binary]"]
# ///
"""Run SQL against the TallyBard Tiger Postgres service.

Usage:
  uv run scripts/db.py -c "SHOW server_version"   # run a query, print rows
  uv run scripts/db.py -f db/schema.sql           # apply a SQL file
  uv run scripts/db.py -t "<tag>" -f db/x.sql     # same, prints tag header

Reads DATABASE_URL_RW (falls back to DATABASE_URL) from .env. Never prints it.
"""
import os
import sys
from pathlib import Path

import psycopg


def load_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    load_env()
    args = sys.argv[1:]
    sql = None
    i = 0
    while i < len(args):
        if args[i] == "-f":
            sql = Path(args[i + 1]).read_text(encoding="utf-8")
            i += 2
        elif args[i] == "-c":
            sql = args[i + 1]
            i += 2
        elif args[i] == "-t":
            print(f"=== {args[i + 1]} ===")
            i += 2
        else:
            i += 1
    if sql is None:
        sys.exit("pass -c <sql> or -f <file>")
    dsn = os.environ.get("DATABASE_URL_RW") or os.environ["DATABASE_URL"]
    with psycopg.connect(dsn, autocommit=True) as conn:
        try:
            cur = conn.execute(sql)
            if cur.description:
                for row in cur.fetchall():
                    print(" | ".join("" if c is None else str(c) for c in row))
        except psycopg.Error as e:
            print(f"SQL_ERROR: {e.diag.severity} {e.diag.message_primary}")
            if e.diag.message_detail:
                print(f"DETAIL: {e.diag.message_detail}")
            sys.exit(1)


if __name__ == "__main__":
    main()
