import { NextResponse } from "next/server";
import { VectorStoreRepository } from "@/server/vector-store-repository";
import { RagService } from "@/server/rag-service";
import { chatSchema, firstIssue } from "@/lib/schemas";
import { META_DELIM, ERROR_DELIM } from "@/lib/stream";
import type { ChatSource } from "@/lib/types";
import type { ChatOpenAI } from "@langchain/openai";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("chat");

export async function POST(req: Request) {
  log.info("POST /api/chat");
  const parsed = chatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid payload", { issue: firstIssue(parsed.error) });
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { question, retrieval, generation } = parsed.data;
  const rag = new RagService(VectorStoreRepository.getInstance());

  // Retrieval + model build happen up front so pre-stream errors return clean JSON
  // and the sources can be sent before the first token.
  let sources: ChatSource[];
  let model: ChatOpenAI;
  let usedParams: string[];
  try {
    sources = await rag.retrieve(question, retrieval);
    ({ model, usedParams } = rag.createModel(generation));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retrieval failed.";
    log.error("pre-stream failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
  log.info("streaming answer", { sources: sources.length });

  const encoder = new TextEncoder();
  const metadata = JSON.stringify({ sources, model: rag.model, usedParams });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(metadata + META_DELIM));
      try {
        for await (const token of rag.stream(
          model,
          question,
          sources.map((s) => ({ index: s.index, content: s.content })),
          generation,
        )) {
          controller.enqueue(encoder.encode(token));
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed.";
        controller.enqueue(encoder.encode(ERROR_DELIM + message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
