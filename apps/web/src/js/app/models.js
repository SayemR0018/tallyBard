import { html, icon, mount, errorState, skeletonRows } from "../ui.js";
import { runTool } from "../api.js";

export function renderModels(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Model switch</h1><p>TallyBard runs the same prompts on either backend. The server picks via <code>MODEL_BACKEND</code>; this screen shows what is live and what each choice means.</p></div>
      </div>
      <section id="m-status">${skeletonRows(3)}</section>
      <div class="grid grid-2 mt-4" id="m-opts"></div>
      <div class="notice mt-4">${icon("lock")}<p>The switch is a server setting, not a visitor control — in a shared demo anyone could flip it. Self-host and set <code>MODEL_BACKEND=ollama|aistudio</code> in your environment.</p></div>
    `,
  );
  const st = main.querySelector("#m-status");
  const opts = main.querySelector("#m-opts");

  async function load() {
    try {
      const s = await runTool("system_status", {});
      mount(
        st,
        html`<div class="stats">
          <div class="card card-sm stat"><span class="stat-v fs-lg">${s.backend}</span><span class="stat-l">Active backend</span></div>
          <div class="card card-sm stat"><span class="stat-v mono fs-md">${s.chat_model}</span><span class="stat-l">Chat model</span></div>
          <div class="card card-sm stat"><span class="stat-v mono fs-md">${s.embed_model}</span><span class="stat-l">Embeddings (768-d)</span></div>
          <div class="card card-sm stat"><span class="stat-v fs-lg">${s.sidecar.ok ? html`<span class="risk risk-low">${icon("check")} up</span>` : html`<span class="risk risk-high">${icon("alert")} asleep</span>`}</span><span class="stat-l">Risk sidecar${s.sidecar.mode ? ` · TabPFN ${s.sidecar.mode}` : ""}</span></div>
        </div>`,
      );
      mount(
        opts,
        html`
          <div class="card model-opt ${s.backend === "ollama" ? "active" : ""}">
            <div class="row between"><h3>Self-hosted Ollama</h3>${s.backend === "ollama" ? html`<span class="badge badge-ok">active</span>` : ""}</div>
            <p class="small muted">gemma4 + embeddinggemma on your own DigitalOcean box behind Caddy with a bearer token. Prompts never leave your infrastructure.</p>
            <ul class="small list"><li>Open-weight (Gemma Terms of Use)</li><li>Latency depends on your hardware</li><li>No per-token cost</li></ul>
          </div>
          <div class="card model-opt ${s.backend === "aistudio" ? "active" : ""}">
            <div class="row between"><h3>Google AI Studio</h3>${s.backend === "aistudio" ? html`<span class="badge badge-ok">active</span>` : ""}</div>
            <p class="small muted">gemma-4-26b-a4b-it + gemini-embedding-001 (768-d). Fallback when you have no GPU box — prompts go to Google.</p>
            <ul class="small list"><li>Zero ops</li><li>Free tier rate-limits under load</li><li>Prompts include client names and amounts</li></ul>
          </div>
        `,
      );
    } catch (e) {
      mount(st, errorState(e));
      st.querySelector("[data-retry]").onclick = () => { mount(st, skeletonRows(3)); load(); };
    }
  }
  load();
}
