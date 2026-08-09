import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { CONFIG } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("model");

/**
 * Wraps the HuggingFace Inference API embedding model (remote call, no local
 * model download — serverless-friendly). Lazy singleton: the client is created
 * once and reused across requests.
 */
export class EmbeddingsService {
  private static instance: EmbeddingsService | null = null;

  readonly embeddings: HuggingFaceInferenceEmbeddings;

  private constructor() {
    log.info("using HuggingFace Inference embeddings", {
      model: CONFIG.embedding.model,
    });
    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: CONFIG.embedding.apiKey,
      model: CONFIG.embedding.model,
    });
  }

  static getInstance(): EmbeddingsService {
    if (!EmbeddingsService.instance) {
      log.debug("cold start — creating embeddings singleton");
      EmbeddingsService.instance = new EmbeddingsService();
    }
    return EmbeddingsService.instance;
  }
}
