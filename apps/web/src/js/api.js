// API client for the Mastra server. Base URL is configurable so the same
// static bundle can point at localhost or the Render deployment.
const API_URL =
  localStorage.getItem("tallybard_api_url") ||
  document.querySelector('meta[name="api-url"]')?.content ||
  "http://localhost:4111";

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(json.error || `API ${res.status}`);
  return json;
}

// Mastra dev/prod server exposes tool execution at POST /api/tools/:id/execute
export async function runTool(id, data = {}) {
  const res = await post(`/api/tools/${id}/execute`, { data });
  if (res && typeof res === "object" && "result" in res) return res.result;
  return res;
}

export async function chat(messages, threadId) {
  const res = await post("/api/agents/tallybard/generate", {
    messages,
    memory: { thread: threadId, resource: "demo" },
  });
  return res.text ?? res;
}
