// API client for the Mastra server. Handles the "Render free instance is
// asleep" case: /health is pinged on load and requests retry with backoff
// while the server wakes. No auth, no tokens — the demo is zero-login.
import { API_URL } from "./config.js";

export class ApiError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

const listeners = new Set();
let serverState = "unknown"; // unknown | waking | up | down
export function onServerState(fn) {
  listeners.add(fn);
  fn(serverState);
  return () => listeners.delete(fn);
}
function setState(s) {
  if (s === serverState) return;
  serverState = s;
  listeners.forEach((fn) => fn(s));
}
export const getServerState = () => serverState;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff schedule used while a sleeping instance boots. */
export function backoff(attempt, base = 1500, cap = 8000) {
  return Math.min(cap, base * 2 ** attempt);
}

/**
 * Warm-up ping. Resolves true when the API answers /health; keeps trying for
 * ~60s (Render cold starts are typically 20–50s). Safe to call repeatedly.
 */
export async function warmUp({ attempts = 8, fetchImpl = fetch } = {}) {
  if (serverState === "up") return true;
  setState("waking");
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetchImpl(`${API_URL}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        setState("up");
        return true;
      }
    } catch {
      /* not up yet */
    }
    await sleep(backoff(i));
  }
  setState("down");
  return false;
}

async function post(path, body, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new ApiError(`Unexpected response (${res.status})`, { status: res.status });
      }
      if (res.status === 429) throw new ApiError("Too many requests — please wait a minute.", { status: 429 });
      if (res.status >= 502 && res.status <= 504) throw new ApiError("Server is waking up…", { status: res.status, retryable: true });
      if (!res.ok) throw new ApiError(json.error || json.message || `Request failed (${res.status})`, { status: res.status });
      setState("up");
      return json;
    } catch (e) {
      lastErr = e instanceof ApiError ? e : new ApiError("Cannot reach the server. It may be waking up.", { retryable: true });
      if (!lastErr.retryable || attempt === retries) break;
      setState("waking");
      await sleep(backoff(attempt));
    }
  }
  if (lastErr?.retryable) setState("down");
  throw lastErr;
}

/** Execute a Mastra tool: POST /api/tools/:id/execute  { data } */
export async function runTool(id, data = {}) {
  const res = await post(`/api/tools/${id}/execute`, { data });
  return res && typeof res === "object" && "result" in res ? res.result : res;
}

/** Agent chat with thread memory: POST /api/agents/tallybard/generate */
export async function chat(messages, threadId, resourceId = "demo") {
  const res = await post("/api/agents/tallybard/generate", {
    messages,
    memory: { thread: threadId, resource: resourceId },
  });
  return res.text ?? res;
}

export { API_URL };
