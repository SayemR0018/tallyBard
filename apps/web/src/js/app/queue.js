import { html, raw, icon, mount, on, toast, fmtMoney, riskBadge, errorState, emptyState, skeletonRows } from "../ui.js";
import { runTool } from "../api.js";
import { DEMO_MODE } from "../config.js";
import { renderNudgeSlot } from "./nudge-slot.js";

const TONES = ["friendly", "firm", "final"];
const LANGS = [["", "Client’s"], ["bn", "Bangla"], ["en", "English"], ["mixed", "Mixed"]];

export function renderQueue(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Chase queue</h1><p>Open receivables ranked by amount × P(paid &gt;7 days late). Risk from TabPFN on anonymised numbers; the “why” is plain stats.</p></div>
        <div class="actions"><button class="btn btn-secondary" id="q-refresh">${icon("refresh")} Re-score</button></div>
      </div>
      <div class="notice mb-4">${icon("info")}<p>First scoring call refits TabPFN on the ledger — up to a minute cold. Risk shows <em>Not scored</em> if the sidecar is asleep; the queue still works.</p></div>
      <div class="card mb-4">
        <div class="row between">
          <div class="row">
            <span class="small muted">Tone</span>
            <div class="segmented" role="group" aria-label="Tone">${TONES.map((t) => html`<button type="button" data-tone="${t}" aria-pressed="${t === "friendly"}">${t}</button>`)}</div>
          </div>
          <div class="row">
            <label class="small muted" for="q-lang">Language</label>
            <select class="input" id="q-lang">${LANGS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
          </div>
        </div>
      </div>
      <section id="q-table">${skeletonRows(6)}</section>
      <section id="q-nudge" class="mt-4" aria-live="polite"></section>
    `,
  );

  const table = main.querySelector("#q-table");
  const slot = main.querySelector("#q-nudge");
  let tone = "friendly";
  let queue = [];

  on(main, "[data-tone]", "click", (e, b) => {
    tone = b.dataset.tone;
    main.querySelectorAll("[data-tone]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });

  async function load(rescore = false) {
    mount(table, skeletonRows(6));
    try {
      ({ queue } = await runTool("chase_queue", { limit: 20, rescore }));
      if (!queue?.length) {
        mount(table, emptyState({ title: "Nothing to chase", body: "No open receivables. Import some rows or mark a few unpaid." }));
        return;
      }
      const unscored = queue.every((q) => q.p_late7 == null);
      mount(
        table,
        html`${unscored ? html`<div class="notice notice-warn mb-3">${icon("alert")}<p>Risk sidecar didn’t answer — showing the queue without scores. <button class="btn btn-sm btn-secondary" id="q-retry">Retry scoring</button></p></div>` : ""}
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Client</th><th class="num">Amount</th><th>Overdue</th><th>Risk</th><th class="num hide-sm">Priority</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${queue.map((q) => html`<tr class="queue-row" data-rid="${q.receivable_id}">
            <td><strong>${q.client_name}</strong><div class="why">${q.currency} · id ${q.receivable_id.slice(0, 8)}</div></td>
            <td class="num">${fmtMoney(q.amount, q.currency)}</td>
            <td>${q.days_overdue ? html`<span class="badge ${q.days_overdue > 21 ? "badge-bad" : q.days_overdue > 7 ? "badge-warn" : ""}">${q.days_overdue} days</span>` : html`<span class="badge">not due</span>`}</td>
            <td>${riskBadge(q.p_late7)}</td>
            <td class="num mono hide-sm">${q.priority == null ? "—" : Math.round(q.priority).toLocaleString("en-IN")}</td>
            <td><div class="row nowrap"><button class="btn btn-sm" data-draft="${q.receivable_id}">${icon("pen")} Draft</button>${DEMO_MODE ? "" : html`<button class="btn btn-sm btn-ghost" data-paid="${q.receivable_id}">${icon("check")} Paid</button>`}</div></td>
          </tr>`)}</tbody>
        </table></div>`,
      );
      main.querySelector("#q-retry")?.addEventListener("click", load);
    } catch (e) {
      mount(table, errorState(e));
      table.querySelector("[data-retry]").onclick = load;
    }
  }

  on(main, "[data-draft]", "click", async (e, b) => {
    const rid = b.dataset.draft;
    const rec = queue.find((q) => q.receivable_id === rid);
    const language = main.querySelector("#q-lang").value || null;
    b.disabled = true;
    mount(slot, html`<div class="card"><p class="small muted"><span class="spinner"></span> Drafting a ${tone} nudge for ${rec?.client_name}… (searching notes + past nudges, then Gemma)</p></div>`);
    slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const d = await runTool("draft_nudge", { receivable_id: rid, tone, language });
      await renderNudgeSlot(slot, { ...d, status: "draft" }, { receivable: rec });
    } catch (err) {
      mount(slot, errorState(err, "Try drafting again"));
      slot.querySelector("[data-retry]").onclick = () => b.click();
    } finally {
      b.disabled = false;
    }
  });

  on(main, "[data-paid]", "click", async (e, b) => {
    const rid = b.dataset.paid;
    const rec = queue.find((q) => q.receivable_id === rid);
    if (!confirm(`Mark ${rec?.client_name}’s ${fmtMoney(rec?.amount, rec?.currency)} as paid?`)) return;
    b.disabled = true;
    try {
      await runTool("mark_paid", { receivable_id: rid, amount: null, method: "demo" });
      toast("Marked paid", "ok");
      b.closest("tr")?.remove();
      queue = queue.filter((q) => q.receivable_id !== rid);
    } catch (err) {
      b.disabled = false;
      toast(err.message, "bad");
    }
  });

  main.querySelector("#q-refresh").onclick = () => load(true);
  load();
}
