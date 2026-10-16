"""Time-split backtest: TabPFN-3.5 / TabPFN-v2 vs client-past-late-rate baseline.

Pulls receivables from Tiger (read-only DSN), builds point-in-time features,
trains on the earliest N labelled rows and tests on ALL later labelled rows —
no shuffling. Metrics: ROC-AUC + Brier score. Writes docs/backtest.json.

This is a SYNTHETIC benchmark on generated data — evidence about the pipeline,
not about real clients' payment behaviour.

Usage: uv run --python apps/risk-sidecar/.venv apps/risk-sidecar/backtest.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import psycopg
from sklearn.metrics import brier_score_loss, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import FEATURE_COLUMNS, build_feature_frame, label_for  # noqa: E402
from model import make_classifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SIZES = [int(s) for s in os.getenv("BACKTEST_SIZES", "50,100,300").split(",")]


def load_env() -> None:
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


def load_receivables() -> list[dict]:
    dsn = os.environ.get("DATABASE_URL") or os.environ["DATABASE_URL_RW"]
    with psycopg.connect(dsn) as conn:
        rows = conn.execute(
            "SELECT id, client_id, amount, kind, channel, issued_at, due_date, "
            "paid_at, status FROM receivables ORDER BY issued_at"
        ).fetchall()
    return [dict(zip(
        ["id", "client_id", "amount", "kind", "channel", "issued_at",
         "due_date", "paid_at", "status"], r)) for r in rows]


def run() -> dict:
    load_env()
    records = load_receivables()
    ids, X, labels = build_feature_frame(records)
    df = X.copy()
    df["id"] = ids
    df["y"] = labels
    labelled = df.dropna(subset=["y"]).reset_index(drop=True)
    labelled["y"] = labelled["y"].astype(int)

    assert set(FEATURE_COLUMNS) == set(X.columns), "feature drift"
    forbidden = {"id", "client_id", "name", "phone", "notes", "body", "draft_text"}
    assert not (set(X.columns) & forbidden), "PII column in feature matrix"

    import tabpfn
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data": "synthetic (db/generate_synthetic.py seed 20261016)",
        "disclaimer": "Synthetic benchmark — pipeline evidence, not real clients.",
        "n_labelled": int(len(labelled)),
        "positive_rate": float(labelled["y"].mean()),
        "packages": {"tabpfn": getattr(tabpfn, "__version__", "?")},
        "models_used": {},
        "splits": [],
    }

    clfs = {}
    for tag in ("tabpfn35", "tabpfnv2"):
        try:
            clf, mid = make_classifier(tag)
            clfs[tag] = clf
            result["models_used"][tag] = mid
        except Exception as e:  # noqa: BLE001
            result["models_used"][tag] = f"UNAVAILABLE: {e}"

    for n in SIZES:
        if n >= len(labelled) - 10:
            result["splits"].append({"n_train": n, "skipped": "not enough rows"})
            continue
        train = labelled.iloc[:n]
        test = labelled.iloc[n:]
        if test["y"].nunique() < 2:
            result["splits"].append(
                {"n_train": n, "skipped": "single-class test fold"})
            continue
        split = {"n_train": n, "n_test": int(len(test)),
                 "test_positive_rate": float(test["y"].mean())}

        base_p = test["client_prior_late_rate"].clip(0, 1).to_numpy()
        split["baseline"] = {
            "auc": float(roc_auc_score(test["y"], base_p)),
            "brier": float(brier_score_loss(test["y"], base_p)),
        }
        for tag, clf in clfs.items():
            try:
                clf.fit(train[FEATURE_COLUMNS], train["y"])
                p = clf.predict_proba(test[FEATURE_COLUMNS])[:, 1]
                split[tag] = {
                    "auc": float(roc_auc_score(test["y"], p)),
                    "brier": float(brier_score_loss(test["y"], p)),
                }
            except Exception as e:  # noqa: BLE001
                split[tag] = {"error": str(e)}
        result["splits"].append(split)
        print(json.dumps(split))

    out = ROOT / "docs" / "backtest.json"
    out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {out}")
    return result


if __name__ == "__main__":
    run()
