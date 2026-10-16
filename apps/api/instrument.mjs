// Sentry bootstrap — loaded via --import before the app starts so its
// OpenTelemetry tracer provider is global when Mastra's OtelBridge emits spans.
//
// SENTRY_CAPTURE_CONTENT=1 (LOCAL ONLY, synthetic data) records genAI
// inputs/outputs for write-up screenshots. In production they stay OFF and a
// span processor strips them before export as well (belt and suspenders).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  for (const line of readFileSync(resolve(process.cwd(), "../../.env"), "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env in production */ }

const Sentry = await import("@sentry/node");
const capture = process.env.SENTRY_CAPTURE_CONTENT === "1";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV || "production",
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
  // genAI prompt/response capture — OFF in prod, ON only for local synthetic runs
  dataCollection: { genAI: { inputs: capture, outputs: capture } },
});

console.log(`[sentry] initialized env=${process.env.SENTRY_ENV || "production"} genAI_content=${capture ? "ON(local)" : "off"}`);
