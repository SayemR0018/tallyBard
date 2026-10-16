import { runTool } from "../api.js";

export function renderQueue(root) {
  root.innerHTML = `
    <h2>Chase queue</h2>
    <p class="muted">Open receivables ranked by amount × P(paid &gt;7 days late). Risk from TabPFN
       on anonymised features; the "why" numbers come from SQL.</p>
    <div class="row"><button id="q-refresh">Refresh scores</button>
    <span id="q-status" class="muted"></span></div>
    <div id="q-table"></div>
    <div id="nudge-slot"></div>`;

  const status = document.getElementById("q-status");
  const table = document.getElementById("q-table");
  const slot = document.getElementById("nudge-slot");

  async function load() {
    status.textContent = "loading + scoring… (first score can take ~1 min)";
    try {
      const { queue } = await runTool("chase_queue", { limit: 20 });
      status.textContent = `${queue.length} open receivables`;
      table.innerHTML =
        `<table><tr><th>client</th><th>amount</th><th>days overdue</th>
         <th>P(late&gt;7d)</th><th>priority</th><th></th></tr>` +
        queue
          .map(
            (q) => `<tr>
              <td>${esc(q.client_name)}</td>
              <td>${q.amount.toLocaleString()} ${q.currency}</td>
              <td>${q.days_overdue}</td>
              <td class="${riskClass(q.p_late7)}">${q.p_late7 == null ? "—" : q.p_late7.toFixed(2)}</td>
              <td class="mono">${q.priority ?? "—"}</td>
              <td><button class="ghost" data-rid="${q.receivable_id}">Draft nudge</button></td>
            </tr>`,
          )
          .join("") +
        `</table>`;
      table.querySelectorAll("button[data-rid]").forEach((b) => {
        b.onclick = () => draft(b.dataset.rid);
      });
    } catch (e) {
      status.innerHTML = `<span class="error">${esc(e.message)}</span>`;
    }
  }

  async function draft(rid) {
    slot.innerHTML = `<div class="panel muted">drafting…</div>`;
    try {
      const d = await runTool("draft_nudge", {
        receivable_id: rid,
        tone: "friendly",
        language: null,
      });
      // COPILOT ISSUE: this raw render is the scaffold stand-in. The real
      // NudgeCard component (tone ladder, wa.me approve flow, copy button,
      // dedup notice, tests) is assigned to the Copilot coding agent.
      const wa = await safeApprove(d.nudge_id);
      slot.innerHTML = `
        <div class="panel" id="nudge-card" data-nudge="${d.nudge_id}">
          <div class="muted">draft — ${d.language} / ${d.tone} · nudge ${d.nudge_id}</div>
          <p>${esc(d.draft_text)}</p>
          <div class="row">
            ${wa ? `<a href="${wa}" target="_blank" rel="noopener"><button>Approve → open WhatsApp</button></a>` : ""}
            <button class="ghost" id="nc-copy">Copy</button>
          </div>
          <div class="muted" style="font-size:.75rem;margin-top:8px">
            Nothing is sent automatically. You press send in WhatsApp.
          </div>
        </div>`;
      document.getElementById("nc-copy").onclick = () =>
        navigator.clipboard.writeText(d.draft_text);
    } catch (e) {
      slot.innerHTML = `<div class="panel error">${esc(e.message)}</div>`;
    }
  }

  document.getElementById("q-refresh").onclick = load;
  load();
}

async function safeApprove(nudgeId) {
  try {
    const a = await runTool("approve_nudge", { nudge_id: nudgeId });
    return a.wa_link;
  } catch {
    return null; // already approved or phone missing — copy still works
  }
}

function riskClass(p) {
  if (p == null) return "muted";
  return p >= 0.65 ? "risk-hi" : p >= 0.4 ? "risk-md" : "risk-lo";
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
