// Quick retrieval check independent of the dev server.
//   node --env-file=.env scripts/retrieve-test.mjs "pergunta"  [source]
import pg from "pg";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

const model = process.env.EMBEDDING_MODEL;
const question = process.argv[2] ?? "quais as skills que o Cristian Giehl sabe?";
const source = process.argv[3];

const emb = new HuggingFaceTransformersEmbeddings({
  model,
  pretrainedOptions: { dtype: "fp32" },
});
const vec = await emb.embedQuery(question);
const lit = `[${vec.join(",")}]`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const where = source ? `WHERE metadata->>'source' = $2` : "";
const params = source ? [lit, source] : [lit];
const { rows } = await pool.query(
  `SELECT metadata->>'source' AS src, (metadata->>'chunkIndex')::int AS idx,
          1 - (vector <=> $1) AS sim, left(content, 55) AS c
   FROM embeddings ${where}
   ORDER BY vector <=> $1 LIMIT 6`,
  params,
);

console.log(`\nQ: ${question}  ${source ? `(source=${source})` : "(todos)"}\nmodel: ${model}\n`);
console.table(
  rows.map((r) => ({
    src: (r.src ?? "").slice(0, 24),
    idx: r.idx,
    sim: Number(r.sim).toFixed(3),
    trecho: r.c.replace(/\s+/g, " "),
  })),
);
await pool.end();
