import { NextResponse } from "next/server";
import { DocumentProcessor } from "@/server/document-processor";
import { VectorStoreRepository } from "@/server/vector-store-repository";
import { embedSchema, firstIssue } from "@/lib/schemas";
import type { EmbedResponse } from "@/lib/types";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
// Vercel Hobby caps function duration at 60s. Very large documents may need to be
// ingested in smaller batches (or a Pro plan, which allows up to 300s).
export const maxDuration = 60;

const log = createLogger("embed");

// Confirmed step: split -> embed locally -> store in pgvector.
export async function POST(req: Request) {
  log.info("POST /api/embed");
  const parsed = embedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid payload", { issue: firstIssue(parsed.error) });
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    const { text, config } = parsed.data;
    const source = parsed.data.source?.trim() || "pasted-text";

    const documents = await new DocumentProcessor(config).toDocuments(
      text,
      source,
    );
    if (documents.length === 0) {
      log.warn("splitting produced no chunks", { source });
      return NextResponse.json(
        { error: "Splitting produced no chunks." },
        { status: 400 },
      );
    }

    await VectorStoreRepository.getInstance().addDocuments(documents);

    const payload: EmbedResponse = {
      storedVectors: documents.length,
      source,
    };
    log.success("embed done", { ...payload });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to embed and store text.";
    log.error("embed failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
