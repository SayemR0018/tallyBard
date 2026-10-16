import { html, icon, mount, errorState, skeletonRows } from "../ui.js";
import { runTool } from "../api.js";

export function renderPrivacyPanel(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Privacy panel</h1><p>Generated from the server’s own report, so it reflects the backend actually running right now.</p></div>
        <div class="actions"><a class="btn btn-secondary btn-sm" href="/privacy">${icon("shield")} Why it’s built this way</a></div>
      </div>
      <section id="p-body">${skeletonRows(4)}</section>
      <div class="notice notice-ok mt-4">${icon("check")}<p><strong>Nothing is sent automatically.</strong> Approval produces a WhatsApp link; a human presses send. There is no outbound messaging integration.</p></div>
    `,
  );
  const body = main.querySelector("#p-body");
  async function load() {
    try {
      const p = await runTool("privacy_report", {});
      mount(
        body,
        html`
          <p class="small">Active model backend: <span class="badge badge-primary">${p.backend}</span> ${p.backend === "ollama" ? "— prompts stay on our own infrastructure." : "— prompts go to Google AI Studio."}</p>
          <div class="egress">${p.egress.map((e) => html`<div class="card card-sm">
            <h3>${icon(e.to.toLowerCase().includes("sentry") ? "eye" : e.to.toLowerCase().includes("sidecar") ? "cpu" : "pen")} ${e.to}</h3>
            <ul><li class="yes"><strong>Sees:</strong> ${e.sees.join("; ")}</li><li class="no"><strong>Never sees:</strong> ${e.never.join("; ")}</li></ul>
          </div>`)}</div>
          <p class="xs muted mt-3">This demo ledger is synthetic. Rows you import in the demo stay in your browser and never leave it.</p>
        `,
      );
    } catch (e) {
      mount(body, errorState(e));
      body.querySelector("[data-retry]").onclick = () => { mount(body, skeletonRows(4)); load(); };
    }
  }
  load();
}
