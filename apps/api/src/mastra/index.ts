import { loadEnv } from "./loadenv.js";
loadEnv();
import { Mastra } from "@mastra/core";
import {
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";
import type { AnySpan, SpanOutputProcessor } from "@mastra/core/observability";
import { OtelBridge } from "@mastra/otel-bridge";
import { PostgresStore } from "@mastra/pg";
import { tallybardAgent } from "./agents/tallybard.js";
import { dsn, ssl } from "./db.js";
import { weeklyChase } from "./workflows/weekly-chase.js";

const captureContent = process.env.SENTRY_CAPTURE_CONTENT === "1";

/** Strips model inputs/outputs from exported spans unless local capture is on. */
class GenAIContentGate implements SpanOutputProcessor {
  name = "genai-content-gate";
  process(span: AnySpan): AnySpan {
    const t = String((span as { type?: string }).type ?? "");
    if (!captureContent && /model|llm|agent|generate/i.test(t)) {
      (span as { input?: unknown }).input = undefined;
      (span as { output?: unknown }).output = undefined;
    }
    return span;
  }
  async shutdown(): Promise<void> {}
}

/** Tiny fixed-window rate limiter (per IP) for the public demo. */
const hits = new Map<string, { n: number; reset: number }>();
const RATE_LIMIT = { windowMs: 60_000, max: 120 };
function rateLimitMiddleware(c: any, next: any) {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + RATE_LIMIT.windowMs });
  } else if (++h.n > RATE_LIMIT.max) {
    return c.json({ error: "rate_limited" }, 429);
  }
  return next();
}

const storage = new PostgresStore({
  id: "tallybard-store",
  connectionString: dsn(process.env.DATABASE_URL_RW || process.env.DATABASE_URL) || "",
  ssl,
});

export const mastra = new Mastra({
  storage,
  agents: { tallybard: tallybardAgent },
  workflows: { weeklyChase },
  observability: new Observability({
    configs: {
      tallybard: {
        serviceName: "tallybard-api",
        bridge: new OtelBridge(),
        spanOutputProcessors: [
          new GenAIContentGate(),
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
  server: {
    cors: {
      origin: (process.env.WEB_ORIGIN || "http://localhost:5173").split(","),
      allowMethods: ["GET", "POST", "OPTIONS"],
      credentials: false,
    },
    // Mastra serves GET /health ({"success":true}) itself — used by the Render
    // health check and the web app's warm-up ping.
    middleware: [rateLimitMiddleware],
  },
});
