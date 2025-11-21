#!/usr/bin/env node

/**
 * Generalized V2 scraper for American Legal Publishing (amlegal.com) cities
 *
 * Uses Firecrawl V2 API with improved performance:
 * - 500% faster with 2-day caching
 * - Better defaults (ad blocking, TLS skip, base64 removal)
 * - Smarter proxy handling (auto stealth retry)
 *
 * Usage:
 *   node scrape-amlegal-divisions.js --city=los_angeles --chapter=chapter9
 *   node scrape-amlegal-divisions.js --city=san_francisco --chapter=planning
 */

const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY environment variable not set');
  process.exit(1);
}

// =============================================================================
// CITY CONFIGURATIONS
// =============================================================================

const CITY_CONFIGS = {
  los_angeles: {
    slug: 'los_angeles',
    code_id: 'lamc',
    name: 'Los Angeles',
    chapters: {
      chapter9: {
        name: 'Chapter IX - Building Regulations',
        articles: [
          {
            name: 'Article 1 - Buildings (Building Code)',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-172105',
            divisions: 97,
          },
          {
            name: 'Article 1.2 - Existing Building Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-294126',
            divisions: 10,
          },
          {
            name: 'Article 1.5 - LA Residential Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-182923',
            divisions: 5,
          },
          {
            name: 'Article 2 - Elevator Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-182925',
            divisions: 8,
          },
          {
            name: 'Article 3 - Electrical Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-183611',
            divisions: 7,
          },
          {
            name: 'Article 4 - Plumbing Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-185063',
            divisions: 21,
          },
          {
            name: 'Article 5 - Mechanical Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-187350',
            divisions: 20,
          },
          {
            name: 'Article 6 - Miscellaneous',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-188547',
            divisions: 5,
          },
          {
            name: 'Article 7 - Boilers, Unfired Pressure Vessels',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-188922',
            divisions: 4,
          },
          {
            name: 'Article 8 - General Administrative Provisions',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-189339',
            divisions: 7,
          },
          {
            name: 'Article 9 - Green Building Code',
            url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-214608',
            divisions: 10,
          },
        ],
      },
    },
  },
  san_francisco: {
    slug: 'san_francisco',
    code_id: 'sf',
    name: 'San Francisco',
    chapters: {
      planning: {
        name: 'Planning Code',
        root_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/',
      },
      building: {
        name: 'Building Code',
        root_url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_building/',
      },
    },
  },
  // Add more amlegal cities here...
};

// =============================================================================
// COMMAND LINE PARSING
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      params[key.slice(2)] = value;
    }
  });

  return params;
}

// =============================================================================
// FIRECRAWL V2 API
// =============================================================================

/**
 * Start a crawl job using V2 API
 */
async function startCrawlV2(url, options = {}) {
  try {
    const crawlConfig = {
      url,
      limit: options.limit || 200,
      maxDiscoveryDepth: options.maxDiscoveryDepth || 2,  // V2 uses maxDiscoveryDepth, not maxDepth
      allowExternalLinks: false,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        // V2 defaults (all enabled automatically):
        // - blockAds: true
        // - skipTlsVerification: true
        // - removeBase64Images: true
        // - maxAge: 172800000 (2-day cache for 500% speed boost)
      },
    };

    const response = await fetch('https://api.firecrawl.dev/v2/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify(crawlConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start crawl: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.success || !data.id) {
      throw new Error('Crawl job did not return an ID');
    }

    return data.id;
  } catch (error) {
    throw new Error(`Crawl start failed: ${error.message}`);
  }
}

/**
 * Check crawl status using V2 API
 */
async function checkCrawlStatusV2(jobId) {
  try {
    const response = await fetch(`https://api.firecrawl.dev/v2/crawl/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Status check failed: ${error.message}`);
  }
}

/**
 * Poll crawl job until completion
 */
async function waitForCrawlV2(jobId) {
  const POLL_INTERVAL = 5000; // 5 seconds
  const MAX_WAIT = 30 * 60 * 1000; // 30 minutes
  const startTime = Date.now();

  console.log(`\nPolling crawl job ${jobId}...`);

  while (true) {
    if (Date.now() - startTime > MAX_WAIT) {
      throw new Error('Crawl timeout exceeded 30 minutes');
    }

    const status = await checkCrawlStatusV2(jobId);

    if (status.status === 'completed') {
      console.log(`\n✓ Crawl completed: ${status.data?.length || 0} pages scraped`);
      return status.data;
    }

    if (status.status === 'failed') {
      throw new Error(`Crawl failed: ${status.error || 'Unknown error'}`);
    }

    // Status is 'scraping' or 'pending'
    const completed = status.completed || 0;
    const total = status.total || '?';
    const creditsUsed = status.creditsUsed || 0;
    process.stdout.write(`\r  Progress: ${completed}/${total} pages (${creditsUsed} credits)...`);

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Scrape single page using V2 API (fallback for small jobs)
 */
async function scrapeSinglePageV2(url) {
  try {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        // V2 defaults automatically applied
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status} ${response.statusText}` };
    }

    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        content: data.data.markdown || '',
        metadata: data.data.metadata,
      };
    }

    return { success: false, error: 'No content returned' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// ARTICLE DIVISION SCRAPING
// =============================================================================

async function scrapeArticleDivisions(article, cityName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Scraping: ${article.name}`);
  console.log(`Expected divisions: ~${article.divisions}`);
  console.log(`URL: ${article.url}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // Start crawl using V2 API
    console.log('\nStarting Firecrawl V2 crawl (with 2-day caching)...');
    const jobId = await startCrawlV2(article.url, {
      maxDiscoveryDepth: 2,
      limit: 150,
    });
    console.log(`Crawl job started: ${jobId}`);

    // Wait for completion
    const results = await waitForCrawlV2(jobId);

    if (!results || results.length === 0) {
      console.log('✗ No content returned from crawl');
      return { article: article.name, pages: [], error: 'No content' };
    }

    // Process V2 results
    const pages = results.map(page => ({
      url: page.metadata?.sourceURL || page.metadata?.url || page.url,
      title: page.metadata?.title || 'Untitled',
      content: page.markdown || page.content || '',
      metadata: page.metadata,
    }));

    console.log(`\n✓ Scraped ${pages.length} pages`);
    console.log(`  Total content: ${pages.reduce((sum, p) => sum + p.content.length, 0).toLocaleString()} characters`);

    return {
      article: article.name,
      article_url: article.url,
      expected_divisions: article.divisions,
      actual_pages: pages.length,
      pages,
      city: cityName,
      api_version: 'v2',
      scraped_at: new Date().toISOString(),
    };

  } catch (error) {
    console.log(`\n✗ Error: ${error.message}`);
    return {
      article: article.name,
      article_url: article.url,
      pages: [],
      error: error.message,
    };
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  const params = parseArgs();

  if (!params.city || !params.chapter) {
    console.error(`
Usage: node scrape-amlegal-divisions.js --city=CITY --chapter=CHAPTER

Available cities:
${Object.keys(CITY_CONFIGS).map(c => `  - ${c}`).join('\n')}

Examples:
  node scrape-amlegal-divisions.js --city=los_angeles --chapter=chapter9
  node scrape-amlegal-divisions.js --city=san_francisco --chapter=planning

Features (Firecrawl V2):
  ✓ 500% faster with 2-day caching
  ✓ Ad blocking enabled by default
  ✓ Smart proxy (auto stealth retry)
  ✓ Clean markdown (base64 images removed)
`);
    process.exit(1);
  }

  const cityConfig = CITY_CONFIGS[params.city];
  if (!cityConfig) {
    console.error(`Error: Unknown city "${params.city}"`);
    console.error(`Available cities: ${Object.keys(CITY_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const chapterConfig = cityConfig.chapters[params.chapter];
  if (!chapterConfig) {
    console.error(`Error: Unknown chapter "${params.chapter}" for city "${params.city}"`);
    console.error(`Available chapters: ${Object.keys(cityConfig.chapters).join(', ')}`);
    process.exit(1);
  }

  console.log(`
${'='.repeat(80)}
AMERICAN LEGAL PUBLISHING DIVISION SCRAPER (V2)
${'='.repeat(80)}

City: ${cityConfig.name} (${params.city})
Chapter: ${chapterConfig.name}
Platform: American Legal Publishing (amlegal.com)
API: Firecrawl V2 (with 2-day caching for 500% speed boost)

`);

  // Scrape all articles in chapter
  const allResults = [];

  if (chapterConfig.articles) {
    // Chapter has multiple articles (like Chapter IX)
    for (let i = 0; i < chapterConfig.articles.length; i++) {
      const article = chapterConfig.articles[i];

      console.log(`\nArticle ${i + 1}/${chapterConfig.articles.length}`);
      const result = await scrapeArticleDivisions(article, cityConfig.name);
      allResults.push(result);

      // Delay between articles to respect rate limit (3 crawls/minute = 20s minimum)
      if (i < chapterConfig.articles.length - 1) {
        console.log('\nWaiting 25 seconds before next article (rate limit: 3 crawls/min)...');
        await new Promise(resolve => setTimeout(resolve, 25000));
      }
    }
  } else if (chapterConfig.root_url) {
    // Single chapter scrape
    console.log('\nScraping single chapter...');
    const jobId = await startCrawlV2(chapterConfig.root_url, {
      maxDiscoveryDepth: 3,
      limit: 300,
    });
    const results = await waitForCrawlV2(jobId);

    allResults.push({
      chapter: chapterConfig.name,
      url: chapterConfig.root_url,
      pages: results,
      city: cityConfig.name,
      api_version: 'v2',
      scraped_at: new Date().toISOString(),
    });
  }

  // Save results
  const outputDir = path.join(__dirname, '../.cache');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = path.join(
    outputDir,
    `${params.city}-${params.chapter}-divisions-${timestamp}.json`
  );

  const finalOutput = {
    city: cityConfig.name,
    city_slug: params.city,
    chapter: params.chapter,
    chapter_name: chapterConfig.name,
    platform: 'American Legal Publishing',
    api_version: 'v2',
    scraped_at: new Date().toISOString(),
    results: allResults,
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SCRAPING COMPLETE');
  console.log(`${'='.repeat(80)}`);
  console.log(`\nSaved to: ${outputPath}`);

  const totalPages = allResults.reduce((sum, r) => sum + (r.pages?.length || 0), 0);
  const totalChars = allResults.reduce((sum, r) => {
    return sum + (r.pages?.reduce((s, p) => s + p.content.length, 0) || 0);
  }, 0);

  console.log(`\nArticles scraped: ${allResults.length}`);
  console.log(`Total pages: ${totalPages}`);
  console.log(`Total content: ${totalChars.toLocaleString()} characters (${(totalChars / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Average per page: ${Math.round(totalChars / totalPages).toLocaleString()} characters`);

  // Check for errors
  const errors = allResults.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e.article}: ${e.error}`));
  }

  console.log('\n✓ Done!\n');
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
