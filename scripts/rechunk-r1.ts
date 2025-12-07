#!/usr/bin/env tsx

/**
 * Re-chunk Section 12.08 (R1 Zone)
 *
 * The original chunk is 4513 tokens, causing retrieval dilution.
 * This script splits it into smaller sub-chunks based on internal section headers.
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

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
// MAIN SCRIPT
// =============================================================================

async function main() {
  console.log('🔧 Starting Section 12.08 (R1 Zone) rechunking...\n');

  // 1. Find the R1 Zone chunk
  console.log('📂 Querying for Section 12.08 chunk...');
  const { data: chunks, error: queryError } = await supabase
    .from('zoning_embeddings')
    .select('*')
    .eq('section_ref', '12.08')
    .order('chunk_index', { ascending: true });

  if (queryError) {
    throw new Error(`Query failed: ${queryError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    throw new Error('Section 12.08 not found in database');
  }

  console.log(`✓ Found ${chunks.length} chunk(s) for Section 12.08\n`);

  for (const chunk of chunks) {
    console.log(`📄 Processing chunk ID ${chunk.id} (${chunk.token_count} tokens)...`);
    console.log(`   Content length: ${chunk.content.length} characters\n`);

    const content = chunk.content;
    const docId = chunk.doc_id;
    const baseChunkIndex = chunk.chunk_index;

    // 2. Split content by section headers (A., B., C., etc.)
    const sectionPattern = /^([A-Z])\.\s+(.+?)$/gm;
    const sections: Array<{ letter: string; title: string; content: string }> = [];

    let lastMatch: RegExpExecArray | null = null;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = sectionPattern.exec(content)) !== null) {
      // If we have a previous section, capture its content
      if (lastMatch) {
        const sectionContent = content.substring(lastIndex, match.index).trim();
        sections.push({
          letter: lastMatch[1],
          title: lastMatch[2],
          content: sectionContent,
        });
      }

      lastMatch = match;
      lastIndex = match.index;
    }

    // Capture the last section
    if (lastMatch) {
      const sectionContent = content.substring(lastIndex).trim();
      sections.push({
        letter: lastMatch[1],
        title: lastMatch[2],
        content: sectionContent,
      });
    }

    if (sections.length === 0) {
      console.log('⚠ No subsections found, skipping this chunk');
      continue;
    }

    console.log(`✓ Split into ${sections.length} subsections:\n`);
    sections.forEach(s => {
      const tokenEstimate = Math.ceil(s.content.length / 4);
      console.log(`   ${s.letter}. ${s.title} (~${tokenEstimate} tokens)`);
    });
    console.log('');

    // 3. Generate embeddings for each subsection
    console.log('🧮 Generating embeddings for subsections...');
    const newChunks = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionRef = `12.08.${section.letter}`;
      const tokenCount = Math.ceil(section.content.length / 4);

      console.log(`   Generating embedding for ${sectionRef} - ${section.title}...`);

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: section.content,
        dimensions: 1536,
      });

      const embedding = embeddingResponse.data[0].embedding;

      newChunks.push({
        doc_id: docId,
        chunk_index: baseChunkIndex + i,
        content: section.content,
        section_ref: sectionRef,
        token_count: tokenCount,
        embedding: embedding,
      });
    }

    console.log(`✓ Generated ${newChunks.length} embeddings\n`);

    // 4. Delete the old chunk
    console.log(`🗑️  Deleting old chunk ID ${chunk.id}...`);
    const { error: deleteError } = await supabase
      .from('zoning_embeddings')
      .delete()
      .eq('id', chunk.id);

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    console.log('✓ Old chunk deleted\n');

    // 5. Insert new chunks
    console.log('💾 Inserting new subsection chunks...');
    const { error: insertError } = await supabase
      .from('zoning_embeddings')
      .insert(newChunks);

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    console.log(`✓ Inserted ${newChunks.length} new chunks\n`);

    // 6. Verify
    console.log('🔍 Verifying new chunks...');
    const { data: verifyChunks, error: verifyError } = await supabase
      .from('zoning_embeddings')
      .select('id, section_ref, token_count')
      .like('section_ref', '12.08%')
      .order('section_ref', { ascending: true });

    if (verifyError) {
      throw new Error(`Verification failed: ${verifyError.message}`);
    }

    console.log('✓ New chunks in database:');
    verifyChunks?.forEach(c => {
      console.log(`   ID ${c.id}: ${c.section_ref} (${c.token_count} tokens)`);
    });
  }

  console.log('\n✅ Section 12.08 rechunking completed successfully!');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
