#!/usr/bin/env tsx

/**
 * Parking Dimensions Data Patch
 *
 * Manually patches the parking stall dimensions data that was destroyed by PDF parser.
 * Inserts Section 12.21.A.5 (Parking Stall Dimensions) into the database.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const PATCH_FILE = path.join(__dirname, 'data/parking_patch.txt');

// =============================================================================
// CLIENTS
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function main() {
  console.log('🔧 Starting parking dimensions patch...\n');

  // 1. Find the Chapter I document ID
  console.log('📂 Looking up Chapter I document...');
  const { data: docs, error: docError } = await supabase
    .from('zoning_docs')
    .select('id, slug, code_name')
    .like('slug', 'los-angeles-chapter1%')
    .limit(1);

  if (docError || !docs || docs.length === 0) {
    throw new Error('Chapter I document not found in database');
  }

  const doc = docs[0];
  console.log(`✓ Found: ${doc.code_name} (${doc.id})\n`);

  // 2. Read the patch content
  console.log('📄 Reading patch file...');
  const patchContent = fs.readFileSync(PATCH_FILE, 'utf-8');
  console.log(`✓ Loaded ${patchContent.length} characters\n`);

  // 3. Generate embedding
  console.log('🧮 Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: patchContent,
  });

  const embedding = embeddingResponse.data[0].embedding;
  console.log(`✓ Generated ${embedding.length}-dimensional embedding\n`);

  // 4. Count tokens (rough estimate)
  const tokenCount = Math.ceil(patchContent.length / 4); // Rough estimate

  // 5. Get current max chunk_index for this document
  console.log('🔢 Finding next chunk index...');
  const { data: maxChunk } = await supabase
    .from('zoning_embeddings')
    .select('chunk_index')
    .eq('doc_id', doc.id)
    .order('chunk_index', { ascending: false })
    .limit(1);

  const nextChunkIndex = maxChunk && maxChunk.length > 0 ? maxChunk[0].chunk_index + 1 : 0;
  console.log(`✓ Next chunk index: ${nextChunkIndex}\n`);

  // 6. Insert the patched chunk
  console.log('💾 Inserting patched chunk into database...');
  const { error: insertError } = await supabase
    .from('zoning_embeddings')
    .insert({
      doc_id: doc.id,
      chunk_index: nextChunkIndex,
      content: patchContent,
      section_ref: '12.21.A.5',
      token_count: tokenCount,
      embedding: embedding,
    });

  if (insertError) {
    throw new Error(`Failed to insert chunk: ${insertError.message}`);
  }

  console.log('✓ Patch inserted successfully!\n');

  // 7. Verify insertion
  console.log('🔍 Verifying patch...');
  const { data: verifyChunk, error: verifyError } = await supabase
    .from('zoning_embeddings')
    .select('id, section_ref, content')
    .eq('doc_id', doc.id)
    .eq('section_ref', '12.21.A.5')
    .limit(1);

  if (verifyError || !verifyChunk || verifyChunk.length === 0) {
    throw new Error('Verification failed - chunk not found after insertion');
  }

  console.log('✓ Verification successful!');
  console.log(`  ID: ${verifyChunk[0].id}`);
  console.log(`  Section: ${verifyChunk[0].section_ref}`);
  console.log(`  Content preview: ${verifyChunk[0].content.substring(0, 100)}...\n`);

  console.log('✅ Parking dimensions patch completed successfully!');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
