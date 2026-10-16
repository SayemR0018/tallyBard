// Tiny DOM helpers — no framework. h() builds elements; html`` builds a
// fragment from a template string with auto-escaped interpolations.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/** Mark a string as already-safe HTML (for nested html`` results). */
export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);

/** html`...` — escapes interpolated values unless they are Raw or arrays of Raw. */
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < vals.length) out += render(vals[i]);
  });
  return new Raw(out);
}
function render(v) {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

/** Set innerHTML from a Raw/string and return the first element. */
export function mount(el, content) {
  el.innerHTML = content instanceof Raw ? content.s : String(content);
  return el.firstElementChild;
}

export const icon = (name, cls = "icon") =>
  raw(`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`);

export function fmtMoney(n, cur = "BDT") {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${cur === "BDT" ? "৳" : cur + " "}${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Risk label is text + icon, never colour alone. */
export function riskLevel(p) {
  if (p == null || Number.isNaN(Number(p))) return "none";
  return p >= 0.65 ? "high" : p >= 0.4 ? "medium" : "low";
}
export function riskBadge(p) {
  const lvl = riskLevel(p);
  const label = { high: "High", medium: "Medium", low: "Low", none: "Not scored" }[lvl];
  const ic = { high: "alert", medium: "info", low: "check", none: "info" }[lvl];
  const pct = lvl === "none" ? "" : ` ${Math.round(p * 100)}%`;
  return raw(
    `<span class="risk risk-${lvl}" title="P(paid >7 days late)${pct ? ` =${pct}` : ""}">${icon(ic)}${label}${pct}</span>`,
  );
}

export function skeletonRows(n = 4) {
  return raw(
    Array.from({ length: n }, () => `<span class="skeleton h-2 w-100"></span>`).join(""),
  );
}

export function emptyState({ icon: ic = "queue", title, body, action }) {
  return html`<div class="empty">
    ${icon(ic, "icon icon-lg")}
    <h3>${title}</h3>
    <p class="small">${body}</p>
    ${action ? raw(action) : ""}
  </div>`;
}

export function errorState(err, retryLabel = "Try again") {
  const msg = err?.message || String(err);
  return html`<div class="notice notice-bad" role="alert">
    ${icon("alert")}
    <div>
      <p><strong>Something went wrong.</strong> ${msg}</p>
      <button class="btn btn-sm btn-secondary" data-retry>${retryLabel}</button>
    </div>
  </div>`;
}

let toastTimer;
export function toast(msg, kind = "") {
  const host = document.getElementById("toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${kind ? "toast-" + kind : ""}`;
  el.textContent = msg;
  host.appendChild(el);
  clearTimeout(toastTimer);
  setTimeout(() => el.remove(), 3800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "ok");
    return true;
  } catch {
    toast("Could not copy — select the text and copy manually", "bad");
    return false;
  }
}

export function on(root, selector, event, handler) {
  root.addEventListener(event, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  });
}
