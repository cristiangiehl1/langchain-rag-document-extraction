import { NextResponse } from "next/server";
import { DocumentLoader } from "@/server/document-loader";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("extract");

// Extracts plain text from an uploaded file (.txt / .md / .pdf via LangChain PDFLoader).
export async function POST(req: Request) {
  log.info("POST /api/extract");
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      log.warn("no file in request");
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const result = await new DocumentLoader().extractText(file);
    log.success("extract done", { source: result.source, chars: result.text.length });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to extract file text.";
    log.error("extract failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
