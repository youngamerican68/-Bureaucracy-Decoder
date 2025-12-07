import { getServerClient } from '@/lib/supabase';
import { generateEmbeddings } from './embeddings';
import { chunkMunicipalCode, RegulationChunk } from './chunking';
import { ZoningDoc } from '@/types';

interface IngestOptions {
  forceRefresh?: boolean;
}

interface CrawlResult {
  content: string;
  title?: string;
  url: string;
}

/**
 * Crawl a URL and extract text content
 * Uses Firecrawl API if available, falls back to simple fetch
 */
async function crawlUrl(url: string): Promise<CrawlResult> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;

  if (firecrawlKey) {
    // Use Firecrawl for better extraction
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.data?.markdown || '',
        title: data.data?.metadata?.title,
        url,
      };
    } catch (error) {
      console.warn('Firecrawl failed, falling back to simple fetch:', error);
    }
  }

  // Fallback: simple fetch with basic HTML extraction
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const html = await response.text();

  // Very basic HTML to text conversion
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  return {
    content: textContent,
    url,
  };
}

/**
 * Ingest a zoning code document
 */
export async function ingestZoningCode(
  docId: string,
  options: IngestOptions = {}
): Promise<void> {
  const supabase = getServerClient();

  // Get the document
  const { data: doc, error: docError } = await supabase
    .from('zoning_docs')
    .select('*')
    .eq('id', docId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${docId}`);
  }

  // Check if already ingested and not forcing refresh
  if (doc.status === 'ingested' && !options.forceRefresh) {
    console.log(`Document ${doc.slug} already ingested, skipping...`);
    return;
  }

  // Update status to ingesting
  await supabase
    .from('zoning_docs')
    .update({ status: 'ingesting', error_message: null })
    .eq('id', docId);

  try {
    // Crawl the source URL
    console.log(`Crawling ${doc.source_url}...`);
    const crawlResult = await crawlUrl(doc.source_url);

    // Check for sufficient content
    if (!crawlResult.content || crawlResult.content.length < 100) {
      throw new Error('Insufficient content extracted from source URL');
    }

    // Chunk the text using the new municipal code chunker
    console.log(`Chunking text (${crawlResult.content.length} chars)...`);
    const chunks: RegulationChunk[] = chunkMunicipalCode(crawlResult.content, doc.source_url);

    console.log(`Created ${chunks.length} chunks`);

    // Delete existing embeddings for this doc
    await supabase
      .from('zoning_embeddings')
      .delete()
      .eq('doc_id', docId);

    // Generate embeddings in batches
    console.log('Generating embeddings...');
    const chunkContents = chunks.map(c => c.full_text);
    const embeddings = await generateEmbeddings(chunkContents);

    // Insert chunks with embeddings
    console.log('Storing embeddings...');
    const embeddingRows = chunks.map((chunk, i) => ({
      doc_id: docId,
      chunk_index: i,
      content: chunk.full_text,
      section_ref: chunk.section_ref,
      token_count: chunk.token_count,
      embedding: embeddings[i],
    }));

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < embeddingRows.length; i += BATCH_SIZE) {
      const batch = embeddingRows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('zoning_embeddings')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert embeddings: ${insertError.message}`);
      }
    }

    // Update document status
    await supabase
      .from('zoning_docs')
      .update({
        status: 'ingested',
        chunk_count: chunks.length,
        last_crawled_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', docId);

    console.log(`Successfully ingested ${doc.slug} with ${chunks.length} chunks`);
  } catch (error) {
    // Update status to error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('zoning_docs')
      .update({
        status: 'error',
        error_message: errorMessage,
      })
      .eq('id', docId);

    throw error;
  }
}

/**
 * Create or update a zoning document entry
 */
export async function upsertZoningDoc(
  slug: string,
  cityName: string,
  codeName: string,
  sourceUrl: string,
  options: {
    region?: string;
    isFeatured?: boolean;
    sourceType?: string;
  } = {}
): Promise<ZoningDoc> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('zoning_docs')
    .upsert(
      {
        slug,
        city_name: cityName,
        code_name: codeName,
        source_url: sourceUrl,
        region: options.region,
        is_featured: options.isFeatured ?? false,
        source_type: options.sourceType ?? 'official_site',
      },
      {
        onConflict: 'slug',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert document: ${error.message}`);
  }

  return data as ZoningDoc;
}
