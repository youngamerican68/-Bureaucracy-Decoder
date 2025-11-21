#!/usr/bin/env node

/**
 * Scrape all LA Municipal Code zoning articles (Chapter 1 + Chapter 1A)
 * Uses Firecrawl batch scrape API for efficient parallel scraping
 */

const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE_URL = 'https://codelibrary.amlegal.com';

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY environment variable not set');
  process.exit(1);
}

// Chapter 1: Original Zoning Code (applies to most of LA)
const chapter1URLs = [
  '/codes/los_angeles/latest/lamc/0-0-0-107408',  // Root: General Provisions and Zoning
  '/codes/los_angeles/latest/lamc/0-0-0-107445',  // General Planning Department Information
  '/codes/los_angeles/latest/lamc/0-0-0-107492',  // Article 1 General Provisions
  '/codes/los_angeles/latest/lamc/0-0-0-225704',  // Article 1.2 Administrative Citations
  '/codes/los_angeles/latest/lamc/0-0-0-107689',  // Article 1.5 Planning
  '/codes/los_angeles/latest/lamc/0-0-0-108121',  // Article 2 Specific Planning
  '/codes/los_angeles/latest/lamc/0-0-0-118494',  // Article 2.9 Condominiums
  '/codes/los_angeles/latest/lamc/0-0-0-118838',  // Article 3 Specific Plan
  '/codes/los_angeles/latest/lamc/0-0-0-120465',  // Article 4 Public Benefit Projects
  '/codes/los_angeles/latest/lamc/0-0-0-120865',  // Article 4.3 Eldercare Facility
  '/codes/los_angeles/latest/lamc/0-0-0-199272',  // Article 4.4 Sign Regulations
  '/codes/los_angeles/latest/lamc/0-0-0-120917',  // Article 4.5 Transfer of Floor Area Rights
  '/codes/los_angeles/latest/lamc/0-0-0-121249',  // Article 5 Referrals
  '/codes/los_angeles/latest/lamc/0-0-0-121277',  // Article 6 Local Emergency
  '/codes/los_angeles/latest/lamc/0-0-0-121475',  // Article 6.1 Review of Development Projects
  '/codes/los_angeles/latest/lamc/0-0-0-121821',  // Article 7 Division of Land
  '/codes/los_angeles/latest/lamc/0-0-0-123254',  // Article 8 Private Street Regulations
  '/codes/los_angeles/latest/lamc/0-0-0-123503',  // Article 9 Fees
];

// Chapter 1A: New Zoning Code (Downtown only)
const chapter1AURLs = [
  '/codes/los_angeles/latest/lamc/0-0-0-423586',  // Article 1 Introductory Provisions
  '/codes/los_angeles/latest/lamc/0-0-0-423593',  // Article 2 Form
  '/codes/los_angeles/latest/lamc/0-0-0-423600',  // Article 3 Frontage
  '/codes/los_angeles/latest/lamc/0-0-0-423607',  // Article 4 Development Standards
  '/codes/los_angeles/latest/lamc/0-0-0-423614',  // Article 5 Use
  '/codes/los_angeles/latest/lamc/0-0-0-423621',  // Article 6 Density
  '/codes/los_angeles/latest/lamc/0-0-0-423628',  // Article 7 Alternate Typologies
  '/codes/los_angeles/latest/lamc/0-0-0-423635',  // Article 8 Supplemental & Special Zoning
  '/codes/los_angeles/latest/lamc/0-0-0-423642',  // Article 9 Public Benefit Systems
  '/codes/los_angeles/latest/lamc/0-0-0-423649',  // Article 10 Streets & Parks
  '/codes/los_angeles/latest/lamc/0-0-0-423656',  // Article 11 Division of Land
  '/codes/los_angeles/latest/lamc/0-0-0-423663',  // Article 12 Nonconformities
  '/codes/los_angeles/latest/lamc/0-0-0-423670',  // Article 13 Administration
  '/codes/los_angeles/latest/lamc/0-0-0-423677',  // Article 14 General Rules
  '/codes/los_angeles/latest/lamc/0-0-0-423684',  // Article 15 Fees
];

const allURLs = [...chapter1URLs, ...chapter1AURLs].map(path => `${BASE_URL}${path}`);

console.log(`Scraping ${allURLs.length} LA Municipal Code articles...`);
console.log(`  - Chapter 1: ${chapter1URLs.length} articles`);
console.log(`  - Chapter 1A: ${chapter1AURLs.length} articles\n`);

async function scrapeArticles() {
  try {
    // Use Firecrawl's scrape endpoint for each URL
    // Note: Firecrawl v1 batch endpoint may not be available, so we'll scrape sequentially
    const results = [];

    for (let i = 0; i < allURLs.length; i++) {
      const url = allURLs[i];
      const articleNum = i + 1;

      process.stdout.write(`Scraping ${articleNum}/${allURLs.length}: ${url.split('/').pop()}...`);

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
        console.error(`\n  ✗ Failed: ${response.status} ${response.statusText}`);
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
        console.error(`\n  ✗ No content returned`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✓ Scraped ${results.length}/${allURLs.length} articles`);

    // Save combined content
    const outputDir = path.join(__dirname, '../.cache');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'la-zoning-scraped.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\nSaved to: ${outputPath}`);

    // Calculate totals
    const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);
    console.log(`Total content: ${totalChars.toLocaleString()} characters`);

  } catch (error) {
    console.error('\nError during scraping:', error);
    process.exit(1);
  }
}

scrapeArticles();
