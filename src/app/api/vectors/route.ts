import { NextResponse } from "next/server";
import { VectorStoreRepository } from "@/server/vector-store-repository";
import type { VectorListResponse } from "@/lib/types";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("vectors");

export async function GET(req: Request) {
  log.debug("GET /api/vectors");
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
    const source = searchParams.get("source")?.trim() || undefined;

    const repo = VectorStoreRepository.getInstance();
    const [items, stats] = await Promise.all([
      repo.listVectors(limit, offset, source),
      repo.getStats(),
    ]);

    // Total reflects the filtered document when a source is selected.
    const total = source
      ? (stats.sources.find((s) => s.source === source)?.chunks ?? 0)
      : stats.totalVectors;

    const payload: VectorListResponse = { items, limit, offset, total };
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list vectors.";
    log.error("list vectors failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
