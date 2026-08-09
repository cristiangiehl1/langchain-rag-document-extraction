-- Runs automatically on first container start (empty data volume).
-- Enables pgvector and creates the schema used by LangChain's PGVectorStore.

CREATE EXTENSION IF NOT EXISTS vector;

-- Table layout matches the column names configured in src/lib/vectorstore.ts.
-- all-MiniLM-L6-v2 produces 384-dimensional embeddings.
CREATE TABLE IF NOT EXISTS embeddings (
    id       uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content  text,
    metadata jsonb,
    vector   vector(384)
);

-- HNSW index for fast cosine-similarity search.
CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw_idx
    ON embeddings
    USING hnsw (vector vector_cosine_ops);

-- Helps filtering/listing by source document.
CREATE INDEX IF NOT EXISTS embeddings_metadata_source_idx
    ON embeddings ((metadata ->> 'source'));
