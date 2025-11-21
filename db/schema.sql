-- The Bureaucracy Decoder - Database Schema
-- Requires pgvector extension for vector similarity search

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- zoning_docs: Represents a single jurisdiction's zoning codebase
-- =============================================================================
CREATE TABLE zoning_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    city_name TEXT NOT NULL,
    code_name TEXT NOT NULL,
    region TEXT,
    source_url TEXT NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE,
    source_type TEXT DEFAULT 'official_site',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ingesting', 'ingested', 'error')),
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    last_crawled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for zoning_docs
CREATE INDEX idx_zoning_docs_is_featured ON zoning_docs(is_featured);
CREATE INDEX idx_zoning_docs_status ON zoning_docs(status);
CREATE INDEX idx_zoning_docs_city_name ON zoning_docs(city_name);

-- =============================================================================
-- zoning_embeddings: Holds chunks and vectors for RAG
-- =============================================================================
CREATE TABLE zoning_embeddings (
    id BIGSERIAL PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES zoning_docs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    section_ref TEXT,
    token_count INTEGER,
    embedding vector(1536), -- text-embedding-3-large with 1536 dimensions (pgvector limit)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for zoning_embeddings
CREATE INDEX idx_zoning_embeddings_doc_id ON zoning_embeddings(doc_id);
CREATE INDEX idx_zoning_embeddings_section_ref ON zoning_embeddings(section_ref);

-- HNSW index for vector similarity search (supports up to 2000 dimensions)
CREATE INDEX idx_zoning_embeddings_embedding ON zoning_embeddings
USING hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- preapproval_requests: Store user requests and results
-- =============================================================================
CREATE TABLE preapproval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES zoning_docs(id) ON DELETE SET NULL,
    city_name TEXT NOT NULL,
    user_input JSONB NOT NULL DEFAULT '{}',
    site_plan_metadata JSONB,
    packet_summary TEXT,
    packet_full JSONB,
    overall_risk TEXT CHECK (overall_risk IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for preapproval_requests
CREATE INDEX idx_preapproval_requests_doc_id ON preapproval_requests(doc_id);
CREATE INDEX idx_preapproval_requests_status ON preapproval_requests(status);
CREATE INDEX idx_preapproval_requests_created_at ON preapproval_requests(created_at DESC);

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_zoning_docs_updated_at
    BEFORE UPDATE ON zoning_docs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preapproval_requests_updated_at
    BEFORE UPDATE ON preapproval_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Vector similarity search function
-- =============================================================================
CREATE OR REPLACE FUNCTION match_zoning_sections(
    query_embedding vector(1536),
    match_doc_id UUID,
    match_count INT DEFAULT 20,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id BIGINT,
    doc_id UUID,
    chunk_index INT,
    content TEXT,
    section_ref TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ze.id,
        ze.doc_id,
        ze.chunk_index,
        ze.content,
        ze.section_ref,
        1 - (ze.embedding <=> query_embedding) AS similarity
    FROM zoning_embeddings ze
    WHERE ze.doc_id = match_doc_id
      AND 1 - (ze.embedding <=> query_embedding) > match_threshold
    ORDER BY ze.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
