/**
 * Smoke: exercise the TallyBard tools end-to-end without HTTP.
 * Usage: MODEL_BACKEND=aistudio npx tsx scripts/smoke.ts   (from apps/api)
 */
import "../src/mastra/loadenv.js";
import {
  chaseQueue,
  draftNudge,
  ledgerStats,
  privacyReport,
  scoreReceivables,
} from "../src/mastra/tools/ledger.js";

const run = <T>(
  tool: { execute?: (...args: any[]) => Promise<any> },
  input: unknown,
): Promise<T> => tool.execute!(input, {} as never) as Promise<T>;

const stats = await run<{ rows: Record<string, unknown>[] }>(
  ledgerStats,
  { query: "per_status" },
);
console.log("per_status:", JSON.stringify(stats.rows));

const queue = await run<{
  queue: { receivable_id: string; client_name: string; p_late7: number | null }[];
}>(chaseQueue, { limit: 5 });
console.log("queue top5:", JSON.stringify(queue.queue, null, 1).slice(0, 1200));

const scores = await run<{ model: string; scores: unknown[] }>(
  scoreReceivables,
  { receivable_ids: null },
);
console.log(`scored ${scores.scores.length} open receivables with ${scores.model}`);

if (queue.queue[0]?.receivable_id) {
  const d = await run<{ draft_text: string; sources_used: string[] }>(
    draftNudge,
    { receivable_id: queue.queue[0].receivable_id, tone: "friendly", language: null },
  );
  console.log("draft:", d.draft_text);
  console.log("sources:", d.sources_used);
}

console.log("privacy:", JSON.stringify(await run(privacyReport, {})));
