import { getServerClient } from '@/lib/supabase';
import { generateEmbedding } from './embeddings';
import { RetrievedChunk, RAGContext, ZoningDoc } from '@/types';

interface RetrievalOptions {
  topK?: number;
  threshold?: number;
}

/**
 * Retrieve relevant zoning code sections for a query
 */
export async function getRelevantZoningSections(
  docId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  const supabase = getServerClient();
  const { topK = 20, threshold = 0.5 } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Call the similarity search function
  const { data, error } = await supabase.rpc('match_zoning_sections', {
    query_embedding: queryEmbedding,
    match_doc_id: docId,
    match_count: topK,
    match_threshold: threshold,
  });

  if (error) {
    throw new Error(`Similarity search failed: ${error.message}`);
  }

  return (data || []) as RetrievedChunk[];
}

/**
 * Get full RAG context including document metadata
 */
export async function getRAGContext(
  docId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RAGContext> {
  const supabase = getServerClient();

  // Get document metadata
  const { data: doc, error: docError } = await supabase
    .from('zoning_docs')
    .select('*')
    .eq('id', docId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${docId}`);
  }

  // Get relevant chunks
  const chunks = await getRelevantZoningSections(docId, query, options);

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
 * Get context for multiple queries (for packet generation)
 */
export async function getMultiQueryContext(
  docId: string,
  queries: string[],
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  // Get chunks for all queries
  const allChunks: RetrievedChunk[] = [];
  const seenIds = new Set<number>();

  for (const query of queries) {
    const chunks = await getRelevantZoningSections(docId, query, options);

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
