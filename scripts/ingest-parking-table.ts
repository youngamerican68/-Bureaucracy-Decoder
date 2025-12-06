/**
 * Surgical re-ingestion of §12.21.A.4 parking requirements table
 * Creates row-level chunks for better retrieval of specific use types
 *
 * Usage: npx tsx scripts/ingest-parking-table.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const SECTION_REF = '12.21.A.4';
const HIERARCHY = 'Chapter I > Article 2 > Section 12.21 > A.4 Off-Street Parking';
const DOC_SLUG = 'los-angeles-chapter1';

interface ParkingRow {
  useType: string;
  requirement: string;
  notes?: string;
  keywords: string[];
}

// Format row as embeddable chunk content
function formatRowAsChunk(row: ParkingRow): string {
  let content = `§12.21.A.4 Off-Street Parking Requirements - Los Angeles Municipal Code\n\n`;
  content += `USE TYPE: ${row.useType}\n`;
  content += `PARKING REQUIREMENT: ${row.requirement}\n`;
  if (row.notes) {
    content += `NOTES: ${row.notes}\n`;
  }
  content += `\nRelated terms: ${row.keywords.join(', ')}\n`;
  content += `\nSection 12.21.A.4 - LAMC Chapter I (Zoning)`;
  return content;
}

// Generate embedding via OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function main() {
  console.log('🚗 Starting parking table ingestion for §12.21.A.4\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get doc ID for los-angeles-chapter1
  const { data: doc, error: docError } = await supabase
    .from('zoning_docs')
    .select('id')
    .eq('slug', DOC_SLUG)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${DOC_SLUG}. Error: ${docError?.message}`);
  }

  console.log(`Found document: ${DOC_SLUG} (${doc.id})`);

  // Get max chunk_index for this doc
  const { data: maxChunk } = await supabase
    .from('zoning_embeddings')
    .select('chunk_index')
    .eq('doc_id', doc.id)
    .order('chunk_index', { ascending: false })
    .limit(1)
    .single();

  let nextIndex = (maxChunk?.chunk_index || 0) + 1;
  console.log(`Starting at chunk_index: ${nextIndex}\n`);

  // Read manual JSON file
  const jsonPath = path.join(__dirname, 'data/parking-12.21.A.4.json');
  const rows: ParkingRow[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`Loaded ${rows.length} parking rows from JSON\n`);

  let successCount = 0;
  let errorCount = 0;

  // Process each row
  for (const row of rows) {
    const content = formatRowAsChunk(row);

    try {
      const embedding = await generateEmbedding(content);

      const { error } = await supabase.from('zoning_embeddings').insert({
        doc_id: doc.id,
        chunk_index: nextIndex++,
        section_ref: SECTION_REF,
        hierarchy: HIERARCHY,
        content: content,
        token_count: Math.ceil(content.length / 4),
        embedding: embedding,
      });

      if (error) {
        console.error(`❌ Failed: ${row.useType}`, error.message);
        errorCount++;
      } else {
        console.log(`✓ ${row.useType}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Error processing: ${row.useType}`, err);
      errorCount++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Done. Inserted ${successCount} parking chunks.`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} rows failed.`);
  }
  console.log(`\nVerify with: SELECT section_ref, LEFT(content, 80) FROM zoning_embeddings WHERE section_ref = '12.21.A.4' ORDER BY chunk_index DESC LIMIT 15;`);
}

main().catch(console.error);
