import { runTool } from "./api.js";
import { renderImport } from "./views/import.js";
import { renderQueue } from "./views/queue.js";
import { renderAsk } from "./views/ask.js";
import { renderPrivacy } from "./views/privacy.js";

const routes = {
  import: renderImport,
  queue: renderQueue,
  ask: renderAsk,
  privacy: renderPrivacy,
};

function route() {
  const name = location.hash.replace("#/", "") || "queue";
  const view = routes[name] ? name : "queue";
  document
    .querySelectorAll("nav a")
    .forEach((a) => a.classList.toggle("active", a.dataset.route === view));
  routes[view](document.getElementById("view"));
}

addEventListener("hashchange", route);
route();

// backend badge (ollama vs aistudio) — from the privacy report
runTool("privacy_report", {})
  .then((p) => {
    const b = document.getElementById("backend-badge");
    b.textContent = `model backend: ${p.backend}`;
  })
  .catch(() => {
    document.getElementById("backend-badge").textContent = "api offline";
  });
