"""Feature-pipeline tests: PII-free matrix + point-in-time leakage guard."""
from datetime import datetime, timedelta, timezone

import pandas as pd

from features import FEATURE_COLUMNS, build_feature_frame, label_for

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def mk(i, cid, issued, due, paid=None, amount=1000.0, kind="invoice"):
    return {"id": f"r{i}", "client_id": cid, "amount": amount, "kind": kind,
            "channel": "whatsapp", "issued_at": issued, "due_date": due,
            "paid_at": paid, "status": "x"}


def base_records():
    return [
        # c1: paid late (due day5, paid day20) — knowable after day20
        mk("a", "c1", T0, T0 + timedelta(days=5), T0 + timedelta(days=20)),
        # c1: unpaid, due day8 — late-knowable after day15
        mk("b", "c1", T0, T0 + timedelta(days=8), None),
        # c2: paid on time day12 (due day10, +2d)
        mk("c", "c2", T0, T0 + timedelta(days=10), T0 + timedelta(days=12)),
        # TARGET: c1 issued day30
        mk("target", "c1", T0 + timedelta(days=30), T0 + timedelta(days=44)),
    ]


def test_feature_columns_have_no_pii():
    recs = [dict(r, name="X", phone="+8801", notes="secret") for r in base_records()]
    ids, X, _ = build_feature_frame(recs)
    assert list(X.columns) == FEATURE_COLUMNS
    assert not ({"name", "phone", "notes", "client_id", "id"} & set(X.columns))
    for col in X.columns:
        if X[col].dtype == object:
            assert not X[col].astype(str).str.contains(r"\+880").any()


def test_point_in_time_no_leakage():
    recs = base_records()
    _, X1, _ = build_feature_frame(recs)
    t1 = X1.iloc[[3]]

    # Mutate the FUTURE relative to target's issue (day30): pay "b" on day50.
    recs2 = [dict(r) for r in recs]
    recs2[1]["paid_at"] = T0 + timedelta(days=50)
    _, X2, _ = build_feature_frame(recs2)
    pd.testing.assert_frame_equal(t1, X2.iloc[[3]], check_dtype=False)


def test_label_definition():
    late = mk("x", "c", T0, T0 + timedelta(5), T0 + timedelta(20))
    on_time = mk("y", "c", T0, T0 + timedelta(5), T0 + timedelta(10))
    unpaid_late = mk("z", "c", T0, T0 + timedelta(5), None)
    recent_open = mk("w", "c", T0, T0 + timedelta(500), None)
    now = T0 + timedelta(days=60)
    assert label_for(late, now) == 1
    assert label_for(on_time, now) == 0
    assert label_for(unpaid_late, now) == 1
    assert label_for(recent_open, now) is None


def test_target_prior_rate_uses_only_knowable_outcomes():
    _, X, _ = build_feature_frame(base_records())
    row = X.iloc[3]
    # at day30: 'a' paid-late (paid day20 <= 30) and 'b' unpaid past due+7 -> 2/2
    assert row["client_prior_count"] == 2
    assert row["client_prior_late_count"] == 2
