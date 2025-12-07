#!/usr/bin/env tsx

/**
 * Diagnostic Script: Analyze what the current parser does with Chapter I
 *
 * Goal: Understand why SEC. 12.21 (General Provisions with parking ratios)
 * is missing from the database.
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { chunkMunicipalCode, analyzeChunks } from '../src/lib/services/chunking';

const PDF_PATH = path.join(__dirname, '../.cache/chapter1.pdf');

async function diagnose() {
  console.log('='.repeat(80));
  console.log('PARSER DIAGNOSTIC: Chapter I PDF');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Load and parse PDF
  console.log('Step 1: Loading PDF...');
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const pdfData = await pdfParse(dataBuffer);
  const rawText = pdfData.text;
  console.log(`  PDF loaded: ${pdfData.numpages} pages, ${rawText.length.toLocaleString()} chars`);
  console.log();

  // Step 2: Find SEC. 12.21 in raw text
  console.log('Step 2: Finding SEC. 12.21 in raw PDF text...');
  const lines = rawText.split('\n');

  let sec1221LineNum = -1;
  let sec12211LineNum = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^SEC\.\s*12\.21\.\s*GENERAL/i)) {
      sec1221LineNum = i;
      console.log(`  Found SEC. 12.21 at line ${i}: "${lines[i].substring(0, 80)}..."`);
    }
    if (lines[i].match(/^SEC\.\s*12\.21\.1\./i)) {
      sec12211LineNum = i;
      console.log(`  Found SEC. 12.21.1 at line ${i}: "${lines[i].substring(0, 80)}..."`);
    }
  }

  if (sec1221LineNum >= 0 && sec12211LineNum >= 0) {
    const linesBetween = sec12211LineNum - sec1221LineNum;
    const charsBetween = lines.slice(sec1221LineNum, sec12211LineNum).join('\n').length;
    console.log(`  Lines between 12.21 and 12.21.1: ${linesBetween}`);
    console.log(`  Characters between: ${charsBetween.toLocaleString()}`);
    console.log(`  Estimated tokens: ~${Math.ceil(charsBetween / 4).toLocaleString()}`);
  }
  console.log();

  // Step 3: Run the parser
  console.log('Step 3: Running chunkMunicipalCode parser...');
  const chunks = chunkMunicipalCode(rawText);
  const stats = analyzeChunks(chunks);

  console.log(`  Total chunks produced: ${chunks.length}`);
  console.log(`  Total tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(`  Avg tokens/chunk: ${stats.avgTokensPerChunk}`);
  console.log(`  Max tokens: ${stats.maxTokens}`);
  console.log();

  // Step 4: Look for 12.21-related chunks
  console.log('Step 4: Analyzing 12.21-related chunks...');

  const chunks1221 = chunks.filter(c => c.section_ref.startsWith('12.21'));
  console.log(`  Chunks with section_ref starting with "12.21": ${chunks1221.length}`);

  for (const chunk of chunks1221) {
    const hasParking = chunk.full_text.toLowerCase().includes('parking');
    const has500sqft = chunk.full_text.includes('500 square feet');
    const hasDwelling = chunk.full_text.toLowerCase().includes('dwelling unit');

    console.log();
    console.log(`  Section: ${chunk.section_ref}`);
    console.log(`    Tokens: ${chunk.token_count}`);
    console.log(`    Hierarchy: ${chunk.hierarchy}`);
    console.log(`    Has "parking": ${hasParking}`);
    console.log(`    Has "500 square feet": ${has500sqft}`);
    console.log(`    Has "dwelling unit": ${hasDwelling}`);
    console.log(`    Preview: ${chunk.full_text.substring(0, 200).replace(/\n/g, ' ')}...`);
  }
  console.log();

  // Step 5: Check if there's a chunk with the parking ratios
  console.log('Step 5: Searching ALL chunks for parking ratio content...');

  const parkingChunks = chunks.filter(c =>
    c.full_text.includes('500 square feet') ||
    c.full_text.includes('Off-Street Automobile Parking')
  );

  console.log(`  Chunks containing parking ratio content: ${parkingChunks.length}`);

  for (const chunk of parkingChunks) {
    console.log();
    console.log(`  Section: ${chunk.section_ref}`);
    console.log(`    Tokens: ${chunk.token_count}`);
    console.log(`    Preview: ${chunk.full_text.substring(0, 300).replace(/\n/g, ' ')}...`);
  }
  console.log();

  // Step 6: Find oversized chunks that might have been truncated
  console.log('Step 6: Checking for oversized chunks (> 7000 tokens)...');

  const oversized = chunks.filter(c => c.token_count > 7000);
  console.log(`  Oversized chunks: ${oversized.length}`);

  for (const chunk of oversized) {
    console.log(`    ${chunk.section_ref}: ${chunk.token_count} tokens`);
  }
  console.log();

  // Step 7: List all unique section_refs
  console.log('Step 7: All unique section_refs (first 50)...');
  const uniqueRefs = [...new Set(chunks.map(c => c.section_ref))].sort();
  console.log(`  Total unique sections: ${uniqueRefs.length}`);
  uniqueRefs.slice(0, 50).forEach(ref => console.log(`    ${ref}`));
  if (uniqueRefs.length > 50) {
    console.log(`    ... and ${uniqueRefs.length - 50} more`);
  }
  console.log();

  // Step 8: Check specifically for "12.21" (without subsection)
  console.log('Step 8: Looking for exact section_ref "12.21"...');
  const exact1221 = chunks.filter(c => c.section_ref === '12.21');
  console.log(`  Chunks with section_ref === "12.21": ${exact1221.length}`);

  if (exact1221.length > 0) {
    for (const chunk of exact1221) {
      console.log(`    Found! Tokens: ${chunk.token_count}`);
      console.log(`    First 500 chars: ${chunk.full_text.substring(0, 500)}`);
    }
  } else {
    console.log('  ⚠️  NO CHUNK WITH section_ref "12.21" EXISTS!');
    console.log('  This confirms the parser is not creating a chunk for SEC. 12.21 General Provisions');
  }

  console.log();
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
}

diagnose().catch(console.error);
