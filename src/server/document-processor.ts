import {
  RecursiveCharacterTextSplitter,
  type TextSplitter,
} from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import type { SplitConfig } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("split");

/**
 * Splits raw text into chunks using a LangChain RecursiveCharacterTextSplitter.
 * The split configuration is injected via the constructor (per request).
 */
export class DocumentProcessor {
  constructor(private readonly config: SplitConfig) {}

  private buildSplitter(): TextSplitter {
    const { chunkSize, chunkOverlap, separators } = this.config;
    const custom =
      separators && separators.length > 0 ? separators : undefined;

    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      ...(custom ? { separators: custom } : {}),
    });
  }

  /** Returns the plain chunk strings (used by the preview step). */
  async split(text: string): Promise<string[]> {
    const end = log.timer("split text");
    const chunks = await this.buildSplitter().splitText(text);
    end("split into chunks", {
      chars: text.length,
      chunks: chunks.length,
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
    return chunks;
  }

  /** Returns LangChain Documents with metadata, ready to embed and store. */
  async toDocuments(text: string, source: string): Promise<Document[]> {
    const chunks = await this.split(text);
    const ingestedAt = new Date().toISOString();
    log.info("built documents", { source, documents: chunks.length });
    return chunks.map(
      (content, index) =>
        new Document({
          pageContent: content,
          metadata: {
            source,
            chunkIndex: index,
            totalChunks: chunks.length,
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap,
            splitter: "recursive",
            ingestedAt,
          },
        }),
    );
  }
}
