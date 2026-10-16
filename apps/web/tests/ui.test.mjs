import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, html, raw, riskLevel, riskBadge, fmtMoney } from "../src/js/ui.js";

test("esc neutralises HTML", () => {
  assert.equal(esc(`<img onerror="x">&'`), "&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;");
});

test("html`` escapes interpolations but passes Raw and arrays through", () => {
  const out = html`<p>${"<b>"}${raw("<i>ok</i>")}${[raw("<u>"), "<"]}</p>`.toString();
  assert.equal(out, "<p>&lt;b&gt;<i>ok</i><u>&lt;</p>");
});

test("risk levels have text labels and icons — never colour alone", () => {
  assert.equal(riskLevel(0.9), "high");
  assert.equal(riskLevel(0.5), "medium");
  assert.equal(riskLevel(0.1), "low");
  assert.equal(riskLevel(null), "none");
  const badge = riskBadge(0.84).toString();
  assert.match(badge, /High/);
  assert.match(badge, /84%/);
  assert.match(badge, /<use href="#i-alert"/);
  assert.match(riskBadge(null).toString(), /Not scored/);
});

test("money formatting uses the taka sign for BDT", () => {
  assert.equal(fmtMoney(46828.12, "BDT"), "৳46,828");
  assert.equal(fmtMoney("abc"), "—");
});
