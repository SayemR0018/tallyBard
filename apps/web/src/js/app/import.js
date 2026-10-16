import { html, raw, icon, mount, on, toast, fmtMoney, errorState } from "../ui.js";
import { runTool } from "../api.js";
import { DEMO_MODE } from "../config.js";
import { localRows } from "../state.js";
import { preparse } from "./csv-wrapper.js";

const SAMPLE = `# synthetic example — Bangla + English mixed is fine
Amina Begum, +8801711000001, 12000 BDT, udhaar, due 2026-10-01
Rafiq Traders, +8801822000002, 45500 taka invoice, due 20 Sept
Tanvir bhai tuition 3500 baki, phone 01933000003, due 12 Oct`;

const KINDS = ["invoice", "udhaar", "fiado", "other"];
const LANGS = [["bn", "Bangla"], ["en", "English"], ["mixed", "Mixed"]];

export function renderImport(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Import</h1><p>Paste a CSV or informal credit notes in Bangla or English. Gemma proposes rows — you review and confirm.</p></div>
        <div class="actions"><a class="btn btn-secondary btn-sm" href="/sample-ledger.csv" download>${icon("download")} Sample CSV</a></div>
      </div>
      ${DEMO_MODE
        ? html`<div class="notice notice-info mb-4">${icon("info")}<p><strong>Demo mode:</strong> rows you confirm are kept in <em>this browser only</em> and are never written to the shared synthetic ledger. Don’t paste real client data. Self-host to import for real.</p></div>`
        : ""}
      <form class="card stack" id="imp-form">
        <div class="field">
          <label for="imp-text">Ledger text or CSV</label>
          <textarea class="input" id="imp-text" name="text" rows="8" spellcheck="false" placeholder="client, phone, amount, kind, due date — or just your notes">${SAMPLE}</textarea>
          <span class="hint">Up to 20,000 characters. Lines starting with # are ignored by the model.</span>
        </div>
        <div class="row">
          <button class="btn" type="submit" id="imp-extract">${icon("import")} Extract rows</button>
          <button class="btn btn-ghost" type="button" id="imp-clear">Clear</button>
          <span class="small muted" id="imp-status" role="status"></span>
        </div>
      </form>
      <section id="imp-preview" class="mt-4"></section>
      <section id="imp-local" class="mt-4"></section>
    `,
  );

  const form = main.querySelector("#imp-form");
  const status = main.querySelector("#imp-status");
  const preview = main.querySelector("#imp-preview");
  const localEl = main.querySelector("#imp-local");
  const extractBtn = main.querySelector("#imp-extract");
  let proposed = [];

  main.querySelector("#imp-clear").onclick = () => { form.text.value = ""; preview.innerHTML = ""; status.textContent = ""; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (text.length < 3) return toast("Paste at least a line of text", "bad");
    extractBtn.disabled = true;
    status.innerHTML = '<span class="spinner"></span> Extracting with Gemma…';
    mount(preview, html`<span class="skeleton h-8 w-100"></span>`);
    try {
      const pre = await preparse(text);
      const out = await runTool("import_text", { text: pre.text });
      proposed = (out.rows || []).map((r) => ({ currency: "BDT", kind: "invoice", preferred_language: "bn", ...r }));
      status.textContent = `${proposed.length} row${proposed.length === 1 ? "" : "s"} proposed${out.warnings?.length ? ` · ${out.warnings.join("; ")}` : ""}`;
      drawPreview();
    } catch (err) {
      status.textContent = "";
      mount(preview, errorState(err));
      preview.querySelector("[data-retry]").onclick = () => form.requestSubmit();
    } finally {
      extractBtn.disabled = false;
    }
  });

  function drawPreview() {
    if (!proposed.length) {
      mount(preview, html`<div class="empty">${icon("import", "icon icon-lg")}<h3>No rows found</h3><p class="small">Try adding an amount and a name per line, e.g. “Amina 12000 baki due 1 Oct”.</p></div>`);
      return;
    }
    mount(
      preview,
      html`<div class="card">
        <div class="card-head"><h3>Review before confirming</h3><span class="badge badge-accent">${proposed.length} proposed</span></div>
        <p class="small muted">Edit anything that looks wrong. Untick rows you don’t want.</p>
        <div class="table-wrap import-preview"><table class="table">
          <thead><tr><th><span class="sr-only">Include</span></th><th>Client</th><th>Phone</th><th class="num">Amount</th><th>Kind</th><th>Due</th><th>Lang</th></tr></thead>
          <tbody>
            ${proposed.map((r, i) => html`<tr data-i="${i}">
              <td><input type="checkbox" checked aria-label="Include ${r.client_name}" data-f="include"></td>
              <td><input class="input" value="${r.client_name}" data-f="client_name" aria-label="Client name"></td>
              <td><input class="input" value="${r.phone ?? ""}" data-f="phone" aria-label="Phone" placeholder="optional"></td>
              <td><input class="input num" type="number" step="0.01" value="${r.amount}" data-f="amount" aria-label="Amount"></td>
              <td><select class="input" data-f="kind" aria-label="Kind">${KINDS.map((k) => html`<option ${k === r.kind ? "selected" : ""}>${k}</option>`)}</select></td>
              <td><input class="input" type="date" value="${(r.due_date || "").slice(0, 10)}" data-f="due_date" aria-label="Due date"></td>
              <td><select class="input" data-f="preferred_language" aria-label="Language">${LANGS.map(([v, l]) => html`<option value="${v}" ${v === r.preferred_language ? "selected" : ""}>${l}</option>`)}</select></td>
            </tr>`)}
          </tbody>
        </table></div>
        <div class="row mt-3">
          <button class="btn" id="imp-confirm">${icon("check")} ${DEMO_MODE ? "Keep in this browser" : "Confirm & write to ledger"}</button>
          <span class="small muted">${DEMO_MODE ? "Browser-only — not scored, not shared." : "Writes clients + receivables."}</span>
        </div>
      </div>`,
    );
    preview.querySelector("#imp-confirm").onclick = confirm;
  }

  function collect() {
    return [...preview.querySelectorAll("tbody tr")]
      .filter((tr) => tr.querySelector('[data-f="include"]').checked)
      .map((tr) => {
        const g = (f) => tr.querySelector(`[data-f="${f}"]`).value;
        const base = proposed[Number(tr.dataset.i)];
        return {
          ...base,
          client_name: g("client_name").trim(),
          phone: g("phone").trim() || null,
          amount: Number(g("amount")),
          kind: g("kind"),
          due_date: g("due_date") || null,
          preferred_language: g("preferred_language"),
        };
      })
      .filter((r) => r.client_name && Number.isFinite(r.amount));
  }

  async function confirm() {
    const rows = collect();
    if (!rows.length) return toast("Nothing selected", "bad");
    if (DEMO_MODE) {
      localRows.add(rows);
      toast(`${rows.length} row${rows.length === 1 ? "" : "s"} kept in this browser`, "ok");
      preview.innerHTML = "";
      proposed = [];
      drawLocal();
      return;
    }
    const btn = preview.querySelector("#imp-confirm");
    btn.disabled = true;
    try {
      const out = await runTool("confirm_import", { rows });
      toast(`Inserted ${out.inserted} rows`, "ok");
      preview.innerHTML = "";
      proposed = [];
    } catch (err) {
      btn.disabled = false;
      toast(err.message, "bad");
    }
  }

  function drawLocal() {
    const rows = localRows.all();
    if (!rows.length) return (localEl.innerHTML = "");
    mount(
      localEl,
      html`<div class="card">
        <div class="card-head"><h3>Kept in this browser</h3><span class="badge badge-info">${rows.length}</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Client</th><th class="num">Amount</th><th>Kind</th><th>Due</th><th></th></tr></thead>
          <tbody>${rows.map((r) => html`<tr>
            <td>${r.client_name}</td><td class="num">${fmtMoney(r.amount, r.currency)}</td><td>${r.kind}</td><td>${r.due_date || "—"}</td>
            <td><button class="btn btn-sm btn-ghost" data-remove="${r.local_id}" aria-label="Remove ${r.client_name}">${icon("x")}</button></td>
          </tr>`)}</tbody>
        </table></div>
      </div>`,
    );
  }
  on(localEl, "[data-remove]", "click", (e, b) => { localRows.remove(b.dataset.remove); drawLocal(); });
  if (DEMO_MODE) drawLocal();
}
