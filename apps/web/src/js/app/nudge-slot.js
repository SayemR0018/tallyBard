// Thin wrapper around the NudgeCard component that docs/copilot-cli-task.md
// assigns to the Copilot CLI session (apps/web/src/js/app/nudge-card.js,
// export `renderNudgeCard(container, nudge, api)`). If that module exists it
// is used; otherwise this minimal stand-in renders. Keep this file small —
// the real component belongs to the Copilot task.
import { html, icon, mount, copyText, toast, on } from "../ui.js";
import { runTool } from "../api.js";
import { recentDrafts } from "../state.js";

let impl = null;
let tried = false;

async function loadImpl() {
  if (tried) return impl;
  tried = true;
  try {
    impl = (await import("./nudge-card.js")).renderNudgeCard;
  } catch {
    impl = null;
  }
  return impl;
}

export async function renderNudgeSlot(container, nudge, { receivable } = {}) {
  recentDrafts.push({ ...nudge, client_name: receivable?.client_name, status: nudge.status || "draft" });
  const real = await loadImpl();
  if (real) return real(container, nudge, { runTool, receivable });
  return fallback(container, nudge, receivable);
}

function fallback(container, nudge, receivable) {
  let approved = nudge.status === "approved" || nudge.status === "sent";
  let waLink = nudge.wa_link || null;

  const draw = () =>
    mount(
      container,
      html`<div class="card nudge-card" data-nudge="${nudge.nudge_id}">
        <div class="nudge-meta">
          <span class="badge badge-primary">${nudge.tone}</span>
          <span class="badge">${{ bn: "Bangla", en: "English", mixed: "Mixed" }[nudge.language] || nudge.language}</span>
          ${receivable ? html`<span class="small muted">to ${receivable.client_name}</span>` : ""}
          <span class="badge ${approved ? "badge-ok" : ""}">${approved ? "approved" : "draft"}</span>
        </div>
        <p class="nudge-text" lang="${nudge.language === "bn" ? "bn" : "en"}">${nudge.draft_text}</p>
        ${nudge.sources_used?.length ? html`<p class="xs muted">Grounded in: ${nudge.sources_used.join(" · ")}</p>` : ""}
        <div class="row">
          ${approved && waLink
            ? html`<a class="btn" href="${waLink}" target="_blank" rel="noopener">${icon("send")} Open in WhatsApp</a>
                   <button class="btn btn-secondary" data-sent>${icon("check")} Mark sent</button>`
            : html`<button class="btn" data-approve>${icon("check")} Approve</button>`}
          <button class="btn btn-secondary" data-copy>${icon("copy")} Copy</button>
        </div>
        <p class="xs muted">Nothing is sent automatically — you press send in WhatsApp.</p>
      </div>`,
    );
  draw();

  on(container, "[data-copy]", "click", () => copyText(nudge.draft_text));
  on(container, "[data-approve]", "click", async (e, btn) => {
    btn.disabled = true;
    try {
      const a = await runTool("approve_nudge", { nudge_id: nudge.nudge_id });
      approved = true;
      waLink = a.wa_link;
      recentDrafts.update(nudge.nudge_id, { status: "approved", wa_link: waLink });
      toast("Approved — open WhatsApp to send", "ok");
      draw();
    } catch (err) {
      btn.disabled = false;
      toast(err.message, "bad");
    }
  });
  on(container, "[data-sent]", "click", async (e, btn) => {
    btn.disabled = true;
    try {
      const r = await runTool("mark_sent", { nudge_id: nudge.nudge_id });
      if (r.ok) {
        recentDrafts.update(nudge.nudge_id, { status: "sent" });
        toast("Marked as sent", "ok");
        btn.textContent = "Sent";
      } else {
        btn.disabled = false;
        toast("Nudge was not in approved state", "bad");
      }
    } catch (err) {
      btn.disabled = false;
      toast(err.message, "bad");
    }
  });
}
