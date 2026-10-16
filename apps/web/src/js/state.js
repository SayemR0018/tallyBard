// Browser-local state for the zero-login demo. There are no accounts: an
// anonymous session id scopes chat memory; imported rows stay in this
// browser only (never written to the shared demo ledger). "Reset demo"
// clears all of it.
const KEYS = {
  session: "tb.session",
  thread: "tb.thread",
  localRows: "tb.localRows",
  drafts: "tb.drafts",
  theme: "tb.theme",
};

const store = typeof localStorage !== "undefined" ? localStorage : new Map();
const get = (k) => (store instanceof Map ? store.get(k) : store.getItem(k));
const set = (k, v) => (store instanceof Map ? store.set(k, v) : store.setItem(k, v));
const del = (k) => (store instanceof Map ? store.delete(k) : store.removeItem(k));

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function sessionId() {
  let s = get(KEYS.session);
  if (!s) set(KEYS.session, (s = uuid()));
  return s;
}
export function threadId() {
  let t = get(KEYS.thread);
  if (!t) set(KEYS.thread, (t = uuid()));
  return t;
}
export function newThread() {
  const t = uuid();
  set(KEYS.thread, t);
  return t;
}

function readJSON(k, fallback) {
  try {
    return JSON.parse(get(k) || "") ?? fallback;
  } catch {
    return fallback;
  }
}

/** Rows the visitor imported in demo mode — browser-only, never persisted server-side. */
export const localRows = {
  all: () => readJSON(KEYS.localRows, []),
  add(rows) {
    const cur = localRows.all();
    const stamped = rows.map((r) => ({ ...r, local_id: uuid(), added_at: new Date().toISOString() }));
    set(KEYS.localRows, JSON.stringify([...stamped, ...cur]));
    return stamped;
  },
  remove(localId) {
    set(KEYS.localRows, JSON.stringify(localRows.all().filter((r) => r.local_id !== localId)));
  },
  clear: () => del(KEYS.localRows),
};

/** Drafts produced in this browser (so the Nudges screen can show them even offline). */
export const recentDrafts = {
  all: () => readJSON(KEYS.drafts, []),
  push(d) {
    const cur = recentDrafts.all().filter((x) => x.nudge_id !== d.nudge_id);
    set(KEYS.drafts, JSON.stringify([d, ...cur].slice(0, 50)));
  },
  update(nudgeId, patch) {
    set(KEYS.drafts, JSON.stringify(recentDrafts.all().map((d) => (d.nudge_id === nudgeId ? { ...d, ...patch } : d))));
  },
};

export function resetDemo() {
  for (const k of [KEYS.session, KEYS.thread, KEYS.localRows, KEYS.drafts]) del(k);
}

export const theme = {
  get: () => get(KEYS.theme) || "auto",
  set(v) {
    if (v === "auto") del(KEYS.theme);
    else set(KEYS.theme, v);
    apply();
  },
  toggle() {
    const dark = document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    theme.set(dark ? "light" : "dark");
  },
};
function apply() {
  if (typeof document === "undefined") return;
  const v = theme.get();
  if (v === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = v;
}
apply();
