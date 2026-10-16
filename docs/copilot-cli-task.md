# Copilot CLI task — NudgeCard component + tests

Run this task in **Copilot CLI** inside the repo root with **Entire enabled**
(`entire status` should show `Enabled`). Paste the brief below as one prompt.
Estimated size: one focused session (~30–45 min of agent work).

---

## Brief to paste

You are working in the `tallyBard` repo — an open-source collections copilot
(open receivables + WhatsApp nudge drafting, human approval required; nothing
is auto-sent). The web UI is a zero-build static SPA in `apps/web/` (vanilla ES
modules, no bundler, no framework).

**Task:** extract the inline nudge rendering in `apps/web/views/queue.js` into a
proper `NudgeCard` component at `apps/web/views/nudge-card.js`, and add tests.

Requirements:

1. `renderNudgeCard(container, { nudge_id, draft_text, language, tone, sources_used })`
   renders a card with:
   - the draft text (escaped — drafts may contain user data)
   - a tone ladder control (friendly / firm / final) that re-calls the
     `draft_nudge` tool with the same `receivable_id` and the new tone, then
     re-renders the card in place
   - an **Approve** button that calls the `approve_nudge` tool and turns the
     result's `wa_link` into a "Open WhatsApp" link (`target="_blank"
     rel="noopener"`); disabled state if approval fails
   - a **Copy** button (navigator.clipboard) that copies `draft_text`
   - a **Mark sent** button (enabled only after approval) calling `mark_sent`
   - if `sources_used` is non-empty, a small "based on: …" note
   - a persistent caption: "Nothing is sent automatically — you press send."
2. Keep the existing zero-build style: plain ES module, no imports beyond
   `../api.js`, `esc()` the same as the other views (you may export a shared
   `esc` from `api.js` and reuse it).
3. `queue.js` should import and use `renderNudgeCard` in place of its inline
   markup; remove the now-dead inline rendering code.
4. Tests: add `apps/web/tests/nudge-card.test.mjs` runnable with `node --test`
   (Node's built-in runner + a minimal fake DOM is fine — if you add a tiny
   helper like `tests/fake-dom.mjs` keep it dependency-free). Cover: card
   renders draft text escaped; copy button writes to clipboard (stub it);
   approve button is disabled when `approve_nudge` rejects; tone change
   re-calls `draft_nudge` with the new tone.
5. Do NOT touch `apps/api/`, `db/`, or `docs/`. Do not add npm dependencies.
6. Verify: `node --test apps/web/tests/` passes; `git status` shows only
   `apps/web/` changes.

API surface (already implemented server-side, see `apps/web/api.js`):
`runTool("draft_nudge", { receivable_id, tone, language }) → { nudge_id,
draft_text, language, tone, sources_used }`;
`runTool("approve_nudge", { nudge_id }) → { wa_link, draft_text }`;
`runTool("mark_sent", { nudge_id }) → { ok }`.

---

## After the session

- Confirm Entire captured it (`entire sessions` / repo `.entire/` logs).
- If the result is good, commit on a branch `copilot/nudge-card` and open a PR
  so the challenge gets a real Copilot-authored contribution.
