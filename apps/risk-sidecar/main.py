"""TallyBard risk sidecar — FastAPI.

Reads receivables through the read-only DATABASE_URL (the scorer never holds
write credentials and never sees names, phones, or note text — only anonymised
numeric/categorical features leave this service for the model).

Endpoints:
  GET  /health
  POST /score      {receivable_ids?: [...]}  -> P(late>7d) + numeric "why" stats
  GET  /features/{receivable_id}             -> feature row + stats
  POST /backtest   {sizes?: [50,100,300]}    -> metrics JSON (slow)
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import psycopg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from features import FEATURE_COLUMNS, build_feature_frame
from model import make_classifier

ROOT = Path(__file__).resolve().parents[2]
for _line in (ROOT / ".env").read_text().splitlines():
    _line = _line.strip()
    if _line and not _line.startswith("#") and "=" in _line:
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

app = FastAPI(title="tallybard-risk-sidecar")


def dsn() -> str:
    return os.environ.get("DATABASE_URL") or os.environ["DATABASE_URL_RW"]


def load_records() -> list[dict]:
    with psycopg.connect(dsn()) as conn:
        rows = conn.execute(
            "SELECT id, client_id, amount, kind, channel, issued_at, due_date, "
            "paid_at, status FROM receivables ORDER BY issued_at"
        ).fetchall()
    return [dict(zip(
        ["id", "client_id", "amount", "kind", "channel", "issued_at",
         "due_date", "paid_at", "status"], r)) for r in rows]


@lru_cache(maxsize=1)
def get_classifier():
    return make_classifier(os.getenv("TABPFN_TAG", "tabpfn35"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "tallybard-risk-sidecar",
            "mode": os.getenv("TABPFN_MODE", "local")}


class ScoreRequest(BaseModel):
    receivable_ids: list[str] | None = None


@app.post("/score")
def score(req: ScoreRequest) -> dict:
    now = datetime.now(timezone.utc)
    records = load_records()
    for r in records:
        r["id"] = str(r["id"])
        r["client_id"] = str(r["client_id"])
    open_ids = {r["id"] for r in records if r["status"] in ("pending", "overdue")
                and r["paid_at"] is None}
    from features import label_for
    ids, X, _ = build_feature_frame(records, now=now)
    df = X.copy()
    df["id"] = ids
    y = [label_for(r, now) for r in records]
    labelled_idx = [i for i, v in enumerate(y) if v is not None]
    train = df.iloc[labelled_idx]
    y_train = [y[i] for i in labelled_idx]
    if len(train) < 5:
        raise HTTPException(503, "not enough labelled history to score")
    clf, model_id = get_classifier()
    clf.fit(train[FEATURE_COLUMNS], y_train)

    targets = req.receivable_ids or sorted(open_ids)
    # one batched predict_proba (a single forward pass), not one call per row
    tdf = df[df["id"].isin(targets)]
    probs = (
        clf.predict_proba(tdf[FEATURE_COLUMNS])[:, 1] if len(tdf) else []
    )
    pmap = {rid: float(p) for rid, p in zip(tdf["id"].tolist(), probs)}
    rec_by_id = {r["id"]: r for r in records}
    row_by_id = {rid: tdf[tdf["id"] == rid] for rid in pmap}
    out = []
    for rid, p in pmap.items():
        rec = rec_by_id[rid]
        row = row_by_id[rid]
        out.append({
            "receivable_id": rid,
            "p_late7": round(p, 4),
            "why": {
                "amount": float(rec["amount"]),
                "kind": rec["kind"],
                "days_overdue": max(0, (now - rec["due_date"]).days),
                "client_prior_count": int(row["client_prior_count"].iloc[0]),
                "client_prior_late_rate": round(
                    float(row["client_prior_late_rate"].iloc[0]), 3),
            },
        })
    return {"model": model_id, "scored_at": now.isoformat(), "scores": out}


@app.get("/features/{receivable_id}")
def features(receivable_id: str) -> dict:
    records = load_records()
    for r in records:
        r["id"] = str(r["id"])
        r["client_id"] = str(r["client_id"])
    ids, X, _ = build_feature_frame(records)
    df = X.copy()
    df["id"] = ids
    row = df[df["id"] == receivable_id]
    if row.empty:
        raise HTTPException(404, "receivable not found")
    def clean(v):
        return str(v) if isinstance(v, str) or not hasattr(v, "dtype") and isinstance(v, (int,)) else (
            v.item() if hasattr(v, "item") else str(v))
    return {"receivable_id": receivable_id,
            "features": {c: clean(row.iloc[0][c]) for c in FEATURE_COLUMNS}}


class BacktestRequest(BaseModel):
    sizes: list[int] | None = None


@app.post("/backtest")
def backtest(req: BacktestRequest) -> dict:
    if req.sizes:
        os.environ["BACKTEST_SIZES"] = ",".join(str(s) for s in req.sizes)
    import backtest as bt
    return bt.run()
