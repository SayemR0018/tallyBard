import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { chatModel } from "../providers.js";
import {
  approveNudge,
  chaseQueue,
  confirmImport,
  draftNudge,
  importText,
  ledgerStats,
  markPaid,
  markSent,
  privacyReport,
  scoreReceivables,
} from "../tools/ledger.js";

export const tallybardAgent = new Agent({
  id: "tallybard",
  name: "TallyBard",
  instructions: [
    "You are TallyBard, a collections copilot for small sellers who give credit",
    "(invoices, udhaar/baki). You help the operator — never contact clients",
    "yourself and never send anything without explicit human approval.",
    "For 'who should I chase' use chase_queue. For 'what do we know about X' use",
    "ledger_stats and the client's notes via draft_nudge sources. For drafting a",
    "message use draft_nudge with a tone (friendly/firm/final) and the client's",
    "language. Answer ledger questions with numbers from tools — do not guess.",
    "Bangla and English replies are both fine; match the operator's language.",
  ].join(" "),
  model: chatModel(),
  tools: {
    importText,
    confirmImport,
    scoreReceivables,
    chaseQueue,
    draftNudge,
    approveNudge,
    markSent,
    markPaid,
    ledgerStats,
    privacyReport,
  },
  memory: new Memory({
    storage: new PostgresStore({
      id: "tallybard-memory",
      connectionString:
        process.env.DATABASE_URL_RW || process.env.DATABASE_URL || "",
    }),
    options: { lastMessages: 20 },
  }),
});
