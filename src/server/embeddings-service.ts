import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import type { PretrainedOptions } from "@huggingface/transformers";
import { CONFIG } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("model");

/**
 * Wraps the local transformers.js embedding model (runs on the server, no external API).
 * Lazy singleton: the model is loaded once and reused across requests.
 */
export class EmbeddingsService {
  private static instance: EmbeddingsService | null = null;

  readonly embeddings: HuggingFaceTransformersEmbeddings;

  private constructor() {
    log.info("initializing local embedding model", {
      model: CONFIG.embedding.model,
    });
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      model: CONFIG.embedding.model,
      pretrainedOptions: CONFIG.embedding
        .pretrainedOptions as PretrainedOptions,
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
