import { getServerClient } from '@/lib/supabase';
import { getMultiQueryContext, formatChunksAsContext, getRAGContext } from './rag';
import { callClaude, SYSTEM_PROMPTS, generatePacketQueries } from './llm';
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
 */
export async function askZoningQuestion(
  docId: string,
  question: string
): Promise<AskZoningResponse> {
  // Get RAG context
  const { doc, chunks } = await getRAGContext(docId, question, {
    topK: 20,
    threshold: 0.4,
  });

  // Format context
  const context = formatChunksAsContext(chunks, doc);

  // Call Claude
  const userMessage = `QUESTION:
${question}

ZONING CODE CONTEXT:
${context}

Please answer the question based only on the provided zoning code excerpts. Always cite specific sections.`;

  const response = await callClaude(
    SYSTEM_PROMPTS.QA,
    [{ role: 'user', content: userMessage }],
    { temperature: 0.3 }
  );

  // Extract citations from the response
  const citations = extractCitations(response, chunks);

  // Determine confidence based on chunk similarities
  const avgSimilarity =
    chunks.length > 0
      ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
      : 0;

  const confidence: 'high' | 'medium' | 'low' =
    avgSimilarity > 0.7 ? 'high' : avgSimilarity > 0.5 ? 'medium' : 'low';

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
  const sectionPattern = /§[\d.]+[A-Za-z]*[\d.]*|Section\s+[\d.]+[A-Za-z]?[\d.]*/gi;
  const matches = response.match(sectionPattern) || [];

  for (const match of matches) {
    const normalizedRef = match.trim();
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
