import { html, icon, mount, on, fmtMoney, fmtDate, errorState, emptyState, skeletonRows } from "../ui.js";
import { runTool } from "../api.js";
import { recentDrafts } from "../state.js";
import { renderNudgeSlot } from "./nudge-slot.js";

const FILTERS = [["all", "All"], ["draft", "Drafts"], ["approved", "Approved"], ["sent", "Sent"]];

export function renderNudges(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Nudges</h1><p>Every draft, approved message and sent reminder on the synthetic ledger. Nothing here was sent automatically.</p></div>
        <div class="actions"><a class="btn" href="/app/queue">${icon("pen")} Draft from the queue</a></div>
      </div>
      <div class="segmented" role="group" aria-label="Filter" class="mb-4">${FILTERS.map(([v, l]) => html`<button type="button" data-filter="${v}" aria-pressed="${v === "all"}">${l}</button>`)}</div>
      <section id="n-list">${skeletonRows(5)}</section>
      <section id="n-detail" class="mt-4" aria-live="polite"></section>
    `,
  );
  const list = main.querySelector("#n-list");
  const detail = main.querySelector("#n-detail");
  let status = "all";
  let nudges = [];

  on(main, "[data-filter]", "click", (e, b) => {
    status = b.dataset.filter;
    main.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    load();
  });

  async function load() {
    mount(list, skeletonRows(5));
    try {
      ({ nudges } = await runTool("list_nudges", { status, limit: 40 }));
      if (!nudges.length) {
        const mine = recentDrafts.all();
        mount(list, emptyState({
          icon: "send",
          title: status === "all" ? "No nudges yet" : `No ${status} nudges`,
          body: mine.length ? "Your browser remembers drafts you made here, but the server has none matching this filter." : "Draft one from the chase queue — pick a tone, review, approve.",
          action: '<a class="btn btn-sm" href="/app/queue">Go to queue</a>',
        }));
        return;
      }
      mount(
        list,
        html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Client</th><th class="num">Amount</th><th>Tone</th><th>Status</th><th>Created</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${nudges.map((n) => html`<tr>
            <td><strong>${n.client_name}</strong><div class="xs muted">${n.draft_text.slice(0, 70)}${n.draft_text.length > 70 ? "…" : ""}</div></td>
            <td class="num">${fmtMoney(n.amount, n.currency)}</td>
            <td><span class="badge badge-primary">${n.tone}</span> <span class="badge">${n.language}</span></td>
            <td><span class="badge ${{ sent: "badge-ok", approved: "badge-info" }[n.status] || ""}">${n.status}</span></td>
            <td class="nowrap">${fmtDate(n.created_at)}</td>
            <td><button class="btn btn-sm btn-secondary" data-open="${n.nudge_id}">Open</button></td>
          </tr>`)}</tbody>
        </table></div>`,
      );
    } catch (e) {
      mount(list, errorState(e));
      list.querySelector("[data-retry]").onclick = load;
    }
  }

  on(main, "[data-open]", "click", async (e, b) => {
    const n = nudges.find((x) => x.nudge_id === b.dataset.open);
    if (!n) return;
    const remembered = recentDrafts.all().find((d) => d.nudge_id === n.nudge_id);
    await renderNudgeSlot(detail, { ...n, wa_link: remembered?.wa_link || null, sources_used: remembered?.sources_used || [] }, {
      receivable: { client_name: n.client_name, amount: n.amount, currency: n.currency, receivable_id: n.receivable_id },
    });
    detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  load();
}
