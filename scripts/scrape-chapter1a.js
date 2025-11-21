#!/usr/bin/env node

/**
 * Scrape all 15 Chapter 1A articles from zoning.lacity.gov
 */

const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE_URL = 'https://zoning.lacity.gov/browse';

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY environment variable not set');
  process.exit(1);
}

// Chapter 1A has 15 articles
const articleNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const articleURLs = articleNumbers.map(num => ({
  number: num,
  url: `${BASE_URL}/${num}`,
  title: `Article ${num}`
}));

console.log(`Scraping ${articleURLs.length} Chapter 1A articles from zoning.lacity.gov\n`);

async function scrapeChapter1A() {
  try {
    const results = [];
    const DELAY_MS = 3000; // 3 seconds between requests to avoid rate limiting

    for (let i = 0; i < articleURLs.length; i++) {
      const { number, url, title } = articleURLs[i];
      const articleNum = i + 1;

      process.stdout.write(`Scraping ${articleNum}/${articleURLs.length}: ${title}...`);

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
            article: number,
            title,
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
      if (i < articleURLs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`\n✓ Scraped ${results.length}/${articleURLs.length} articles`);

    // Save results
    const outputDir = path.join(__dirname, '../.cache');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'chapter1a-scraped.json');
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

scrapeChapter1A();
