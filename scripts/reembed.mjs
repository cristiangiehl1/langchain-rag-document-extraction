// Re-embeds every stored chunk IN PLACE using the current EMBEDDING_MODEL.
// Run after changing the embedding model (same 384-dim space required):
//   node --env-file=.env scripts/reembed.mjs
//
// Uses the SAME LangChain class the app uses at query time, so stored vectors
// and query vectors live in exactly the same space (pooling=mean, normalize=true).

import pg from "pg";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

const model =
  process.env.EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env scripts/reembed.mjs");
  process.exit(1);
}

const toVectorLiteral = (arr) => `[${arr.join(",")}]`;

const pool = new pg.Pool({ connectionString });

try {
  const { rows } = await pool.query(
    "SELECT id, content FROM embeddings ORDER BY id",
  );
  if (rows.length === 0) {
    console.log("No stored vectors to re-embed.");
    process.exit(0);
  }

  console.log(`⏳ Re-embedding ${rows.length} chunks with "${model}"…`);
  const embeddings = new HuggingFaceTransformersEmbeddings({
    model,
    pretrainedOptions: { dtype: "fp32" },
  });

  const vectors = await embeddings.embedDocuments(rows.map((r) => r.content));

  const dim = vectors[0]?.length ?? 0;
  console.log(`✅ Generated ${vectors.length} vectors (dim=${dim}).`);
  if (dim !== 384) {
    console.error(
      `✗ Model produced ${dim}-dim vectors, but the column is vector(384). ` +
        `Pick a 384-dim model or change the schema + re-ingest.`,
    );
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i += 1) {
    await pool.query("UPDATE embeddings SET vector = $1 WHERE id = $2", [
      toVectorLiteral(vectors[i]),
      rows[i].id,
    ]);
  }

  console.log(`🎉 Updated ${rows.length} rows in place. Done.`);
} catch (err) {
  console.error("Re-embed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await pool.end();
}
