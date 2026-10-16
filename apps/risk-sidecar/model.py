"""TabPFN classifier factory. TABPFN_MODE=local|api.

local: open weights via the `tabpfn` package (weights download gated by the
       Prior Labs license the user accepted; TABPFN_TOKEN in env).
api:   hosted inference via `tabpfn-client` (comparison path; non-commercial
       free key — never shipped as the default).

Returns (classifier, model_id_used) — the id is recorded in results so the
claim in the write-up names the real artifact.
"""
from __future__ import annotations

import os

MODEL_VERSION_TAGS = {
    # tabpfn-3.5: TABPFN-3-5 License v1.0 — non-commercial / non-production.
    "tabpfn35": "V3_5",
    # tabpfn-v2: Prior Labs License 1.1 (Apache 2.0 + attribution) —
    # commercially permissive per the HF model card.
    "tabpfnv2": "V2",
}


def make_classifier(tag: str, mode: str | None = None):
    mode = mode or os.getenv("TABPFN_MODE", "local")
    if mode == "api":
        from tabpfn_client import TabPFNClassifier as ClientClassifier
        try:
            from tabpfn_client import init
            init(os.environ["TABPFN_TOKEN"])
        except Exception:
            pass  # client also reads TABPFN_TOKEN from env
        return ClientClassifier(), f"api:{tag}"

    # Headless license flow: use TABPFN_TOKEN, never open a browser.
    os.environ.setdefault("TABPFN_NO_BROWSER", "1")

    from tabpfn import TabPFNClassifier
    from tabpfn.model_loading import ModelVersion
    version = ModelVersion[MODEL_VERSION_TAGS[tag]]
    candidates = [version, version.value]
    if tag == "tabpfnv2":
        candidates = ["tabpfn-v2-classifier-v2_default.ckpt", version.value]
    if tag == "tabpfn35":
        # repo file name listed by Prior Labs' HF repo tabpfn_3_5
        candidates = ["tabpfn-v3.5-20260909.safetensors", version, version.value]
    errors = []
    for cand in candidates:
        try:
            return TabPFNClassifier(model_path=cand), f"{version.value}"
        except Exception as e:  # noqa: BLE001
            errors.append(f"{cand}: {str(e)[:160]}")
    raise RuntimeError(f"no usable TabPFN model for {tag}: " + " | ".join(errors))
