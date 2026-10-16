// Runtime config comes from a <meta> tag that build.mjs rewrites from env.
// Nothing secret is ever here — only the public API origin and feature flags.
function read() {
  if (typeof document === "undefined") return {};
  const m = document.querySelector('meta[name="tallybard-config"]');
  try {
    return m ? JSON.parse(m.content) : {};
  } catch {
    return {};
  }
}

const cfg = read();
export const API_URL = (
  (typeof localStorage !== "undefined" && localStorage.getItem("tb.apiUrl")) ||
  cfg.apiUrl ||
  "http://localhost:4111"
).replace(/\/$/, "");
export const DEMO_MODE = cfg.demoMode !== false;
export const REPO_URL = cfg.repoUrl || "https://github.com/SayemR0018/tallyBard";
export const VERSION = cfg.version || "dev";
