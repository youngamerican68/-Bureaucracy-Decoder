#!/usr/bin/env tsx

/**
 * Chapter IX PDF Ingestion
 *
 * Reads Chapter IX (Building Regulations) from PDF, chunks it, generates embeddings, and stores in Supabase.
 * This replaces the thin article-level data that was scraped from the web.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { chunkMunicipalCode } from '../src/lib/services/chunking';
import pdfParse from 'pdf-parse';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const PDF_PATH = path.join(__dirname, '../.cache/chapter9.pdf');
const DOC_SLUG = 'los-angeles-chapter9';
const CITY_NAME = 'Los Angeles';
const CODE_NAME = 'Chapter IX - Building Regulations';
const SOURCE_URL = 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-172082';

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

/**
 * Clean PDF text by removing headers, footers, and artifacts
 */
function cleanPDFText(text: string): string {
  let cleaned = text;

  // Remove page numbers (e.g., "Page 1 of 500")
  cleaned = cleaned.replace(/Page \d+ of \d+/g, '');

  // Remove chapter headers that appear on every page
  cleaned = cleaned.replace(/^CHAPTER IX\s+BUILDING REGULATIONS.*$/gm, '');
  cleaned = cleaned.replace(/^BUILDING REGULATIONS.*$/gm, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

  return cleaned;
}

/**
 * Generate embedding for a text chunk
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
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN LOGIC
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('CHAPTER IX PDF INGESTION');
  console.log('='.repeat(80));
  console.log();

  // =========================================================================
  // PHASE 1: READ THE PDF
  // =========================================================================

  console.log('PHASE 1: Reading PDF...');
  console.log('-'.repeat(80));

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`✗ PDF not found: ${PDF_PATH}`);
    console.log('Please ensure chapter1.pdf is in the .cache directory');
    process.exit(1);
  }

  const dataBuffer = fs.readFileSync(PDF_PATH);
  console.log(`  ✓ Loaded PDF: ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  const pdfData = await pdfParse(dataBuffer);
  console.log(`  ✓ Pages: ${pdfData.numpages}`);
  console.log(`  ✓ Raw text length: ${pdfData.text.length.toLocaleString()} characters`);
  console.log();

  // Clean the text
  console.log('Cleaning PDF text (removing headers/footers)...');
  const cleanedText = cleanPDFText(pdfData.text);
  console.log(`  ✓ Cleaned text length: ${cleanedText.length.toLocaleString()} characters`);
  console.log();

  // Show preview
  console.log('First 500 characters of cleaned text:');
  console.log('-'.repeat(80));
  console.log(cleanedText.substring(0, 500));
  console.log('-'.repeat(80));
  console.log();

  // Chunk the text
  console.log('Chunking text with Legacy Mode parser...');
  const chunks = chunkMunicipalCode(cleanedText, SOURCE_URL);
  console.log(`  ✓ Produced ${chunks.length} chunks`);
  console.log();

  if (chunks.length === 0) {
    console.error('✗ ERROR: Parser produced 0 chunks!');
    console.log('The PDF text may not be in the expected format.');
    process.exit(1);
  }

  // Calculate stats
  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.token_count, 0);
  const avgTokens = Math.round(totalTokens / chunks.length);
  const oversizedChunks = chunks.filter(c => c.token_count > 7500).length;

  console.log('Chunk Statistics:');
  console.log(`  Total chunks: ${chunks.length}`);
  console.log(`  Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`  Average tokens/chunk: ${avgTokens}`);
  console.log(`  Oversized chunks (>7500 tokens): ${oversizedChunks}`);
  console.log();

  // =========================================================================
  // PHASE 2: DELETE GHOST DATA & PREPARE DATABASE
  // =========================================================================

  console.log('PHASE 2: Preparing database...');
  console.log('-'.repeat(80));

  // Get the document ID
  const { data: docData, error: docError } = await supabase
    .from('zoning_docs')
    .select('id')
    .eq('slug', DOC_SLUG)
    .single();

  if (docError || !docData) {
    console.error('✗ Document not found:', docError);
    process.exit(1);
  }

  const docId = docData.id;
  console.log(`  ✓ Found document ID: ${docId}`);

  // Delete old ghost data chunks
  console.log('  Deleting old ghost data...');
  const { error: deleteError } = await supabase
    .from('zoning_embeddings')
    .delete()
    .eq('doc_id', docId);

  if (deleteError) {
    console.error('✗ Error deleting old chunks:', deleteError);
    process.exit(1);
  }
  console.log('  ✓ Deleted old chunks');

  // Update document status
  const { error: updateError } = await supabase
    .from('zoning_docs')
    .update({ status: 'ingesting' })
    .eq('id', docId);

  if (updateError) {
    console.error('✗ Error updating document status:', updateError);
    process.exit(1);
  }
  console.log('  ✓ Updated document status to "ingesting"');
  console.log();

  // =========================================================================
  // PHASE 3: GENERATE EMBEDDINGS & INSERT
  // =========================================================================

  console.log('PHASE 3: Generating embeddings and inserting chunks...');
  console.log('-'.repeat(80));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk.full_text);

      // Insert chunk
      const { error: insertError } = await supabase
        .from('zoning_embeddings')
        .insert({
          doc_id: docId,
          chunk_index: i,
          section_ref: chunk.section_ref,
          content: chunk.full_text,
          token_count: chunk.token_count,
          hierarchy: chunk.hierarchy,
          embedding: embedding,
        });

      if (insertError) {
        console.error(`✗ Error inserting chunk ${i + 1}:`, insertError);
        errorCount++;
      } else {
        successCount++;
        if ((i + 1) % 50 === 0) {
          console.log(`  ✓ Inserted ${i + 1}/${chunks.length} chunks...`);
        }
      }

      // Rate limiting: OpenAI has limits on embeddings API
      if ((i + 1) % 100 === 0) {
        await sleep(1000); // Sleep 1 second every 100 chunks
      }

    } catch (error) {
      console.error(`✗ Error processing chunk ${i + 1}:`, error);
      errorCount++;
    }
  }

  console.log();
  console.log(`  ✓ Successfully inserted: ${successCount} chunks`);
  if (errorCount > 0) {
    console.log(`  ✗ Failed: ${errorCount} chunks`);
  }
  console.log();

  // Update document status to completed
  const { error: completeError } = await supabase
    .from('zoning_docs')
    .update({ status: 'indexed' })
    .eq('id', docId);

  if (completeError) {
    console.error('✗ Error updating document status:', completeError);
  } else {
    console.log('  ✓ Updated document status to "indexed"');
  }
  console.log();

  // =========================================================================
  // PHASE 4: VERIFICATION
  // =========================================================================

  console.log('PHASE 4: Verifying ingestion...');
  console.log('-'.repeat(80));

  // Count total chunks
  const { count, error: countError } = await supabase
    .from('zoning_embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('doc_id', docId);

  if (countError) {
    console.error('✗ Error counting chunks:', countError);
  } else {
    console.log(`  ✓ Total chunks in database: ${count}`);
  }

  // Find parking section (12.21)
  console.log();
  console.log('  Critical Check: Finding parking section (12.21)...');
  const { data: parkingChunks, error: parkingError } = await supabase
    .from('zoning_embeddings')
    .select('section_ref, content')
    .eq('doc_id', docId)
    .ilike('section_ref', '%12.21%')
    .limit(1);

  if (parkingError) {
    console.error('✗ Error finding parking section:', parkingError);
  } else if (!parkingChunks || parkingChunks.length === 0) {
    console.log('  ⚠️  WARNING: No parking section (12.21) found!');
  } else {
    const parkingChunk = parkingChunks[0];
    console.log('  ✓ Found parking section!');
    console.log();
    console.log('  Section:', parkingChunk.section_ref);
    console.log('  Content preview (first 300 chars):');
    console.log('  ' + '-'.repeat(78));
    console.log('  ' + parkingChunk.content.substring(0, 300).replace(/\n/g, '\n  '));
    console.log('  ' + '-'.repeat(78));
  }

  console.log();
  console.log('='.repeat(80));
  console.log('✓ CHAPTER IX PDF INGESTION COMPLETE');
  console.log('='.repeat(80));
  console.log();
  console.log('Summary:');
  console.log(`  - Source: ${PDF_PATH}`);
  console.log(`  - Pages: ${pdfData.numpages}`);
  console.log(`  - Chunks: ${chunks.length}`);
  console.log(`  - Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`  - Average tokens/chunk: ${avgTokens}`);
  console.log(`  - Successfully inserted: ${successCount}`);
  if (errorCount > 0) {
    console.log(`  - Failed: ${errorCount}`);
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
