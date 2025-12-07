#!/usr/bin/env ts-node

/**
 * Test Script: Verify Chapter I Article 2 Real Content
 *
 * This script tests if we can scrape actual regulatory content (not just TOC)
 * from a specific Chapter I Article URL.
 */

import { config } from 'dotenv';
import path from 'path';
import { chunkMunicipalCode } from '../src/lib/services/chunking';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEST_URL = 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-111141';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY not found in environment');
  process.exit(1);
}

// =============================================================================
// MAIN LOGIC
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('CHAPTER I ARTICLE 2 - REAL CONTENT TEST');
  console.log('='.repeat(80));
  console.log();
  console.log('Testing URL:', TEST_URL);
  console.log('Article: Article 2 - Specific Zones');
  console.log();

  // Step 1: Scrape using Firecrawl V1
  console.log('Step 1: Scraping with Firecrawl V1...');

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: TEST_URL,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl API error:', response.status, errorText);
    process.exit(1);
  }

  const data = await response.json();
  const markdown = data.data?.markdown || '';

  console.log(`  ✓ Scraped ${markdown.length.toLocaleString()} characters\n`);

  if (markdown.length < 100) {
    console.error('✗ ERROR: Scraped content is suspiciously short!');
    console.log('Content:', markdown);
    process.exit(1);
  }

  // Step 2: Show first 2000 chars of raw content
  console.log('Step 2: Raw content preview (first 2000 chars):');
  console.log('-'.repeat(80));
  console.log(markdown.substring(0, 2000));
  console.log('-'.repeat(80));
  console.log();

  // Also show last 1000 chars to see if content is at the end
  console.log('Last 1000 chars:');
  console.log('-'.repeat(80));
  console.log(markdown.substring(Math.max(0, markdown.length - 1000)));
  console.log('-'.repeat(80));
  console.log();

  // Step 3: Chunk the content
  console.log('Step 3: Chunking with polymorphic parser...');
  const chunks = chunkMunicipalCode(markdown, TEST_URL);
  console.log(`  ✓ Produced ${chunks.length} chunks\n`);

  if (chunks.length === 0) {
    console.error('✗ ERROR: Parser produced 0 chunks!');
    console.log('\nThis means the content is not in the expected format.');
    process.exit(1);
  }

  // Step 4: Display first 3 chunks
  console.log('Step 4: First 3 chunks:');
  console.log('='.repeat(80));

  chunks.slice(0, 3).forEach((chunk, idx) => {
    console.log(`\nChunk ${idx + 1}:`);
    console.log(`  Section: ${chunk.section_ref}`);
    console.log(`  Hierarchy: ${chunk.hierarchy}`);
    console.log(`  Heading: ${chunk.heading}`);
    console.log(`  Token count: ${chunk.token_count}`);
    console.log(`  Content length: ${chunk.full_text.length} chars`);
    console.log();
    console.log('  Content preview (first 300 chars):');
    console.log('  ' + '-'.repeat(78));
    console.log('  ' + chunk.full_text.substring(0, 300).replace(/\n/g, '\n  '));
    console.log('  ' + '-'.repeat(78));
  });

  // Step 5: Content quality check
  console.log('\n' + '='.repeat(80));
  console.log('CONTENT QUALITY CHECK');
  console.log('='.repeat(80));

  const hasRealContent = chunks.some(chunk => {
    const text = chunk.full_text.toLowerCase();
    return (
      text.includes('permitted') ||
      text.includes('prohibited') ||
      text.includes('shall') ||
      text.includes('required') ||
      text.includes('allowed') ||
      text.includes('following uses')
    );
  });

  if (hasRealContent) {
    console.log('\n✓ SUCCESS: Chunks contain real regulatory content!');
    console.log('  - Found keywords like "permitted", "prohibited", "shall", etc.');
    console.log('  - This is NOT just a table of contents.');
  } else {
    console.log('\n⚠️  WARNING: Chunks may only contain titles/TOC links.');
    console.log('  - Did not find regulatory keywords in content.');
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
