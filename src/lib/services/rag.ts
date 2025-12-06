import { getServerClient } from '@/lib/supabase';
import { generateEmbedding } from './embeddings';
import { RetrievedChunk, RAGContext, ZoningDoc } from '@/types';

interface RetrievalOptions {
  topK?: number;
  threshold?: number;
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

interface RRFResult {
  section_ref: string;
  content: string;
  similarity: number;
  id: number;
  chunk_index: number;
}

/**
 * Reciprocal Rank Fusion (RRF) merge with Tier 1 boosting and intent-based routing
 */
function rrfMerge(
  vectorResults: Array<{ section_ref: string; content: string; similarity: number; id: number; chunk_index: number }>,
  bm25Results: Array<{ section_ref: string; content: string; rank: number; id: number }>,
  intent: QueryIntent = 'mixed',
  k: number = 60
): RRFResult[] {
  const scores = new Map<number, { rrf: number; data: RRFResult }>();

  // Add vector results
  vectorResults.forEach((r, i) => {
    const existing = scores.get(r.id);
    if (existing) {
      existing.rrf += 1 / (k + i + 1);
    } else {
      scores.set(r.id, {
        rrf: 1 / (k + i + 1),
        data: {
          id: r.id,
          section_ref: r.section_ref,
          content: r.content,
          similarity: r.similarity,
          chunk_index: r.chunk_index || 0,
        },
      });
    }
  });

  // Add BM25 results
  bm25Results.forEach((r, i) => {
    const existing = scores.get(r.id);
    if (existing) {
      existing.rrf += 1 / (k + i + 1);
    } else {
      scores.set(r.id, {
        rrf: 1 / (k + i + 1),
        data: {
          id: r.id,
          section_ref: r.section_ref,
          content: r.content,
          similarity: 0,
          chunk_index: 0,
        },
      });
    }
  });

  // Apply Tier 1 boost (3.0x) + intent-based chapter weight
  // Intent routing helps canonical sections surface for their respective domains
  const merged = Array.from(scores.values())
    .map(({ rrf, data }) => {
      const tier1Boost = isTier1Section(data.section_ref) ? 3.0 : 1.0;
      const chapterWeight = getChapterWeight(data.section_ref, intent);
      return {
        ...data,
        similarity: rrf * tier1Boost * chapterWeight,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return merged;
}

/**
 * Retrieve relevant zoning code sections for a query
 *
 * Uses hybrid search (Vector + BM25) with Tier 1 boosting for best results.
 * Searches ALL Los Angeles chapters (Chapter 1, Chapter 1A, Chapter IX)
 * and merges results via RRF.
 */
export async function getRelevantZoningSections(
  docIdOrSlug: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  const supabase = getServerClient();
  const { topK = 8, threshold = 0.2 } = options;

  // Classify query intent for chapter prioritization
  const intent = classifyQueryIntent(query);

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Get doc_ids for ALL Los Angeles chapters
  const { data: docs } = await supabase
    .from('zoning_docs')
    .select('id, slug')
    .in('slug', ['los-angeles-chapter1', 'los-angeles-chapter1a', 'los-angeles-chapter9']);

  const chapter1Doc = docs?.find(d => d.slug === 'los-angeles-chapter1');
  const chapter1aDoc = docs?.find(d => d.slug === 'los-angeles-chapter1a');
  const chapter9Doc = docs?.find(d => d.slug === 'los-angeles-chapter9');

  // Parallel fetch: Vector + BM25 from ALL chapters
  // Fetch more per chapter (20 each) to ensure canonical sections aren't missed
  const perChapterCount = 20;

  // Track which chapters we're searching and their response indices
  const chapterSearches: Array<{ name: string; doc: { id: string } }> = [];

  // Chapter 1 searches
  if (chapter1Doc) {
    chapterSearches.push({ name: 'Chapter 1', doc: chapter1Doc });
  }

  // Chapter 1A searches
  if (chapter1aDoc) {
    chapterSearches.push({ name: 'Chapter 1A', doc: chapter1aDoc });
  }

  // Chapter IX searches (Building Code)
  if (chapter9Doc) {
    chapterSearches.push({ name: 'Chapter IX', doc: chapter9Doc });
  }

  // Build all search promises (2 per chapter: vector + BM25)
  const searchPromises: PromiseLike<any>[] = [];
  for (const { doc } of chapterSearches) {
    searchPromises.push(
      supabase.rpc('match_zoning_sections_filtered', {
        query_embedding: queryEmbedding,
        match_threshold: 0.15,  // Lower threshold for better recall
        match_count: perChapterCount,
        filter_doc_id: doc.id,
      }),
      supabase.rpc('search_zoning_bm25', {
        query_text: query,
        filter_doc_id: doc.id,
        top_k: perChapterCount,
      })
    );
  }

  const responses = await Promise.all(searchPromises);

  // Combine vector results from all chapters
  const allVectorResults: Array<{ id: number; section_ref: string; content: string; similarity: number; chunk_index: number }> = [];
  const allBm25Results: Array<{ id: number; section_ref: string; content: string; rank: number }> = [];

  // Process results from each chapter (2 responses per chapter: vector, bm25)
  // Store per-chapter results to enable fair position-based RRF
  const perChapterVector: Array<Array<{ id: number; section_ref: string; content: string; similarity: number; chunk_index: number }>> = [];
  const perChapterBm25: Array<Array<{ id: number; section_ref: string; content: string; rank: number }>> = [];

  chapterSearches.forEach((chapter, idx) => {
    const vectorIdx = idx * 2;
    const bm25Idx = idx * 2 + 1;

    const chapterVectorResults: typeof allVectorResults = [];
    const chapterBm25Results: typeof allBm25Results = [];

    if (responses.length > bm25Idx) {
      const vectorResp = responses[vectorIdx];
      const bm25Resp = responses[bm25Idx];

      if (vectorResp.error) console.error(`${chapter.name} vector error:`, vectorResp.error);
      if (bm25Resp.error) console.error(`${chapter.name} BM25 error:`, bm25Resp.error);

      (vectorResp.data || []).forEach((d: any) => {
        chapterVectorResults.push({
          id: d.id,
          section_ref: d.section_ref,
          content: d.content,
          similarity: d.similarity,
          chunk_index: d.chunk_index || 0,
        });
      });

      (bm25Resp.data || []).forEach((d: any) => {
        chapterBm25Results.push({
          id: d.id,
          section_ref: d.section_ref,
          content: d.content,
          rank: d.rank,
        });
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

  // RRF merge with Tier 1 boosting + intent-based chapter routing
  const merged = rrfMerge(allVectorResults, allBm25Results, intent);

  // Convert to RetrievedChunk format and return top-k
  return merged.slice(0, topK).map(r => ({
    id: r.id,
    section_ref: r.section_ref,
    content: r.content,
    similarity: r.similarity,
    chunk_index: r.chunk_index,
  })) as RetrievedChunk[];
}

/**
 * Get full RAG context including document metadata
 *
 * For Los Angeles, this returns metadata from the first available chapter
 * but searches across ALL chapters for relevant content.
 */
export async function getRAGContext(
  docIdOrSlug: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RAGContext> {
  const supabase = getServerClient();

  // For now, we only support Los Angeles
  // Get any one of the LA documents for metadata (we'll use the first one found)
  const { data: docs, error: docError } = await supabase
    .from('zoning_docs')
    .select('*')
    .like('slug', 'los-angeles%')
    .limit(1);

  if (docError || !docs || docs.length === 0) {
    throw new Error(`No Los Angeles documents found in database`);
  }

  const doc = docs[0];

  // Get relevant chunks from ALL LA chapters
  const chunks = await getRelevantZoningSections(docIdOrSlug, query, options);

  return {
    doc: doc as ZoningDoc,
    chunks,
  };
}

/**
 * Format retrieved chunks as context for LLM
 */
export function formatChunksAsContext(
  chunks: RetrievedChunk[],
  doc: ZoningDoc
): string {
  if (chunks.length === 0) {
    return 'No relevant sections found in the zoning code.';
  }

  const header = `ZONING CODE EXCERPTS
Source: ${doc.city_name} - ${doc.code_name}
URL: ${doc.source_url}
---

`;

  const formattedChunks = chunks.map((chunk, i) => {
    const sectionLabel = chunk.section_ref
      ? `[${chunk.section_ref}]`
      : `[Chunk ${chunk.chunk_index}]`;

    return `${sectionLabel}
${chunk.content}

`;
  });

  return header + formattedChunks.join('---\n\n');
}

/**
 * Get context for multiple queries (for packet generation and query decomposition)
 * Executes all searches in parallel for better performance
 */
export async function getMultiQueryContext(
  docId: string,
  queries: string[],
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  // Execute all searches in parallel
  const searchPromises = queries.map(query =>
    getRelevantZoningSections(docId, query, options)
  );

  const results = await Promise.all(searchPromises);

  // Deduplicate chunks by ID and merge results
  const seenIds = new Set<number>();
  const allChunks: RetrievedChunk[] = [];

  for (const chunks of results) {
    for (const chunk of chunks) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        allChunks.push(chunk);
      }
    }
  }

  // Sort by highest similarity
  return allChunks.sort((a, b) => b.similarity - a.similarity);
}
