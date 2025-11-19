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
import { chunkDocument } from '../src/lib/services/chunking';

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

async function fetchZoningCode(url: string): Promise<string> {
  console.log(`Fetching zoning code from: ${url}`);

  // Try Firecrawl first if available
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          pageOptions: {
            onlyMainContent: true,
            includeHtml: false,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.markdown) {
          console.log('Successfully fetched with Firecrawl');
          return data.data.markdown;
        }
      }
    } catch (error) {
      console.log('Firecrawl failed, falling back to HTTP fetch');
    }
  }

  // Fallback to basic HTTP fetch
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
          is_featured: metro.isFeatured,
          source_type: 'municode',
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
    const chunks = chunkDocument(content);
    console.log(`Created ${chunks.length} chunks`);

    // Step 4: Generate embeddings
    console.log('Generating embeddings (this may take a few minutes)...');
    const chunkTexts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 5: Store embeddings
    console.log('Storing embeddings in database...');
    const embeddingRecords = chunks.map((chunk, index) => ({
      doc_id: docId,
      chunk_index: index,
      content: chunk.content,
      section_ref: chunk.sectionRef,
      token_count: estimateTokenCount(chunk.content),
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
