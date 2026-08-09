import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { createLogger } from "@/lib/logger";

const log = createLogger("extract");

export interface ExtractedText {
  text: string;
  source: string;
}

/** Extracts plain text from an uploaded file (.txt / .md / .pdf). */
export class DocumentLoader {
  async extractText(file: File): Promise<ExtractedText> {
    const name = file.name.toLowerCase();
    log.info("received file", {
      name: file.name,
      type: file.type || "unknown",
      bytes: file.size,
    });

    if (name.endsWith(".pdf")) {
      // PDFLoader accepts a Blob directly; splitPages:false => one combined document.
      const end = log.timer("pdf load");
      const loader = new PDFLoader(file, { splitPages: false });
      const docs = await loader.load();
      const text = docs
        .map((d) => d.pageContent)
        .join("\n\n")
        .trim();
      end("pdf parsed", { documents: docs.length, chars: text.length });
      return { text, source: file.name };
    }

    if (name.endsWith(".txt") || name.endsWith(".md")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = buffer.toString("utf-8");
      log.success("text file read", { chars: text.length });
      return { text, source: file.name };
    }

    log.error("unsupported file type", { name: file.name });
    throw new Error("Unsupported file type. Use .txt, .md or .pdf.");
  }
}
