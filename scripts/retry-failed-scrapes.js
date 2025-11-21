#!/usr/bin/env node

/**
 * Retry failed article scrapes with longer delays to avoid rate limiting
 */

const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE_URL = 'https://codelibrary.amlegal.com';

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY environment variable not set');
  process.exit(1);
}

// All URLs we need
const allURLs = [
  // Chapter 1
  '/codes/los_angeles/latest/lamc/0-0-0-107408',
  '/codes/los_angeles/latest/lamc/0-0-0-107445',
  '/codes/los_angeles/latest/lamc/0-0-0-107492',
  '/codes/los_angeles/latest/lamc/0-0-0-225704',
  '/codes/los_angeles/latest/lamc/0-0-0-107689',
  '/codes/los_angeles/latest/lamc/0-0-0-108121',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-118494',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-118838',
  '/codes/los_angeles/latest/lamc/0-0-0-120465',
  '/codes/los_angeles/latest/lamc/0-0-0-120865',
  '/codes/los_angeles/latest/lamc/0-0-0-199272',
  '/codes/los_angeles/latest/lamc/0-0-0-120917',
  '/codes/los_angeles/latest/lamc/0-0-0-121249',
  '/codes/los_angeles/latest/lamc/0-0-0-121277',
  '/codes/los_angeles/latest/lamc/0-0-0-121475',
  '/codes/los_angeles/latest/lamc/0-0-0-121821',
  '/codes/los_angeles/latest/lamc/0-0-0-123254',
  '/codes/los_angeles/latest/lamc/0-0-0-123503',  // Missing
  // Chapter 1A
  '/codes/los_angeles/latest/lamc/0-0-0-423586',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423593',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423600',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423607',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423614',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423621',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423628',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423635',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423642',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423649',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423656',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423663',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423670',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423677',  // Missing
  '/codes/los_angeles/latest/lamc/0-0-0-423684',  // Missing
].map(p => `${BASE_URL}${p}`);

async function retryFailedScrapes() {
  try {
    // Load existing results
    const cachePath = path.join(__dirname, '../.cache/la-zoning-scraped.json');
    let existingResults = [];

    if (fs.existsSync(cachePath)) {
      existingResults = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`Loaded ${existingResults.length} existing results\n`);
    }

    // Find missing URLs
    const scrapedURLs = new Set(existingResults.map(r => r.url));
    const missingURLs = allURLs.filter(url => !scrapedURLs.has(url));

    console.log(`Missing ${missingURLs.length} articles:`);
    missingURLs.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url.split('/').pop()}`);
    });
    console.log('');

    if (missingURLs.length === 0) {
      console.log('All articles already scraped!');
      return;
    }

    // Retry with longer delays
    const newResults = [];
    const DELAY_MS = 3000; // 3 seconds between requests

    for (let i = 0; i < missingURLs.length; i++) {
      const url = missingURLs[i];
      const articleNum = i + 1;

      process.stdout.write(`Scraping ${articleNum}/${missingURLs.length}: ${url.split('/').pop()}...`);

      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(` ✗ Failed: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();

        if (data.success && data.data) {
          const content = data.data.markdown || '';
          newResults.push({
            url,
            content,
            metadata: data.data.metadata,
          });
          console.log(` ✓ (${content.length} chars)`);
        } else {
          console.log(` ✗ No content returned`);
        }
      } catch (error) {
        console.log(` ✗ Error: ${error.message}`);
      }

      // Wait before next request to avoid rate limiting
      if (i < missingURLs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // Merge with existing results
    const allResults = [...existingResults, ...newResults];
    console.log(`\n✓ Total scraped: ${allResults.length}/${allURLs.length} articles`);

    // Save combined results
    fs.writeFileSync(cachePath, JSON.stringify(allResults, null, 2));
    console.log(`Saved to: ${cachePath}`);

    // Calculate totals
    const totalChars = allResults.reduce((sum, r) => sum + r.content.length, 0);
    console.log(`Total content: ${totalChars.toLocaleString()} characters`);

  } catch (error) {
    console.error('\nError during retry:', error);
    process.exit(1);
  }
}

retryFailedScrapes();
