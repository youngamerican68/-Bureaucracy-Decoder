#!/usr/bin/env ts-node

/**
 * Test Firecrawl CRAWL Mode for Chapter I
 *
 * Tests if crawl mode (following links) can get real content
 * instead of just the navigation shell.
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

// Test on a single Section page that should have real content
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
  console.log('FIRECRAWL CRAWL MODE TEST - CHAPTER I SECTION 12.03');
  console.log('='.repeat(80));
  console.log();
  console.log('Testing URL:', TEST_URL);
  console.log('Section: 12.03 - Definitions');
  console.log();
  console.log('Strategy: Use Firecrawl CRAWL mode with limit=1');
  console.log('  - This should follow the link and get the actual content page');
  console.log('  - Unlike scrape mode which just gets the navigation shell');
  console.log();

  // Start crawl job
  console.log('Starting crawl job...');
  const startResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: TEST_URL,
      limit: 1,  // Just crawl this one page
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 5000,
      },
    }),
  });

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    console.error('Firecrawl API error:', startResponse.status, errorText);
    process.exit(1);
  }

  const startData = await startResponse.json();
  const jobId = startData.id;

  console.log(`✓ Crawl job started: ${jobId}`);
  console.log('  Waiting for completion...\n');

  // Poll for completion
  let completed = false;
  let attempts = 0;
  const maxAttempts = 60;  // 60 attempts * 2 seconds = 2 minutes max

  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds
    attempts++;

    const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Status check error:', statusResponse.status, errorText);
      process.exit(1);
    }

    const statusData = await statusResponse.json();
    const status = statusData.status;

    process.stdout.write(`\r  Attempt ${attempts}/${maxAttempts}: ${status}...`);

    if (status === 'completed') {
      completed = true;
      console.log('\n');

      // Get results
      const pages = statusData.data || [];
      console.log(`✓ Crawl completed: ${pages.length} page(s) scraped\n`);

      if (pages.length === 0) {
        console.error('✗ ERROR: No pages returned!');
        process.exit(1);
      }

      const firstPage = pages[0];
      const markdown = firstPage.markdown || '';

      console.log(`Content length: ${markdown.length.toLocaleString()} characters\n`);

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
        console.log('✓ SUCCESS: Crawl mode got real regulatory content!');
        console.log('  We can use crawl mode to get Chapter I data.');
        console.log();
        console.log('NEXT STEP:');
        console.log('  - Use Firecrawl crawl mode to re-scrape all Chapter I sections');
        console.log('  - Set limit high enough to get all sections');
        console.log('  - Use includePaths pattern to stay within Chapter I');
      } else {
        console.log('⚠️  WARNING: Crawl mode still returning navigation/UI.');
        console.log('  May need to try a different approach (PDF download).');
      }

    } else if (status === 'failed') {
      console.log('\n');
      console.error('✗ Crawl job failed!');
      console.error('Error:', statusData.error || 'Unknown error');
      process.exit(1);
    }
  }

  if (!completed) {
    console.log('\n');
    console.error('✗ Timeout: Crawl job did not complete in 2 minutes');
    process.exit(1);
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
