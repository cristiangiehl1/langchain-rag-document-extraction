import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { Document } from "@langchain/core/documents";
import pg, { type PoolConfig } from "pg";
import { CONFIG } from "@/lib/config";
import { EmbeddingsService } from "./embeddings-service";
import type { StoreStats, VectorDetail } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("store");

/**
 * Persistence layer for embeddings in Postgres/pgvector via LangChain's PGVectorStore.
 * Lazy singleton so the store and connection pool are shared across requests.
 */
export class VectorStoreRepository {
  private static instance: VectorStoreRepository | null = null;

  private storePromise: Promise<PGVectorStore> | null = null;
  private pool: pg.Pool | null = null;

  private constructor() {}

  static getInstance(): VectorStoreRepository {
    if (!VectorStoreRepository.instance) {
      VectorStoreRepository.instance = new VectorStoreRepository();
    }
    return VectorStoreRepository.instance;
  }

  private connectionConfig(): PoolConfig {
    const connectionString = CONFIG.postgres.connectionString;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and start the DB with `npm run db:up`.",
      );
    }
    return { connectionString };
  }

  private getStore(): Promise<PGVectorStore> {
    if (!this.storePromise) {
      log.info("initializing pgvector store", {
        table: CONFIG.postgres.tableName,
        distance: CONFIG.postgres.distanceStrategy,
      });
      this.storePromise = PGVectorStore.initialize(
        EmbeddingsService.getInstance().embeddings,
        {
          postgresConnectionOptions: this.connectionConfig(),
          tableName: CONFIG.postgres.tableName,
          columns: CONFIG.postgres.columns,
          distanceStrategy: CONFIG.postgres.distanceStrategy,
        },
      );
    }
    return this.storePromise;
  }

  private getPool(): pg.Pool {
    if (!this.pool) this.pool = new pg.Pool(this.connectionConfig());
    return this.pool;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const end = log.timer("embed + store");
    const store = await this.getStore();
    await store.addDocuments(documents);
    end("documents embedded and stored", { documents: documents.length });
  }

  /**
   * Returns [Document, distance][] — pgvector cosine distance (0 = identical).
   * An optional metadata filter (e.g. { source }) scopes the search.
   */
  async similaritySearchWithScore(
    query: string,
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    const end = log.timer("similarity search");
    const store = await this.getStore();
    const results = await store.similaritySearchWithScore(query, k, filter);
    end("search complete", { topK: k, hits: results.length, filter: filter ?? null });
    return results;
  }

  async getStats(): Promise<StoreStats> {
    const client = this.getPool();
    const table = CONFIG.postgres.tableName;
    const total = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );
    const bySource = await client.query<{ source: string; chunks: string }>(
      `SELECT COALESCE(metadata->>'source', 'unknown') AS source, COUNT(*)::text AS chunks
       FROM ${table}
       GROUP BY 1
       ORDER BY 2 DESC`,
    );
    return {
      totalVectors: Number(total.rows[0]?.count ?? 0),
      sources: bySource.rows.map((r) => ({
        source: r.source,
        chunks: Number(r.chunks),
      })),
    };
  }

  /**
   * Lists stored vectors with metadata and a short preview of each embedding.
   * When `source` is provided, only chunks of that document are returned.
   */
  async listVectors(
    limit: number,
    offset: number,
    source?: string,
  ): Promise<VectorDetail[]> {
    const client = this.getPool();
    const table = CONFIG.postgres.tableName;
    const where = source ? `WHERE metadata->>'source' = $3` : "";
    const params: (string | number)[] = source
      ? [limit, offset, source]
      : [limit, offset];

    const res = await client.query<{
      id: string;
      content: string;
      metadata: Record<string, unknown> | null;
      dim: number;
      preview: number[] | null;
    }>(
      `SELECT
         id,
         content,
         metadata,
         vector_dims(vector) AS dim,
         (vector::real[])[1:8] AS preview
       FROM ${table}
       ${where}
       ORDER BY COALESCE(metadata->>'source', ''),
                COALESCE((metadata->>'chunkIndex')::int, 0)
       LIMIT $1 OFFSET $2`,
      params,
    );

    return res.rows.map((r) => {
      const meta = r.metadata ?? {};
      const chunkIndex = meta["chunkIndex"];
      const ingestedAt = meta["ingestedAt"];
      return {
        id: r.id,
        source: String(meta["source"] ?? "unknown"),
        chunkIndex: typeof chunkIndex === "number" ? chunkIndex : null,
        content: r.content,
        dim: Number(r.dim ?? 0),
        preview: (r.preview ?? []).map((v) => Number(v)),
        ingestedAt: typeof ingestedAt === "string" ? ingestedAt : null,
        metadata: meta,
      };
    });
  }

  async clearAll(): Promise<number> {
    const client = this.getPool();
    const res = await client.query(`DELETE FROM ${CONFIG.postgres.tableName}`);
    const deleted = res.rowCount ?? 0;
    log.warn("cleared all vectors", { deleted });
    return deleted;
  }
}
