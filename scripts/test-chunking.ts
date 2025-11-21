#!/usr/bin/env ts-node

/**
 * Test script for stateful municipal code chunking
 * Verifies hierarchy preservation and semantic completeness
 */

import fs from 'fs';
import path from 'path';
import { chunkMunicipalCode, analyzeChunks } from '../src/lib/services/chunking';

// =============================================================================
// FIND LARGEST SCRAPED FILE
// =============================================================================

const searchDirs = [
  path.join(__dirname, '../.cache'),
  path.join(__dirname, '../data'),
  path.join(__dirname, '../scraped_data'),
];

console.log('Searching for scraped files...\n');

let largestFile: { path: string; size: number } | null = null;

for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    continue;
  }

  const files = fs.readdirSync(dir);
  console.log(`Checking ${dir}...`);

  for (const file of files) {
    if (file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.md')) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      console.log(`  - ${file}: ${(stats.size / 1024).toFixed(1)} KB`);

      // Prioritize Chapter IX files (they use SEC. format that parser expects)
      const isChapter9 = file.includes('chapter9') || file.includes('chapter-9');
      const currentIsChapter9 = largestFile?.path.includes('chapter9') || largestFile?.path.includes('chapter-9');

      if (!largestFile || (isChapter9 && !currentIsChapter9) || (isChapter9 === currentIsChapter9 && stats.size > largestFile.size)) {
        largestFile = { path: filePath, size: stats.size };
      }
    }
  }
}

if (!largestFile) {
  console.error('\nError: No scraped files found in any directory');
  process.exit(1);
}

console.log(`\n✓ Using largest file: ${path.basename(largestFile.path)}`);
console.log(`  Size: ${(largestFile.size / 1024).toFixed(1)} KB\n`);

// =============================================================================
// LOAD AND EXTRACT CONTENT
// =============================================================================

console.log('='.repeat(80));
console.log('LOADING FILE');
console.log('='.repeat(80) + '\n');

const rawData = fs.readFileSync(largestFile.path, 'utf-8');
let contentToChunk = '';
let sourceUrl = '';

// Try to parse as JSON first (Firecrawl format)
try {
  const jsonData = JSON.parse(rawData);

  // Handle Firecrawl JSON structure
  if (jsonData.results && Array.isArray(jsonData.results)) {
    // Extract content from all articles/pages
    console.log(`Found ${jsonData.results.length} article(s) in file\n`);

    for (const article of jsonData.results) {
      if (article.pages && Array.isArray(article.pages)) {
        console.log(`Article: ${article.article || 'Unknown'}`);
        console.log(`  Pages: ${article.pages.length}`);

        const articleContent = article.pages
          .map((page: any) => page.content || '')
          .join('\n\n---\n\n');

        contentToChunk += articleContent + '\n\n';
        sourceUrl = article.article_url || sourceUrl;
      }
    }
  } else if (jsonData.content) {
    // Single article format
    contentToChunk = jsonData.content;
    sourceUrl = jsonData.url || '';
  } else if (Array.isArray(jsonData)) {
    // Array of pages
    contentToChunk = jsonData.map((item: any) => item.content || item.markdown || '').join('\n\n');
  }
} catch (e) {
  // Not JSON, treat as plain text/markdown
  console.log('File is plain text/markdown\n');
  contentToChunk = rawData;
}

if (!contentToChunk || contentToChunk.length < 100) {
  console.error('Error: No content extracted from file');
  process.exit(1);
}

console.log(`Total content length: ${contentToChunk.length.toLocaleString()} characters\n`);

// =============================================================================
// RUN CHUNKER
// =============================================================================

console.log('='.repeat(80));
console.log('RUNNING CHUNKER');
console.log('='.repeat(80) + '\n');

const chunks = chunkMunicipalCode(contentToChunk, sourceUrl);

console.log(`✓ Created ${chunks.length} chunks\n`);

// =============================================================================
// STATISTICS
// =============================================================================

console.log('='.repeat(80));
console.log('CHUNK STATISTICS');
console.log('='.repeat(80) + '\n');

const stats = analyzeChunks(chunks);

console.log(`Total Chunks: ${stats.totalChunks}`);
console.log(`Total Tokens: ${stats.totalTokens.toLocaleString()}`);
console.log(`Avg Tokens/Chunk: ${stats.avgTokensPerChunk}`);
console.log(`Min Tokens: ${stats.minTokens}`);
console.log(`Max Tokens: ${stats.maxTokens}`);

console.log(`\nChapters Found: ${stats.chaptersFound.size}`);
Array.from(stats.chaptersFound).forEach(ch => console.log(`  - ${ch}`));

console.log(`\nArticles Found: ${stats.articlesFound.size}`);
Array.from(stats.articlesFound).forEach(art => console.log(`  - ${art}`));

console.log(`\nDivisions Found: ${stats.divisionsFound.size}`);
Array.from(stats.divisionsFound).forEach(div => console.log(`  - ${div}`));

// =============================================================================
// FIRST 3 CHUNKS (COMPLETE)
// =============================================================================

console.log('\n' + '='.repeat(80));
console.log('FIRST 3 CHUNKS (FULL TEXT)');
console.log('='.repeat(80) + '\n');

chunks.slice(0, 3).forEach((chunk, idx) => {
  console.log(`${'─'.repeat(80)}`);
  console.log(`CHUNK ${idx + 1} of ${chunks.length}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Section Ref: ${chunk.section_ref}`);
  console.log(`Hierarchy: ${chunk.hierarchy}`);
  console.log(`Heading: ${chunk.heading}`);
  console.log(`Token Count: ${chunk.token_count}`);
  console.log(`Source URL: ${chunk.source_url || 'N/A'}`);
  console.log(`\nFull Text:\n${chunk.full_text}`);
  console.log('\n');
});

// =============================================================================
// LAST 3 CHUNKS (COMPLETE)
// =============================================================================

console.log('='.repeat(80));
console.log('LAST 3 CHUNKS (FULL TEXT)');
console.log('='.repeat(80) + '\n');

chunks.slice(-3).forEach((chunk, idx) => {
  const chunkNum = chunks.length - 3 + idx + 1;
  console.log(`${'─'.repeat(80)}`);
  console.log(`CHUNK ${chunkNum} of ${chunks.length}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Section Ref: ${chunk.section_ref}`);
  console.log(`Hierarchy: ${chunk.hierarchy}`);
  console.log(`Heading: ${chunk.heading}`);
  console.log(`Token Count: ${chunk.token_count}`);
  console.log(`Source URL: ${chunk.source_url || 'N/A'}`);
  console.log(`\nFull Text:\n${chunk.full_text}`);
  console.log('\n');
});

// =============================================================================
// SANITY CHECKS
// =============================================================================

console.log('='.repeat(80));
console.log('SANITY CHECKS');
console.log('='.repeat(80) + '\n');

// Check for incomplete hierarchy
const incompleteHierarchy = chunks.filter(chunk =>
  chunk.hierarchy === 'Unknown' || !chunk.hierarchy.includes('>')
);

if (incompleteHierarchy.length > 0) {
  console.log(`⚠️  WARNING: ${incompleteHierarchy.length} chunks have incomplete hierarchy`);
  console.log(`   Example: ${incompleteHierarchy[0].section_ref} - "${incompleteHierarchy[0].hierarchy}"\n`);
} else {
  console.log(`✓ All chunks have complete hierarchy (Chapter > Article > Division)\n`);
}

// Check for missing section refs
const missingSectionRefs = chunks.filter(chunk => !chunk.section_ref);
if (missingSectionRefs.length > 0) {
  console.log(`⚠️  WARNING: ${missingSectionRefs.length} chunks missing section refs\n`);
} else {
  console.log(`✓ All chunks have section references\n`);
}

console.log('='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80) + '\n');
