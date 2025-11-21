#!/usr/bin/env node

/**
 * Scrape all LA Municipal Code Chapter IX - Building Regulations
 * This includes all building codes, electrical, plumbing, mechanical, etc.
 */

const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE_URL = 'https://codelibrary.amlegal.com';

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY environment variable not set');
  process.exit(1);
}

// Chapter IX: Building Regulations (11 articles)
const chapter9URLs = [
  '/codes/los_angeles/latest/lamc/0-0-0-172082',  // Chapter IX Root: Building Regulations
  '/codes/los_angeles/latest/lamc/0-0-0-172105',  // Article 1: Buildings [Building Code]
  '/codes/los_angeles/latest/lamc/0-0-0-294126',  // Article 1.2: Existing Building Code
  '/codes/los_angeles/latest/lamc/0-0-0-182923',  // Article 1.5: Los Angeles Residential Code
  '/codes/los_angeles/latest/lamc/0-0-0-182925',  // Article 2: Elevator Code
  '/codes/los_angeles/latest/lamc/0-0-0-183611',  // Article 3: Electrical Code
  '/codes/los_angeles/latest/lamc/0-0-0-185063',  // Article 4: Plumbing Code
  '/codes/los_angeles/latest/lamc/0-0-0-187350',  // Article 5: Mechanical Code
  '/codes/los_angeles/latest/lamc/0-0-0-188547',  // Article 6: Miscellaneous
  '/codes/los_angeles/latest/lamc/0-0-0-188922',  // Article 7: Boilers, Unfired Pressure Vessels
  '/codes/los_angeles/latest/lamc/0-0-0-189339',  // Article 8: General Administrative Provisions
  '/codes/los_angeles/latest/lamc/0-0-0-214608',  // Article 9: Green Building Code
];

const allURLs = chapter9URLs.map(p => `${BASE_URL}${p}`);

console.log(`Scraping ${allURLs.length} LA Municipal Code Chapter IX (Building) articles...\n`);

async function scrapeChapter9() {
  try {
    const results = [];
    const DELAY_MS = 3000; // 3 seconds between requests to avoid rate limiting

    for (let i = 0; i < allURLs.length; i++) {
      const url = allURLs[i];
      const articleNum = i + 1;

      process.stdout.write(`Scraping ${articleNum}/${allURLs.length}: ${url.split('/').pop()}...`);

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
          results.push({
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
      if (i < allURLs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`\n✓ Scraped ${results.length}/${allURLs.length} articles`);

    // Save results
    const outputDir = path.join(__dirname, '../.cache');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'chapter9-building-scraped.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`Saved to: ${outputPath}`);

    // Calculate totals
    const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);
    console.log(`Total content: ${totalChars.toLocaleString()} characters`);

  } catch (error) {
    console.error('\nError during scraping:', error);
    process.exit(1);
  }
}

scrapeChapter9();
