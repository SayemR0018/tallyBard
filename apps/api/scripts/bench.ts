/**
 * Benchmark harness — fixed prompts × model backends → latency p50/p95 + tokens.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/bench.ts            # benches whatever MODEL_BACKEND is set
 *   MODEL_BACKEND=ollama npx tsx scripts/bench.ts
 *   MODEL_BACKEND=aistudio npx tsx scripts/bench.ts
 *
 * Run once per backend (set the env var), results append to stdout as a
 * markdown table row — paste into docs/results.md. Numbers only ever go into
 * results.md after a real run; this file produces no fake output.
 *
 * Prompts are synthetic-ledger shaped (no PII).
 */
import "../src/mastra/loadenv.js";
import { generateText } from "ai";
import { chatModel, embedText, backend } from "../src/mastra/providers.js";

const PROMPTS = [
  "Draft a friendly WhatsApp payment reminder in Bangla for a BDT 12,000 invoice that is 9 days overdue. Under 60 words.",
  "Extract ledger rows: 'Amina Begum 12000 BDT udhaar due Oct 1. Rafiq 45000 invoice due Sep 20' — JSON array only.",
  "Answer in one sentence: which type of client usually pays fastest?",
];

const RUNS = 5; // per prompt

interface Row { prompt: string; ms: number; tokens: number | null }

async function bench() {
  const rows: Row[] = [];
  for (const p of PROMPTS) {
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const { text, usage } = await generateText({
        model: chatModel(),
        prompt: p,
      });
      rows.push({
        prompt: p.slice(0, 40),
        ms: Math.round(performance.now() - t0),
        tokens: (usage as { totalTokens?: number })?.totalTokens ?? null,
      });
      if (!text) throw new Error("empty generation");
    }
  }
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))];

  // embedding sanity: must be 768 to match vector(768)
  const emb = await embedText("synthetic test");
  console.log(`embed_dim=${emb?.length ?? "FAILED"}`);

  console.log(
    `| ${backend()} | ${process.env.AI_CHAT_MODEL || process.env.OLLAMA_CHAT_MODEL || "default"} ` +
    `| ${ms.length} calls | p50=${pct(0.5)}ms p95=${pct(0.95)}ms |` +
    ` tokens(n)=${rows.filter((r) => r.tokens).length} |`,
  );
}

bench().catch((e) => {
  console.error("bench failed:", e.message);
  process.exit(1);
});
