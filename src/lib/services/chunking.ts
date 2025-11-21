/**
 * Stateful Line-by-Line Parser for LA Municipal Code
 *
 * This is NOT a simple regex splitter. It maintains state as it reads
 * to preserve the hierarchical context (Chapter > Article > Division > Section).
 *
 * Why: The scraped data uses implicit hierarchy (plain text + position),
 * not explicit markdown headers. Without state tracking, we lose critical
 * context like "Which chapter does SEC. 91.101 belong to?"
 */

export interface RegulationChunk {
  section_ref: string;        // e.g., "91.101" or "12.04"
  heading: string;            // e.g., "SEC. 91.101. TITLE, PURPOSE, AND SCOPE."
  hierarchy: string;          // e.g., "Chapter IX > Article 1 > Division 1"
  full_text: string;          // Header + all content until next section
  token_count: number;        // Rough estimate
  source_url?: string;        // Optional URL if available
}

interface ParserState {
  currentChapter: string | null;
  currentArticle: string | null;
  currentDivision: string | null;
  currentSection: string | null;
  currentHeading: string | null;
  accumulatedContent: string[];
  inContentArea: boolean;     // True after we skip navigation boilerplate
}

/**
 * Regex patterns for detecting hierarchy boundaries
 */
const PATTERNS = {
  // Chapter headers (e.g., "CHAPTER IX BUILDING REGULATIONS")
  chapter: /^CHAPTER ([IVXLC]+|[\d]+[A-Z]?)\b/,

  // Article headers (e.g., "ARTICLE 1", "ARTICLE 2.9")
  article: /^ARTICLE ([\d]+(?:\.[\d]+)?)\b/,

  // Division headers (e.g., "DIVISION 1 ADMINISTRATION", "Division 1")
  division: /^DIVISION ([\d]+)\b/i,

  // Main section headers (e.g., "SEC. 91.101. TITLE, PURPOSE, AND SCOPE.")
  section: /^SEC\. ([\d]+\.[\d]+(?:\.[\d]+)*)\./,

  // Subsection numbering (e.g., "91.101.1. Title.")
  subsection: /^([\d]+\.[\d]+\.[\d]+(?:\.[\d]+)*)\./,

  // Skip lines (navigation boilerplate)
  skipUntil: /^(CHAPTER|ARTICLE)\s+/,
};

/**
 * Estimate token count (rough approximation: 4 chars per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clean up excessive whitespace and normalize line breaks
 */
function cleanContent(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')      // Collapse multiple spaces
    .trim();
}

/**
 * Build hierarchy string from current state
 */
function buildHierarchy(state: ParserState): string {
  const parts: string[] = [];

  if (state.currentChapter) {
    parts.push(`Chapter ${state.currentChapter}`);
  }
  if (state.currentArticle) {
    parts.push(`Article ${state.currentArticle}`);
  }
  if (state.currentDivision) {
    parts.push(`Division ${state.currentDivision}`);
  }

  return parts.join(' > ') || 'Unknown';
}

/**
 * Finalize the current chunk and add it to results
 */
function finalizeChunk(
  state: ParserState,
  chunks: RegulationChunk[]
): void {
  if (!state.currentSection || !state.currentHeading) {
    return; // Nothing to finalize
  }

  const full_text = cleanContent(
    [state.currentHeading, ...state.accumulatedContent].join('\n')
  );

  // Only create chunk if it has meaningful content (> 50 chars)
  if (full_text.length > 50) {
    chunks.push({
      section_ref: state.currentSection,
      heading: state.currentHeading,
      hierarchy: buildHierarchy(state),
      full_text,
      token_count: estimateTokenCount(full_text),
    });
  }

  // Reset accumulator for next chunk
  state.accumulatedContent = [];
}

/**
 * Process a single line and update parser state
 */
function processLine(
  line: string,
  state: ParserState,
  chunks: RegulationChunk[]
): void {
  const trimmedLine = line.trim();

  // Skip empty lines
  if (!trimmedLine) {
    return;
  }

  // Skip navigation boilerplate until we hit content
  if (!state.inContentArea) {
    if (PATTERNS.skipUntil.test(trimmedLine)) {
      state.inContentArea = true;
    } else {
      return; // Keep skipping
    }
  }

  // Skip markdown link lines (e.g., "[CHAPTER IX BUILDING REGULATIONS](...)")
  if (trimmedLine.startsWith('[') && trimmedLine.includes('](')) {
    return;
  }

  // Skip pure URL lines
  if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
    return;
  }

  // Check for Chapter boundary
  const chapterMatch = trimmedLine.match(PATTERNS.chapter);
  if (chapterMatch) {
    finalizeChunk(state, chunks);
    state.currentChapter = chapterMatch[1];
    state.currentArticle = null;
    state.currentDivision = null;
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Article boundary
  const articleMatch = trimmedLine.match(PATTERNS.article);
  if (articleMatch) {
    finalizeChunk(state, chunks);
    state.currentArticle = articleMatch[1];
    state.currentDivision = null;
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Division boundary
  const divisionMatch = trimmedLine.match(PATTERNS.division);
  if (divisionMatch) {
    finalizeChunk(state, chunks);
    state.currentDivision = divisionMatch[1];
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Section boundary (MAIN CHUNK TRIGGER)
  const sectionMatch = trimmedLine.match(PATTERNS.section);
  if (sectionMatch) {
    // Finalize previous chunk before starting new one
    finalizeChunk(state, chunks);

    // Start new chunk
    state.currentSection = sectionMatch[1];
    state.currentHeading = trimmedLine;
    state.accumulatedContent = [];
    return;
  }

  // Check for subsection (part of current chunk)
  const subsectionMatch = trimmedLine.match(PATTERNS.subsection);
  if (subsectionMatch && state.currentSection) {
    // This is content within the current section
    state.accumulatedContent.push(trimmedLine);
    return;
  }

  // Regular content line - accumulate if we're inside a section
  if (state.currentSection) {
    state.accumulatedContent.push(trimmedLine);
  }
}

/**
 * Main chunking function
 *
 * Takes raw text from scraped municipal code and returns an array of
 * semantically complete chunks with preserved hierarchy context.
 *
 * @param rawText - The full text of a municipal code article/chapter
 * @param sourceUrl - Optional source URL for the document
 * @returns Array of regulation chunks with hierarchy preserved
 */
export function chunkMunicipalCode(
  rawText: string,
  sourceUrl?: string
): RegulationChunk[] {
  const lines = rawText.split('\n');
  const chunks: RegulationChunk[] = [];

  const state: ParserState = {
    currentChapter: null,
    currentArticle: null,
    currentDivision: null,
    currentSection: null,
    currentHeading: null,
    accumulatedContent: [],
    inContentArea: false,
  };

  // Process each line
  for (const line of lines) {
    processLine(line, state, chunks);
  }

  // Finalize any remaining chunk
  finalizeChunk(state, chunks);

  // Add source URL if provided
  if (sourceUrl) {
    chunks.forEach(chunk => {
      chunk.source_url = sourceUrl;
    });
  }

  return chunks;
}

/**
 * Chunk multiple documents at once
 *
 * Useful for batch processing all scraped files.
 */
export function chunkMultipleDocuments(
  documents: Array<{ content: string; url: string }>
): RegulationChunk[] {
  return documents.flatMap(doc =>
    chunkMunicipalCode(doc.content, doc.url)
  );
}

/**
 * Statistics about chunked data
 */
export interface ChunkStats {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  chaptersFound: Set<string>;
  articlesFound: Set<string>;
  divisionsFound: Set<string>;
}

/**
 * Analyze chunks and return statistics
 */
export function analyzeChunks(chunks: RegulationChunk[]): ChunkStats {
  const tokenCounts = chunks.map(c => c.token_count);
  const chapters = new Set<string>();
  const articles = new Set<string>();
  const divisions = new Set<string>();

  chunks.forEach(chunk => {
    const parts = chunk.hierarchy.split(' > ');
    parts.forEach(part => {
      if (part.startsWith('Chapter ')) chapters.add(part);
      if (part.startsWith('Article ')) articles.add(part);
      if (part.startsWith('Division ')) divisions.add(part);
    });
  });

  return {
    totalChunks: chunks.length,
    totalTokens: tokenCounts.reduce((a, b) => a + b, 0),
    avgTokensPerChunk: Math.round(
      tokenCounts.reduce((a, b) => a + b, 0) / chunks.length
    ),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    chaptersFound: chapters,
    articlesFound: articles,
    divisionsFound: divisions,
  };
}
