#!/usr/bin/env ts-node

/**
 * Regression Test: Parser Compatibility
 *
 * Verifies that the municipal code parser works correctly for ALL THREE formats:
 * - Chapter IX Building Regulations (format: SEC. 91.101)
 * - Chapter I Zoning (format: SEC. 12.04)
 * - Chapter 1A Downtown Zoning (format: ### Sec. 1.3.1, markdown)
 *
 * This test ensures the parser is "polymorphic" and doesn't break
 * when handling different section numbering formats and styles.
 */

import { chunkMunicipalCode } from '../src/lib/services/chunking';
import fs from 'fs';
import path from 'path';

// =============================================================================
// TEST SAMPLES
// =============================================================================

/**
 * Sample from Chapter IX Building Regulations
 * Format: SEC. 91.XXX (3-digit section numbers, plain text)
 * Hierarchy: CHAPTER IX > ARTICLE X > DIVISION X > SEC. 91.XXX
 */
const CHAPTER_IX_SAMPLE = `
CHAPTER IX

BUILDING REGULATIONS

ARTICLE 1

ADMINISTRATIVE

DIVISION 1

BUILDING CODE – GENERAL ADMINISTRATION

SEC. 91.101. TITLE, PURPOSE, AND SCOPE.

91.101.1. Title. The provisions of this division shall be known as the Building Code and may be cited as such and will be referred to herein as "this code."

91.101.2. Purpose. The purpose of this code is to establish the minimum requirements to provide a reasonable level of safety, public health and general welfare through structural strength, means of egress facilities, stability, sanitation, adequate light and ventilation, energy conservation and safety to life and property from fire and other hazards attributed to the built environment and to provide a reasonable level of safety to fire fighters and emergency responders during emergency operations.

91.101.3. Scope. The provisions of this code shall apply to the construction, alteration, relocation, enlargement, replacement, repair, equipment, use and occupancy, location, maintenance, removal and demolition of every building or structure or any appurtenances connected or attached to such buildings or structures.

SEC. 91.102. APPLICABILITY.

91.102.1. General. Where there is a conflict between a general requirement and a specific requirement, the specific requirement shall govern. Where differences occur between provisions of this code and referenced standards, the provisions of this code shall apply.

91.102.2. Building. The provisions of this code shall apply to the construction, erection, addition, alteration, repair, relocation, replacement, use, occupancy, maintenance and demolition of buildings and structures.
`;

/**
 * Sample from Chapter I Zoning
 * Format: SEC. 12.XX (2-digit section numbers, plain text)
 * Hierarchy: CHAPTER I > ARTICLE 2 > SEC. 12.XX (NO DIVISION)
 */
const CHAPTER_I_SAMPLE = `
CHAPTER I

GENERAL PROVISIONS AND ZONING

ARTICLE 2

SPECIFIC PLANNING - ZONING - COMPREHENSIVE ZONING PLAN

SEC. 12.04. AREA PLANNING COMMISSIONS – JURISDICTION AND AUTHORITY.

(a) Jurisdiction. There shall be seven Area Planning Commissions, each of which shall have jurisdiction over one of seven geographic areas within the City. The boundaries of each Area Planning Commission's geographic area shall be established by resolution of the City Planning Commission.

(b) Authority. Each Area Planning Commission shall have the authority to:

(1) Act as an appellate body for decisions made by the Director of Planning, Zoning Administrators, and other officials as prescribed by this Code.

(2) Make original decisions on certain land use matters as authorized by ordinance.

(3) Advise the City Planning Commission and City Council on matters affecting their geographic areas.

SEC. 12.05. DEFINITIONS.

For the purpose of this chapter, certain words and terms are defined as follows. Words used in the present tense include the future; words in the singular number include the plural, and words in the plural number include the singular.

12.05.1. Accessory Building or Use. A building or use which is clearly incidental to and customarily found in connection with a main building or use.

12.05.2. Alley. Any public way or thoroughfare which has been dedicated or deeded to the public for public use and which affords a secondary means of vehicular access to abutting property.
`;

/**
 * Sample from Chapter 1A Downtown Zoning (MARKDOWN FORMAT)
 * Format: ### Sec. 1.3.1 (3-part section numbers, markdown headers)
 * Hierarchy: Chapter 1A > Article 1 > Division 1.3 > Sec. 1.3.1
 */
const CHAPTER_1A_SAMPLE = `
# Article 1. Introductory Provisions

## Div. 1.3. Orientation

This Division (Orientation) provides an overview of the structure of this Zoning Code (Chapter 1A).

### Sec. 1.3.1. Zone String

The combination of zoning districts applied to a lot including, Form District (Part 2B.), Frontage District (Part 3B.), Development Standards District (Part 4B.), Use District (Part 5B.), and Density District (Part 6B.).

##### Zone String Brackets

A zone is comprised of the following districts, as established in Sec. 1.5.2. (Zoning Map):

In order to regulate the built environment and activities allowed on a property, as provided for in this Zoning Code (Chapter 1A), land is designated with the districts listed in Sec. 1.3.1.B. (Zoning Districts) for zoning purposes.

### Sec. 1.3.2. Non-Zone String Articles

In addition to the zoning district articles, other articles in the Zoning Code (Chapter 1A) include:

##### Article 7 Purpose

Article 7. (Alternate Typologies), governs instances where the desired physical form for development on a lot is prohibited by the applied zoning.

##### Article 9 Purpose

Article 9. (Public Benefit Systems) details procedures for implementing state density bonus provisions to increase the production of affordable housing.

### Sec. 1.3.3. Relief

Throughout this Zoning Code (Chapter 1A), relief statements specify the only relief options available for the standards or rules to which the statements apply.

## Div. 1.4. Introductory Provisions

### Sec. 1.4.1. General Rules

##### Title

This Chapter of the Los Angeles Municipal Code (LAMC) is the City of Los Angeles Zoning Code, and is referred to or cited as "this Zoning Code (Chapter 1A)" or "this Chapter" throughout the LAMC.

##### Intent

This Zoning Code (Chapter 1A) regulates the development and use of property to achieve the following objectives:

01. Preserve, protect, and promote the public health, safety, and general welfare of residents and businesses in the City of Los Angeles.

02. Implement the goals and policies of officially adopted plans and policy documents.
`;

// =============================================================================
// TEST EXECUTION
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
  chunkCount: number;
  sampleChunks: Array<{
    section_ref: string;
    hierarchy: string;
    heading_preview: string;
  }>;
}

function runTest(name: string, sample: string, expectedFormat: string): TestResult {
  const result: TestResult = {
    name,
    passed: false,
    errors: [],
    chunkCount: 0,
    sampleChunks: [],
  };

  try {
    // Run the parser
    const chunks = chunkMunicipalCode(sample, 'test-url');
    result.chunkCount = chunks.length;

    // Validation 1: Should produce chunks
    if (chunks.length === 0) {
      result.errors.push('Parser produced zero chunks');
      return result;
    }

    // Validation 2: All chunks should have section_ref
    const missingRefs = chunks.filter(c => !c.section_ref);
    if (missingRefs.length > 0) {
      result.errors.push(`${missingRefs.length} chunks missing section_ref`);
    }

    // Validation 3: All chunks should have hierarchy
    const missingHierarchy = chunks.filter(c => !c.hierarchy);
    if (missingHierarchy.length > 0) {
      result.errors.push(`${missingHierarchy.length} chunks missing hierarchy`);
    }

    // Validation 4: All chunks should have heading
    const missingHeading = chunks.filter(c => !c.heading);
    if (missingHeading.length > 0) {
      result.errors.push(`${missingHeading.length} chunks missing heading`);
    }

    // Validation 5: Section refs should match expected format
    const invalidRefs = chunks.filter(c => {
      if (expectedFormat === '91.XXX') {
        return c.section_ref && !c.section_ref.startsWith('91.');
      } else if (expectedFormat === '12.XX') {
        return c.section_ref && !c.section_ref.startsWith('12.');
      } else if (expectedFormat === '1.X.X') {
        return c.section_ref && !c.section_ref.startsWith('1.');
      }
      return false;
    });

    if (invalidRefs.length > 0) {
      result.errors.push(
        `${invalidRefs.length} chunks have unexpected section_ref format (expected ${expectedFormat})`
      );
    }

    // Store sample chunks for display
    result.sampleChunks = chunks.slice(0, 3).map(c => ({
      section_ref: c.section_ref,
      hierarchy: c.hierarchy,
      heading_preview: c.heading.substring(0, 60),
    }));

    // Test passes if no errors
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Parser threw error: ${error}`);
  }

  return result;
}

function printResult(result: TestResult) {
  const statusEmoji = result.passed ? '✓' : '✗';
  const statusText = result.passed ? 'PASSED' : 'FAILED';

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`${statusEmoji} ${result.name}: ${statusText}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Chunks produced: ${result.chunkCount}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.forEach(err => {
      console.log(`  - ${err}`);
    });
  }

  if (result.sampleChunks.length > 0) {
    console.log(`\nSample chunks:`);
    result.sampleChunks.forEach((chunk, idx) => {
      console.log(`  ${idx + 1}. Section: ${chunk.section_ref}`);
      console.log(`     Hierarchy: ${chunk.hierarchy}`);
      console.log(`     Heading: ${chunk.heading_preview}...`);
    });
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('PARSER COMPATIBILITY REGRESSION TEST');
  console.log('='.repeat(80));
  console.log('\nTesting parser on ALL THREE municipal code formats...\n');

  // Test Chapter IX (Building Code)
  const test1 = runTest(
    'Chapter IX Building Regulations (SEC. 91.XXX)',
    CHAPTER_IX_SAMPLE,
    '91.XXX'
  );
  printResult(test1);

  // Test Chapter I (Zoning)
  const test2 = runTest(
    'Chapter I Zoning (SEC. 12.XX)',
    CHAPTER_I_SAMPLE,
    '12.XX'
  );
  printResult(test2);

  // Test Chapter 1A (Downtown Zoning - MARKDOWN)
  const test3 = runTest(
    'Chapter 1A Downtown Zoning (### Sec. 1.X.X)',
    CHAPTER_1A_SAMPLE,
    '1.X.X'
  );
  printResult(test3);

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));

  const allPassed = test1.passed && test2.passed && test3.passed;
  const totalErrors = test1.errors.length + test2.errors.length + test3.errors.length;

  if (allPassed) {
    console.log('\n✓ ALL TESTS PASSED');
    console.log('\nThe parser is polymorphic and supports all three formats:');
    console.log('  - Chapter IX Building Code (SEC. 91.XXX, plain text)');
    console.log('  - Chapter I Zoning (SEC. 12.XX, plain text)');
    console.log('  - Chapter 1A Downtown Zoning (### Sec. 1.X.X, markdown)');
    console.log('\nYou can safely proceed with ingestion of all three chapters.');
  } else {
    console.log(`\n✗ SOME TESTS FAILED (${totalErrors} errors total)`);
    console.log('\nThe parser needs adjustments before proceeding.');
    process.exit(1);
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
