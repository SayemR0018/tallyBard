/**
 * Weekly chase run: score open receivables -> rank -> draft nudges for the
 * top of the queue -> SUSPEND for human approval -> on resume, mark drafts
 * approved (the UI then shows wa.me links). State lives in Postgres storage,
 * so a restart or Render cold start cannot lose a pending run.
 */
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { chaseQueue, draftNudge } from "../tools/ledger.js";

const draftedItem = z.object({
  nudge_id: z.string(),
  receivable_id: z.string(),
  client_name: z.string(),
  draft_text: z.string(),
});

interface QueueItem {
  receivable_id: string;
  client_name: string;
  amount: number;
  days_overdue: number;
  p_late7: number | null;
  priority: number | null;
}

const runTool = <T>(
  tool: { execute?: (...args: any[]) => Promise<any> },
  input: unknown,
): Promise<T> => tool.execute!(input, {} as never) as Promise<T>;

const queueStep = createStep({
  id: "build-queue",
  inputSchema: z.object({ top: z.number().int().min(1).max(10).default(5) }),
  outputSchema: z.object({
    queue: z.array(
      z.object({
        receivable_id: z.string(),
        client_name: z.string(),
        amount: z.number(),
        days_overdue: z.number(),
        p_late7: z.number().nullable(),
        priority: z.number().nullable(),
      }),
    ),
    top: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { queue } = await runTool<{ queue: QueueItem[] }>(chaseQueue, {
      limit: 20,
    });
    return { queue, top: inputData.top };
  },
});

const draftStep = createStep({
  id: "draft-top",
  inputSchema: queueStep.outputSchema,
  outputSchema: z.object({ drafted: z.array(draftedItem) }),
  execute: async ({ inputData }) => {
    const drafted: z.infer<typeof draftedItem>[] = [];
    for (const item of inputData.queue.slice(0, inputData.top)) {
      const tone: "final" | "firm" | "friendly" =
        item.days_overdue > 21 ? "final" : item.days_overdue > 7 ? "firm" : "friendly";
      const d = await runTool<{ nudge_id: string; draft_text: string }>(
        draftNudge,
        { receivable_id: item.receivable_id, tone, language: null },
      );
      drafted.push({
        nudge_id: d.nudge_id,
        receivable_id: item.receivable_id,
        client_name: item.client_name,
        draft_text: d.draft_text,
      });
    }
    return { drafted };
  },
});

const approvalStep = createStep({
  id: "await-approval",
  inputSchema: draftStep.outputSchema,
  suspendSchema: z.object({
    drafted: z.array(
      z.object({
        nudge_id: z.string(),
        client_name: z.string(),
        draft_text: z.string(),
      }),
    ),
    message: z.string(),
  }),
  resumeSchema: z.object({ approved: z.boolean() }),
  outputSchema: z.object({
    approved: z.boolean(),
    drafted: z.array(draftedItem),
  }),
  execute: async ({ inputData, suspend, resumeData }) => {
    if (!resumeData?.approved) {
      return suspend({
        drafted: inputData.drafted.map((d) => ({
          nudge_id: d.nudge_id,
          client_name: d.client_name,
          draft_text: d.draft_text,
        })),
        message: "Review drafts, then resume with approved:true to mark them approved.",
      });
    }
    return { approved: true, drafted: inputData.drafted };
  },
});

const finalizeStep = createStep({
  id: "finalize",
  inputSchema: approvalStep.outputSchema,
  outputSchema: z.object({ approved_count: z.number() }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) return { approved_count: 0 };
    const { approveNudge } = await import("../tools/ledger.js");
    let n = 0;
    for (const d of inputData.drafted) {
      try {
        await runTool(approveNudge, { nudge_id: d.nudge_id });
        n++;
      } catch {
        /* already approved elsewhere */
      }
    }
    return { approved_count: n };
  },
});

export const weeklyChase = createWorkflow({
  id: "weekly-chase",
  inputSchema: z.object({ top: z.number().int().min(1).max(10).default(5) }),
  outputSchema: z.object({ approved_count: z.number() }),
})
  .then(queueStep)
  .then(draftStep)
  .then(approvalStep)
  .then(finalizeStep)
  .commit();
