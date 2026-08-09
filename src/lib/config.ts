// Single, frozen source of configuration derived from the validated environment.
// Server-only: never import this from a client component.

import { ENV } from "./env";

export const CONFIG = Object.freeze({
  openRouter: {
    model: ENV.OPENROUTER_MODEL,
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: ENV.OPENROUTER_API_KEY,
    maxRetries: 2,
    defaultHeaders: {
      "HTTP-Referer": ENV.OPENROUTER_SITE_URL,
      "X-Title": ENV.OPENROUTER_SITE_NAME,
    },
  },
  embedding: {
    // Remote HuggingFace Inference API — serverless-friendly (no local model to
    // download). Multilingual model (384d), so the vector(384) column is unchanged.
    model: ENV.EMBEDDING_MODEL,
    apiKey: ENV.HUGGINGFACEHUB_API_TOKEN,
  },
  postgres: {
    connectionString: ENV.DATABASE_URL,
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
