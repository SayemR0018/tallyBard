import { html, raw, icon, mount, on, toast } from "../ui.js";
import { DEMO_MODE, REPO_URL } from "../config.js";
import { theme, resetDemo } from "../state.js";
import { warmUp, onServerState, getServerState } from "../api.js";
import { renderOverview } from "./overview.js";
import { renderImport } from "./import.js";
import { renderQueue } from "./queue.js";
import { renderNudges } from "./nudges.js";
import { renderAsk } from "./ask.js";
import { renderPrivacyPanel } from "./privacy.js";
import { renderModels } from "./models.js";

const SCREENS = [
  { id: "", label: "Overview", icon: "grid", render: renderOverview, tab: true },
  { id: "import", label: "Import", icon: "import", render: renderImport, tab: true },
  { id: "queue", label: "Chase queue", short: "Queue", icon: "queue", render: renderQueue, tab: true },
  { id: "nudges", label: "Nudges", icon: "send", render: renderNudges, tab: true },
  { id: "ask", label: "Ask your ledger", short: "Ask", icon: "chat", render: renderAsk, tab: true },
  { id: "privacy", label: "Privacy panel", short: "Privacy", icon: "shield", render: renderPrivacyPanel },
  { id: "models", label: "Model switch", short: "Models", icon: "cpu", render: renderModels },
];

let built = false;
let unsubscribe;

function build(root, router) {
  built = true;
  document.body.classList.add("has-tabbar");
  mount(
    root,
    html`
      <div class="app">
        <header class="app-top">
          <a class="brand" href="/">${icon("bird", "")} TallyBard</a>
          <span class="badge badge-accent">demo · synthetic</span>
          <span class="spacer"></span>
          <span class="status" id="server-status" aria-live="polite"></span>
          <a class="icon-btn" href="/app/privacy" aria-label="Privacy panel" title="Privacy panel">${icon("shield")}</a>
          <a class="icon-btn" href="/app/models" aria-label="Model switch" title="Model switch">${icon("cpu")}</a>
          <button class="icon-btn theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">${icon("sun", "icon icon-sun")}${icon("moon", "icon icon-moon")}</button>
        </header>
        ${DEMO_MODE
          ? html`<div class="demo-banner" role="note">
              ${icon("alert")}<span>Demo uses <strong>synthetic data</strong>. Do not enter real client data here; <a href="/open-source">self-host</a> for real use.</span>
              <button class="btn btn-sm btn-secondary" data-reset>${icon("refresh")} Reset demo</button>
            </div>`
          : ""}
        <div class="app-body">
          <nav class="sidebar" aria-label="App">
            ${SCREENS.map((s) => html`<a href="/app${s.id ? "/" + s.id : ""}" data-screen="${s.id}">${icon(s.icon)} ${s.label}</a>`)}
            <div class="sb-foot">
              <a href="/sample-ledger.csv" download>${icon("download")} Sample CSV</a>
              <a href="${REPO_URL}" target="_blank" rel="noopener">${icon("github")} GitHub</a>
              <span>All data synthetic.</span>
            </div>
          </nav>
          <main class="app-main" id="main" tabindex="-1"></main>
        </div>
        <nav class="tabbar" aria-label="App">
          ${SCREENS.filter((s) => s.tab).map((s) => html`<a href="/app${s.id ? "/" + s.id : ""}" data-screen="${s.id}">${icon(s.icon)}<span>${s.short || s.label}</span></a>`)}
        </nav>
      </div>
    `,
  );
  on(root, ".theme-toggle", "click", () => theme.toggle());
  on(root, "[data-reset]", "click", () => {
    if (!confirm("Reset the demo? This clears your browser-local imports, drafts and chat thread. The shared synthetic ledger is untouched.")) return;
    resetDemo();
    toast("Demo reset — fresh session", "ok");
    router.navigate("/app", { replace: true });
    render(root, "", router, true);
  });
  unsubscribe?.();
  unsubscribe = onServerState((s) => {
    const el = root.querySelector("#server-status");
    if (!el) return;
    const map = {
      up: ["ok", "check", "API online"],
      waking: ["warn", "info", "Waking server…"],
      down: ["bad", "alert", "API offline"],
      unknown: ["", "info", "Checking…"],
    };
    const [k, ic, label] = map[s] || map.unknown;
    mount(el, html`<span class="badge ${k ? "badge-" + k : ""}">${s === "waking" ? raw('<span class="spinner"></span>') : icon(ic)} ${label}</span>`);
  });
}

function setActive(root, id) {
  root.querySelectorAll("[data-screen]").forEach((a) => {
    if (a.dataset.screen === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function render(root, rest, router, force = false) {
  const id = rest.split("/")[0] || "";
  const screen = SCREENS.find((s) => s.id === id) || SCREENS[0];
  setActive(root, screen.id);
  document.title = `${screen.label} — TallyBard demo`;
  const main = root.querySelector("#main");
  if (!main) return;

  if (getServerState() !== "up") {
    mount(
      main,
      html`<div class="wake">
        ${icon("bird", "hero-mascot")}
        <h2>Waking the server…</h2>
        <p>The demo runs on a small instance that sleeps when idle. First visit takes 20–60 seconds. <span class="spinner"></span></p>
        <p class="small">While you wait: <a href="/how-it-works">how it works</a> · <a href="/privacy">privacy</a></p>
      </div>`,
    );
    const ok = await warmUp();
    if (!ok) {
      mount(
        main,
        html`<div class="wake">
          ${icon("bird", "hero-mascot")}
          <h2>The server didn’t answer.</h2>
          <p>It may still be booting, or the API URL may be wrong for this build.</p>
          <button class="btn" data-retry-wake>${icon("refresh")} Try again</button>
          <p class="small"><a href="/">Back to the site</a></p>
        </div>`,
      );
      main.querySelector("[data-retry-wake]").onclick = () => render(root, rest, router, true);
      return;
    }
  }
  main.innerHTML = "";
  await screen.render(main, { router, rest: rest.split("/").slice(1).join("/") });
  if (force) main.focus();
}

export function renderAppShell(root, rest, router) {
  if (!built || !root.querySelector(".app")) build(root, router);
  render(root, rest, router);
}
