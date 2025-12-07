import { getServerClient } from '@/lib/supabase';
import { getMultiQueryContext, formatChunksAsContext, getRAGContext } from './rag';
import { callClaude, SYSTEM_PROMPTS, generatePacketQueries, decomposeQuery } from './llm';
import {
  PreapprovalUserInput,
  PreapprovalPacket,
  ZoningDoc,
  Citation,
  AskZoningResponse,
} from '@/types';

/**
 * Generate a Pre-Approval Packet for a proposed building project
 */
export async function generatePreapprovalPacket(
  docId: string,
  userInput: PreapprovalUserInput
): Promise<PreapprovalPacket> {
  const supabase = getServerClient();

  // Get document info
  const { data: doc, error: docError } = await supabase
    .from('zoning_docs')
    .select('*')
    .eq('id', docId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${docId}`);
  }

  // Generate targeted queries based on user input
  const queries = generatePacketQueries(
    userInput.parcelZone || '',
    userInput.proposedUse || 'development',
    {
      stories: userInput.numberOfStories,
      height: userInput.buildingHeight,
      units: userInput.unitCount,
      lotSize: userInput.lotSize,
    }
  );

  // Get relevant chunks for all queries
  const chunks = await getMultiQueryContext(docId, queries, {
    topK: 15,
    threshold: 0.4,
  });

  // Format context for LLM
  const context = formatChunksAsContext(chunks, doc as ZoningDoc);

  // Build the case description
  const caseDescription = buildCaseDescription(userInput);

  // Call Claude to generate the packet
  const userMessage = `CASE DESCRIPTION:
${caseDescription}

ZONING CODE CONTEXT:
${context}

Based on the provided zoning code excerpts, analyze whether the proposed project complies with zoning requirements. Return your analysis as a JSON object following the specified format.`;

  const response = await callClaude(
    SYSTEM_PROMPTS.PACKET,
    [{ role: 'user', content: userMessage }],
    { temperature: 0.2 }
  );

  // Parse the JSON response
  let packet: PreapprovalPacket;
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    packet = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse packet response:', response);
    throw new Error('Failed to parse AI response as JSON');
  }

  // Add metadata
  packet.generated_at = new Date().toISOString();
  packet.disclaimer = packet.disclaimer ||
    'This analysis is based on AI interpretation of zoning code excerpts and is not legal advice. Always consult a licensed professional and verify with official municipal sources before making any decisions.';

  return packet;
}

/**
 * Answer a question about the zoning code
 * Uses query decomposition for better retrieval on complex/comparative questions
 */
export async function askZoningQuestion(
  docId: string,
  question: string
): Promise<AskZoningResponse> {
  const supabase = getServerClient();

  // STEP 1: Decompose complex questions into 2-3 targeted queries
  // Example: "Height in Downtown vs C2" → ["Downtown height", "C2 height"]
  const decomposedQueries = await decomposeQuery(question);

  // STEP 2: Add original query to ensure we don't miss anything
  const allQueries = [question, ...decomposedQueries];

  // STEP 3: Execute parallel searches and deduplicate
  const chunks = await getMultiQueryContext(docId, allQueries, {
    topK: 10, // Per-query limit (3-4 queries × 10 = 30-40 chunks before dedup)
    threshold: 0.4,
  });

  // STEP 4: Limit to top 25 unique chunks by similarity
  const topChunks = chunks.slice(0, 25);

  // STEP 5: Get document metadata for context formatting
  const { data: docs } = await supabase
    .from('zoning_docs')
    .select('*')
    .like('slug', 'los-angeles%')
    .limit(1);

  if (!docs || docs.length === 0) {
    throw new Error('No Los Angeles documents found in database');
  }

  const doc = docs[0] as ZoningDoc;

  // Format context
  const context = formatChunksAsContext(topChunks, doc);

  // Call Claude
  const userMessage = `QUESTION:
${question}

ZONING CODE CONTEXT:
${context}

Answer using your knowledge of Los Angeles zoning law combined with the provided code excerpts.

Guidelines:
- Where the excerpts contain relevant sections, cite them specifically
- If you know something from training that the excerpts don't cover, you may include it but label it as "general knowledge" or "typical practice"
- When the excerpts and your knowledge conflict, trust the excerpts as the authoritative local source
- For state-preempted topics (ADUs, density bonuses, housing), note that CA state law may override local code`;

  const response = await callClaude(
    SYSTEM_PROMPTS.QA,
    [{ role: 'user', content: userMessage }],
    { temperature: 0.3 }
  );

  // Extract citations from the response
  const citations = extractCitations(response, topChunks);

  // Tier-1 sections that should boost confidence when cited
  const TIER1_CONFIDENCE_BOOST = [
    '12.21.A.4',   // Off-Street Parking Requirements
    '12.22.D.33',  // ADU regulations
    '12.22.C.25',  // Density Bonus
    '12.08',       // R1 Zone
    '12.09',       // R2 Zone
    '12.10',       // R3 Zone
    '12.11',       // R4 Zone
    '12.12',       // R5 Zone
    '12.13',       // C1/C1.5 Commercial Zones
    '12.14',       // C2/C4/C5 Commercial Zones
    '12.21.1',     // Height Districts
  ];

  // Check if any tier-1 sections are cited in the response
  const hasTier1Citation = citations.some(c =>
    TIER1_CONFIDENCE_BOOST.some(prefix => c.section_ref.startsWith(prefix))
  );

  // Determine confidence based on chunk similarities + tier-1 boost
  const avgSimilarity =
    topChunks.length > 0
      ? topChunks.reduce((sum, c) => sum + c.similarity, 0) / topChunks.length
      : 0;

  let confidence: 'high' | 'medium' | 'low' =
    avgSimilarity > 0.65 ? 'high' : avgSimilarity > 0.50 ? 'medium' : 'low';

  // Boost confidence when tier-1 sections are explicitly cited
  if (hasTier1Citation && confidence === 'low') {
    confidence = 'medium';
  } else if (hasTier1Citation && confidence === 'medium') {
    confidence = 'high';
  }

  // Log similarity scores for debugging
  console.log('Query Decomposition Results:', {
    original: question,
    decomposed: decomposedQueries,
    totalChunks: chunks.length,
    topChunks: topChunks.length,
  });
  console.log('Chunk Similarity Scores:', topChunks.map(c => ({
    section: c.section_ref || 'No section',
    similarity: c.similarity.toFixed(3)
  })));
  console.log('Average Similarity:', avgSimilarity.toFixed(3), '| Confidence:', confidence);

  return {
    answer: response,
    citations,
    confidence,
  };
}

/**
 * Build a natural language case description from user input
 */
function buildCaseDescription(input: PreapprovalUserInput): string {
  const parts: string[] = [];

  if (input.parcelZone) {
    parts.push(`The parcel is zoned ${input.parcelZone}.`);
  }

  if (input.lotSize) {
    const unit = input.lotSizeUnit === 'acres' ? 'acres' : 'sq ft';
    parts.push(`Lot size is ${input.lotSize.toLocaleString()} ${unit}.`);
  }

  if (input.proposedUse) {
    parts.push(`The proposed use is ${input.proposedUse}.`);
  }

  const buildingDetails: string[] = [];
  if (input.numberOfStories) {
    buildingDetails.push(`${input.numberOfStories} stories`);
  }
  if (input.buildingHeight) {
    const unit = input.heightUnit === 'meters' ? 'meters' : 'feet';
    buildingDetails.push(`${input.buildingHeight} ${unit} tall`);
  }
  if (input.unitCount) {
    buildingDetails.push(`${input.unitCount} units`);
  }

  if (buildingDetails.length > 0) {
    parts.push(`The proposed building is ${buildingDetails.join(', ')}.`);
  }

  if (input.overlays && input.overlays.length > 0) {
    parts.push(`The parcel is within overlay(s): ${input.overlays.join(', ')}.`);
  }

  if (input.additionalNotes) {
    parts.push(`Additional context: ${input.additionalNotes}`);
  }

  return parts.join('\n');
}

/**
 * Extract citations from LLM response text
 */
function extractCitations(
  response: string,
  chunks: Array<{ section_ref: string | null; content: string }>
): Citation[] {
  const citations: Citation[] = [];
  const seenRefs = new Set<string>();

  // Look for section references in the response
  // Matches: §12.21.1, Section 12.21.1, [12.21.1.A.1], 12.21.A.4(d)(3)
  const sectionPattern = /§[\d.]+[A-Za-z]*[\d.]*|Section\s+[\d.]+[A-Za-z]?[\d.]*|\[(\d+\.\d+[\w.()]*)\]|\b(\d{2}\.\d+[A-Za-z.()]*\d*)\b/gi;
  const matches = response.match(sectionPattern) || [];

  for (const match of matches) {
    // Strip brackets if present: [12.21.1.A.1] → 12.21.1.A.1
    const normalizedRef = match.trim().replace(/^\[|\]$/g, '');
    if (seenRefs.has(normalizedRef)) continue;
    seenRefs.add(normalizedRef);

    // Find the corresponding chunk
    const chunk = chunks.find(
      (c) =>
        c.section_ref &&
        (c.section_ref.includes(normalizedRef) ||
          normalizedRef.includes(c.section_ref))
    );

    if (chunk) {
      citations.push({
        section_ref: chunk.section_ref || normalizedRef,
        snippet: chunk.content.substring(0, 200) + '...',
      });
    } else {
      citations.push({
        section_ref: normalizedRef,
        snippet: 'Referenced in analysis',
      });
    }
  }

  return citations;
}
