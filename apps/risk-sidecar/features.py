"""Point-in-time feature builder for TallyBard risk scoring.

Input: raw receivable dicts (id, client_id, amount, kind, channel, issued_at,
due_date, paid_at, status). Output: aligned (ids, X, y) where X contains ONLY
anonymised numeric/categorical features — never names, phones, or note text.

Point-in-time rule (no leakage): features for receivable r use only rows with
issued_at < r.issued_at whose outcome was knowable by r.issued_at. An outcome
is knowable at time t when paid_at <= t, or when the row is unpaid and
due_date + 7 days < t (it is already late by definition).

Label: paid_late7 = paid_at > due_date + 7d; unpaid rows past due+7d are also
labelled positive. Recent unpaid rows (label unknowable) get label None and are
excluded from supervised evaluation.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta

import pandas as pd

LATE_DAYS = 7
FEATURE_COLUMNS = [
    "amount",
    "log_amount",
    "terms_days",
    "kind",            # category
    "channel",         # category
    "issue_month",     # category (1-12)
    "issue_weekday",   # category (0-6)
    "client_prior_count",
    "client_prior_late_count",
    "client_prior_late_rate",   # smoothed toward global rate
    "client_age_days",
]
ID_COLS = {"id", "client_id", "name", "phone", "notes", "body", "draft_text"}


def _ts(v) -> datetime | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def label_for(rec: dict, now: datetime) -> int | None:
    """1 if late (>7d after due), 0 if not, None if outcome unknowable."""
    paid_at, due = _ts(rec.get("paid_at")), _ts(rec["due_date"])
    if paid_at is not None:
        return int((paid_at - due) > timedelta(days=LATE_DAYS))
    if due + timedelta(days=LATE_DAYS) < now:
        return 1
    return None


def _knowable_by(rec: dict, t: datetime) -> bool:
    """Was rec's late7 outcome knowable at time t?

    An on-time/early payment resolves at paid_at. A late outcome resolves at
    due+7d — the moment the grace period passed unpaid — regardless of whether
    the payment eventually arrived.
    """
    paid, due = _ts(rec.get("paid_at")), _ts(rec["due_date"])
    threshold = due + timedelta(days=LATE_DAYS)
    if paid is not None and paid <= threshold:
        return paid <= t
    return threshold < t


def _late(rec: dict) -> int:
    paid, due = _ts(rec.get("paid_at")), _ts(rec["due_date"])
    return int(paid is None or paid > due + timedelta(days=LATE_DAYS))


def build_feature_frame(records: list[dict], now: datetime | None = None):
    """Return (ids, X, y). X has FEATURE_COLUMNS only; y may contain None."""
    now = now or datetime.now().astimezone()
    recs = sorted(records, key=lambda r: _ts(r["issued_at"]))
    first_seen: dict[str, datetime] = {}
    global_late, global_known = 0, 0

    ids, rows, labels = [], [], []
    for r in recs:
        issued, due, paid = _ts(r["issued_at"]), _ts(r["due_date"]), _ts(r["paid_at"])
        cid = r["client_id"]
        # prior outcomes knowable strictly before this row's issue time
        prior = [p for p in recs
                 if p["client_id"] == cid and _ts(p["issued_at"]) < issued
                 and _knowable_by(p, issued)]
        p_late = sum(_late(p) for p in prior)
        p_count = len(prior)
        p_count = len(prior)
        global_rate = global_late / global_known if global_known else 0.4
        prior_rate = (p_late + 5 * global_rate) / (p_count + 5)  # beta smoothing

        amount = float(r["amount"])
        rows.append({
            "amount": amount,
            "log_amount": math.log1p(amount),
            "terms_days": (due - issued).days,
            "kind": r["kind"],
            "channel": r.get("channel", "whatsapp"),
            "issue_month": issued.month,
            "issue_weekday": issued.weekday(),
            "client_prior_count": p_count,
            "client_prior_late_count": p_late,
            "client_prior_late_rate": prior_rate,
            "client_age_days": (issued - first_seen.get(cid, issued)).days,
        })
        ids.append(r["id"])
        labels.append(label_for(r, now))
        first_seen.setdefault(cid, issued)

        # update global stats only with outcomes knowable at this point in scan
        lbl = labels[-1]
        if lbl is not None and _knowable_by(r, issued):
            global_known += 1
            global_late += lbl

    X = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    for col in ("kind", "channel", "issue_month", "issue_weekday"):
        X[col] = X[col].astype("category")
    return ids, X, labels
