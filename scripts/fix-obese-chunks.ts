#!/usr/bin/env tsx

/**
 * Fix Obese Chunks (>2000 tokens)
 *
 * Large chunks dilute retrieval precision for specific rules.
 * This script splits oversized chunks into smaller subsections based on headers.
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CHUNK_SIZE_THRESHOLD = 2000;
const BATCH_SIZE = 10;

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
// HELPER FUNCTIONS
// =============================================================================

interface Section {
  header: string;
  content: string;
  startIndex: number;
}

/**
 * Split content by headers (A., 1., EXCEPTION:, etc.)
 */
function splitByHeaders(content: string): Section[] | null {
  // Try multiple header patterns
  const patterns = [
    /^\s*([A-Z])\.\s+(.+?)$/gm,        // A. Use, B. Area, etc.
    /^\s*([0-9]+)\.\s+(.+?)$/gm,       // 1. Scope, 2. Purpose, etc.
    /^\s*(EXCEPTION):\s*/gm,            // EXCEPTION:
    /^\s*\(([a-z])\)\s+(.+?)$/gm,      // (a) Description, (b) Rules, etc.
  ];

  for (const pattern of patterns) {
    const sections: Section[] = [];
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    pattern.lastIndex = 0;

    while ((match = pattern.exec(content)) !== null) {
      matches.push({ ...match } as RegExpExecArray);
    }

    if (matches.length < 2) {
      // Need at least 2 sections to split
      continue;
    }

    // Build sections
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];

      const header = currentMatch[0].trim();
      const startIndex = currentMatch.index!;
      const endIndex = nextMatch ? nextMatch.index! : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();

      sections.push({
        header,
        content: sectionContent,
        startIndex,
      });
    }

    if (sections.length >= 2) {
      console.log(`   ✓ Found ${sections.length} subsections using pattern: ${pattern.source.substring(0, 50)}...`);
      return sections;
    }
  }

  console.log('   ⚠ No splittable headers found');
  return null;
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// MAIN PROCESSING
// =============================================================================

async function processObeseChunk(chunk: any): Promise<boolean> {
  console.log(`\n📦 Processing chunk ID ${chunk.id}:`);
  console.log(`   Section: ${chunk.section_ref || 'N/A'}`);
  console.log(`   Tokens: ${chunk.token_count}`);
  console.log(`   Length: ${chunk.content.length} characters`);

  // Try to split by headers
  const sections = splitByHeaders(chunk.content);

  if (!sections) {
    console.log('   ⚠ Cannot split - leaving as-is');
    return false;
  }

  // Check if splitting actually helps
  const maxSubsectionTokens = Math.max(...sections.map(s => estimateTokens(s.content)));
  if (maxSubsectionTokens > CHUNK_SIZE_THRESHOLD) {
    console.log(`   ⚠ Largest subsection still ${maxSubsectionTokens} tokens - skipping`);
    return false;
  }

  console.log(`   ✓ Splitting into ${sections.length} subsections...\n`);

  // Generate embeddings for each subsection
  const newChunks = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const tokenCount = estimateTokens(section.content);

    console.log(`   [${i + 1}/${sections.length}] ${section.header.substring(0, 40)}... (${tokenCount} tokens)`);

    const embedding = await generateEmbedding(section.content);

    // Create section reference
    let sectionRef = chunk.section_ref;
    if (sectionRef) {
      // Try to extract subsection identifier from header
      const subsectionMatch = section.header.match(/^([A-Z0-9]+)\./);
      if (subsectionMatch) {
        sectionRef = `${chunk.section_ref}.${subsectionMatch[1]}`;
      }
    }

    newChunks.push({
      doc_id: chunk.doc_id,
      chunk_index: chunk.chunk_index + i,
      content: section.content,
      section_ref: sectionRef,
      token_count: tokenCount,
      embedding: embedding,
    });
  }

  // Delete old chunk
  console.log(`\n   🗑️  Deleting old chunk ID ${chunk.id}...`);
  const { error: deleteError } = await supabase
    .from('zoning_embeddings')
    .delete()
    .eq('id', chunk.id);

  if (deleteError) {
    throw new Error(`Delete failed: ${deleteError.message}`);
  }

  // Insert new chunks
  console.log(`   💾 Inserting ${newChunks.length} new chunks...`);
  const { error: insertError } = await supabase
    .from('zoning_embeddings')
    .insert(newChunks);

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  console.log(`   ✅ Successfully split chunk ID ${chunk.id}`);
  return true;
}

async function main() {
  console.log('🔧 Starting Obese Chunk Fix...\n');
  console.log(`Threshold: ${CHUNK_SIZE_THRESHOLD} tokens`);
  console.log(`Batch size: ${BATCH_SIZE} chunks\n`);

  // 1. Find all obese chunks
  console.log('📂 Querying for obese chunks (>2000 tokens)...');
  const { data: obeseChunks, error: queryError } = await supabase
    .from('zoning_embeddings')
    .select('*')
    .gt('token_count', CHUNK_SIZE_THRESHOLD)
    .order('token_count', { ascending: false });

  if (queryError) {
    throw new Error(`Query failed: ${queryError.message}`);
  }

  if (!obeseChunks || obeseChunks.length === 0) {
    console.log('✓ No obese chunks found!');
    return;
  }

  console.log(`✓ Found ${obeseChunks.length} obese chunks\n`);
  console.log('Top 5 largest:');
  obeseChunks.slice(0, 5).forEach((chunk, i) => {
    console.log(`   ${i + 1}. ID ${chunk.id}: ${chunk.section_ref || 'N/A'} (${chunk.token_count} tokens)`);
  });

  // 2. Process in batches
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < obeseChunks.length; i += BATCH_SIZE) {
    const batch = obeseChunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(obeseChunks.length / BATCH_SIZE);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`BATCH ${batchNum}/${totalBatches} (Chunks ${i + 1}-${Math.min(i + BATCH_SIZE, obeseChunks.length)})`);
    console.log('='.repeat(70));

    for (const chunk of batch) {
      try {
        const success = await processObeseChunk(chunk);
        if (success) {
          successCount++;
        } else {
          skipCount++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing chunk ${chunk.id}:`, error.message);
        errorCount++;
      }
    }

    // Rate limiting pause between batches
    if (i + BATCH_SIZE < obeseChunks.length) {
      console.log('\n⏸️  Pausing 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 3. Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total obese chunks processed: ${obeseChunks.length}`);
  console.log(`✅ Successfully split: ${successCount}`);
  console.log(`⏭️  Skipped (unsplittable): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // 4. Verify remaining obese chunks
  console.log('\n🔍 Checking remaining obese chunks...');
  const { data: remainingObese, error: verifyError } = await supabase
    .from('zoning_embeddings')
    .select('id, section_ref, token_count')
    .gt('token_count', CHUNK_SIZE_THRESHOLD)
    .order('token_count', { ascending: false });

  if (verifyError) {
    throw new Error(`Verification failed: ${verifyError.message}`);
  }

  console.log(`\nRemaining obese chunks: ${remainingObese?.length || 0}`);
  if (remainingObese && remainingObese.length > 0) {
    console.log('\nTop 10 remaining:');
    remainingObese.slice(0, 10).forEach((chunk, i) => {
      console.log(`   ${i + 1}. ID ${chunk.id}: ${chunk.section_ref || 'N/A'} (${chunk.token_count} tokens)`);
    });
  }

  console.log('\n✅ Obese chunk fix completed!');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
