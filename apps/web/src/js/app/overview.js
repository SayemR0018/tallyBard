import { html, raw, icon, mount, fmtMoney, riskBadge, errorState, emptyState, skeletonRows } from "../ui.js";
import { runTool } from "../api.js";
import { localRows } from "../state.js";

export async function renderOverview(main, { router }) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Overview</h1><p>One synthetic ledger, scored and ranked. Start with the queue, or import your own rows to try extraction.</p></div>
        <div class="actions"><a class="btn" href="/app/queue">${icon("queue")} Open chase queue</a><a class="btn btn-secondary" href="/app/import">${icon("import")} Import</a></div>
      </div>
      <section class="stats" id="ov-stats" aria-label="Ledger totals">${skeletonRows(3)}</section>
      <section class="card mt-4">
        <div class="card-head"><h3>Top of the queue</h3><a class="small" href="/app/queue">See all</a></div>
        <div id="ov-queue">${skeletonRows(4)}</div>
      </section>
      <section id="ov-local" class="mt-4"></section>
    `,
  );

  const statsEl = main.querySelector("#ov-stats");
  const queueEl = main.querySelector("#ov-queue");
  const localEl = main.querySelector("#ov-local");

  const rows = localRows.all();
  if (rows.length) {
    mount(
      localEl,
      html`<div class="card">
        <div class="card-head"><h3>Your browser-only rows</h3><span class="badge badge-info">${rows.length} not scored</span></div>
        <p class="small muted">Imported in this browser during the demo. They are not written to the shared ledger and cannot be scored here — self-host to score your own data.</p>
        <ul class="plain small">${rows.slice(0, 5).map((r) => html`<li>${r.client_name} — ${fmtMoney(r.amount, r.currency)} · ${r.kind}</li>`)}</ul>
      </div>`,
    );
  }

  async function loadStats() {
    try {
      const [open, status] = await Promise.all([
        runTool("ledger_stats", { query: "open_totals" }),
        runTool("ledger_stats", { query: "per_status" }),
      ]);
      const openRow = open.rows?.[0];
      const counts = Object.fromEntries((status.rows || []).map((r) => [r.status, Number(r.count)]));
      mount(
        statsEl,
        html`
          <div class="card card-sm stat"><span class="stat-v">${openRow ? fmtMoney(openRow.open_amount, openRow.currency) : "—"}</span><span class="stat-l">Open receivables</span></div>
          <div class="card card-sm stat"><span class="stat-v">${counts.overdue ?? 0}</span><span class="stat-l">Overdue</span></div>
          <div class="card card-sm stat"><span class="stat-v">${counts.pending ?? 0}</span><span class="stat-l">Pending (not yet due)</span></div>
          <div class="card card-sm stat"><span class="stat-v">${counts.paid ?? 0}</span><span class="stat-l">Paid (history for scoring)</span></div>
        `,
      );
    } catch (e) {
      mount(statsEl, errorState(e));
      statsEl.querySelector("[data-retry]").onclick = () => { mount(statsEl, skeletonRows(3)); loadStats(); };
    }
  }

  async function loadQueue() {
    try {
      const { queue } = await runTool("chase_queue", { limit: 5 });
      if (!queue?.length) {
        mount(queueEl, emptyState({ title: "Nothing to chase", body: "No open receivables in the ledger." }));
        return;
      }
      mount(
        queueEl,
        html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Client</th><th class="num">Amount</th><th>Overdue</th><th>Risk</th></tr></thead>
          <tbody>${queue.map((q) => html`<tr>
            <td><strong>${q.client_name}</strong></td>
            <td class="num">${fmtMoney(q.amount, q.currency)}</td>
            <td>${q.days_overdue ? `${q.days_overdue}d` : "not due"}</td>
            <td>${riskBadge(q.p_late7)}</td>
          </tr>`)}</tbody>
        </table></div>`,
      );
    } catch (e) {
      mount(queueEl, errorState(e));
      queueEl.querySelector("[data-retry]").onclick = () => { mount(queueEl, skeletonRows(4)); loadQueue(); };
    }
  }

  loadStats();
  loadQueue();
}
