#!/usr/bin/env ts-node

/**
 * Prove Chapter I Real Data Exists
 *
 * Tests if we can scrape actual regulatory content from a specific
 * Chapter I section by waiting for JavaScript to load.
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEST_URL = 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-111175';
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
  console.log('CHAPTER I SECTION 12.03 - PROVE REAL DATA EXISTS');
  console.log('='.repeat(80));
  console.log();
  console.log('Testing URL:', TEST_URL);
  console.log('Section: 12.03 - Definitions');
  console.log();

  // Test 1: Scrape WITH Firecrawl V2 (better JS handling)
  console.log('Test 1: Scraping with Firecrawl V2...');

  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: TEST_URL,
      formats: ['markdown'],
      onlyMainContent: false,  // V2: Keep all content, don't strip aggressively
      waitFor: 5000,  // Wait 5 seconds for JS to load
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

  // Show first 2000 chars
  console.log('First 2000 characters:');
  console.log('='.repeat(80));
  console.log(markdown.substring(0, 2000));
  console.log('='.repeat(80));
  console.log();

  // Check for real content
  const hasDefinitions = markdown.toLowerCase().includes('definition') ||
                        markdown.toLowerCase().includes('shall mean') ||
                        markdown.toLowerCase().includes('means');

  const hasSectionHeaders = /SEC\.\s+12\./i.test(markdown) || /Section\s+12\./i.test(markdown);

  const hasRegulatoryText = markdown.toLowerCase().includes('permitted') ||
                           markdown.toLowerCase().includes('prohibited') ||
                           markdown.toLowerCase().includes('shall') ||
                           markdown.toLowerCase().includes('required');

  console.log('CONTENT ANALYSIS:');
  console.log('-'.repeat(80));
  console.log('Contains definition language:', hasDefinitions ? '✓ YES' : '✗ NO');
  console.log('Contains SEC. 12.X headers:', hasSectionHeaders ? '✓ YES' : '✗ NO');
  console.log('Contains regulatory keywords:', hasRegulatoryText ? '✓ YES' : '✗ NO');
  console.log();

  if (hasDefinitions && hasSectionHeaders) {
    console.log('✓ SUCCESS: This URL contains real regulatory content!');
    console.log('  We can use this approach to re-scrape Chapter I correctly.');
  } else {
    console.log('⚠️  WARNING: Content still looks like navigation/UI.');
    console.log('  May need different wait strategy or selector.');
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
