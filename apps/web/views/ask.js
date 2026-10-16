import { chat } from "../api.js";

const threadId = localStorage.getItem("tallybard_thread") ||
  (() => {
    const t = crypto.randomUUID();
    localStorage.setItem("tallybard_thread", t);
    return t;
  })();

export function renderAsk(root) {
  root.innerHTML = `
    <h2>Ask your ledger</h2>
    <p class="muted">Answers come from read-only ledger aggregates. Thread memory is on.</p>
    <div class="chat-log" id="chat-log"></div>
    <div class="row">
      <input id="chat-in" style="flex:1;background:var(--panel);color:var(--text);
        border:1px solid var(--edge);border-radius:6px;padding:9px"
        placeholder="e.g. who owes me the most? (synthetic data)">
      <button id="chat-send">Send</button>
    </div>`;

  const log = document.getElementById("chat-log");
  const input = document.getElementById("chat-in");
  const history = [];

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    add("you", text);
    const thinking = add("bot", "…");
    try {
      history.push({ role: "user", content: text });
      const reply = await chat(history.slice(-10), threadId);
      history.push({ role: "assistant", content: reply });
      thinking.textContent = reply;
    } catch (e) {
      thinking.textContent = `error: ${e.message}`;
      thinking.classList.add("error");
    }
  }

  function add(cls, text) {
    const d = document.createElement("div");
    d.className = `chat-msg ${cls}`;
    d.textContent = text;
    log.appendChild(d);
    return d;
  }

  document.getElementById("chat-send").onclick = send;
  input.onkeydown = (e) => e.key === "Enter" && send();
}
