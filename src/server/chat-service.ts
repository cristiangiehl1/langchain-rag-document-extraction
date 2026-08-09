import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { CONFIG } from "@/lib/config";
import type {
  ChatSource,
  GenerationConfig,
  RetrievalConfig,
} from "@/lib/types";
import type { VectorStoreRepository } from "./vector-store-repository";
import { createLogger } from "@/lib/logger";
import { buildRagPrompt } from "@/lib/prompt/prompt-builder";

const log = createLogger("rag");

/**
 * Powers the /api/chat endpoint: answers a question about the ingested documents.
 * Uses retrieval-augmented generation — queries the vector store for context and
 * streams an answer from the OpenRouter chat model. The question comes from the
 * frontend, so the chain is assembled directly (no RunnableSequence / prompt files).
 */
export class ChatService {
  constructor(private readonly repo: VectorStoreRepository) {}

  /** Retrieves the most similar chunks and maps them to UI-facing sources. */
  async retrieve(
    question: string,
    retrieval: RetrievalConfig,
  ): Promise<ChatSource[]> {
    log.info("retrieve", {
      question,
      topK: retrieval.topK,
      minScore: retrieval.minScore,
      source: retrieval.source ?? null,
    });
    // Scope retrieval to a single document when a source is selected.
    const filter = retrieval.source ? { source: retrieval.source } : undefined;
    const results = await this.repo.similaritySearchWithScore(
      question,
      retrieval.topK,
      filter,
    );

    const sources = results
      .map(([doc, distance]) => ({
        // pgvector cosine: score = distance (0 = identical) -> similarity = 1 - distance
        score: Number((1 - distance).toFixed(4)),
        content: doc.pageContent,
        source: String(doc.metadata?.source ?? "unknown"),
        chunkIndex:
          typeof doc.metadata?.chunkIndex === "number"
            ? doc.metadata.chunkIndex
            : null,
      }))
      .filter((s) =>
        retrieval.minScore === null ? true : s.score >= retrieval.minScore,
      )
      .map((s, i) => ({ index: i + 1, ...s }));

    log.success("retrieved context", {
      candidates: results.length,
      kept: sources.length,
      topScore: sources[0]?.score ?? null,
    });
    return sources;
  }

  /** The model identifier (e.g. "google/gemma-...") — a string, not the client. */
  get modelName(): string {
    return CONFIG.openRouter.model;
  }

  /**
   * Builds a streaming ChatOpenAI client pointed at OpenRouter, including ONLY the
   * generation params the user actually set (so unsupported values are never sent).
   * Does NOT call the LLM — it only prepares the client (the network call happens
   * later, in streamAnswer). Throws if the API key is missing. Returns the applied
   * params for UI transparency.
   */
  createChatClient(gen: GenerationConfig): { client: ChatOpenAI; usedParams: string[] } {
    if (!CONFIG.openRouter.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set. Add it to your .env file.");
    }

    const used: string[] = [];
    const modelKwargs: Record<string, unknown> = {};
    const fields: ChatOpenAIFields = {
      model: CONFIG.openRouter.model,
      apiKey: CONFIG.openRouter.apiKey,
      maxRetries: CONFIG.openRouter.maxRetries,
      streaming: true,
      configuration: {
        baseURL: CONFIG.openRouter.baseURL,
        defaultHeaders: CONFIG.openRouter.defaultHeaders,
      },
    };

    if (Number.isFinite(gen.temperature)) {
      fields.temperature = gen.temperature;
      used.push("temperature");
    }
    if (Number.isFinite(gen.topP)) {
      fields.topP = gen.topP;
      used.push("top_p");
    }
    if (Number.isFinite(gen.maxTokens) && gen.maxTokens > 0) {
      fields.maxTokens = gen.maxTokens;
      used.push("max_tokens");
    }
    if (Number.isFinite(gen.frequencyPenalty) && gen.frequencyPenalty !== 0) {
      fields.frequencyPenalty = gen.frequencyPenalty;
      used.push("frequency_penalty");
    }
    if (Number.isFinite(gen.presencePenalty) && gen.presencePenalty !== 0) {
      fields.presencePenalty = gen.presencePenalty;
      used.push("presence_penalty");
    }
    // Non-OpenAI-native params are forwarded verbatim by OpenRouter.
    if (gen.topK !== null && Number.isFinite(gen.topK) && gen.topK > 0) {
      modelKwargs.top_k = gen.topK;
      used.push("top_k");
    }
    if (gen.seed !== null && Number.isFinite(gen.seed)) {
      modelKwargs.seed = gen.seed;
      used.push("seed");
    }
    if (Object.keys(modelKwargs).length > 0) fields.modelKwargs = modelKwargs;

    log.info("chat model ready", {
      model: CONFIG.openRouter.model,
      params: used.length ? used.join(",") : "(defaults)",
    });
    return { client: new ChatOpenAI(fields), usedParams: used };
  }

  private buildMessages(
    question: string,
    sources: Pick<ChatSource, "index" | "content">[],
    gen: GenerationConfig,
  ): BaseMessage[] {
    const contextBlock =
      sources.length > 0
        ? sources.map((s) => `[${s.index}] ${s.content}`).join("\n\n")
        : "(nenhum contexto relevante foi recuperado)";

    // A free-text system prompt from the UI overrides the structured prompt.
    if (gen.systemPrompt?.trim()) {
      return [
        new SystemMessage(gen.systemPrompt),
        new HumanMessage(`Context:\n${contextBlock}\n\nQuestion: ${question}`),
      ];
    }

    // Default: render the structured promptConfig + template (persona, rules,
    // context and question in one message).
    return [
      new HumanMessage(
        buildRagPrompt({ context: contextBlock, question }),
      ),
    ];
  }

  /**
   * Streams the answer token-by-token. This is where the LLM is actually called:
   * `client.stream(messages)` opens the request to OpenRouter and yields each
   * token as it arrives. A generator so the caller consumes tokens one at a time.
   */
  async *streamAnswer(
    client: ChatOpenAI,
    question: string,
    sources: Pick<ChatSource, "index" | "content">[],
    gen: GenerationConfig,
  ): AsyncGenerator<string> {
    const end = log.timer("generation stream");
    // >>> The actual LLM call: sends the prompt and returns a token stream. <<<
    const llmStream = await client.stream(this.buildMessages(question, sources, gen));
    let tokens = 0;
    let chars = 0;
    for await (const chunk of llmStream) {
      const c = chunk.content;
      if (typeof c === "string" && c.length > 0) {
        tokens += 1;
        chars += c.length;
        yield c;
      }
    }
    end("generation complete", { chunks: tokens, chars });
  }
}
