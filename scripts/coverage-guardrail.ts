#!/usr/bin/env tsx

/**
 * Coverage Guardrail for LA Municipal Code Ingestion
 *
 * Validates that critical Tier 1 sections exist in the parsed chunks
 * and contain expected content. Fails fast if critical data is missing.
 */

import type { RegulationChunk } from '../src/lib/services/chunking';

// =============================================================================
// TIER 1 CRITICAL SECTIONS
// =============================================================================

interface CriticalSection {
  id: string;                    // Section ID pattern to match
  name: string;                  // Human-readable name
  requiredKeywords: string[];    // At least one of these must appear
  minContentLength: number;      // Minimum character count
}

/**
 * Tier 1 Critical Sections for LA Municipal Code
 *
 * These sections MUST exist and contain meaningful content.
 * If any are missing or empty, ingestion should fail.
 */
export const TIER1_CRITICAL_SECTIONS: CriticalSection[] = [
  {
    id: '12.21.A.4',
    name: 'Off-Street Parking Requirements',
    requiredKeywords: ['parking', 'automobile', '500 square feet', 'dwelling unit'],
    minContentLength: 5000,
  },
  {
    id: '12.21.1',
    name: 'Height of Buildings',
    requiredKeywords: ['height', 'floor area', 'stories'],
    minContentLength: 2000,
  },
  {
    id: '12.08',
    name: 'R1 One-Family Zone',
    requiredKeywords: ['one-family', 'dwelling', 'R1'],
    minContentLength: 3000,
  },
  {
    id: '12.09',
    name: 'R2 Two-Family Zone',
    requiredKeywords: ['two-family', 'dwelling', 'R2'],
    minContentLength: 500,
  },
  {
    id: '12.10',
    name: 'R3 Multiple Dwelling Zone',
    requiredKeywords: ['multiple dwelling', 'R3'],
    minContentLength: 500,
  },
  {
    id: '12.14',
    name: 'C2 Commercial Zone',
    requiredKeywords: ['commercial', 'C2'],
    minContentLength: 3000,
  },
  {
    id: '12.03',
    name: 'Definitions',
    requiredKeywords: ['definition', 'means', 'shall'],
    minContentLength: 5000,
  },
  {
    id: '12.22',
    name: 'Exceptions',
    requiredKeywords: ['exception', 'yard', 'setback'],
    minContentLength: 5000,
  },
  {
    id: '12.24',
    name: 'Conditional Use Permits',
    requiredKeywords: ['conditional use', 'permit', 'zoning administrator'],
    minContentLength: 5000,
  },
  {
    id: '12.21.C',
    name: 'Hillside Area Regulations',
    requiredKeywords: ['hillside', 'slope', 'grading'],
    minContentLength: 5000,
  },
  {
    id: '12.23',
    name: 'Variances',
    requiredKeywords: ['variance', 'zoning administrator', 'hardship'],
    minContentLength: 3000,
  },
];

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

interface ValidationResult {
  section: CriticalSection;
  found: boolean;
  matchingChunks: RegulationChunk[];
  totalContentLength: number;
  hasRequiredKeywords: boolean;
  missingKeywords: string[];
  errors: string[];
}

/**
 * Validate that a critical section exists and has meaningful content
 */
function validateSection(
  section: CriticalSection,
  chunks: RegulationChunk[]
): ValidationResult {
  const errors: string[] = [];

  // Find all chunks that match this section
  // Match both exact (12.21.A.4) and partial (12.21.A.4_part1) section refs
  const matchingChunks = chunks.filter(c =>
    c.section_ref === section.id ||
    c.section_ref.startsWith(`${section.id}_`) ||
    c.section_ref.startsWith(`${section.id}.`)
  );

  const found = matchingChunks.length > 0;

  if (!found) {
    errors.push(`Section "${section.id}" (${section.name}) not found in any chunk`);
  }

  // Calculate total content length across all matching chunks
  const totalContentLength = matchingChunks.reduce(
    (sum, c) => sum + c.full_text.length,
    0
  );

  if (found && totalContentLength < section.minContentLength) {
    errors.push(
      `Section "${section.id}" content too short: ${totalContentLength} chars (min: ${section.minContentLength})`
    );
  }

  // Check for required keywords
  const combinedText = matchingChunks.map(c => c.full_text.toLowerCase()).join(' ');
  const missingKeywords = section.requiredKeywords.filter(
    keyword => !combinedText.includes(keyword.toLowerCase())
  );

  const hasRequiredKeywords = missingKeywords.length < section.requiredKeywords.length;

  if (found && !hasRequiredKeywords) {
    errors.push(
      `Section "${section.id}" missing ALL required keywords: ${section.requiredKeywords.join(', ')}`
    );
  }

  return {
    section,
    found,
    matchingChunks,
    totalContentLength,
    hasRequiredKeywords,
    missingKeywords,
    errors,
  };
}

/**
 * Run coverage validation on a set of chunks
 *
 * @returns Object with validation results and overall pass/fail status
 */
export function validateCoverage(chunks: RegulationChunk[]): {
  passed: boolean;
  results: ValidationResult[];
  summary: {
    totalSections: number;
    foundSections: number;
    missingSections: string[];
    errors: string[];
  };
} {
  const results = TIER1_CRITICAL_SECTIONS.map(section =>
    validateSection(section, chunks)
  );

  const foundSections = results.filter(r => r.found).length;
  const missingSections = results
    .filter(r => !r.found)
    .map(r => `${r.section.id} (${r.section.name})`);

  const allErrors = results.flatMap(r => r.errors);

  const passed = allErrors.length === 0;

  return {
    passed,
    results,
    summary: {
      totalSections: TIER1_CRITICAL_SECTIONS.length,
      foundSections,
      missingSections,
      errors: allErrors,
    },
  };
}

/**
 * Print coverage report to console
 */
export function printCoverageReport(chunks: RegulationChunk[]): boolean {
  console.log('='.repeat(80));
  console.log('COVERAGE GUARDRAIL: Tier 1 Critical Sections');
  console.log('='.repeat(80));
  console.log();

  const { passed, results, summary } = validateCoverage(chunks);

  // Print each section's status
  for (const result of results) {
    const status = result.found ? '✓' : '✗';
    const statusColor = result.found ? '' : '  ⚠️';

    console.log(`${status} ${result.section.id}: ${result.section.name}${statusColor}`);

    if (result.found) {
      console.log(`    Chunks: ${result.matchingChunks.length}`);
      console.log(`    Content: ${result.totalContentLength.toLocaleString()} chars`);
      console.log(`    Keywords: ${result.hasRequiredKeywords ? 'Found' : 'Missing some'}`);

      if (result.missingKeywords.length > 0 && result.missingKeywords.length < result.section.requiredKeywords.length) {
        console.log(`    Missing keywords: ${result.missingKeywords.join(', ')}`);
      }
    }

    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`    ERROR: ${err}`));
    }

    console.log();
  }

  // Print summary
  console.log('-'.repeat(80));
  console.log(`Coverage: ${summary.foundSections}/${summary.totalSections} critical sections found`);

  if (summary.missingSections.length > 0) {
    console.log();
    console.log('MISSING SECTIONS:');
    summary.missingSections.forEach(s => console.log(`  - ${s}`));
  }

  if (summary.errors.length > 0) {
    console.log();
    console.log('ERRORS:');
    summary.errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log();
  console.log('='.repeat(80));

  if (passed) {
    console.log('✓ COVERAGE CHECK PASSED');
  } else {
    console.log('✗ COVERAGE CHECK FAILED');
    console.log('  Ingestion should NOT proceed with missing critical sections.');
  }

  console.log('='.repeat(80));

  return passed;
}

// =============================================================================
// CLI ENTRY POINT (only runs when executed directly)
// =============================================================================

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const pdfParse = require('pdf-parse');
  const { chunkMunicipalCode } = require('../src/lib/services/chunking');

  async function main() {
    const PDF_PATH = path.join(__dirname, '../.cache/chapter1.pdf');

    console.log('Loading Chapter I PDF...');
    const dataBuffer = fs.readFileSync(PDF_PATH);
    const pdfData = await pdfParse(dataBuffer);

    console.log('Parsing chunks...');
    const chunks = chunkMunicipalCode(pdfData.text);
    console.log(`Produced ${chunks.length} chunks`);
    console.log();

    const passed = printCoverageReport(chunks);
    process.exit(passed ? 0 : 1);
  }

  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
