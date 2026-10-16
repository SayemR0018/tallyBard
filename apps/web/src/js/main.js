import { createRouter } from "./router.js";
import { html, raw, icon, mount, on } from "./ui.js";
import { REPO_URL } from "./config.js";
import { theme } from "./state.js";
import { warmUp } from "./api.js";
import { renderHome } from "./pages/home.js";
import { renderHow } from "./pages/how.js";
import { renderPrivacyPage } from "./pages/privacy.js";
import { renderResults } from "./pages/results.js";
import { renderOpenSource } from "./pages/open-source.js";
import { renderAppShell } from "./app/shell.js";

const SITE_NAV = [
  ["/", "Home"],
  ["/app", "Try the demo"],
  ["/how-it-works", "How it works"],
  ["/privacy", "Privacy"],
  ["/results", "Results"],
  ["/open-source", "Open source"],
];

const routes = [
  { path: "/", page: renderHome, title: "TallyBard — collections copilot for people who sell on credit" },
  { path: "/how-it-works", page: renderHow, title: "How it works — TallyBard" },
  { path: "/privacy", page: renderPrivacyPage, title: "Privacy by design — TallyBard" },
  { path: "/results", page: renderResults, title: "Results — TallyBard" },
  { path: "/open-source", page: renderOpenSource, title: "Open source — TallyBard" },
  { path: "/app/*", app: true, title: "Demo — TallyBard" },
];

const root = document.getElementById("root");
let currentLayout = null;

function siteLayout() {
  if (currentLayout === "site") return document.getElementById("main");
  currentLayout = "site";
  document.body.classList.remove("has-tabbar");
  mount(
    root,
    html`
      <div class="ribbon">Demo data is synthetic — no real clients. Self-host for real use.</div>
      <header class="site-header">
        <div class="wrap">
          <a class="brand" href="/">${icon("bird", "")} TallyBard</a>
          <button class="icon-btn nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon("menu")}</button>
          <nav class="site-nav" id="site-nav" aria-label="Main">
            ${SITE_NAV.map(([href, label]) => html`<a href="${href}">${label}</a>`)}
            <a href="${REPO_URL}" target="_blank" rel="noopener" aria-label="GitHub repository">${icon("github")} <span class="sr-only">GitHub</span></a>
            <button class="icon-btn theme-toggle" aria-label="Toggle dark mode">${icon("sun", "icon icon-sun")}${icon("moon", "icon icon-moon")}</button>
          </nav>
        </div>
      </header>
      <main id="main" tabindex="-1"></main>
      <footer class="site-footer">
        <div class="wrap">
          <a class="brand" href="/">${icon("bird", "")} TallyBard</a>
          <p>Open-source collections copilot for freelancers, tutors, shops that sell on credit, small wholesalers and community treasurers. A human approves every message — nothing is ever sent automatically.</p>
          <nav aria-label="Footer">
            <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
            <a href="${REPO_URL}/blob/main/LICENSE" target="_blank" rel="noopener">MIT licence</a>
            <a href="/results">Results</a>
            <a href="/privacy">Privacy</a>
            <a href="https://dev.to/challenges/hacktoberfest-week2-2026-10-12" target="_blank" rel="noopener">Hacktoberfest Open-Source AI Challenge · Week 2 “Side Hustle”</a>
          </nav>
          <p class="xs">All demo data is synthetic. Built with PriorLabs-TabPFN. Model weights keep their own licences.</p>
        </div>
      </footer>
    `,
  );
  const nav = root.querySelector("#site-nav");
  const toggle = root.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  on(root, ".site-nav a", "click", () => { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
  on(root, ".theme-toggle", "click", () => theme.toggle());
  return document.getElementById("main");
}

function setActive(path) {
  root.querySelectorAll(".site-nav a[href^='/']").forEach((a) => {
    const href = a.getAttribute("href");
    const active = href === "/" ? path === "/" : path.startsWith(href);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

const router = createRouter(routes, (m, loc) => {
  if (!m) {
    const main = siteLayout();
    document.title = "Not found — TallyBard";
    mount(main, html`<section class="section wrap-text center">
      <h1>Page not found</h1><p class="lede">That page doesn’t exist. <a href="/">Back to home</a> or <a href="/app">open the demo</a>.</p></section>`);
    return;
  }
  document.title = m.route.title;
  if (m.route.app) {
    currentLayout = "app";
    renderAppShell(root, m.params.rest || "", router);
    return;
  }
  const main = siteLayout();
  setActive(loc.pathname);
  m.route.page(main, router);
  if (loc.hash) document.querySelector(loc.hash)?.scrollIntoView();
});

router.resolve();
// Warm the API early so the demo is ready by the time the visitor clicks.
warmUp();
export { router };
