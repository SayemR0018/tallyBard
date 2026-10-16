import { html, icon, mount } from "../ui.js";

export function renderHow(main) {
  mount(
    main,
    html`<section class="section wrap-text prose">
      <p class="eyebrow">How it works</p>
      <h1>From a messy ledger to a polite nudge — with you in the loop.</h1>
      <p class="lede">TallyBard is a copilot, not an autopilot. It does the sorting and the first draft; the decision and the send button stay with you.</p>

      <h2><span class="step-num">1</span> Import</h2>
      <p>Paste a CSV export, or just the text of your notebook: <em>“Rafiq bhai 4500 udhaar, due last Friday”</em>. Gemma reads it (Bangla, English or mixed) and proposes rows — client, amount, kind (invoice / udhaar / fiado), due date, language. You edit and confirm. Nothing is written until you do.</p>
      <p class="small muted">In the hosted demo, confirmed rows stay in your browser only. Self-host to write to your own ledger.</p>

      <h2><span class="step-num">2</span> Score</h2>
      <p>For every open receivable the risk sidecar estimates <strong>P(paid more than 7 days late)</strong> with TabPFN, a foundation model for small tables. It is trained on the fly from your own closed receivables — no cloud training, no data pooling.</p>
      <p>It only ever sees anonymised numbers: amount, kind, days overdue, this client’s prior count and prior late rate. Names, phones and notes never reach it. The “why” shown next to each score is those same numbers — things you can check yourself.</p>

      <h2><span class="step-num">3</span> Draft</h2>
      <p>Pick a tone — <strong>friendly</strong> (light reminder), <strong>firm</strong> (amount, days overdue, asks for a date), or <strong>final</strong> (last polite notice) — and the client’s language. The draft is grounded in a hybrid search (BM25 + vector, fused with RRF) over that client’s notes and your earlier nudges, so you never send the same wording twice.</p>

      <h2><span class="step-num">4</span> Approve & send</h2>
      <p>Approving a draft gives you a <code>wa.me</code> click-to-send link and a copy button. You open WhatsApp, read it one more time, and press send. Then mark it sent; when the money lands, mark it paid — that feeds the next score.</p>

      <h2>Weekly chase run</h2>
      <p>A Mastra workflow can do steps 2–3 for the top of your queue every week and then <strong>pause</strong>. It resumes only when you approve. If the server restarts mid-run, the paused state survives in Postgres.</p>

      <h2>Ask your ledger</h2>
      <p>“Who owes me the most?” “What came in this week?” The chat answers from read-only aggregates and remembers the thread. It cannot send anything.</p>

      <p class="row mt-6"><a class="btn" href="/app">Try the demo ${icon("arrow")}</a> <a class="btn btn-secondary" href="/privacy">Privacy by design</a></p>
    </section>`,
  );
}
