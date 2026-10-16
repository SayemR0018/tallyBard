import { html, raw, icon, mount, riskBadge } from "../ui.js";
import { REPO_URL } from "../config.js";
import { loadResults, resultsTable } from "./results.js";

// Hero mock uses explicitly synthetic rows (same shape as the real queue).
const MOCK = [
  { name: "Rafiq Traders", meta: "Invoice · 24 days overdue", amt: "৳46,828", p: 0.84 },
  { name: "Nadia Islam", meta: "Udhaar · 11 days overdue", amt: "৳8,200", p: 0.52 },
  { name: "Tanvir Hossain", meta: "Tuition · due in 3 days", amt: "৳3,500", p: 0.21 },
];

const AUDIENCE = [
  ["user", "Freelancers & agencies", "Invoices that drift past due while you’re busy delivering."],
  ["book", "Private tutors", "Monthly fees from a dozen families, some always late."],
  ["shop", "Shops selling on credit", "The baki / udhaar / fiado book, finally ranked."],
  ["box", "Tailors, caterers, wholesalers", "Deposits and balances across many small orders."],
  ["users", "Community treasurers", "Chanda and dues collected politely, with a record."],
];

const FEATURES = [
  ["import", "Import from CSV or pasted text", "Gemma extracts rows from messy notes in Bangla or English. You confirm before anything is saved."],
  ["score", "Late-risk score with plain reasons", "P(paid >7 days late) from TabPFN. The “why” is real stats — days overdue, this client’s past late rate — not model hand-waving."],
  ["queue", "Ranked chase queue", "Open receivables ordered by amount × risk, so the first thing you see is the one worth chasing."],
  ["lang", "Language-aware nudges", "Bangla, English or mixed, on a friendly → firm → final tone ladder. Hybrid search over notes and past nudges keeps wording fresh."],
  ["check", "Human approval gate", "Approve produces a WhatsApp click-to-send link. You press send. Then mark sent, mark paid."],
  ["chat", "Ask your ledger", "“Who owes me the most?” answered from read-only aggregates, with thread memory."],
  ["shield", "Privacy panel", "A screen that shows exactly what leaves the server and what never does."],
  ["swap", "Swappable models", "Self-hosted Gemma via Ollama, or Google AI Studio as fallback — one setting."],
];

export async function renderHome(main) {
  mount(
    main,
    html`
      <section class="hero">
        <div class="wrap">
          <div>
            ${icon("bird", "hero-mascot")}
            <h1>Get paid on time, without the awkward messages.</h1>
            <p class="lede">TallyBard predicts which invoices and credit-ledger entries will be paid late and drafts polite WhatsApp nudges in your client’s language. You approve every message — nothing is ever sent automatically.</p>
            <div class="row">
              <a class="btn btn-lg" href="/app">Try the demo — no sign-in ${icon("arrow")}</a>
              <a class="btn btn-lg btn-secondary" href="/how-it-works">How it works</a>
            </div>
            <p class="small muted mt-4">Open source · self-hostable · demo uses synthetic data</p>
          </div>
          <div class="mock" role="img" aria-label="Example chase queue with synthetic clients">
            <div class="mock-bar"><strong>Chase queue</strong><span class="badge badge-accent">synthetic data</span></div>
            ${MOCK.map(
              (r) => html`<div class="mock-row">
                <span class="name">${r.name}</span><span class="amt">${r.amt}</span>
                <span class="meta">${r.meta}</span>${riskBadge(r.p)}
              </div>`,
            )}
            <div class="mock-foot"><span>Ranked by amount × risk</span><span>Approve → WhatsApp</span></div>
          </div>
        </div>
      </section>

      <section class="section section-alt" id="who">
        <div class="wrap">
          <p class="eyebrow">The problem</p>
          <h2>Selling on credit is normal. Chasing it is miserable.</h2>
          <p class="lede">You deliver first and get paid later. Then a dozen small balances sit there, and every reminder costs you a little goodwill. TallyBard works out which ones actually need a nudge and writes the first draft for you.</p>
          <div class="aud mt-5">
            ${AUDIENCE.map(([ic, t, d]) => html`<div class="card card-sm">${icon(ic)}<strong>${t}</strong><span class="small muted">${d}</span></div>`)}
          </div>
        </div>
      </section>

      <section class="section" id="how">
        <div class="wrap">
          <p class="eyebrow">How it works</p>
          <h2>Four steps, one of them yours.</h2>
          <div class="steps mt-5">
            ${[
              ["Import", "Paste a CSV or informal text. Gemma proposes rows; you confirm them."],
              ["Score", "TabPFN estimates P(paid >7 days late) from anonymised numbers only."],
              ["Draft", "A nudge in the client’s language and your chosen tone, grounded in their history."],
              ["Approve & send", "Open the WhatsApp link, press send yourself. Mark sent, then paid."],
            ].map(([t, d], i) => html`<div class="step card"><span class="step-num">${i + 1}</span><h3>${t}</h3><p>${d}</p></div>`)}
          </div>
          <p class="mt-4"><a href="/how-it-works">Read the detailed walkthrough ${icon("arrow")}</a></p>
        </div>
      </section>

      <section class="section section-alt" id="features">
        <div class="wrap">
          <p class="eyebrow">Features</p>
          <h2>Everything a collections assistant should do — and nothing it shouldn’t.</h2>
          <div class="grid grid-4 mt-5">
            ${FEATURES.map(([ic, t, d]) => html`<div class="feature">${icon(ic)}<h3>${t}</h3><p>${d}</p></div>`)}
          </div>
        </div>
      </section>

      <section class="section" id="privacy">
        <div class="wrap">
          <p class="eyebrow">Privacy by design</p>
          <h2>Your client list is yours.</h2>
          <p class="lede">Names, phone numbers and notes stay on infrastructure you control. The risk model only ever sees anonymised numbers. And nothing — not one message — is sent without a human pressing the button.</p>
          <div class="flow mt-5">
            <div class="card card-sm"><h4>${icon("cpu")} Risk model (TabPFN)</h4><ul><li class="yes">✓ amount, days overdue, past late rate</li><li class="no">✗ names, phones, notes</li></ul></div>
            <div class="card card-sm"><h4>${icon("pen")} Drafting model (Gemma)</h4><ul><li class="yes">✓ prompt with name + amount</li><li class="no">✗ phone numbers, raw notes unless searched</li><li>Self-hosted Ollama keeps it on your server</li></ul></div>
            <div class="card card-sm"><h4>${icon("eye")} Tracing (Sentry)</h4><ul><li class="yes">✓ span names, timings, token counts</li><li class="no">✗ prompts, outputs, client fields (off in production)</li></ul></div>
          </div>
          <p class="mt-4"><a href="/app/privacy">See the live privacy panel ${icon("arrow")}</a> · <a href="/privacy">Read the privacy page</a></p>
        </div>
      </section>

      <section class="section section-alt" id="open">
        <div class="wrap grid grid-2">
          <div>
            <p class="eyebrow">Why open</p>
            <h2>Open-weight models. Self-hostable. One setting to swap.</h2>
            <p class="muted">Run Gemma 4 and EmbeddingGemma on your own Ollama box, or point at Google AI Studio as a fallback. The ledger lives in your Postgres. MIT-licensed code.</p>
            <a class="btn btn-secondary" href="/open-source">What is open and what is not ${icon("arrow")}</a>
          </div>
          <div class="card">
            <h3>Honest about licences</h3>
            <ul class="small muted list">
              <li><strong>Code:</strong> MIT.</li>
              <li><strong>Gemma weights:</strong> Gemma Terms of Use (open-weight, with conditions).</li>
              <li><strong>TabPFN-3.5 weights:</strong> non-commercial — used here for the synthetic benchmark and demo only.</li>
              <li><strong>TabPFN v2 weights:</strong> permissive Prior Labs licence — the column to watch for self-hosting. Verify terms yourself.</li>
            </ul>
            <p class="xs muted">Built with PriorLabs-TabPFN.</p>
          </div>
        </div>
      </section>

      <section class="section" id="results">
        <div class="wrap">
          <p class="eyebrow">Results</p>
          <h2>A synthetic benchmark, shown honestly.</h2>
          <p class="lede">The baseline — “how often did this client pay late before?” — is hard to beat on tiny ledgers. We show both numbers.</p>
          <div id="home-results" class="mt-4"><span class="skeleton h-8 w-100"></span></div>
          <p class="mt-3"><a href="/results">Full results, commands and dates ${icon("arrow")}</a></p>
        </div>
      </section>

      <section class="section section-alt" id="built">
        <div class="wrap">
          <p class="eyebrow">Built with</p>
          <ul class="plain built">
            ${[
              ["Mastra", "agent, tools, suspend/resume workflow"],
              ["Gemma", "gemma4 via Ollama · AI Studio fallback"],
              ["TabPFN", "late-risk scoring (PriorLabs)"],
              ["Tiger Data", "Postgres + hypertable + hybrid search"],
              ["Sentry", "agent tracing, PII off"],
              ["Render", "blueprint deploy"],
              ["DigitalOcean", "Ollama droplet"],
            ].map(([n, d]) => html`<li>${n}<span>${d}</span></li>`)}
          </ul>
        </div>
      </section>

      <section class="section" id="faq">
        <div class="wrap-text">
          <p class="eyebrow">Limitations & FAQ</p>
          <h2>What this is not (yet).</h2>
          ${[
            ["Is the demo data real?", "No. Every client, invoice and note in the demo is generated by db/generate_synthetic.py and labelled synthetic. Do not enter real client data into the hosted demo — self-host for that."],
            ["Does it send messages for me?", "Never. Approving a draft gives you a WhatsApp click-to-send link. You read it, you press send. Nothing is automated."],
            ["How good is the risk model?", "On the synthetic benchmark the simple baseline wins at 50 training rows and TabPFN only pulls ahead around 300. Results shows the real table. Treat scores as a ranking aid, not a verdict."],
            ["Can I use it commercially?", "The code is MIT. TabPFN-3.5 weights are non-commercial; v2 weights are permissive. Gemma has its own terms. Check each licence before you rely on it."],
            ["Why is the first request slow?", "The hosted demo runs on small instances that sleep when idle; the first visit wakes them (20–60s). Scoring also refits TabPFN on each call, about a minute cold on CPU."],
            ["What about accounts and multi-tenant use?", "Not built. The demo is zero-login on one synthetic ledger. Self-hosting gives you your own ledger; multi-tenant auth is out of scope for now."],
            ["Where can I see what leaves the server?", "The in-app privacy panel lists each egress and what it does and doesn’t see. The privacy page explains the design."],
          ].map(([q, a]) => html`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`)}
          <p class="mt-5"><a class="btn" href="/app">Try the demo — no sign-in ${icon("arrow")}</a> <a class="btn btn-ghost" href="${REPO_URL}" target="_blank" rel="noopener">${icon("github")} Star on GitHub</a></p>
        </div>
      </section>
    `,
  );

  const slot = main.querySelector("#home-results");
  try {
    const data = await loadResults();
    mount(slot, resultsTable(data, { compact: true }));
  } catch {
    mount(slot, html`<div class="notice notice-info">${icon("info")}<p><strong>Results pending.</strong> No benchmark file was found in this build.</p></div>`);
  }
}
