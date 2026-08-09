import { NextResponse } from "next/server";
import { VectorStoreRepository } from "@/server/vector-store-repository";
import { ChatService } from "@/server/chat-service";
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
  const chat = new ChatService(VectorStoreRepository.getInstance());

  // Retrieval + client build happen up front so pre-stream errors return clean JSON
  // and the sources can be sent before the first token. Neither calls the LLM yet.
  let sources: ChatSource[];
  let chatClient: ChatOpenAI;
  let usedParams: string[];
  try {
    sources = await chat.retrieve(question, retrieval);
    ({ client: chatClient, usedParams } = chat.createChatClient(generation));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retrieval failed.";
    log.error("pre-stream failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
  log.info("streaming answer", { sources: sources.length });

  const encoder = new TextEncoder();
  const metadata = JSON.stringify({ sources, model: chat.modelName, usedParams });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(metadata + META_DELIM));
      try {
        for await (const token of chat.streamAnswer(
          chatClient,
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
