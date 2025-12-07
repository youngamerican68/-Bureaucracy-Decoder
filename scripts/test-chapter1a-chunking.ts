#!/usr/bin/env ts-node

/**
 * Test Chapter 1A Parser on Real Data
 *
 * Verifies that the markdown parser correctly chunks Chapter 1A content
 * from the actual scraped data file.
 */

import { chunkMunicipalCode } from '../src/lib/services/chunking';
import fs from 'fs';
import path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCRAPED_FILE = path.join(__dirname, '../.cache/chapter1a-scraped.json');

// =============================================================================
// TEST EXECUTION
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('CHAPTER 1A CHUNKING TEST');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Load scraped data
  console.log('Step 1: Loading scraped data...');
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(`Error: File not found: ${SCRAPED_FILE}`);
    process.exit(1);
  }

  const rawData: Array<{ url: string; content: string }> = JSON.parse(
    fs.readFileSync(SCRAPED_FILE, 'utf-8')
  );
  console.log(`  ✓ Loaded ${rawData.length} articles\n`);

  // Step 2: Test on Article 2 (4-level hierarchy)
  console.log('Step 2: Testing parser on Article 2 (4-level hierarchy test)...');
  const firstArticle = rawData.find(a => a.article === 2) || rawData[0];
  const articleName = firstArticle.url.split('/').pop() || 'unknown';
  console.log(`  Article: ${articleName}`);
  console.log(`  URL: ${firstArticle.url}`);
  console.log(`  Content length: ${firstArticle.content.length.toLocaleString()} chars\n`);

  // Step 3: Chunk the content
  console.log('Step 3: Chunking with polymorphic parser...');
  const chunks = chunkMunicipalCode(firstArticle.content, firstArticle.url);
  console.log(`  ✓ Total chunks: ${chunks.length}\n`);

  if (chunks.length === 0) {
    console.error('✗ FAILED: Parser produced 0 chunks!');
    process.exit(1);
  }

  // Step 4: Display first 3 chunks
  console.log('Step 4: First 3 chunks:');
  console.log('-'.repeat(80));

  const first3 = chunks.slice(0, 3);
  first3.forEach((chunk, idx) => {
    console.log(`\nChunk ${idx + 1}:`);
    console.log(`  Section: ${chunk.section_ref}`);
    console.log(`  Hierarchy: ${chunk.hierarchy}`);
    console.log(`  Heading: ${chunk.heading}`);
    console.log(`  Token count: ${chunk.token_count}`);
    console.log(`  Content preview: ${chunk.full_text.substring(0, 100)}...`);
  });

  // Step 5: Display last 3 chunks
  console.log('\n' + '-'.repeat(80));
  console.log('Step 5: Last 3 chunks:');
  console.log('-'.repeat(80));

  const last3 = chunks.slice(-3);
  last3.forEach((chunk, idx) => {
    console.log(`\nChunk ${chunks.length - 3 + idx + 1}:`);
    console.log(`  Section: ${chunk.section_ref}`);
    console.log(`  Hierarchy: ${chunk.hierarchy}`);
    console.log(`  Heading: ${chunk.heading}`);
    console.log(`  Token count: ${chunk.token_count}`);
    console.log(`  Content preview: ${chunk.full_text.substring(0, 100)}...`);
  });

  // Step 6: Validate hierarchy
  console.log('\n' + '='.repeat(80));
  console.log('Step 6: Validating hierarchy...');
  console.log('='.repeat(80));

  const invalidHierarchies = chunks.filter(c => c.hierarchy === 'Unknown');

  if (invalidHierarchies.length > 0) {
    console.error(`\n✗ FAILED: Found ${invalidHierarchies.length} chunks with "Unknown" hierarchy!`);
    console.error('\nSample invalid chunks:');
    invalidHierarchies.slice(0, 3).forEach(chunk => {
      console.error(`  - Section: ${chunk.section_ref}, Hierarchy: ${chunk.hierarchy}`);
    });
    process.exit(1);
  }

  console.log(`\n✓ PASSED: All ${chunks.length} chunks have valid hierarchy`);

  // Step 7: Summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);
  const avgTokens = Math.round(totalTokens / chunks.length);
  const maxTokens = Math.max(...chunks.map(c => c.token_count));
  const minTokens = Math.min(...chunks.map(c => c.token_count));

  console.log(`\nTotal chunks: ${chunks.length}`);
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Average tokens/chunk: ${avgTokens}`);
  console.log(`Min tokens: ${minTokens}`);
  console.log(`Max tokens: ${maxTokens}`);

  // Extract unique hierarchies
  const uniqueHierarchies = new Set(chunks.map(c => c.hierarchy));
  console.log(`\nUnique hierarchies found: ${uniqueHierarchies.size}`);
  console.log('Sample hierarchies:');
  Array.from(uniqueHierarchies).slice(0, 5).forEach(h => {
    console.log(`  - ${h}`);
  });

  console.log('\n✓ Parser test completed successfully!\n');
}

// =============================================================================
// EXECUTION
// =============================================================================

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
