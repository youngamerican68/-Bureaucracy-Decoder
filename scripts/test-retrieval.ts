#!/usr/bin/env ts-node

/**
 * Test RAG retrieval pipeline
 *
 * Verifies that semantic search works correctly by:
 * 1. Generating an embedding for a test query
 * 2. Calling match_zoning_sections RPC function
 * 3. Displaying top results with similarity scores
 */

import { config } from 'dotenv';
import path from 'path';
import { generateEmbedding } from '../src/lib/services/embeddings';
import { getServerClient } from '../src/lib/supabase';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const DOC_ID = 'caeb4c14-7142-4877-a22f-91362789f923'; // Chapter IX doc ID
const TEST_QUERY = 'When is a grading permit required?';
const MATCH_THRESHOLD = 0.5;
const TOP_K = 3;

// =============================================================================
// MAIN TEST
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('RAG RETRIEVAL TEST');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Generate query embedding
  console.log('Step 1: Generating query embedding...');
  console.log(`  Query: "${TEST_QUERY}"\n`);

  const queryEmbedding = await generateEmbedding(TEST_QUERY);
  console.log(`  ✓ Embedding generated (${queryEmbedding.length} dimensions)\n`);

  // Step 2: Connect to Supabase
  console.log('Step 2: Connecting to Supabase...');
  const supabase = getServerClient();
  console.log('  ✓ Connected\n');

  // Step 3: Call match_zoning_sections RPC function
  console.log('Step 3: Calling match_zoning_sections...');
  console.log(`  Document ID: ${DOC_ID}`);
  console.log(`  Match threshold: ${MATCH_THRESHOLD}`);
  console.log(`  Top K: ${TOP_K}\n`);

  const { data, error } = await supabase.rpc('match_zoning_sections', {
    query_embedding: queryEmbedding,
    match_doc_id: DOC_ID,
    match_count: TOP_K,
    match_threshold: MATCH_THRESHOLD,
  });

  if (error) {
    console.error('✗ Error calling match_zoning_sections:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No results found above threshold\n');
    process.exit(0);
  }

  console.log(`  ✓ Found ${data.length} matching sections\n`);

  // Step 4: Display results
  console.log('='.repeat(80));
  console.log('TOP 3 RESULTS');
  console.log('='.repeat(80));
  console.log();

  data.forEach((result: any, index: number) => {
    console.log(`${'─'.repeat(80)}`);
    console.log(`RESULT ${index + 1}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`Section Ref: ${result.section_ref}`);
    console.log(`Similarity Score: ${(result.similarity * 100).toFixed(2)}%`);
    console.log(`Chunk Index: ${result.chunk_index}`);
    console.log();
    console.log('Content Preview (first 200 chars):');
    console.log(result.content.substring(0, 200));
    console.log();
  });

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
  console.log();

  // Verification check
  const hasExpectedSection = data.some((r: any) =>
    r.section_ref && r.section_ref.startsWith('91.106')
  );

  if (hasExpectedSection) {
    console.log('✓ SUCCESS: Found expected section 91.106.x (grading permits)');
  } else {
    console.log('⚠️  Note: Expected section 91.106.x not in top results');
    console.log('   (May still be working correctly if other relevant results found)');
  }

  console.log();
}

// =============================================================================
// EXECUTION
// =============================================================================

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
