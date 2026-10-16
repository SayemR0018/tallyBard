import { html, icon, mount } from "../ui.js";

export function renderPrivacyPage(main) {
  mount(
    main,
    html`<section class="section wrap-text prose">
      <p class="eyebrow">Privacy by design</p>
      <h1>Collections data is sensitive. We built around that.</h1>
      <p class="lede">Your client list is a business asset and a trust relationship. TallyBard keeps it on infrastructure you control, scores only anonymised numbers, and never sends a message on your behalf.</p>

      <h2>Three rules</h2>
      <ol>
        <li><strong>Names, phones and notes stay with you.</strong> They live in your Postgres. The risk model never receives them.</li>
        <li><strong>Only anonymised numbers are scored.</strong> Amount, kind, days overdue, this client’s prior count and prior late rate. That is the entire feature set.</li>
        <li><strong>Nothing is sent automatically.</strong> There is no outbound messaging integration at all. Approval yields a <code>wa.me</code> link; a human presses send.</li>
      </ol>

      <h2>What leaves the server, by destination</h2>
      <div class="flow">
        <div class="card card-sm"><h4>${icon("cpu")} Risk sidecar (TabPFN)</h4><ul><li class="yes">✓ anonymised numeric / categorical features</li><li class="no">✗ names, phones, note text</li></ul></div>
        <div class="card card-sm"><h4>${icon("pen")} Drafting model (Gemma)</h4><ul><li class="yes">✓ the prompt: client name, amount, days overdue, tone, relevant notes</li><li class="no">✗ phone numbers; unrelated notes</li><li>With the self-hosted Ollama backend this never leaves your network. With Google AI Studio it goes to Google.</li></ul></div>
        <div class="card card-sm"><h4>${icon("eye")} Sentry tracing</h4><ul><li class="yes">✓ span names, timings, token counts</li><li class="no">✗ prompts and outputs — genAI capture is off in production; a local-only flag turns it on for screenshots on synthetic data</li></ul></div>
      </div>
      <p class="small muted mt-3">The in-app <a href="/app/privacy">privacy panel</a> is generated from the server’s own report, so it reflects the backend that is actually running.</p>

      <h2>The hosted demo</h2>
      <ul>
        <li>Runs on one <strong>synthetic</strong> ledger. Every name is generated.</li>
        <li>Has <strong>no accounts and no login</strong>. An anonymous per-browser id scopes chat memory; you can reset it any time.</li>
        <li>Rows you import in the demo stay <strong>in your browser</strong> and are not written to the shared ledger.</li>
        <li>Do not paste real client data into the demo. Self-host for real use.</li>
        <li>No analytics, no trackers, no third-party fonts or scripts on this site.</li>
      </ul>

      <h2>Self-hosting</h2>
      <p>Point the database connection string at your own Postgres, choose <code>MODEL_BACKEND=ollama</code> for a fully self-contained setup, and everything above holds on hardware you own. See the README quickstart.</p>

      <p class="row mt-6"><a class="btn" href="/app/privacy">Open the live privacy panel ${icon("arrow")}</a></p>
    </section>`,
  );
}
