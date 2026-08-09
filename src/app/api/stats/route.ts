import { NextResponse } from "next/server";
import { VectorStoreRepository } from "@/server/vector-store-repository";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("stats");

export async function GET() {
  log.debug("GET /api/stats");
  try {
    const stats = await VectorStoreRepository.getInstance().getStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read stats.";
    log.error("stats failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  log.warn("DELETE /api/stats — clearing store");
  try {
    const deleted = await VectorStoreRepository.getInstance().clearAll();
    return NextResponse.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear store.";
    log.error("clear failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
