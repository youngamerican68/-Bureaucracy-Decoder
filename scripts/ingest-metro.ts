#!/usr/bin/env npx ts-node

/**
 * CLI script to ingest a single metro area's zoning code
 *
 * Usage: npx ts-node scripts/ingest-metro.ts <metro-slug>
 * Example: npx ts-node scripts/ingest-metro.ts los-angeles
 *
 * Available metros can be found in src/lib/featured-metros.ts
 */

import { createClient } from '@supabase/supabase-js';
import { featuredMetros } from '../src/lib/featured-metros';
import { generateEmbeddings, estimateTokenCount } from '../src/lib/services/embeddings';
import { chunkMunicipalCode, RegulationChunk } from '../src/lib/services/chunking';

// Check for required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable: ${envVar}`);
    console.error('\nPlease set up your .env.local file with the required credentials.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchZoningCode(url: string, maxPages: number = 100): Promise<string> {
  console.log(`Fetching zoning code from: ${url}`);

  // Try Firecrawl crawl mode first if available (multi-page)
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      console.log(`Starting Firecrawl crawl (max ${maxPages} pages)...`);

      // Start the crawl job
      const crawlResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          limit: maxPages,
          maxDiscoveryDepth: 2, // Limit crawl depth: 0=start page, 1=direct links, 2=subsections
          allowExternalLinks: false, // Stay on same domain
          deduplicateSimilarURLs: true, // Avoid duplicate content
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
          },
        }),
      });

      if (!crawlResponse.ok) {
        const errorText = await crawlResponse.text();
        throw new Error(`Crawl request failed: ${crawlResponse.status} ${errorText}`);
      }

      const crawlData = await crawlResponse.json();
      const jobId = crawlData.id;

      if (!jobId) {
        throw new Error('No job ID returned from crawl request');
      }

      console.log(`Crawl job started: ${jobId}`);
      console.log('Waiting for crawl to complete...');

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (5s intervals)

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          },
        });

        if (!statusResponse.ok) {
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          const pages = statusData.data || [];
          console.log(`\n✓ Crawl completed! Retrieved ${pages.length} pages`);

          if (pages.length === 0) {
            throw new Error('Crawl completed but no pages were retrieved');
          }

          // Show summary of crawled URLs
          console.log('\nCrawled pages:');
          pages.slice(0, 10).forEach((page: any, i: number) => {
            const pageUrl = page.metadata?.sourceURL || page.url || 'Unknown URL';
            console.log(`  ${i + 1}. ${pageUrl}`);
          });
          if (pages.length > 10) {
            console.log(`  ... and ${pages.length - 10} more pages`);
          }

          // Combine all page content
          const allContent = pages
            .map((page: any) => {
              const pageUrl = page.metadata?.sourceURL || page.url || 'Unknown URL';
              const content = page.markdown || '';
              return `\n\n--- SOURCE: ${pageUrl} ---\n\n${content}`;
            })
            .join('\n');

          console.log(`\nTotal content: ${allContent.length} characters from ${pages.length} pages`);
          return allContent;
        } else if (statusData.status === 'failed') {
          throw new Error(`Crawl failed: ${statusData.error || 'Unknown error'}`);
        }

        // Still in progress
        const completed = statusData.completed || 0;
        const total = statusData.total || maxPages;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const creditsUsed = statusData.creditsUsed || 0;

        // Show detailed progress with percentage, pages, and credits
        process.stdout.write(
          `\r  Progress: ${percentage}% (${completed}/${total} pages) | Credits used: ${creditsUsed}   `
        );
        attempts++;
      }

      throw new Error('Crawl timed out after 10 minutes');
    } catch (error) {
      console.error('\nFirecrawl crawl failed:', error);
      console.log('Falling back to single-page HTTP fetch...');
    }
  } else {
    console.log('FIRECRAWL_API_KEY not set - using basic HTTP fetch (single page only)');
  }

  // Fallback to basic HTTP fetch (single page)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BureaucracyDecoder/1.0 (Zoning Code Research)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Basic HTML to text conversion
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('Warning: Only fetched single page. For comprehensive coverage, set FIRECRAWL_API_KEY');
  return text;
}

async function ingestMetro(slug: string) {
  // Find the metro in featured list
  const metro = featuredMetros.find(m => m.slug === slug);

  if (!metro) {
    console.error(`Error: Metro "${slug}" not found.`);
    console.error('\nAvailable metros:');
    featuredMetros.forEach(m => {
      console.error(`  - ${m.slug} (${m.cityName})`);
    });
    process.exit(1);
  }

  console.log(`\nIngesting zoning code for: ${metro.cityName}`);
  console.log(`Code: ${metro.codeName}`);
  console.log(`Source: ${metro.sourceUrl}\n`);

  try {
    // Step 1: Check if document already exists
    const { data: existingDoc } = await supabase
      .from('zoning_docs')
      .select('id, status')
      .eq('slug', slug)
      .single();

    let docId: string;

    if (existingDoc) {
      console.log(`Document already exists (status: ${existingDoc.status})`);
      docId = existingDoc.id;

      // Clear existing embeddings
      console.log('Clearing existing embeddings...');
      await supabase
        .from('zoning_embeddings')
        .delete()
        .eq('doc_id', docId);
    } else {
      // Create new document record
      console.log('Creating document record...');
      const { data: newDoc, error: insertError } = await supabase
        .from('zoning_docs')
        .insert({
          slug: metro.slug,
          city_name: metro.cityName,
          code_name: metro.codeName,
          region: metro.region,
          source_url: metro.sourceUrl,
          is_featured: metro.status === 'active',
          source_type: metro.codifier || 'municode',
          status: 'processing',
        })
        .select()
        .single();

      if (insertError || !newDoc) {
        throw new Error(`Failed to create document: ${insertError?.message}`);
      }

      docId = newDoc.id;
    }

    // Update status to processing
    await supabase
      .from('zoning_docs')
      .update({ status: 'processing', error_message: null })
      .eq('id', docId);

    // Step 2: Fetch the zoning code content
    console.log('Fetching zoning code content...');
    const content = await fetchZoningCode(metro.sourceUrl);
    console.log(`Fetched ${content.length} characters`);

    if (content.length < 1000) {
      throw new Error('Content too short - may not have fetched properly');
    }

    // Step 3: Chunk the document
    console.log('Chunking document...');
    const chunks: RegulationChunk[] = chunkMunicipalCode(content, metro.sourceUrl);
    console.log(`Created ${chunks.length} chunks`);

    // Step 4: Generate embeddings
    console.log('Generating embeddings (this may take a few minutes)...');
    const chunkTexts = chunks.map(c => c.full_text);
    const embeddings = await generateEmbeddings(chunkTexts);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 5: Store embeddings
    console.log('Storing embeddings in database...');
    const embeddingRecords = chunks.map((chunk, index) => ({
      doc_id: docId,
      chunk_index: index,
      content: chunk.full_text,
      section_ref: chunk.section_ref,
      token_count: chunk.token_count,
      embedding: embeddings[index],
    }));

    // Insert in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < embeddingRecords.length; i += BATCH_SIZE) {
      const batch = embeddingRecords.slice(i, i + BATCH_SIZE);
      const { error: embedError } = await supabase
        .from('zoning_embeddings')
        .insert(batch);

      if (embedError) {
        throw new Error(`Failed to insert embeddings: ${embedError.message}`);
      }

      console.log(`  Inserted ${Math.min(i + BATCH_SIZE, embeddingRecords.length)}/${embeddingRecords.length} chunks`);
    }

    // Step 6: Update document status
    await supabase
      .from('zoning_docs')
      .update({
        status: 'ready',
        chunk_count: chunks.length,
        last_crawled_at: new Date().toISOString(),
      })
      .eq('id', docId);

    console.log(`\nSuccess! ${metro.cityName} zoning code is now ready.`);
    console.log(`  - Document ID: ${docId}`);
    console.log(`  - Chunks: ${chunks.length}`);
    console.log(`  - Status: ready`);

  } catch (error) {
    console.error('\nIngestion failed:', error);

    // Update document status to failed
    const { data: doc } = await supabase
      .from('zoning_docs')
      .select('id')
      .eq('slug', slug)
      .single();

    if (doc) {
      await supabase
        .from('zoning_docs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', doc.id);
    }

    process.exit(1);
  }
}

// Main execution
const slug = process.argv[2];

if (!slug) {
  console.log('Bureaucracy Decoder - Metro Ingestion Script\n');
  console.log('Usage: npx ts-node scripts/ingest-metro.ts <metro-slug>\n');
  console.log('Available metros:');

  const regions = [...new Set(featuredMetros.map(m => m.region))];
  for (const region of regions) {
    console.log(`\n  ${region}:`);
    featuredMetros
      .filter(m => m.region === region)
      .forEach(m => {
        console.log(`    - ${m.slug.padEnd(20)} ${m.cityName}`);
      });
  }

  console.log('\nExample: npx ts-node scripts/ingest-metro.ts los-angeles');
  process.exit(0);
}

ingestMetro(slug);
