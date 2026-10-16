import { runTool } from "../api.js";

const SAMPLE = `# synthetic example — paste your own rows
Amina Begum, 8801711000000, 12000 BDT, udhaar, due 2026-10-01
Rafiq Traders, 8801822000000, 45500 BDT, invoice, due 2026-09-20`;

export function renderImport(root) {
  root.innerHTML = `
    <h2>Import ledger rows</h2>
    <p class="muted">Paste CSV or informal credit text (Bangla or English). Gemma proposes rows;
       nothing is written until you confirm.</p>
    <textarea id="imp-text" placeholder="client name, phone, amount, kind, due date">${SAMPLE}</textarea>
    <div class="row" style="margin-top:10px">
      <button id="imp-extract">Extract rows</button>
      <span id="imp-status" class="muted"></span>
    </div>
    <div id="imp-preview"></div>`;

  const status = document.getElementById("imp-status");
  const preview = document.getElementById("imp-preview");
  let proposed = [];

  document.getElementById("imp-extract").onclick = async () => {
    status.textContent = "extracting…";
    preview.innerHTML = "";
    try {
      const out = await runTool("import_text", {
        text: document.getElementById("imp-text").value,
      });
      proposed = out.rows || [];
      status.textContent = `${proposed.length} proposed rows` +
        (out.warnings?.length ? ` — ${out.warnings.join("; ")}` : "");
      preview.innerHTML =
        `<table><tr><th></th><th>client</th><th>amount</th><th>kind</th><th>due</th><th>lang</th></tr>` +
        proposed
          .map(
            (r, i) => `<tr>
              <td><input type="checkbox" data-i="${i}" checked></td>
              <td>${esc(r.client_name)}</td><td>${r.amount} ${r.currency}</td>
              <td>${r.kind}</td><td>${esc(r.due_date || "")}</td><td>${r.preferred_language}</td>
            </tr>`,
          )
          .join("") +
        `</table><div class="row" style="margin-top:10px">
           <button id="imp-confirm">Confirm selected rows</button>
         </div>`;
      document.getElementById("imp-confirm").onclick = confirm;
    } catch (e) {
      status.innerHTML = `<span class="error">${esc(e.message)}</span>`;
    }
  };

  async function confirm() {
    const checked = [...preview.querySelectorAll("input:checked")].map(
      (c) => proposed[Number(c.dataset.i)],
    );
    if (!checked.length) return (status.textContent = "nothing selected");
    status.textContent = "inserting…";
    try {
      const out = await runTool("confirm_import", { rows: checked });
      status.textContent = `Inserted ${out.inserted} rows. Synthetic rows only in the demo.`;
      preview.innerHTML = "";
    } catch (e) {
      status.innerHTML = `<span class="error">${esc(e.message)}</span>`;
    }
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
