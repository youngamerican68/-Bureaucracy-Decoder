#!/usr/bin/env tsx

/**
 * Apply Context Window Migration
 *
 * Updates the match_zoning_sections_city_wide function to fetch neighboring chunks
 * for context (chunk_index - 1 and chunk_index + 1).
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQL = `
-- Search across ALL documents for a given city (no doc_id filter)
-- This allows searching across multiple chapters (e.g., LA Chapter 1, 9, 1A)
-- Context Window Strategy: For each matched chunk, also fetch neighboring chunks
-- (chunk_index - 1 and chunk_index + 1) to provide context for orphaned chunks
CREATE OR REPLACE FUNCTION match_zoning_sections_city_wide(
    query_embedding vector(1536),
    city_slug TEXT,
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
    WITH matched_chunks AS (
        -- Step 1: Find top matches via vector search
        SELECT
            ze.id,
            ze.doc_id,
            ze.chunk_index,
            ze.content,
            ze.section_ref,
            1 - (ze.embedding <=> query_embedding) AS similarity
        FROM zoning_embeddings ze
        JOIN zoning_docs zd ON ze.doc_id = zd.id
        WHERE zd.slug LIKE city_slug || '%'
          AND 1 - (ze.embedding <=> query_embedding) > match_threshold
        ORDER BY ze.embedding <=> query_embedding
        LIMIT match_count
    ),
    context_chunks AS (
        -- Step 2: For each matched chunk, fetch the chunk before and after
        SELECT DISTINCT
            ze.id,
            ze.doc_id,
            ze.chunk_index,
            ze.content,
            ze.section_ref,
            COALESCE(mc.similarity, 0.0) AS similarity
        FROM matched_chunks mc
        CROSS JOIN LATERAL (
            -- Get the matched chunk itself
            SELECT mc.id, mc.doc_id, mc.chunk_index, mc.content, mc.section_ref
            UNION ALL
            -- Get the chunk before (chunk_index - 1)
            SELECT ze1.id, ze1.doc_id, ze1.chunk_index, ze1.content, ze1.section_ref
            FROM zoning_embeddings ze1
            WHERE ze1.doc_id = mc.doc_id
              AND ze1.chunk_index = mc.chunk_index - 1
            UNION ALL
            -- Get the chunk after (chunk_index + 1)
            SELECT ze2.id, ze2.doc_id, ze2.chunk_index, ze2.content, ze2.section_ref
            FROM zoning_embeddings ze2
            WHERE ze2.doc_id = mc.doc_id
              AND ze2.chunk_index = mc.chunk_index + 1
        ) ze
    )
    SELECT
        cc.id,
        cc.doc_id,
        cc.chunk_index,
        cc.content,
        cc.section_ref,
        cc.similarity
    FROM context_chunks cc
    ORDER BY cc.similarity DESC, cc.chunk_index ASC;
END;
$$;
`;

async function main() {
  console.log('🔧 Applying Context Window Migration...\n');

  const { error } = await supabase.rpc('exec', { query: SQL });

  if (error) {
    // Try direct execution via raw SQL
    console.log('⚠️  RPC failed, trying direct execution...');

    const { error: directError } = await supabase.from('_migrations').insert({
      name: 'context_window_retrieval',
      executed_at: new Date().toISOString(),
    });

    if (directError && !directError.message.includes('does not exist')) {
      console.error('Error:', directError.message);
    }

    // Execute the SQL directly
    const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Migration failed:', text);
      throw new Error('Failed to apply migration');
    }
  }

  console.log('✅ Context Window Migration applied successfully!\n');
  console.log('📋 Summary:');
  console.log('   - Updated match_zoning_sections_city_wide function');
  console.log('   - Now fetches neighboring chunks (chunk_index ± 1)');
  console.log('   - Orphaned chunks will now have context from surrounding chunks');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
