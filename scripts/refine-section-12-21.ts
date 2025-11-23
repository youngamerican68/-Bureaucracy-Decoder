#!/usr/bin/env tsx

/**
 * Refine Section 12.21 (General Provisions) with Context Stamping
 *
 * Problem: Large chunks in Section 12.21 (e.g., "12.21.A Parking") are being split,
 * but the child chunks lose their parent context and become orphaned.
 *
 * Solution: "Stamp" the parent context onto every child chunk so they carry their
 * full legal path (e.g., "[CONTEXT: Section 12.21.A Off-Street Parking]").
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CHUNK_SIZE_THRESHOLD = 2000; // Split chunks larger than this
const BATCH_SIZE = 5;

// =============================================================================
// CLIENTS
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// =============================================================================
// TYPES
// =============================================================================

interface ParentContext {
  subsection: string; // e.g., "A", "C", "D"
  title: string; // e.g., "Off-Street Parking", "Area"
  fullRef: string; // e.g., "12.21.A"
}

interface ChildSection {
  number: string; // e.g., "1", "16", "23"
  content: string;
  startIndex: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect the parent context from the chunk content or section_ref
 * Looks for patterns like "A. OFF-STREET PARKING" or "SEC. 12.21.A"
 * Or infers from section_ref like "12.21.1" or "12.21.A.5"
 */
function detectParentContext(content: string, sectionRef: string | null): ParentContext | null {
  // Try to find subsection header patterns in content
  const patterns = [
    // Pattern: "A. OFF-STREET PARKING" or "A. Area"
    /^([A-Z])\.\s+([A-Z][A-Z\s-]+?)(?:\n|$)/m,
    // Pattern: "SEC. 12.21.A" or "Section 12.21.A"
    /SEC(?:TION)?\.\s+12\.21\.([A-Z])\s+([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const subsection = match[1];
      const title = match[2].trim();
      return {
        subsection,
        title,
        fullRef: `12.21.${subsection}`,
      };
    }
  }

  // Fallback: Infer from section_ref
  if (sectionRef) {
    // Pattern: "12.21.A" or "12.21.A.5" → extract "A"
    const letterMatch = sectionRef.match(/^12\.21\.([A-Z])/);
    if (letterMatch) {
      return {
        subsection: letterMatch[1],
        title: 'General Provisions',
        fullRef: `12.21.${letterMatch[1]}`,
      };
    }

    // Pattern: "12.21.1" or "12.21.1.A" → treat as subsection "1"
    const numberMatch = sectionRef.match(/^12\.21\.(\d+)/);
    if (numberMatch) {
      // Map number to title (you can expand this mapping)
      const subsectionTitles: Record<string, string> = {
        '1': 'Height of Buildings',
        '2': 'Yards',
        '3': 'Area',
        '4': 'Building Line',
        '5': 'Lot Width',
        '6': 'Lot Area',
      };
      const subsection = numberMatch[1];
      const title = subsectionTitles[subsection] || 'General Provisions';
      return {
        subsection,
        title,
        fullRef: `12.21.${subsection}`,
      };
    }

    // Pattern: "12.21" → General Provisions (root)
    if (sectionRef === '12.21') {
      return {
        subsection: '',
        title: 'General Provisions',
        fullRef: '12.21',
      };
    }
  }

  return null;
}

/**
 * Split content by numbered subsections (1., 2., 3., etc.)
 */
function splitByNumbers(content: string): ChildSection[] | null {
  // Pattern: "1. Title" or "16. Bicycle Parking"
  const pattern = /^\s*(\d+)\.\s+/gm;
  const sections: ChildSection[] = [];
  const matches: Array<{ index: number; number: string }> = [];
  let match: RegExpExecArray | null;

  pattern.lastIndex = 0;

  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      number: match[1],
    });
  }

  if (matches.length < 2) {
    // Need at least 2 numbered sections to split
    return null;
  }

  // Build sections
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    const startIndex = currentMatch.index;
    const endIndex = nextMatch ? nextMatch.index : content.length;

    const sectionContent = content.substring(startIndex, endIndex).trim();

    sections.push({
      number: currentMatch.number,
      content: sectionContent,
      startIndex,
    });
  }

  return sections;
}

/**
 * Stamp parent context onto child content
 */
function stampContext(childContent: string, parent: ParentContext): string {
  const contextHeader = `[CONTEXT: Section ${parent.fullRef} ${parent.title}]\n\n`;
  return contextHeader + childContent;
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// MAIN PROCESSING
// =============================================================================

async function processSection1221Chunk(chunk: any): Promise<boolean> {
  console.log(`\n📦 Processing chunk ID ${chunk.id}:`);
  console.log(`   Section: ${chunk.section_ref || 'N/A'}`);
  console.log(`   Tokens: ${chunk.token_count}`);
  console.log(`   Length: ${chunk.content.length} characters`);

  // Check if already stamped
  if (chunk.content.startsWith('[CONTEXT:')) {
    console.log('   ⏭️  Already stamped - skipping');
    return false;
  }

  // Step 1: Detect parent context
  const parent = detectParentContext(chunk.content, chunk.section_ref);

  if (!parent) {
    console.log('   ⚠ Cannot detect parent context - skipping');
    return false;
  }

  console.log(`   ✓ Detected parent: Section ${parent.fullRef} ${parent.title}`);

  // Step 2: Stamp the content
  const stampedContent = stampContext(chunk.content, parent);
  const newTokenCount = estimateTokens(stampedContent);

  console.log(`   ✓ Stamping content (${chunk.token_count} → ${newTokenCount} tokens)`);

  // Step 3: Generate new embedding for stamped content
  const embedding = await generateEmbedding(stampedContent);

  // Step 4: Update the chunk in place
  console.log(`   💾 Updating chunk with stamped content...`);
  const { error: updateError } = await supabase
    .from('zoning_embeddings')
    .update({
      content: stampedContent,
      token_count: newTokenCount,
      embedding: embedding,
    })
    .eq('id', chunk.id);

  if (updateError) {
    throw new Error(`Update failed: ${updateError.message}`);
  }

  console.log(`   ✅ Successfully stamped chunk ID ${chunk.id}`);
  return true;
}

async function main() {
  console.log('🔧 Starting Section 12.21 Context Stamping Refinement...\n');
  console.log(`Threshold: ${CHUNK_SIZE_THRESHOLD} tokens`);
  console.log(`Batch size: ${BATCH_SIZE} chunks\n`);

  // 1. Find ALL chunks in Section 12.21 (regardless of size)
  console.log('📂 Querying for ALL Section 12.21 chunks...');
  const { data: chunks, error: queryError } = await supabase
    .from('zoning_embeddings')
    .select('*')
    .like('section_ref', '12.21%')
    .order('section_ref', { ascending: true });

  if (queryError) {
    throw new Error(`Query failed: ${queryError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    console.log('✓ No Section 12.21 chunks found!');
    return;
  }

  console.log(`✓ Found ${chunks.length} Section 12.21 chunks\n`);
  console.log('First 5 chunks:');
  chunks.slice(0, 5).forEach((chunk, i) => {
    const hasStamp = chunk.content.startsWith('[CONTEXT:') ? '✓' : '✗';
    console.log(`   ${i + 1}. ID ${chunk.id}: ${chunk.section_ref || 'N/A'} (${chunk.token_count} tokens) [${hasStamp}]`);
  });

  // 2. Process in batches
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`BATCH ${batchNum}/${totalBatches} (Chunks ${i + 1}-${Math.min(i + BATCH_SIZE, chunks.length)})`);
    console.log('='.repeat(70));

    for (const chunk of batch) {
      try {
        const success = await processSection1221Chunk(chunk);
        if (success) {
          successCount++;
        } else {
          skipCount++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing chunk ${chunk.id}:`, error.message);
        errorCount++;
      }
    }

    // Rate limiting pause between batches
    if (i + BATCH_SIZE < chunks.length) {
      console.log('\n⏸️  Pausing 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 3. Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Section 12.21 chunks processed: ${chunks.length}`);
  console.log(`✅ Successfully refined with stamping: ${successCount}`);
  console.log(`⏭️  Skipped (unsplittable): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // 4. Verify stamping coverage
  console.log('\n🔍 Checking stamping coverage...');
  const { data: allChunks, error: verifyError } = await supabase
    .from('zoning_embeddings')
    .select('id, section_ref, token_count, content')
    .like('section_ref', '12.21%')
    .order('section_ref', { ascending: true });

  if (verifyError) {
    throw new Error(`Verification failed: ${verifyError.message}`);
  }

  const stampedCount = allChunks?.filter(c => c.content.startsWith('[CONTEXT:')).length || 0;
  const unstampedCount = (allChunks?.length || 0) - stampedCount;

  console.log(`\nStamping Coverage:`);
  console.log(`   ✅ Stamped: ${stampedCount}`);
  console.log(`   ❌ Unstamped: ${unstampedCount}`);
  console.log(`   📊 Coverage: ${((stampedCount / (allChunks?.length || 1)) * 100).toFixed(1)}%`);

  // 5. Show example stamped chunks
  console.log('\n🔍 Example stamped chunks:');
  const { data: stampedExamples } = await supabase
    .from('zoning_embeddings')
    .select('id, section_ref, content')
    .like('section_ref', '12.21%')
    .like('content', '[CONTEXT:%')
    .limit(3);

  if (stampedExamples && stampedExamples.length > 0) {
    stampedExamples.forEach((chunk, i) => {
      const contextLine = chunk.content.split('\n')[0];
      console.log(`   ${i + 1}. ${chunk.section_ref}: ${contextLine.substring(0, 80)}...`);
    });
  }

  console.log('\n✅ Section 12.21 context stamping completed!');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
