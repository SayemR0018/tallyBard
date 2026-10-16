# Results — real runs only

Every number below was produced by a command on this machine. Nothing is
estimated. **All data is synthetic** (`db/generate_synthetic.py`, seed
20261016): this benchmark validates the pipeline, it is *not* evidence about
real payment behavior.

## Synthetic ledger (seeded 2026-10-16)

Command: `uv run db/generate_synthetic.py` → `uv run scripts/db.py -f db/seeds.sql`

| table | rows |
|---|---|
| clients | 60 |
| receivables | 600 |
| payment_events | 463 |
| client_notes | ~126 |
| nudges | 20 |
| labelled (closed) receivables | 573 |
| positive rate (`paid >7d late`) | 0.583 |

## Backtest: P(paid >7 days late), time-split

Command: `uv run --python apps/risk-sidecar/.venv apps/risk-sidecar/backtest.py`
(2026-10-16, `tabpfn==9.2.0` local weights, CPU). Full JSON: `docs/backtest.json`.
Features are point-in-time (only history before each receivable's issue date);
`test_features.py` contains a leakage guard test that fails if future rows leak.

| train N | test N | model | AUC | Brier |
|---:|---:|---|---:|---:|
| 50 | 523 | past-late-rate baseline | **0.655** | **0.241** |
| 50 | 523 | TabPFN-3.5 | 0.533 | 0.254 |
| 50 | 523 | TabPFN v2 | 0.515 | 0.256 |
| 100 | 473 | baseline | **0.653** | 0.240 |
| 100 | 473 | TabPFN-3.5 | 0.619 | **0.236** |
| 100 | 473 | TabPFN v2 | 0.625 | 0.243 |
| 300 | 273 | baseline | 0.670 | 0.233 |
| 300 | 273 | TabPFN-3.5 | **0.672** | **0.224** |
| 300 | 273 | TabPFN v2 | 0.681 | 0.225 |

**Honest read:** on this tiny synthetic ledger the free baseline beats both
TabPFN variants at N=50 (0.655 vs ~0.53 AUC); TabPFN only catches up around
N=300 (3.5: 0.672 vs baseline 0.670; v2: 0.681). TabPFN is not magic at
N=50 here — the product keeps the baseline alongside and shows both.

**Licence note:** TabPFN-3.5 weights are non-commercial/non-production — the
benchmark and demo only. TabPFN v2 weights are the permissive Prior Labs
licence (Apache-2.0-style + attribution); v2 is the column to watch for any
commercial self-host. Verify before relying on this.

## Sidecar smoke (2026-10-16, local CPU)

- `POST /score` single receivable, cold (weights + 573-row refit): **61.3 s**
- `POST /score` all 137 open receivables, warm: one batched forward pass
- sample output: `p_late7=0.6489`, `why` = amount 43165.49, kind invoice,
  60 days overdue, prior_count 6, prior_late_rate 0.455
- `GET /features/{id}` returns the anonymised feature row (no names/phones/notes)

## API smoke (2026-10-16, `npx tsx scripts/smoke.ts`, MODEL_BACKEND=aistudio)

- `ledger_stats`: 463 paid / 114 overdue / 23 pending — real DB counts
- `chase_queue` top-1: BDT 46,828 × p=0.8426 → priority 39,457
- `score_receivables`: 137 open receivables scored (TabPFN-3.5 local weights)
- `draft_nudge` via `gemma-4-26b-a4b-it`: produced a mixed Bangla+English
  friendly nudge (real model output)
- `privacy_report` returns the egress table shown in the UI

## Sidecar memory (measured 2026-10-16, local CPU)

- warm RSS after model load + scoring: **~2,255 MB** (uvicorn process, torch +
  TabPFN-3.5 weights resident)
- consequence: Render `standard` (2 GB) is too tight — `render.yaml` pins
  `pro` (4 GB) for `TABPFN_MODE=local`; `TABPFN_MODE=api` would run on
  `starter` instead (weights stay on Prior Labs' side — note their key is
  non-commercial, so api mode is a demo-fallback story, not a business plan).

## Model bench (2026-10-16, `npx tsx scripts/bench.ts`, 15 calls, 3 fixed prompts × 5)

| backend | model | calls | latency | notes |
|---|---|---|---|---|
| aistudio | gemma-4-26b-a4b-it | 15 | p50=20,499ms p95=26,243ms | free tier; all 15 returned text + token counts |
| aistudio | gemini-embedding-001 | — | — | `outputDimensionality=768` confirmed (embed_dim=768) |
| ollama | gemma4:e2b (droplet) | — | — | pending droplet (T10/H4) |

## Pending real measurements

- [ ] GPU droplet benchmark (blocked on droplet approval, T10)
- [ ] aistudio vs ollama prompt-level bench `scripts/bench.ts` (needs droplet)
- [ ] public payments dataset backtest — skipped: no dataset with a clearly
      verified licence found inside the 20-minute budget
