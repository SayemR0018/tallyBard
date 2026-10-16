import { html, icon, mount } from "../ui.js";
import { REPO_URL } from "../config.js";

export function renderOpenSource(main) {
  mount(
    main,
    html`<section class="section wrap-text prose">
      <p class="eyebrow">Open source</p>
      <h1>Open where it matters. Honest where it isn’t.</h1>
      <p class="lede">TallyBard is MIT-licensed and designed to run on your own machines with open-weight models. Some of the pieces it benchmarks carry stricter terms — here is the full picture.</p>

      <h2>What is open</h2>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Piece</th><th>Licence</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>TallyBard code</td><td>MIT</td><td>Fork it, self-host it, sell a hosted version — just keep the notice.</td></tr>
          <tr><td>Gemma 4 / EmbeddingGemma</td><td>Gemma Terms of Use</td><td>Open-weight. Runs locally via Ollama. Has use conditions — read them.</td></tr>
          <tr><td>TabPFN v2 weights</td><td>Prior Labs licence (Apache-2.0-style + attribution)</td><td>The permissive option for self-hosted scoring.</td></tr>
          <tr><td>TabPFN-3.5 weights</td><td><strong>Non-commercial</strong></td><td>Used in this project for the synthetic benchmark and demo only. Not for production or commercial use.</td></tr>
          <tr><td>Google AI Studio</td><td>Google terms</td><td>Optional fallback backend; prompts leave your network.</td></tr>
          <tr><td>Postgres extensions (Timescale, pgvectorscale, pg_textsearch)</td><td>Their own licences</td><td>Available on Tiger Cloud; check terms for self-managed installs.</td></tr>
        </tbody>
      </table></div>
      <p class="small muted">Built with PriorLabs-TabPFN. Verify every licence yourself before relying on it — this page is a summary, not legal advice.</p>

      <h2>Swap the model backend with one setting</h2>
      <pre><code>MODEL_BACKEND=ollama     # gemma4 + embeddinggemma on your own box (Caddy + bearer token)
MODEL_BACKEND=aistudio   # Google AI Studio fallback (gemma-4-26b-a4b-it + gemini-embedding-001 @768d)</code></pre>
      <p>Both paths produce 768-dimensional embeddings so the Postgres <code>vector(768)</code> columns and the hybrid-search indexes work unchanged.</p>

      <h2>Self-host in four commands</h2>
      <pre><code>uv run scripts/db.py -f db/schema.sql        # Postgres 17+: extensions, hypertable, RRF search
cd apps/risk-sidecar && uv venv --python 3.12 .venv && uv pip install -r requirements.txt
cd ../api && npm ci && npm run dev             # Mastra API on :4111
cd ../web && npm run build && npm run dev      # site + app on :5173</code></pre>
      <p>Full instructions, env vars and the Render blueprint are in the <a href="${REPO_URL}#readme" target="_blank" rel="noopener">README</a>.</p>

      <h2>Prior art</h2>
      <p><a href="https://dev.to/fracabu" target="_blank" rel="noopener">PayMind</a> by fracabu explored open-source AI collections before this project. TallyBard shares no code with it and differs in being self-hostable and model-swappable, handling informal credit (baki / udhaar), scoring against an explicit baseline, and drafting language-aware nudges grounded in hybrid search.</p>

      <h2>Contribute</h2>
      <p>Issues and pull requests are welcome. The nudge card and CSV edge-case parsing are open issues earmarked for the GitHub Copilot coding agent — see the repository.</p>
      <p class="row mt-6"><a class="btn" href="${REPO_URL}" target="_blank" rel="noopener">${icon("github")} View on GitHub</a> <a class="btn btn-secondary" href="/app">Try the demo</a></p>
    </section>`,
  );
}
