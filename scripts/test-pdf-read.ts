#!/usr/bin/env ts-node

/**
 * Test PDF Reading for Chapter I Zoning Code
 *
 * Tests if we can download and parse the official LA City PDF
 * for Chapter I Zoning Code.
 */

import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Try multiple potential PDF URLs
const PDF_URLS = [
  'https://planning.lacity.org/odocument/34123/Chapter_01.pdf',
  'https://planning.lacity.org/odocument/lamc-chapter-1.pdf',
  'https://planning.lacity.gov/odocument/34123/Chapter_01.pdf',
];

const CACHE_DIR = path.join(__dirname, '../.cache');
const PDF_CACHE_PATH = path.join(CACHE_DIR, 'chapter1-zoning.pdf');

// =============================================================================
// MAIN LOGIC
// =============================================================================

async function downloadPDF(url: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`  Attempting: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.log(`  ✗ Failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('pdf')) {
      console.log(`  ✗ Not a PDF: ${contentType}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    const sizeKB = Math.round(buffer.byteLength / 1024);
    console.log(`  ✓ Downloaded: ${sizeKB} KB`);
    return true;
  } catch (error) {
    console.log(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('CHAPTER I PDF DOWNLOAD & PARSE TEST');
  console.log('='.repeat(80));
  console.log();

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Step 1: Try to download PDF from various URLs
  console.log('Step 1: Attempting to download PDF...');

  let downloaded = false;
  for (const url of PDF_URLS) {
    downloaded = await downloadPDF(url, PDF_CACHE_PATH);
    if (downloaded) {
      break;
    }
  }

  if (!downloaded) {
    console.log('\n✗ Could not download PDF from any known URL.');
    console.log('\nPlease manually download the Chapter I Zoning PDF from:');
    console.log('  - LA Planning website: https://planning.lacity.org/');
    console.log('  - Search for "LAMC Chapter 1 PDF" or "Los Angeles Zoning Code Chapter 1 PDF"');
    console.log('\nThen save it to:', PDF_CACHE_PATH);
    process.exit(1);
  }

  console.log();

  // Step 2: Parse the PDF
  console.log('Step 2: Parsing PDF...');

  const dataBuffer = fs.readFileSync(PDF_CACHE_PATH);
  const pdfData = await pdfParse(dataBuffer);

  console.log(`  ✓ Pages: ${pdfData.numpages}`);
  console.log(`  ✓ Text length: ${pdfData.text.length.toLocaleString()} characters\n`);

  // Step 3: Show first 500 characters
  console.log('Step 3: First 500 characters of extracted text:');
  console.log('='.repeat(80));
  console.log(pdfData.text.substring(0, 500));
  console.log('='.repeat(80));
  console.log();

  // Step 4: Content quality check
  console.log('Step 4: Content Quality Check:');
  console.log('-'.repeat(80));

  const hasChapterHeader = /CHAPTER\s+I/i.test(pdfData.text.substring(0, 2000));
  const hasSectionHeaders = /SEC\.\s+12\./i.test(pdfData.text) || /Section\s+12\./i.test(pdfData.text);
  const hasZoningContent = pdfData.text.toLowerCase().includes('zoning') ||
                           pdfData.text.toLowerCase().includes('zone');
  const hasRegulatoryText = pdfData.text.toLowerCase().includes('permitted') ||
                           pdfData.text.toLowerCase().includes('shall');

  console.log('Contains "CHAPTER I" header:', hasChapterHeader ? '✓ YES' : '✗ NO');
  console.log('Contains SEC. 12.X headers:', hasSectionHeaders ? '✓ YES' : '✗ NO');
  console.log('Contains zoning keywords:', hasZoningContent ? '✓ YES' : '✗ NO');
  console.log('Contains regulatory text:', hasRegulatoryText ? '✓ YES' : '✗ NO');
  console.log();

  if (hasChapterHeader && hasSectionHeaders && hasZoningContent) {
    console.log('✓ SUCCESS: PDF contains real Chapter I zoning code content!');
    console.log('  - We can use this PDF for ingestion.');
    console.log('  - Next step: Run the full PDF ingestion pipeline.');
    console.log();
    console.log('Cached PDF location:', PDF_CACHE_PATH);
  } else {
    console.log('⚠️  WARNING: PDF may not contain the expected content.');
    console.log('  - Verify the PDF is the correct document.');
  }

  console.log();
}

// =============================================================================
// EXECUTION
// =============================================================================

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
