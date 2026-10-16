import { html, raw, icon, mount, on, toast } from "../ui.js";
import { chat } from "../api.js";
import { threadId, newThread, sessionId } from "../state.js";

const SUGGESTIONS = [
  "Who owes me the most right now?",
  "How many receivables are overdue?",
  "What came in recently?",
  "কার কাছে সবচেয়ে বেশি পাওনা আছে?",
];

export function renderAsk(main) {
  mount(
    main,
    html`
      <div class="screen-head">
        <div><h1>Ask your ledger</h1><p>Answers come from read-only aggregates on the synthetic ledger. The assistant remembers this thread; it cannot send anything.</p></div>
        <div class="actions"><button class="btn btn-secondary btn-sm" id="chat-new">${icon("refresh")} New thread</button></div>
      </div>
      <div class="chat">
        <div class="suggest" id="chat-suggest">${SUGGESTIONS.map((s) => html`<button type="button" class="btn btn-sm btn-secondary" data-q="${s}">${s}</button>`)}</div>
        <div class="chat-log" id="chat-log" role="log" aria-live="polite"></div>
        <form class="chat-form" id="chat-form">
          <label class="sr-only" for="chat-in">Your question</label>
          <input class="input" id="chat-in" name="q" autocomplete="off" placeholder="Ask in Bangla or English…" />
          <button class="btn" type="submit" id="chat-send">${icon("send")}<span class="sr-only">Send</span></button>
        </form>
      </div>
    `,
  );
  const log = main.querySelector("#chat-log");
  const form = main.querySelector("#chat-form");
  const input = main.querySelector("#chat-in");
  const sendBtn = main.querySelector("#chat-send");
  const history = [];

  function add(cls, text) {
    const el = document.createElement("div");
    el.className = `bubble bubble-${cls}`;
    el.textContent = text;
    log.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return el;
  }

  async function send(text) {
    text = text.trim();
    if (!text) return;
    input.value = "";
    sendBtn.disabled = true;
    add("you", text);
    const thinking = add("bot", "…");
    history.push({ role: "user", content: text });
    try {
      const reply = await chat(history.slice(-10), threadId(), sessionId());
      const str = typeof reply === "string" ? reply : JSON.stringify(reply);
      history.push({ role: "assistant", content: str });
      thinking.textContent = str;
    } catch (e) {
      thinking.textContent = `Couldn’t get an answer: ${e.message}`;
      thinking.classList.add("notice-bad");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
  on(main, "[data-q]", "click", (e, b) => send(b.dataset.q));
  main.querySelector("#chat-new").onclick = () => {
    newThread();
    history.length = 0;
    log.innerHTML = "";
    toast("New thread started", "ok");
  };
}
