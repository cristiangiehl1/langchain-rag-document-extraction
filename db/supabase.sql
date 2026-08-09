-- Supabase schema for the vector store.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Mirrors db/init/01-init.sql (used by the local Docker Postgres).

-- pgvector lives in the "extensions" schema on Supabase.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Table layout matches the columns configured in src/lib/config.ts.
-- The embedding model produces 384-dimensional vectors.
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
