import { createTool } from "@mastra/core/tools";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { pool, readPool, vectorLiteral } from "../db.js";
import { chatModel, embedText, backend } from "../providers.js";

const UUID = z.string().uuid();

const importTextOutput = z.object({
  rows: z.array(
    z.object({
      client_name: z.string(),
      phone: z.string().nullable(),
      amount: z.number(),
      currency: z.string().default("BDT"),
      kind: z.enum(["invoice", "udhaar", "fiado", "other"]).default("invoice"),
      issued_at: z.string().nullable(),
      due_date: z.string().nullable(),
      preferred_language: z.enum(["bn", "en", "mixed"]).default("bn"),
      note: z.string().nullable(),
    }),
  ),
  warnings: z.array(z.string()),
});

export const importText = createTool({
  id: "import_text",
  description:
    "Extract ledger rows from pasted text or CSV content using the chat model. " +
    "Returns proposed rows for human confirmation; inserts nothing.",
  inputSchema: z.object({
    text: z.string().min(3).max(20_000),
  }),
  outputSchema: importTextOutput,
  execute: async (inputData) => {
    const { object } = await generateObject({
      model: chatModel(),
      schema: importTextOutput,
      prompt: [
        "Extract ledger rows from this informal credit text (may mix Bangla and English,",
        "baki/udhaar means informal credit). Output JSON only. If a field is unknown use null.",
        "Do not invent amounts or dates. Text:",
        inputData.text,
      ].join("\n"),
    });
    return object;
  },
});

export const confirmImport = createTool({
  id: "confirm_import",
  description:
    "Insert confirmed ledger rows (clients + receivables). Only call with rows " +
    "the human has reviewed and approved.",
  inputSchema: z.object({
    rows: z.array(
      z.object({
        client_name: z.string(),
        phone: z.string().nullable(),
        amount: z.number().nonnegative(),
        currency: z.string().default("BDT"),
        kind: z.enum(["invoice", "udhaar", "fiado", "other"]).default("invoice"),
        issued_at: z.string().nullable(),
        due_date: z.string().nullable(),
        preferred_language: z.enum(["bn", "en", "mixed"]).default("bn"),
        note: z.string().nullable(),
      }),
    ),
  }),
  outputSchema: z.object({ inserted: z.number(), client_ids: z.array(UUID) }),
  execute: async (inputData) => {
    const client = await pool.connect();
    let inserted = 0;
    const clientIds = new Set<string>();
    try {
      await client.query("BEGIN");
      for (const row of inputData.rows) {
        const phone = row.phone || `n/a:${row.client_name}`;
        const c = await client.query(
          `INSERT INTO clients (name, phone, preferred_language)
           VALUES ($1, $2, $3)
           ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [row.client_name, phone, row.preferred_language],
        );
        const cid: string = c.rows[0].id;
        clientIds.add(cid);
        if (row.note) {
          await client.query(
            "INSERT INTO client_notes (client_id, body) VALUES ($1, $2)",
            [cid, row.note],
          );
        }
        await client.query(
          `INSERT INTO receivables (client_id, amount, currency, kind, issued_at, due_date)
           VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()),
                   COALESCE($6::timestamptz, now() + interval '30 days'))`,
          [cid, row.amount, row.currency, row.kind, row.issued_at, row.due_date],
        );
        inserted++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    scoreCache = null;
    return { inserted, client_ids: [...clientIds] };
  },
});

let scoreCache: { at: number; map: Record<string, number> } | null = null;
const SCORE_TTL_MS = 90_000;

export const scoreReceivables = createTool({
  id: "score_receivables",
  description:
    "Score open receivables for P(paid >7 days late) via the risk sidecar " +
    "(TabPFN on anonymised features only — no names/phones/notes leave here).",
  inputSchema: z.object({
    receivable_ids: z.array(z.string()).nullable().default(null),
  }),
  outputSchema: z.object({
    model: z.string(),
    scores: z.array(
      z.object({
        receivable_id: z.string(),
        p_late7: z.number(),
        why: z.record(z.string(), z.any()),
      }),
    ),
  }),
  execute: async (inputData) => {
    const url = `${process.env.RISK_SIDECAR_URL}/score`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receivable_ids: inputData.receivable_ids }),
    });
    if (!res.ok) throw new Error(`sidecar ${res.status}: ${await res.text()}`);
    return res.json();
  },
});

export const chaseQueue = createTool({
  id: "chase_queue",
  description:
    "Ranked chase queue: open receivables ordered by amount x P(late). " +
    "Joins ledger rows to sidecar risk scores.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(20),
    rescore: z.boolean().default(false),
  }),
  outputSchema: z.object({
    queue: z.array(
      z.object({
        receivable_id: z.string(),
        client_name: z.string(),
        amount: z.number(),
        currency: z.string(),
        days_overdue: z.number(),
        p_late7: z.number().nullable(),
        priority: z.number().nullable(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const open = await readPool.query(
      `SELECT r.id, c.name, r.amount, r.currency, r.due_date
       FROM receivables r JOIN clients c ON c.id = r.client_id
       WHERE r.status IN ('pending','overdue') AND r.paid_at IS NULL`,
    );
    let scores: Record<string, number> = {};
    const fresh =
      !inputData.rescore &&
      scoreCache &&
      Date.now() - scoreCache.at < SCORE_TTL_MS;
    if (fresh && scoreCache) {
      scores = scoreCache.map;
    } else {
      try {
        const res = await fetch(`${process.env.RISK_SIDECAR_URL}/score`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        if (res.ok) {
          const data = await res.json();
          for (const s of data.scores) scores[s.receivable_id] = s.p_late7;
          if (Object.keys(scores).length)
            scoreCache = { at: Date.now(), map: scores };
        }
      } catch {
        // sidecar down -> queue still works, risk column null
      }
    }
    const now = Date.now();
    const queue = open.rows
      .map((r: any) => {
        const p = scores[r.id] ?? null;
        const daysOver = Math.max(
          0,
          Math.floor((now - new Date(r.due_date).getTime()) / 86400000),
        );
        return {
          receivable_id: r.id,
          client_name: r.name,
          amount: Number(r.amount),
          currency: r.currency,
          days_overdue: daysOver,
          p_late7: p,
          priority: p === null ? null : Number((Number(r.amount) * p).toFixed(2)),
        };
      })
      .sort((a: any, b: any) => (b.priority ?? -1) - (a.priority ?? -1))
      .slice(0, inputData.limit);
    return { queue };
  },
});

const TONE_LADDER = {
  friendly:
    "Warm, assumes good intent, light reminder. No pressure, no deadlines mentioned.",
  firm: "Direct and courteous. States amount + days overdue, asks for a payment date.",
  final:
    "Last polite notice before escalation. Still respectful; names the amount, days overdue, and asks to settle or respond by a date.",
} as const;

export const draftNudge = createTool({
  id: "draft_nudge",
  description:
    "Draft a WhatsApp nudge for a receivable in the client's language at the " +
    "requested tone. Grounded in hybrid search over client notes and previous " +
    "nudges so wording never repeats. Saves a 'draft' row — nothing is sent.",
  inputSchema: z.object({
    receivable_id: UUID,
    tone: z.enum(["friendly", "firm", "final"]).default("friendly"),
    language: z.enum(["bn", "en", "mixed"]).nullable().default(null),
  }),
  outputSchema: z.object({
    nudge_id: UUID,
    draft_text: z.string(),
    language: z.string(),
    tone: z.string(),
    sources_used: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const r = await pool.query(
      `SELECT r.id, r.amount, r.currency, r.due_date, r.kind,
              c.id AS client_id, c.name, c.phone, c.preferred_language
       FROM receivables r JOIN clients c ON c.id = r.client_id
       WHERE r.id = $1`,
      [inputData.receivable_id],
    );
    if (r.rowCount === 0) throw new Error("receivable not found");
    const rec = r.rows[0];
    const language = inputData.language ?? rec.preferred_language;
    const daysOver = Math.max(
      0,
      Math.floor((Date.now() - new Date(rec.due_date).getTime()) / 86400000),
    );

    // Hybrid search over this client's notes (context) + all prior nudges (dedup).
    const q = `${rec.name} ${rec.kind} payment reminder ${language}`;
    const emb = await embedText(q);
    const notes = await pool.query(
      "SELECT body, bm25_rank, vec_rank FROM hybrid_search_notes($1,$2,5,$3)",
      [q, vectorLiteral(emb), rec.client_id],
    );
    const prior = await pool.query(
      `SELECT n.draft_text FROM hybrid_search_nudges($1,$2,8) h
       JOIN nudges n ON n.id = h.nudge_id
       JOIN receivables r2 ON r2.id = n.receivable_id
       WHERE r2.client_id = $3`,
      [q, vectorLiteral(emb), rec.client_id],
    );

    const { text } = await generateText({
      model: chatModel(),
      prompt: [
        `Draft ONE WhatsApp payment reminder in ${language === "mixed" ? "mixed Bangla+English" : language === "bn" ? "Bangla" : "English"}.`,
        `Tone: ${inputData.tone} — ${TONE_LADDER[inputData.tone]}`,
        `Facts: amount ${rec.amount} ${rec.currency}, ${daysOver} days overdue, kind=${rec.kind}.`,
        `Address the client by name (${rec.name}). Sign off as the business.`,
        notes.rows.length ? `Client context: ${notes.rows.map((n: any) => n.body).join("; ")}` : "",
        prior.rows.length
          ? `Do NOT reuse phrasing from these earlier nudges: ${prior.rows.map((p: any) => JSON.stringify(p.draft_text)).join("; ")}`
          : "",
        "Rules: under 60 words, polite, no threats, no payment links, end with a question inviting a reply.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const nEmb = await embedText(text);
    const ins = await pool.query(
      `INSERT INTO nudges (receivable_id, tone, language, draft_text, embedding)
       VALUES ($1, $2, $3, $4, $5::vector) RETURNING id`,
      [inputData.receivable_id, inputData.tone, language, text, vectorLiteral(nEmb)],
    );
    return {
      nudge_id: ins.rows[0].id,
      draft_text: text,
      language,
      tone: inputData.tone,
      sources_used: notes.rows.map((n: any) => n.body).slice(0, 3),
    };
  },
});

export const approveNudge = createTool({
  id: "approve_nudge",
  description:
    "Approve a draft nudge: marks it approved and returns the wa.me click-to-send " +
    "link. The human still presses send in WhatsApp — nothing is auto-sent.",
  inputSchema: z.object({ nudge_id: UUID }),
  outputSchema: z.object({
    nudge_id: UUID,
    wa_link: z.string(),
    draft_text: z.string(),
  }),
  execute: async (inputData) => {
    const r = await pool.query(
      `UPDATE nudges SET status='approved', approved_at=now()
       WHERE id=$1 AND status='draft'
       RETURNING id, draft_text,
                 (SELECT c.phone FROM receivables rc JOIN clients c ON c.id=rc.client_id
                  WHERE rc.id = nudges.receivable_id) AS phone`,
      [inputData.nudge_id],
    );
    if (r.rowCount === 0) throw new Error("nudge not found or not in draft state");
    const n = r.rows[0];
    const digits = String(n.phone).replace(/[^0-9]/g, "");
    return {
      nudge_id: n.id,
      wa_link: `https://wa.me/${digits}?text=${encodeURIComponent(n.draft_text)}`,
      draft_text: n.draft_text,
    };
  },
});

export const markSent = createTool({
  id: "mark_sent",
  description: "Mark an approved nudge as sent (human clicked wa.me / copied).",
  inputSchema: z.object({ nudge_id: UUID }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const r = await pool.query(
      "UPDATE nudges SET status='sent', sent_at=now() WHERE id=$1 AND status='approved'",
      [inputData.nudge_id],
    );
    return { ok: (r.rowCount ?? 0) > 0 };
  },
});

export const markPaid = createTool({
  id: "mark_paid",
  description:
    "Mark a receivable paid and append a payment_events row (hypertable).",
  inputSchema: z.object({
    receivable_id: UUID,
    amount: z.number().nonnegative().nullable().default(null),
    method: z.string().default("unknown"),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const r = await pool.query(
      `UPDATE receivables SET status='paid', paid_at=now()
       WHERE id=$1 AND paid_at IS NULL RETURNING amount`,
      [inputData.receivable_id],
    );
    if (r.rowCount === 0) throw new Error("receivable not found or already paid");
    const amt = inputData.amount ?? Number(r.rows[0].amount);
    await pool.query(
      "INSERT INTO payment_events (receivable_id, amount, paid_at, method) VALUES ($1,$2,now(),$3)",
      [inputData.receivable_id, amt, inputData.method],
    );
    scoreCache = null;
    return { ok: true };
  },
});

export const ledgerStats = createTool({
  id: "ledger_stats",
  description:
    "Canned read-only ledger aggregates for 'ask your ledger' chat: open totals, " +
    "overdue counts, per-client balances, recent payments.",
  inputSchema: z.object({
    query: z.enum([
      "open_totals",
      "top_open_clients",
      "recent_payments",
      "per_status",
    ]),
  }),
  outputSchema: z.object({ rows: z.array(z.record(z.string(), z.any())) }),
  execute: async (inputData) => {
    const sql = {
      open_totals: `SELECT currency, count(*) AS open_count, sum(amount) AS open_amount
                    FROM receivables WHERE paid_at IS NULL AND status IN ('pending','overdue')
                    GROUP BY currency`,
      top_open_clients: `SELECT c.name, sum(r.amount) AS open_amount, count(*) AS open_items
                         FROM receivables r JOIN clients c ON c.id=r.client_id
                         WHERE r.paid_at IS NULL AND r.status IN ('pending','overdue')
                         GROUP BY c.name ORDER BY open_amount DESC LIMIT 10`,
      recent_payments: `SELECT p.paid_at, p.amount, p.method
                        FROM payment_events p ORDER BY paid_at DESC LIMIT 10`,
      per_status: `SELECT status, count(*) FROM receivables GROUP BY status ORDER BY 2 DESC`,
    }[inputData.query];
    const r = await readPool.query(sql);
    return { rows: r.rows };
  },
});

export const listNudges = createTool({
  id: "list_nudges",
  description:
    "Read-only list of recent nudges (draft/approved/sent) with client name, " +
    "amount, tone, language and text — for the Nudges screen.",
  inputSchema: z.object({
    status: z.enum(["draft", "approved", "sent", "all"]).default("all"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  outputSchema: z.object({
    nudges: z.array(
      z.object({
        nudge_id: z.string(),
        receivable_id: z.string(),
        client_name: z.string(),
        amount: z.number(),
        currency: z.string(),
        status: z.string(),
        tone: z.string(),
        language: z.string(),
        draft_text: z.string(),
        created_at: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const where = inputData.status === "all" ? "" : "WHERE n.status = $2";
    const params: unknown[] = [inputData.limit];
    if (inputData.status !== "all") params.push(inputData.status);
    const r = await readPool.query(
      `SELECT n.id, n.receivable_id, c.name, r.amount, r.currency, n.status,
              n.tone, n.language, n.draft_text, n.created_at
       FROM nudges n
       JOIN receivables r ON r.id = n.receivable_id
       JOIN clients c ON c.id = r.client_id
       ${where}
       ORDER BY n.created_at DESC LIMIT $1`,
      params,
    );
    return {
      nudges: r.rows.map((n: any) => ({
        nudge_id: String(n.id),
        receivable_id: String(n.receivable_id),
        client_name: n.name,
        amount: Number(n.amount),
        currency: n.currency,
        status: n.status,
        tone: n.tone,
        language: n.language,
        draft_text: n.draft_text,
        created_at: new Date(n.created_at).toISOString(),
      })),
    };
  },
});

export const systemStatus = createTool({
  id: "system_status",
  description:
    "Which model backend is active, which models, whether the risk sidecar " +
    "is reachable and in which TabPFN mode. No secrets.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    backend: z.enum(["ollama", "aistudio"]),
    chat_model: z.string(),
    embed_model: z.string(),
    sidecar: z.object({
      ok: z.boolean(),
      mode: z.string().nullable(),
    }),
    demo_data: z.literal("synthetic"),
  }),
  execute: async () => {
    const isOllama = backend() === "ollama";
    let sidecar = { ok: false, mode: null as string | null };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${process.env.RISK_SIDECAR_URL}/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const j = (await res.json()) as { mode?: string };
        sidecar = { ok: true, mode: j.mode ?? null };
      }
    } catch {
      /* sidecar down or sleeping */
    }
    return {
      backend: backend(),
      chat_model: isOllama
        ? process.env.OLLAMA_CHAT_MODEL || "gemma4:e4b"
        : process.env.AI_CHAT_MODEL || "gemma-4-26b-a4b-it",
      embed_model: isOllama
        ? process.env.OLLAMA_EMBED_MODEL || "embeddinggemma"
        : process.env.AI_EMBED_MODEL || "gemini-embedding-001",
      sidecar,
      demo_data: "synthetic" as const,
    };
  },
});

export const privacyReport = createTool({
  id: "privacy_report",
  description:
    "Report exactly what leaves this server: egress endpoints, which data fields " +
    "each sees, and which never leave. For the UI privacy panel.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    backend: z.string(),
    egress: z.array(
      z.object({
        to: z.string(),
        sees: z.array(z.string()),
        never: z.array(z.string()),
      }),
    ),
  }),
  execute: async () => ({
    backend: backend(),
    egress: [
      {
        to: backend() === "ollama"
          ? "Ollama on our own droplet (self-hosted)"
          : "Google AI Studio",
        sees: ["prompt text (may include client names and amounts)"],
        never: ["phone numbers in prompts unless you paste them", "raw notes unless searched"],
      },
      {
        to: "risk sidecar (TabPFN)",
        sees: ["anonymised numeric/categorical features only"],
        never: ["names", "phones", "note text"],
      },
      {
        to: "Sentry (tracing)",
        sees: ["span names, timing, token counts"],
        never: ["prompt inputs", "model outputs", "client fields"],
      },
    ],
  }),
});
