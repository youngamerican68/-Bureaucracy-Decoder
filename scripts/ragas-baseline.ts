#!/usr/bin/env tsx

/**
 * RAGAS Baseline Test
 *
 * Runs gold queries against the RAG system and measures:
 * - Context Precision: Are retrieved chunks relevant?
 * - Context Recall: Did we retrieve the expected sections?
 */

import fs from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// =============================================================================
// GOLD QUERIES - Expected section mappings
// =============================================================================

interface GoldQuery {
  query: string;
  expectedSections: string[];  // Section prefixes that SHOULD appear in top-k
  category: string;
}

const GOLD_QUERIES: GoldQuery[] = [
  // ==========================================================================
  // CHAPTER 1 - Traditional Zoning Code (SEC. 12.xx)
  // ==========================================================================

  // Parking queries (high frequency)
  { query: 'parking requirements for restaurant in C2 zone', expectedSections: ['12.21.A.4'], category: 'parking' },
  { query: 'how many parking spaces per dwelling unit', expectedSections: ['12.21.A.4'], category: 'parking' },
  { query: 'parking ratio commercial building', expectedSections: ['12.21.A.4'], category: 'parking' },

  // Height/density queries
  { query: 'height limit R1 zone single family', expectedSections: ['12.08', '12.21.1'], category: 'height' },
  { query: 'maximum building height residential', expectedSections: ['12.21.1'], category: 'height' },
  { query: 'floor area ratio calculation', expectedSections: ['12.21.1', '12.03'], category: 'height' },

  // Zone-specific queries
  { query: 'what uses are allowed in R1 zone', expectedSections: ['12.08'], category: 'zoning' },
  { query: 'R2 two family dwelling requirements', expectedSections: ['12.09'], category: 'zoning' },
  { query: 'R3 multiple dwelling zone regulations', expectedSections: ['12.10'], category: 'zoning' },
  { query: 'C2 commercial zone permitted uses', expectedSections: ['12.14'], category: 'zoning' },

  // Setbacks/exceptions
  { query: 'front yard setback exceptions', expectedSections: ['12.22'], category: 'setbacks' },
  { query: 'side yard requirements residential', expectedSections: ['12.22', '12.08'], category: 'setbacks' },

  // Permits/variances
  { query: 'conditional use permit requirements', expectedSections: ['12.24'], category: 'permits' },
  { query: 'variance application hillside', expectedSections: ['12.23', '12.21.C'], category: 'permits' },
  { query: 'CUP process zoning administrator', expectedSections: ['12.24'], category: 'permits' },

  // Hillside
  { query: 'hillside grading requirements', expectedSections: ['12.21.C'], category: 'hillside' },
  { query: 'slope regulations hillside area', expectedSections: ['12.21.C'], category: 'hillside' },

  // Definitions
  { query: 'definition of dwelling unit', expectedSections: ['12.03'], category: 'definitions' },
  { query: 'what is floor area definition', expectedSections: ['12.03'], category: 'definitions' },
  { query: 'accessory building definition', expectedSections: ['12.03'], category: 'definitions' },

  // ==========================================================================
  // CHAPTER 1A - New Zoning Code (Article.Section format)
  // ==========================================================================

  // Density Bonus (Article 9.2)
  { query: 'DTLA TOC affordable housing bonus', expectedSections: ['9.2.1', '9.2.7'], category: 'density_bonus' },
  { query: 'Downtown density bonus FAR', expectedSections: ['9.2.1'], category: 'density_bonus' },
  { query: 'state density bonus program eligibility', expectedSections: ['9.2.1'], category: 'density_bonus' },
  { query: 'affordable housing incentive program', expectedSections: ['9.2.1', '9.2.2'], category: 'density_bonus' },
  { query: 'density bonus 50 percent calculation', expectedSections: ['9.2.1'], category: 'density_bonus' },

  // Transit Oriented Communities (TOC)
  { query: 'transit oriented communities incentive', expectedSections: ['9.2.5', '9.2.7', '1.5.16'], category: 'toc' },
  { query: 'TOC parking reduction near transit', expectedSections: ['9.2.5', '9.2.7', '9.2.1'], category: 'toc' },

  // Affordable Housing Fees
  { query: 'affordable housing linkage fee', expectedSections: ['15.4'], category: 'housing_fees' },
  { query: 'density bonus program fees', expectedSections: ['15.4'], category: 'housing_fees' },

  // Tract Maps & Subdivisions (Article 11)
  { query: 'Downtown subdivision tract map rules', expectedSections: ['11.5'], category: 'subdivisions' },
  { query: 'condominium conversion requirements', expectedSections: ['11.5'], category: 'subdivisions' },

  // Emergency Provisions
  { query: 'emergency shelter homeless provisions', expectedSections: ['1.6'], category: 'emergency' },
  { query: 'temporary use permit emergency', expectedSections: ['1.6'], category: 'emergency' },

  // ==========================================================================
  // CHAPTER IX - Building Code (SEC. 91.xxx, 98.xxx, 99.xxx)
  // ==========================================================================

  // Permits (91.106)
  { query: 'when is a building permit required', expectedSections: ['91.106'], category: 'permits_building' },
  { query: 'permit exemptions minor work', expectedSections: ['91.106'], category: 'permits_building' },
  { query: 'work requiring building permit', expectedSections: ['91.106'], category: 'permits_building' },

  // Fees (91.107)
  { query: 'building permit fee calculation', expectedSections: ['91.107'], category: 'fees_building' },
  { query: 'LADBS permit fees schedule', expectedSections: ['91.107'], category: 'fees_building' },

  // Inspections (91.108, 91.1704, 91.1705)
  { query: 'required building inspections', expectedSections: ['91.108'], category: 'inspections' },
  { query: 'special inspection requirements', expectedSections: ['91.1705'], category: 'inspections' },
  { query: 'structural observation requirements', expectedSections: ['91.1704'], category: 'inspections' },

  // Certificate of Occupancy (91.109)
  { query: 'certificate of occupancy requirements', expectedSections: ['91.109'], category: 'co' },
  { query: 'when is certificate of occupancy needed', expectedSections: ['91.109'], category: 'co' },

  // Grading (91.7003, 91.7006)
  { query: 'grading permit requirements', expectedSections: ['91.7006', '91.7003'], category: 'grading' },
  { query: 'grading definitions cut fill', expectedSections: ['91.7003'], category: 'grading' },

  // Enforcement (98.0403)
  { query: 'building code enforcement powers', expectedSections: ['98.0403'], category: 'enforcement' },
  { query: 'LADBS department enforcement authority', expectedSections: ['98.0403'], category: 'enforcement' },

  // Green Building (99.04.100, 99.05.100 - Basic Provisions)
  { query: 'CALGreen residential building code', expectedSections: ['99.04.100'], category: 'green_building' },
  { query: 'CALGreen commercial building code', expectedSections: ['99.05.100'], category: 'green_building' },
  { query: 'green building water efficiency requirements', expectedSections: ['99.04.303', '99.05.303'], category: 'green_building' },
];

// =============================================================================
// RAG RETRIEVAL
// =============================================================================

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

// Cache doc_id lookups
let chapter1DocId: string | null = null;
let chapter1aDocId: string | null = null;
let chapter9DocId: string | null = null;

async function getDocIds(): Promise<{ chapter1: string | null; chapter1a: string | null; chapter9: string | null }> {
  if (chapter1DocId !== null || chapter1aDocId !== null || chapter9DocId !== null) {
    return { chapter1: chapter1DocId, chapter1a: chapter1aDocId, chapter9: chapter9DocId };
  }

  const { data } = await supabase
    .from('zoning_docs')
    .select('id, slug')
    .in('slug', ['los-angeles-chapter1', 'los-angeles-chapter1a', 'los-angeles-chapter9']);

  if (!data) throw new Error('No LA docs found');

  const ch1 = data.find(d => d.slug === 'los-angeles-chapter1');
  const ch1a = data.find(d => d.slug === 'los-angeles-chapter1a');
  const ch9 = data.find(d => d.slug === 'los-angeles-chapter9');

  chapter1DocId = ch1?.id || null;
  chapter1aDocId = ch1a?.id || null;
  chapter9DocId = ch9?.id || null;

  return { chapter1: chapter1DocId, chapter1a: chapter1aDocId, chapter9: chapter9DocId };
}

interface RetrievalResult {
  section_ref: string;
  similarity: number;
}

// =============================================================================
// QUERY INTENT CLASSIFICATION
// =============================================================================

type QueryIntent = 'zoning' | 'building' | 'mixed';

// Keywords that strongly indicate building code queries (Chapter IX)
const BUILDING_CODE_KEYWORDS = [
  // Permit/inspection process
  'building permit', 'permit required', 'permit fee', 'permit application',
  'inspection', 'inspector', 'certificate of occupancy', 'c of o', 'co required',
  'plan check', 'plan review',
  // Structural/construction
  'structural', 'foundation', 'footing', 'reinforcement', 'seismic',
  'special inspection', 'deputy inspector',
  // Grading
  'grading permit', 'grading plan', 'cut and fill', 'excavation',
  // Building systems
  'electrical', 'plumbing', 'mechanical', 'hvac', 'fire sprinkler',
  // Green building
  'calgreen', 'cal green', 'green building', 'energy code', 'title 24',
  // LADBS specific
  'ladbs', 'building and safety', 'department of building',
  // Code references
  '91.', '92.', '93.', '94.', '95.', '96.', '97.', '98.', '99.',
];

// Keywords that strongly indicate zoning queries (Chapter 1 / 1A)
const ZONING_CODE_KEYWORDS = [
  // Zone types
  'r1 zone', 'r2 zone', 'r3 zone', 'r4 zone', 'r5 zone',
  'c1 zone', 'c2 zone', 'c4 zone', 'c5 zone', 'cm zone',
  'm1 zone', 'm2 zone', 'm3 zone',
  'single family', 'multi-family', 'multifamily', 'residential zone',
  'commercial zone', 'industrial zone', 'manufacturing zone',
  // Zoning concepts
  'permitted use', 'conditional use', 'variance', 'cup', 'zoning administrator',
  'setback', 'front yard', 'side yard', 'rear yard',
  'height limit', 'height district', 'floor area ratio', 'far',
  'lot coverage', 'density', 'dwelling unit',
  // Parking (zoning)
  'parking requirement', 'parking ratio', 'parking spaces', 'off-street parking',
  // Hillside
  'hillside', 'slope', 'grading ordinance',
  // Density bonus
  'density bonus', 'affordable housing', 'toc', 'transit oriented',
  // Code references
  '12.', 'sec. 12', 'section 12',
];

/**
 * Classify query intent to determine chapter prioritization.
 * Returns 'zoning', 'building', or 'mixed' based on keyword analysis.
 */
function classifyQueryIntent(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();

  let zoningScore = 0;
  let buildingScore = 0;

  // Check for zoning keywords
  for (const keyword of ZONING_CODE_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      zoningScore += keyword.length > 10 ? 2 : 1; // Longer phrases = stronger signal
    }
  }

  // Check for building keywords
  for (const keyword of BUILDING_CODE_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      buildingScore += keyword.length > 10 ? 2 : 1;
    }
  }

  // Determine intent based on scores
  if (buildingScore > 0 && zoningScore === 0) return 'building';
  if (zoningScore > 0 && buildingScore === 0) return 'zoning';
  if (buildingScore > zoningScore * 2) return 'building'; // Strong building signal
  if (zoningScore > buildingScore * 2) return 'zoning';   // Strong zoning signal

  return 'mixed'; // Default to searching all chapters equally
}

// Tier 1 sections get a boost in RRF scoring
// Chapter 1 (Traditional Zoning Code - SEC. 12.xx format)
const TIER1_CHAPTER1_PREFIXES = [
  '12.21.A.4',   // Off-Street Parking Requirements
  '12.21.1',    // Height of Buildings
  '12.08',      // R1 One-Family Zone
  '12.09',      // R2 Two-Family Zone
  '12.10',      // R3 Multiple Dwelling Zone
  '12.14',      // C2 Commercial Zone
  '12.03',      // Definitions
  '12.22',      // Exceptions
  '12.24',      // Conditional Use Permits
  '12.21.C',    // Hillside Area Regulations
  '12.23',      // Variances
];

// Chapter 1A (New Zoning Code - Article.Section format)
const TIER1_CHAPTER1A_PREFIXES = [
  '9.2.1',      // State Density Bonus Program
  '9.2.2',      // Affordable Housing Incentive Program
  '9.2.5',      // Transit Oriented Incentive Program
  '9.2.7',      // Transit Oriented Communities (TOC) Program
  '9.3.2',      // Local Affordable Housing Incentive Program
  '1.5.16',     // Transit Oriented Incentive Map
  '1.6',        // Emergency Provisions
  '14.2',       // Definitions (Measurements)
  '15.4',       // Affordable Housing Program Fees
  '11.5',       // Tract Maps & Conversions
];

// Chapter IX (Building Code - SEC. 91.xxx format)
// Note: Use specific section refs to avoid semantic crowding with zoning code
const TIER1_CHAPTER9_PREFIXES = [
  '91.106',     // Permits Required
  '91.107',     // Fees
  '91.108',     // Inspections
  '91.109',     // Certificate of Occupancy
  '91.1705',    // Special Inspections
  '91.1704',    // Structural Inspections
  '91.7006',    // Grading Permits
  '91.7003',    // Grading Definitions
  '98.0403',    // Department Powers/Enforcement
  '99.04.100',  // Green Building Residential - Basic Provisions
  '99.04.303',  // Green Building Residential - Water Use
  '99.05.100',  // Green Building Non-Residential - Basic Provisions
  '99.05.303',  // Green Building Non-Residential - Water Use
];

const TIER1_SECTION_PREFIXES = [
  ...TIER1_CHAPTER1_PREFIXES,
  ...TIER1_CHAPTER1A_PREFIXES,
  ...TIER1_CHAPTER9_PREFIXES,
];

function isTier1Section(sectionRef: string): boolean {
  return TIER1_SECTION_PREFIXES.some(prefix =>
    sectionRef.startsWith(prefix) || sectionRef === prefix
  );
}

/**
 * Get chapter-level weight for a section based on query intent.
 * Intent-based routing gives priority to the relevant chapter.
 * Tier 1 sections from the prioritized chapter get extra boost.
 */
function getChapterWeight(sectionRef: string, intent: QueryIntent): number {
  const isChapter1 = sectionRef.startsWith('12.');
  const isChapter1A = /^[0-9]{1,2}\.[0-9]/.test(sectionRef) && !sectionRef.startsWith('9') ||
                      sectionRef.startsWith('9.') && !sectionRef.startsWith('9') === false && /^9\.[0-9]/.test(sectionRef);
  const isChapter9 = /^9[1-9]\./.test(sectionRef);
  const isTier1 = isTier1Section(sectionRef);

  // Intent-based routing: prioritize the relevant chapter
  if (intent === 'zoning') {
    // Zoning query: boost zoning chapters, penalize building code
    if (isChapter1) return isTier1 ? 1.3 : 1.2;
    if (isChapter1A) return isTier1 ? 1.2 : 1.1;
    if (isChapter9) return isTier1 ? 0.8 : 0.7;  // Penalize building code for zoning queries
  }

  if (intent === 'building') {
    // Building query: boost building code, penalize zoning
    if (isChapter9) return isTier1 ? 1.3 : 1.2;
    if (isChapter1) return isTier1 ? 0.8 : 0.7;   // Penalize zoning for building queries
    if (isChapter1A) return isTier1 ? 0.9 : 0.8;
  }

  // Mixed intent: neutral weighting with slight zoning preference (default behavior)
  if (isTier1) return 1.0;
  if (isChapter1) return 1.15;
  if (isChapter1A) return 1.1;
  if (isChapter9) return 0.95;

  return 1.0;  // Default
}

/**
 * Reciprocal Rank Fusion (RRF) merge with Tier 1 boosting and intent-based routing
 * Combines vector and BM25 results with k=60 constant
 */
function rrfMerge(
  vectorResults: { section_ref: string; similarity: number }[],
  bm25Results: { section_ref: string; rank: number }[],
  intent: QueryIntent = 'mixed',
  k: number = 60
): RetrievalResult[] {
  const scores = new Map<string, { rrf: number; vectorSim: number; bm25Rank: number }>();

  // Add vector results
  vectorResults.forEach((r, i) => {
    const existing = scores.get(r.section_ref) || { rrf: 0, vectorSim: 0, bm25Rank: 0 };
    existing.rrf += 1 / (k + i + 1);  // RRF formula
    existing.vectorSim = r.similarity;
    scores.set(r.section_ref, existing);
  });

  // Add BM25 results
  bm25Results.forEach((r, i) => {
    const existing = scores.get(r.section_ref) || { rrf: 0, vectorSim: 0, bm25Rank: 0 };
    existing.rrf += 1 / (k + i + 1);  // RRF formula
    existing.bm25Rank = r.rank;
    scores.set(r.section_ref, existing);
  });

  // Apply Tier 1 boost (3.0x) + intent-based chapter weight
  // Intent routing helps canonical sections surface for their respective domains
  const merged = Array.from(scores.entries())
    .map(([section_ref, s]) => {
      const tier1Boost = isTier1Section(section_ref) ? 3.0 : 1.0;
      const chapterWeight = getChapterWeight(section_ref, intent);
      return {
        section_ref,
        similarity: s.rrf * tier1Boost * chapterWeight,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return merged;
}

async function retrieveChunks(query: string, topK: number = 5): Promise<RetrievalResult[]> {
  // Classify query intent for chapter prioritization
  const intent = classifyQueryIntent(query);

  const embedding = await getEmbedding(query);
  const { chapter1, chapter1a, chapter9 } = await getDocIds();

  // Fetch more per chapter (20 each) to ensure canonical sections aren't missed
  const perChapterCount = 20;

  // Track which chapters we're searching and their response indices
  const chapterSearches: Array<{ name: string; docId: string }> = [];

  if (chapter1) chapterSearches.push({ name: 'Chapter 1', docId: chapter1 });
  if (chapter1a) chapterSearches.push({ name: 'Chapter 1A', docId: chapter1a });
  if (chapter9) chapterSearches.push({ name: 'Chapter IX', docId: chapter9 });

  // Build all search promises (2 per chapter: vector + BM25)
  const searchPromises: PromiseLike<any>[] = [];
  for (const { docId } of chapterSearches) {
    searchPromises.push(
      supabase.rpc('match_zoning_sections_filtered', {
        query_embedding: embedding,
        match_threshold: 0.15,  // Lower threshold for better recall
        match_count: perChapterCount,
        filter_doc_id: docId,
      }),
      supabase.rpc('search_zoning_bm25', {
        query_text: query,
        filter_doc_id: docId,
        top_k: perChapterCount,
      })
    );
  }

  const responses = await Promise.all(searchPromises);

  // Combine results from all chapters
  const allVectorResults: { section_ref: string; similarity: number }[] = [];
  const allBm25Results: { section_ref: string; rank: number }[] = [];

  // Store per-chapter results to enable fair position-based RRF
  const perChapterVector: Array<Array<{ section_ref: string; similarity: number }>> = [];
  const perChapterBm25: Array<Array<{ section_ref: string; rank: number }>> = [];

  // Process results from each chapter (2 responses per chapter: vector, bm25)
  chapterSearches.forEach((chapter, idx) => {
    const vectorIdx = idx * 2;
    const bm25Idx = idx * 2 + 1;

    const chapterVectorResults: { section_ref: string; similarity: number }[] = [];
    const chapterBm25Results: { section_ref: string; rank: number }[] = [];

    if (responses.length > bm25Idx) {
      const vectorResp = responses[vectorIdx];
      const bm25Resp = responses[bm25Idx];

      if (vectorResp.error) console.error(`${chapter.name} vector error:`, vectorResp.error);
      if (bm25Resp.error) console.error(`${chapter.name} BM25 error:`, bm25Resp.error);

      (vectorResp.data || []).forEach((d: any) => {
        chapterVectorResults.push({ section_ref: d.section_ref, similarity: d.similarity });
      });
      (bm25Resp.data || []).forEach((d: any) => {
        chapterBm25Results.push({ section_ref: d.section_ref, rank: d.rank });
      });
    }

    // Sort within chapter
    chapterVectorResults.sort((a, b) => b.similarity - a.similarity);
    chapterBm25Results.sort((a, b) => a.rank - b.rank);

    perChapterVector.push(chapterVectorResults);
    perChapterBm25.push(chapterBm25Results);
  });

  // Interleave results from all chapters to give fair position-based ranking
  // This ensures Chapter 1's #1 result competes fairly with Chapter IX's #1 result
  const maxLen = Math.max(
    ...perChapterVector.map(c => c.length),
    ...perChapterBm25.map(c => c.length)
  );

  for (let i = 0; i < maxLen; i++) {
    for (const chapterResults of perChapterVector) {
      if (i < chapterResults.length) {
        allVectorResults.push(chapterResults[i]);
      }
    }
    for (const chapterResults of perChapterBm25) {
      if (i < chapterResults.length) {
        allBm25Results.push(chapterResults[i]);
      }
    }
  }

  const vectorResults = allVectorResults;
  const bm25Results = allBm25Results;

  // RRF merge with intent-based chapter routing
  const merged = rrfMerge(vectorResults, bm25Results, intent);
  return merged.slice(0, topK);
}

// =============================================================================
// METRICS CALCULATION
// =============================================================================

interface QueryResult {
  query: string;
  category: string;
  expectedSections: string[];
  retrievedSections: string[];
  topSimilarity: number;
  recall: number;      // Did we get expected sections?
  precision: number;   // Are retrieved sections relevant?
  hit: boolean;        // At least one expected section in top-k?
}

function sectionMatches(retrieved: string, expected: string): boolean {
  // Strict prefix match: 12.21.A.4_part1 matches 12.21.A.4
  return retrieved.startsWith(expected) || retrieved === expected;
}

function calculateMetrics(
  expectedSections: string[],
  retrievedSections: string[]
): { recall: number; precision: number; hit: boolean } {

  // Recall: What fraction of expected sections appeared in retrieved?
  const expectedHits = expectedSections.filter(exp =>
    retrievedSections.some(ret => sectionMatches(ret, exp))
  );
  const recall = expectedSections.length > 0
    ? expectedHits.length / expectedSections.length
    : 0;

  // Precision: What fraction of retrieved sections match expected?
  const relevantRetrieved = retrievedSections.filter(ret =>
    expectedSections.some(exp => sectionMatches(ret, exp))
  );
  const precision = retrievedSections.length > 0
    ? relevantRetrieved.length / retrievedSections.length
    : 0;

  // Hit: Did we get at least one expected section?
  const hit = expectedHits.length > 0;

  return { recall, precision, hit };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('RAGAS BASELINE TEST');
  console.log('='.repeat(80));
  console.log();

  const results: QueryResult[] = [];

  for (let i = 0; i < GOLD_QUERIES.length; i++) {
    const gold = GOLD_QUERIES[i];

    process.stdout.write(`[${i + 1}/${GOLD_QUERIES.length}] ${gold.query.substring(0, 50)}...`);

    const retrievalResults = await retrieveChunks(gold.query, 5);
    const retrievedSections = retrievalResults.map(r => r.section_ref);
    const topSimilarity = retrievalResults[0]?.similarity || 0;
    const metrics = calculateMetrics(gold.expectedSections, retrievedSections);

    results.push({
      query: gold.query,
      category: gold.category,
      expectedSections: gold.expectedSections,
      retrievedSections,
      topSimilarity,
      ...metrics,
    });

    const status = metrics.hit ? '✓' : '✗';
    console.log(` ${status}`);

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  // ==========================================================================
  // AGGREGATE METRICS
  // ==========================================================================

  console.log();
  console.log('='.repeat(80));
  console.log('RESULTS BY CATEGORY');
  console.log('='.repeat(80));

  const categories = [...new Set(results.map(r => r.category))];

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const avgRecall = catResults.reduce((s, r) => s + r.recall, 0) / catResults.length;
    const avgPrecision = catResults.reduce((s, r) => s + r.precision, 0) / catResults.length;
    const hitRate = catResults.filter(r => r.hit).length / catResults.length;

    console.log(`\n${cat.toUpperCase()} (${catResults.length} queries)`);
    console.log(`  Recall:    ${(avgRecall * 100).toFixed(1)}%`);
    console.log(`  Precision: ${(avgPrecision * 100).toFixed(1)}%`);
    console.log(`  Hit Rate:  ${(hitRate * 100).toFixed(1)}%`);
  }

  // Overall metrics
  const avgRecall = results.reduce((s, r) => s + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((s, r) => s + r.precision, 0) / results.length;
  const hitRate = results.filter(r => r.hit).length / results.length;

  console.log();
  console.log('='.repeat(80));
  console.log('OVERALL METRICS');
  console.log('='.repeat(80));
  console.log(`  Context Recall:    ${(avgRecall * 100).toFixed(1)}%  (target: >80%)`);
  console.log(`  Context Precision: ${(avgPrecision * 100).toFixed(1)}%  (target: >85%)`);
  console.log(`  Hit Rate:          ${(hitRate * 100).toFixed(1)}%`);
  console.log();

  // Show failures
  const failures = results.filter(r => !r.hit);
  if (failures.length > 0) {
    console.log('='.repeat(80));
    console.log('FAILURES (no expected section in top-5)');
    console.log('='.repeat(80));
    for (const f of failures) {
      console.log(`\n  Query: "${f.query}"`);
      console.log(`  Expected: ${f.expectedSections.join(', ')}`);
      console.log(`  Retrieved: ${f.retrievedSections.join(', ')} (${f.retrievedSections.length}/5 chunks)`);
      console.log(`  Top similarity: ${f.topSimilarity.toFixed(3)}`);
    }
  }

  // Save results for trend tracking
  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = path.join(__dirname, `../scripts/data/ragas-baseline-${timestamp}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    overall: { recall: avgRecall, precision: avgPrecision, hitRate },
    byCategory: Object.fromEntries(categories.map(cat => {
      const catResults = results.filter(r => r.category === cat);
      return [cat, {
        recall: catResults.reduce((s, r) => s + r.recall, 0) / catResults.length,
        precision: catResults.reduce((s, r) => s + r.precision, 0) / catResults.length,
        hitRate: catResults.filter(r => r.hit).length / catResults.length,
      }];
    })),
    results,
  }, null, 2));
  console.log();
  console.log(`Results saved to: ${outputPath}`);

  console.log();
  console.log('='.repeat(80));

  // Pass/fail
  const passed = avgRecall >= 0.80 && avgPrecision >= 0.85;
  if (passed) {
    console.log('✓ BASELINE PASSED - Ready to ship');
  } else {
    console.log('⚠ BASELINE BELOW TARGET - Review failures before shipping');
  }
  console.log('='.repeat(80));
}

main().catch(console.error);
