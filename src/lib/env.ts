// Validates and types the server-side environment once, at module load, with zod.
// A missing/invalid var fails fast here with a clear message instead of blowing up
// deep inside a request. Server-only: never import this from a client component.

import { z } from "zod";

const envSchema = z.object({
  // --- OpenRouter (chat LLM) ---
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemma-4-26b-a4b-it:free"),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_SITE_NAME: z.string().min(1).default("LangChain RAG Lab"),

  // --- Embeddings (HuggingFace Inference API) ---
  HUGGINGFACEHUB_API_TOKEN: z
    .string()
    .min(1, "HUGGINGFACEHUB_API_TOKEN is required"),
  EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    // "Xenova/*" are ONNX builds for the old local transformers.js path; the remote
    // Inference API expects the original "sentence-transformers/*" repo id.
    .refine(
      (m) => !m.startsWith("Xenova/"),
      "Use the 'sentence-transformers/...' repo id, not the Xenova ONNX build.",
    ),

  // --- Postgres + pgvector (Supabase in prod, local Docker in dev) ---
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres connection string.",
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables. Check your .env file:\n${issues}`,
  );
}

/** Validated, typed environment. Import this instead of reading process.env. */
export const ENV = parsed.data;
