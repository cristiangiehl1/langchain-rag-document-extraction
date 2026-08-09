// Shared contracts between the UI and the API routes.

export interface SplitConfig {
  chunkSize: number;
  chunkOverlap: number;
  /** Optional custom separators. Empty => library defaults. */
  separators?: string[];
}

export interface ChunkPreview {
  index: number;
  content: string;
  size: number;
}

export interface PreviewResponse {
  chunks: ChunkPreview[];
  totalChunks: number;
  totalChars: number;
}

export interface EmbedRequest {
  text: string;
  source: string;
  config: SplitConfig;
}

export interface EmbedResponse {
  storedVectors: number;
  source: string;
}

/** Retrieval knobs (how the vector store is queried). */
export interface RetrievalConfig {
  topK: number;
  /** Optional minimum cosine similarity (0..1). null => disabled. */
  minScore: number | null;
  /** Restrict retrieval to a single document (metadata.source). null => all. */
  source: string | null;
}

/**
 * Generation knobs sent to the LLM. Fields left `null`/`undefined` are omitted
 * from the OpenRouter call so unsupported params are never sent as invalid values.
 */
export interface GenerationConfig {
  temperature: number;
  topP: number;
  /** Sampling top_k (OpenRouter) — distinct from RetrievalConfig.topK. */
  topK: number | null;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  seed: number | null;
  systemPrompt: string;
}

export interface ChatSource {
  index: number;
  content: string;
  score: number;
  source: string;
  chunkIndex: number | null;
}

export interface ChatRequest {
  question: string;
  retrieval: RetrievalConfig;
  generation: GenerationConfig;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  model: string;
  usedParams: string[];
}

export interface StoreStats {
  totalVectors: number;
  sources: { source: string; chunks: number }[];
}

export interface VectorDetail {
  id: string;
  source: string;
  chunkIndex: number | null;
  content: string;
  /** Number of dimensions of the stored embedding (e.g. 384). */
  dim: number;
  /** First few values of the embedding, for a quick visual check. */
  preview: number[];
  ingestedAt: string | null;
  /** Full metadata jsonb stored alongside the vector. */
  metadata: Record<string, unknown>;
}

export interface VectorListResponse {
  items: VectorDetail[];
  limit: number;
  offset: number;
  total: number;
}
