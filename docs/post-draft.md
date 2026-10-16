<!--
T17 — DEV post draft for the Hacktoberfest Open-Source AI Challenge, Week 2
"Side Hustle". STAGED LOCALLY — not yet on dev.to. Rewrite in your own voice,
then we stage via DevRelay (create_article, ai_disclosure: some_ai) only after
your explicit OK. Tags: devchallenge, hf26challenge (+ tallybard?).
Placeholders in [brackets] need real screenshots/links before publishing.
-->

# I built an open-source collections copilot for people who sell on credit

If you've ever freelanced, tutored, or run a shop with a "baki" (ledger of
informal credit), you know the worst part isn't the work — it's chasing the
money afterward. Duefy, Nudgera, and a dozen SaaS tools will happily automate
that for $30/month, keep your client list on their servers, and auto-send
messages in your name.

**TallyBard** is the opposite of that: an open-source, self-hostable
collections copilot where a human approves every single message. Nothing is
ever sent automatically.

[HERO IMAGE: queue screenshot]

## What it does

1. **Import anything** — paste a CSV or messy informal text ("Rafiq bhai 4500
   udhaar due last Friday"). Gemma extracts the rows, you confirm before a
   single byte is written.
2. **Late-risk score** — every open receivable gets `P(paid >7 days late)`
   from TabPFN, running against *anonymised numeric features only* — client
   names, phones, and notes never leave the database for scoring.
3. **Chase queue** — ranked by `amount × risk`, with an honest "why" column
   built from SQL stats (days overdue, the client's actual prior late rate),
   not model explanations.
4. **Language-aware nudges** — WhatsApp drafts in Bangla, English, or the
   mixed register real South Asian chats use, on a friendly → firm → final
   tone ladder. Hybrid search (BM25 + vector + RRF on Tiger Cloud Postgres)
   over that client's notes and your previous nudges means messages don't
   repeat themselves.
5. **Human approval gate** — "Approve" produces a `wa.me` click-to-send link.
   You press send. Then mark sent, mark paid, done.
6. **Weekly chase run** — a Mastra workflow scores the ledger, drafts the top
   of the queue, and *suspends* mid-run until a human resumes it.
7. **"Ask your ledger"** — chat over read-only aggregates with thread memory.

## The honest benchmark (this is the part I didn't expect)

I backtested TabPFN on a synthetic 600-receivable ledger (all demo data is
generated and labelled synthetic — this is pipeline evidence, not real
clients) with strict point-in-time features and a leakage test:

| train N | past-late-rate baseline | TabPFN-3.5 | TabPFN v2 |
|---:|---:|---:|---:|
| 50 | **0.655 AUC** | 0.533 | 0.515 |
| 100 | **0.653** | 0.619 | 0.625 |
| 300 | 0.670 | 0.672 | **0.681** |

The free baseline — "how often did this client pay late before?" — **beats a
transformer at N=50** on this data. TabPFN only earns its keep once you have a
few hundred rows of history. So TallyBard shows both numbers. If you're
building "AI for small business" tools: please benchmark against the dumb
baseline first. (TabPFN-3.5 weights are non-commercial — benchmark/demo only;
v2 is the permissively-licensed one.)

## Stack

- **Mastra** (TypeScript) — agent, zod-schematized tools, suspend/resume
  workflow, Postgres memory
- **Tiger Cloud Postgres 18** — TimescaleDB hypertable for payment events,
  `pg_textsearch` BM25 + `pgvectorscale` DiskANN fused with Reciprocal Rank
  Fusion, queried in SQL
- **Prior Labs TabPFN** — `P(late)` scoring in a FastAPI sidecar that only
  ever sees anonymised features
- **Gemma** — `gemma4` via self-hosted Ollama behind Caddy+bearer on
  DigitalOcean; `gemma-4-26b-a4b-it` on Google AI Studio as fallback;
  EmbeddingGemma/gemini-embedding at 768 dims
- **Sentry Agent Tracing** — genAI input/output capture off in production
  (client data is sensitive); a local-only mode records prompts for
  screenshots on synthetic data only
- **Render** — one `render.yaml` deploys all three services
- **GitHub Copilot + Entire** — real Copilot-agent PRs and a Copilot CLI
  session captured end-to-end

[ARCHITECTURE DIAGRAM — screenshot of README mermaid]

## Privacy, plainly

There's a panel in the UI that shows exactly what leaves the server: prompts
to whichever model backend is active, anonymised features to the sidecar,
span names/timings to Sentry. Names, phones, and notes don't go to the risk
model. With the Ollama backend, nothing leaves your own infrastructure at all.

## Limitations (real ones)

- Synthetic data only — no real-client evidence yet
- `/score` refits TabPFN each call (~1 min cold on CPU)
- No auth/multi-tenant, no auto-send, no payment rails — deliberately
- gemma-4-31b-it hit free-tier rate limits during testing
- Couldn't find a public payments dataset with a verified licence in a
  reasonable search window — synthetic-only is a stated limitation

## Built with agents

This repo was built with Devin (planning, schema, sidecar, API, UI scaffold)
and GitHub Copilot (issues #2/#3 + a Copilot CLI task on the nudge card, its
session captured with Entire). [MY AGENT SESSION: link/permalink]

Prior art credit: [PayMind](https://dev.to/fracabu) by fracabu walked this
path first — TallyBard reuses none of its code.

Repo: https://github.com/SayemR0018/tallyBard — MIT, contributions welcome.
"Built with PriorLabs-TabPFN."
