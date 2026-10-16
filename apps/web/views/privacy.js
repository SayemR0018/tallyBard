import { runTool } from "../api.js";

export async function renderPrivacy(root) {
  root.innerHTML = `<h2>What leaves this server</h2><div id="p-body" class="muted">loading…</div>`;
  const body = document.getElementById("p-body");
  try {
    const p = await runTool("privacy_report", {});
    body.innerHTML =
      `<p>Active model backend: <strong>${esc(p.backend)}</strong></p>` +
      p.egress
        .map(
          (e) => `<div class="panel">
            <strong>${esc(e.to)}</strong>
            <div style="margin-top:6px"><span class="muted">sees:</span>
              ${e.sees.map((s) => `<span class="risk-md"> ${esc(s)}</span>`).join(" ·")}</div>
            <div><span class="muted">never sees:</span>
              ${e.never.map((s) => `<span class="risk-lo"> ${esc(s)}</span>`).join(" ·")}</div>
          </div>`,
        )
        .join("") +
      `<p class="muted" style="margin-top:12px">All rows in this demo are synthetic.
        In production, genAI prompt/response capture is off in Sentry; spans carry
        names, timings, and token counts only.</p>`;
  } catch (e) {
    body.innerHTML = `<span class="error">${esc(e.message)}</span>`;
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
