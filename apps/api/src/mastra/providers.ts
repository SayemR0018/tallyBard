/**
 * Model switch. MODEL_BACKEND=ollama|aistudio.
 *
 * ollama:  OpenAI-compatible endpoint on our own droplet, behind Caddy + bearer.
 *          Chat: gemma4:e4b (env OLLAMA_CHAT_MODEL). Embeddings: embeddinggemma
 *          (env OLLAMA_EMBED_MODEL), native 768-dim — matches vector(768).
 * aistudio: Google AI Studio fallback (env AI_CHAT_MODEL / AI_EMBED_MODEL).
 *
 * Privacy note: with backend=ollama no client data leaves our infrastructure;
 * with aistudio, prompts (which may include client names from the ledger) go to
 * Google — the privacy panel in the UI reports the active backend.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embed } from "ai";

export function backend() {
  return (process.env.MODEL_BACKEND || "ollama") as "ollama" | "aistudio";
}

export function chatModel() {
  if (backend() === "aistudio") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY!,
    });
    return google(process.env.AI_CHAT_MODEL || "gemma-4-31b-it");
  }
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: `${(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1`,
    apiKey: process.env.OLLAMA_API_KEY,
  });
  return ollama.chatModel(process.env.OLLAMA_CHAT_MODEL || "gemma4:e4b");
}

export function embedder() {
  if (backend() === "aistudio") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY!,
    });
    return google.textEmbeddingModel(
      process.env.AI_EMBED_MODEL || "gemini-embedding-001",
    );
  }
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: `${(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1`,
    apiKey: process.env.OLLAMA_API_KEY,
  });
  return ollama.embeddingModel(process.env.OLLAMA_EMBED_MODEL || "embeddinggemma");
}

/** Embed text → number[768] | null. Null means "BM25-only" (graceful). */
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const { embedding } = await embed({
      model: embedder(),
      value: text,
      providerOptions: {
        google: { outputDimensionality: 768 },
      },
    });
    return embedding.length === 768 ? embedding : embedding.slice(0, 768);
  } catch {
    return null;
  }
}
