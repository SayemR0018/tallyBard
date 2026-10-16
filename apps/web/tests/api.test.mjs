import { test } from "node:test";
import assert from "node:assert/strict";

// api.js reads config from document/localStorage when present; in Node neither exists.
const { warmUp, backoff, onServerState, getServerState } = await import("../src/js/api.js");

test("backoff grows exponentially and caps", () => {
  assert.equal(backoff(0), 1500);
  assert.equal(backoff(1), 3000);
  assert.equal(backoff(2), 6000);
  assert.equal(backoff(5), 8000);
});

test("warmUp retries /health while the server wakes and reports state transitions", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls < 3) throw new Error("ECONNREFUSED");
    return { ok: true };
  };
  const seen = [];
  const off = onServerState((s) => seen.push(s));
  // speed up: monkeypatch timers via tiny backoff by passing attempts; sleep uses real timers,
  // so cap the test with a short schedule by racing against the real schedule.
  const ok = await Promise.race([warmUp({ attempts: 5, fetchImpl }), new Promise((r) => setTimeout(() => r("timeout"), 7000))]);
  off();
  assert.equal(ok, true);
  assert.equal(calls, 3);
  assert.ok(seen.includes("waking"));
  assert.equal(getServerState(), "up");
});
