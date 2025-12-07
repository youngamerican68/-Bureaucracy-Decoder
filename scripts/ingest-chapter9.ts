#!/usr/bin/env ts-node

/**
 * Ingest Chapter IX Building Code into Supabase
 *
 * This script:
 * 1. Loads scraped Chapter IX data
 * 2. Chunks the content using stateful parser
 * 3. Implements "Safety Valve" for oversized chunks (>7000 tokens)
 * 4. Generates embeddings using OpenAI text-embedding-3-large
 * 5. Stores in Supabase zoning_embeddings table
 */

import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { chunkMunicipalCode, RegulationChunk } from '../src/lib/services/chunking';
import { generateEmbeddings, estimateTokenCount } from '../src/lib/services/embeddings';
import { getServerClient } from '../src/lib/supabase';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRAPED_FILE = path.join(__dirname, '../.cache/los_angeles-chapter9-divisions-2025-11-21.json');
const DOC_SLUG = 'los-angeles-chapter9';
const CITY_NAME = 'Los Angeles';
const CODE_NAME = 'Chapter IX - Building Regulations';
const SOURCE_URL = 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-172082';

const TOKEN_LIMIT = 7000; // Safety valve threshold
const MAX_TOKEN_HARD_LIMIT = 7500; // Target 7500 to account for token estimation error (OpenAI's actual limit is 8191)
const EMBEDDING_BATCH_SIZE = 100; // OpenAI batch limit
const DB_INSERT_BATCH_SIZE = 50; // Supabase insert batch size

// =============================================================================
// SAFETY VALVE: Split oversized chunks
// =============================================================================

interface ProcessedChunk {
  content: string;
  section_ref: string;
  token_count: number;
  hierarchy: string;
  source_url?: string;
}

function splitOversizedChunk(chunk: RegulationChunk): ProcessedChunk[] {
  const tokenCount = estimateTokenCount(chunk.full_text);

  // If under limit, return as-is
  if (tokenCount < TOKEN_LIMIT) {
    return [{
      content: chunk.full_text,
      section_ref: chunk.section_ref,
      token_count: tokenCount,
      hierarchy: chunk.hierarchy,
      source_url: chunk.source_url,
    }];
  }

  console.log(`  ⚠️  Chunk ${chunk.section_ref} is ${tokenCount} tokens (exceeds ${TOKEN_LIMIT})`);

  // Attempt to split by subsections (e.g., 91.101.1, 91.101.2)
  const subsectionPattern = /^(\d+\.\d+\.\d+(?:\.\d+)*)\./gm;
  const lines = chunk.full_text.split('\n');
  const subsections: { startLine: number; ref: string }[] = [];

  lines.forEach((line, idx) => {
    const match = line.match(subsectionPattern);
    if (match) {
      subsections.push({ startLine: idx, ref: match[1] });
    }
  });

  // If we found multiple subsections, split by them
  if (subsections.length >= 2) {
    console.log(`    → Splitting into ${subsections.length} subsections`);

    const result: ProcessedChunk[] = [];

    for (let i = 0; i < subsections.length; i++) {
      const startLine = subsections[i].startLine;
      const endLine = i < subsections.length - 1 ? subsections[i + 1].startLine : lines.length;
      const subsectionContent = lines.slice(startLine, endLine).join('\n').trim();
      const subsectionTokens = estimateTokenCount(subsectionContent);

      // If this subsection is still too big, truncate it
      if (subsectionTokens > MAX_TOKEN_HARD_LIMIT) {
        console.log(`    ⚠️  Subsection ${subsections[i].ref} still too large (${subsectionTokens} tokens). Truncating.`);
        // Truncate aggressively and re-check token count
        let truncatedContent = subsectionContent.substring(0, MAX_TOKEN_HARD_LIMIT * 3);
        let actualTokens = estimateTokenCount(truncatedContent);

        // Keep truncating until under limit
        while (actualTokens > MAX_TOKEN_HARD_LIMIT && truncatedContent.length > 100) {
          truncatedContent = truncatedContent.substring(0, Math.floor(truncatedContent.length * 0.9));
          actualTokens = estimateTokenCount(truncatedContent);
        }

        result.push({
          content: truncatedContent,
          section_ref: subsections[i].ref,
          token_count: actualTokens,
          hierarchy: chunk.hierarchy,
          source_url: chunk.source_url,
        });
      } else {
        result.push({
          content: subsectionContent,
          section_ref: subsections[i].ref,
          token_count: subsectionTokens,
          hierarchy: chunk.hierarchy,
          source_url: chunk.source_url,
        });
      }
    }

    return result;
  }

  // Cannot split - truncate and warn
  console.log(`    ⚠️  Cannot split chunk ${chunk.section_ref}. Truncating to ${MAX_TOKEN_HARD_LIMIT} tokens.`);

  // Truncate aggressively and re-check token count
  let truncatedContent = chunk.full_text.substring(0, MAX_TOKEN_HARD_LIMIT * 3);
  let actualTokens = estimateTokenCount(truncatedContent);

  // Keep truncating until under limit
  while (actualTokens > MAX_TOKEN_HARD_LIMIT && truncatedContent.length > 100) {
    truncatedContent = truncatedContent.substring(0, Math.floor(truncatedContent.length * 0.9));
    actualTokens = estimateTokenCount(truncatedContent);
  }

  return [{
    content: truncatedContent,
    section_ref: chunk.section_ref,
    token_count: actualTokens,
    hierarchy: chunk.hierarchy,
    source_url: chunk.source_url,
  }];
}

// =============================================================================
// MAIN INGESTION LOGIC
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('CHAPTER IX BUILDING CODE INGESTION');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Load scraped data
  console.log('Step 1: Loading scraped data...');
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(`Error: File not found: ${SCRAPED_FILE}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf-8'));
  console.log(`  ✓ Loaded ${rawData.results.length} articles\n`);

  // Step 2: Initialize Supabase client
  console.log('Step 2: Connecting to Supabase...');
  const supabase = getServerClient();
  console.log('  ✓ Connected\n');

  // Step 3: Check if zoning_docs record exists, create if needed
  console.log('Step 3: Checking for zoning_docs record...');
  let { data: existingDoc, error: fetchError } = await supabase
    .from('zoning_docs')
    .select('id')
    .eq('slug', DOC_SLUG)
    .single();

  let docId: string;

  if (fetchError && fetchError.code === 'PGRST116') {
    // Record doesn't exist - create it
    console.log('  → Creating new zoning_docs record...');
    const { data: newDoc, error: insertError } = await supabase
      .from('zoning_docs')
      .insert({
        slug: DOC_SLUG,
        city_name: CITY_NAME,
        code_name: CODE_NAME,
        source_url: SOURCE_URL,
        is_featured: true,
        source_type: 'amlegal',
        status: 'ingesting',
      })
      .select('id')
      .single();

    if (insertError || !newDoc) {
      console.error('Error creating zoning_docs record:', insertError);
      process.exit(1);
    }

    docId = newDoc.id;
    console.log(`  ✓ Created with ID: ${docId}\n`);
  } else if (fetchError) {
    console.error('Error fetching zoning_docs:', fetchError);
    process.exit(1);
  } else if (existingDoc) {
    docId = existingDoc.id;
    console.log(`  ✓ Found existing record: ${docId}`);

    // Update status to ingesting
    await supabase
      .from('zoning_docs')
      .update({ status: 'ingesting' })
      .eq('id', docId);

    // Delete existing embeddings for this doc (re-ingestion)
    const { error: deleteError } = await supabase
      .from('zoning_embeddings')
      .delete()
      .eq('doc_id', docId);

    if (deleteError) {
      console.error('Error deleting old embeddings:', deleteError);
    } else {
      console.log('  ✓ Cleared existing embeddings\n');
    }
  } else {
    console.error('Unexpected state: no document found and no error');
    process.exit(1);
  }

  // Step 4: Chunk all articles
  console.log('Step 4: Chunking content...');
  const allChunks: RegulationChunk[] = [];

  for (const article of rawData.results) {
    const articleContent = article.pages.map((p: any) => p.content || '').join('\n\n');
    const chunks = chunkMunicipalCode(articleContent, article.article_url);
    allChunks.push(...chunks);
    console.log(`  → ${article.article}: ${chunks.length} chunks`);
  }

  console.log(`  ✓ Total chunks: ${allChunks.length}\n`);

  // Step 5: Apply Safety Valve
  console.log('Step 5: Applying Safety Valve for oversized chunks...');
  const processedChunks: ProcessedChunk[] = [];
  let splitCount = 0;

  for (const chunk of allChunks) {
    const results = splitOversizedChunk(chunk);
    if (results.length > 1) {
      splitCount++;
    }
    processedChunks.push(...results);
  }

  console.log(`  ✓ Processed ${allChunks.length} → ${processedChunks.length} chunks`);
  console.log(`  ✓ Split ${splitCount} oversized chunks\n`);

  // Step 6: Generate embeddings
  console.log('Step 6: Generating embeddings...');
  console.log(`  Model: text-embedding-3-large (1536 dimensions)`);
  console.log(`  Batch size: ${EMBEDDING_BATCH_SIZE}\n`);

  const chunkTexts = processedChunks.map(c => c.content);
  const embeddings: number[][] = [];

  for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddings(batch);
    embeddings.push(...batchEmbeddings);

    const progress = Math.min(i + EMBEDDING_BATCH_SIZE, chunkTexts.length);
    process.stdout.write(`\r  Progress: ${progress}/${chunkTexts.length} chunks`);
  }

  console.log('\n  ✓ All embeddings generated\n');

  // Step 7: Insert into database
  console.log('Step 7: Inserting into zoning_embeddings...');
  const embeddingRecords = processedChunks.map((chunk, index) => ({
    doc_id: docId,
    chunk_index: index,
    content: chunk.content,
    section_ref: chunk.section_ref,
    hierarchy: chunk.hierarchy,
    token_count: chunk.token_count,
    embedding: embeddings[index],
  }));

  let insertedCount = 0;

  for (let i = 0; i < embeddingRecords.length; i += DB_INSERT_BATCH_SIZE) {
    const batch = embeddingRecords.slice(i, i + DB_INSERT_BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('zoning_embeddings')
      .insert(batch);

    if (insertError) {
      console.error(`\n  Error inserting batch ${i / DB_INSERT_BATCH_SIZE + 1}:`, insertError);

      // Update zoning_docs status to error
      await supabase
        .from('zoning_docs')
        .update({
          status: 'error',
          error_message: `Embedding insert failed: ${insertError.message}`,
        })
        .eq('id', docId);

      process.exit(1);
    }

    insertedCount += batch.length;
    process.stdout.write(`\r  Progress: ${insertedCount}/${embeddingRecords.length} rows inserted`);
  }

  console.log('\n  ✓ All embeddings inserted\n');

  // Step 8: Update zoning_docs status
  console.log('Step 8: Updating zoning_docs status...');
  const { error: updateError } = await supabase
    .from('zoning_docs')
    .update({
      status: 'ingested',
      chunk_count: embeddingRecords.length,
      last_crawled_at: new Date().toISOString(),
    })
    .eq('id', docId);

  if (updateError) {
    console.error('Error updating zoning_docs:', updateError);
    process.exit(1);
  }

  console.log('  ✓ Status updated to "ingested"\n');

  // Final summary
  console.log('='.repeat(80));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nDocument ID: ${docId}`);
  console.log(`Total chunks: ${embeddingRecords.length}`);
  console.log(`Total tokens: ${embeddingRecords.reduce((sum, r) => sum + r.token_count, 0).toLocaleString()}`);
  console.log(`Average tokens/chunk: ${Math.round(embeddingRecords.reduce((sum, r) => sum + r.token_count, 0) / embeddingRecords.length)}`);
  console.log(`\nVerify in Supabase:`);
  console.log(`  SELECT COUNT(*) FROM zoning_embeddings WHERE doc_id = '${docId}';`);
  console.log(`\n✓ Done!\n`);
}

// =============================================================================
// EXECUTION
// =============================================================================

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
