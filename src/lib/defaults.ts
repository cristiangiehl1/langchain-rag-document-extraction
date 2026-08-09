import type { GenerationConfig, RetrievalConfig } from "./types";

export const DEFAULT_RETRIEVAL: RetrievalConfig = {
  topK: 4,
  minScore: null,
  source: null,
};

export const DEFAULT_GENERATION: GenerationConfig = {
  temperature: 0.3,
  topP: 1,
  topK: null,
  maxTokens: 1024,
  frequencyPenalty: 0,
  presencePenalty: 0,
  seed: null,
  systemPrompt: "",
};

export const CONFIG_STORAGE_KEY = "rag-lab.chat-config.v1";
