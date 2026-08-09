// Single, frozen source of configuration read from the environment.
// Server-only: never import this from a client component.

export const CONFIG = Object.freeze({
  openRouter: {
    model: process.env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it:free",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    maxRetries: 2,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "LangChain RAG Lab",
    },
  },
  embedding: {
    // Multilingual model (384d) — handles Portuguese queries far better than
    // the English-only all-MiniLM-L6-v2. Same dimension, so vector(384) is unchanged.
    model:
      process.env.EMBEDDING_MODEL ??
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    // fp32 = best quality; see @huggingface/transformers dtype options.
    pretrainedOptions: { dtype: "fp32" as const },
  },
  postgres: {
    connectionString: process.env.DATABASE_URL,
    tableName: "embeddings",
    columns: {
      idColumnName: "id",
      vectorColumnName: "vector",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine" as const,
  },
});
