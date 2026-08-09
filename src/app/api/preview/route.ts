import { NextResponse } from "next/server";
import { DocumentProcessor } from "@/server/document-processor";
import { previewSchema, firstIssue } from "@/lib/schemas";
import type { PreviewResponse } from "@/lib/types";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("split");

// Preview only: splits the text and returns the chunks.
// It NEVER calls the LLM and NEVER writes to the database.
export async function POST(req: Request) {
  log.info("POST /api/preview");
  const parsed = previewSchema.safeParse(await req.json().catch(() => null));
  
  if (!parsed.success) {
    log.warn("invalid payload", { issue: firstIssue(parsed.error) });
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    const { text, config } = parsed.data;
    const chunks = await new DocumentProcessor(config).split(text);

    const payload: PreviewResponse = {
      chunks: chunks.map((content, index) => ({
        index,
        content,
        size: content.length,
      })),
      totalChunks: chunks.length,
      totalChars: text.length,
    };
    log.success("preview done", {
      chunks: payload.totalChunks,
      chars: payload.totalChars,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to split text.";
    log.error("preview failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
