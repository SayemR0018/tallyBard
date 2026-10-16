// Thin wrapper around the CSV pre-parser that GitHub issue #2 assigns to the
// Copilot coding agent (apps/web/src/js/csv.js, export `preparse(text)`).
// Until that lands, text passes through unchanged and the model does the
// extraction. Do not implement the edge cases here — see issue #2.
let impl = null;
let tried = false;

export async function preparse(text) {
  if (!tried) {
    tried = true;
    try {
      impl = (await import("../csv.js")).preparse;
    } catch {
      impl = null; // not yet contributed
    }
  }
  return impl ? impl(text) : { text, normalised: false };
}
