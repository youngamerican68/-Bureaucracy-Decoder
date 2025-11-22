/**
 * Polymorphic Parser for LA Municipal Code
 *
 * Supports TWO formats:
 * 1. Legacy Format (Chapters I & IX): Plain text with implicit hierarchy
 * 2. Markdown Format (Chapter 1A): Markdown headers with CamelCase sections
 *
 * The main export `chunkMunicipalCode` automatically routes to the correct parser.
 */

export interface RegulationChunk {
  section_ref: string;        // e.g., "91.101", "12.04", or "1.3.1"
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

// =============================================================================
// SHARED UTILITIES
// =============================================================================

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

// =============================================================================
// LEGACY PARSER (Chapters I & IX)
// =============================================================================

/**
 * Regex patterns for LEGACY format (plain text, UPPERCASE)
 */
const LEGACY_PATTERNS = {
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
 * Process a single line for LEGACY format
 */
function processLegacyLine(
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
    if (LEGACY_PATTERNS.skipUntil.test(trimmedLine)) {
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
  const chapterMatch = trimmedLine.match(LEGACY_PATTERNS.chapter);
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
  const articleMatch = trimmedLine.match(LEGACY_PATTERNS.article);
  if (articleMatch) {
    finalizeChunk(state, chunks);
    state.currentArticle = articleMatch[1];
    state.currentDivision = null;
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Division boundary
  const divisionMatch = trimmedLine.match(LEGACY_PATTERNS.division);
  if (divisionMatch) {
    finalizeChunk(state, chunks);
    state.currentDivision = divisionMatch[1];
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Section boundary (MAIN CHUNK TRIGGER)
  const sectionMatch = trimmedLine.match(LEGACY_PATTERNS.section);
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
  const subsectionMatch = trimmedLine.match(LEGACY_PATTERNS.subsection);
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
 * Parse LEGACY format (Chapters I & IX)
 */
function chunkLegacyCode(
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
    processLegacyLine(line, state, chunks);
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

// =============================================================================
// MARKDOWN PARSER (Chapter 1A)
// =============================================================================

/**
 * Regex patterns for MARKDOWN format (CamelCase, markdown headers)
 *
 * NOTE: Chapter 1A uses TWO different hierarchy structures:
 * - 3-level: Article (H1) > Division (H2) > Section (H3)
 * - 4-level: Article (H1) > Part (H2) > Division (H3) > Section (H4)
 */
const MARKDOWN_PATTERNS = {
  // Article headers (e.g., "# Article 1. Introductory Provisions")
  article: /^#\s+Article\s+([\d]+(?:\.[\d]+)?)\b/i,

  // Part headers (e.g., "## Part 2A. Introduction") - 4-level hierarchy only
  part: /^##\s+Part\s+([\dA-Z]+)\b/i,

  // Division headers - supports BOTH H2 and H3
  // H2: "## Div. 1.3. Orientation" (3-level hierarchy)
  // H3: "### Div. 2A.1. Orientation" (4-level hierarchy with Part)
  division: /^#{2,3}\s+(?:Div\.|Division)\s+([\d]+[A-Z]?\.[\d]+)\b/i,

  // Section headers - supports BOTH H3 and H4
  // H3: "### Sec. 1.3.1. Zone String" (3-level hierarchy)
  // H4: "#### Sec. 2A.1.1. Relationship to Zone String" (4-level hierarchy with Part)
  section: /^#{3,4}\s+Sec\.\s+([\d]+[A-Z]?\.[\d]+\.[\d]+(?:\.[\d]+)*)\b/i,

  // Subsection numbered items (e.g., "##### Zone String Brackets")
  subsectionHeading: /^#{4,6}\s+/,

  // Skip lines (navigation boilerplate)
  skipUntil: /^#\s+Article\s+/i,
};

/**
 * Clean markdown artifacts from text
 */
function cleanMarkdown(text: string): string {
  return text
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML/SVG code blocks
    .replace(/<[^>]+>/g, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Process a single line for MARKDOWN format
 */
function processMarkdownLine(
  line: string,
  state: ParserState,
  chunks: RegulationChunk[]
): void {
  const trimmedLine = line.trim();

  // Skip empty lines
  if (!trimmedLine) {
    return;
  }

  // NOTE: No need for inContentArea check here - the pre-scan already filtered
  // out navigation junk before we reach this function

  // Skip pure URL lines
  if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
    return;
  }

  // Skip image/download links
  if (trimmedLine.startsWith('[![') || trimmedLine.startsWith('[Download]')) {
    return;
  }

  // Check for Article boundary
  const articleMatch = trimmedLine.match(MARKDOWN_PATTERNS.article);
  if (articleMatch) {
    finalizeChunk(state, chunks);
    state.currentArticle = articleMatch[1];
    state.currentDivision = null;
    state.currentSection = null;
    state.currentHeading = null;
    // Chapter 1A is always "1A"
    state.currentChapter = '1A';
    return;
  }

  // Check for Part boundary (4-level hierarchy only)
  // Store Part info in currentDivision temporarily, or append to hierarchy
  const partMatch = trimmedLine.match(MARKDOWN_PATTERNS.part);
  if (partMatch) {
    finalizeChunk(state, chunks);
    // Store Part as a prefix for Division (e.g., "Part 2A")
    // This will be combined with actual division number later
    state.currentDivision = `Part ${partMatch[1]}`;
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Division boundary
  const divisionMatch = trimmedLine.match(MARKDOWN_PATTERNS.division);
  if (divisionMatch) {
    finalizeChunk(state, chunks);
    state.currentDivision = divisionMatch[1];
    state.currentSection = null;
    state.currentHeading = null;
    return;
  }

  // Check for Section boundary (MAIN CHUNK TRIGGER)
  const sectionMatch = trimmedLine.match(MARKDOWN_PATTERNS.section);
  if (sectionMatch) {
    // Finalize previous chunk before starting new one
    finalizeChunk(state, chunks);

    // Start new chunk
    state.currentSection = sectionMatch[1];
    // Remove markdown header prefix (### or ####)
    state.currentHeading = cleanMarkdown(trimmedLine.replace(/^#{3,4}\s+/, ''));
    state.accumulatedContent = [];
    return;
  }

  // Check for subsection headings (e.g., "##### Intent")
  if (MARKDOWN_PATTERNS.subsectionHeading.test(trimmedLine)) {
    if (state.currentSection) {
      state.accumulatedContent.push(cleanMarkdown(trimmedLine));
    }
    return;
  }

  // Regular content line - accumulate if we're inside a section
  if (state.currentSection) {
    state.accumulatedContent.push(cleanMarkdown(trimmedLine));
  }
}

/**
 * Parse MARKDOWN format (Chapter 1A)
 */
function chunkMarkdownCode(
  rawText: string,
  sourceUrl?: string
): RegulationChunk[] {
  const lines = rawText.split('\n');
  const chunks: RegulationChunk[] = [];

  // PRE-SCAN: Skip navigation junk until we find actual content
  // Look for first markdown header (# Article, ## Part/Div, ### Div, or #### Sec)
  let startIndex = 0;
  const contentStartPattern = /^(#{1,4})\s+(Article|Part|Div\.|Division|Sec\.)\s+/i;

  for (let i = 0; i < lines.length; i++) {
    if (contentStartPattern.test(lines[i].trim())) {
      startIndex = i;
      break;
    }
  }

  // If we found a content start, use it; otherwise start from beginning
  const contentLines = startIndex > 0 ? lines.slice(startIndex) : lines;

  const state: ParserState = {
    currentChapter: '1A',  // Chapter 1A is always "1A"
    currentArticle: null,
    currentDivision: null,
    currentSection: null,
    currentHeading: null,
    accumulatedContent: [],
    inContentArea: true,  // Always true now - pre-scan handles filtering
  };

  // Process each line
  for (const line of contentLines) {
    processMarkdownLine(line, state, chunks);
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

// =============================================================================
// ROUTER: AUTO-DETECT FORMAT
// =============================================================================

/**
 * Detect which format the text uses by examining the first 10000 characters
 * (increased to handle large navigation headers and 4-level hierarchy)
 */
function detectFormat(text: string): 'markdown' | 'legacy' {
  const sample = text.substring(0, 10000);

  // Check for markdown section headers at ANY level (###, ####, etc.)
  // This handles both 3-level (### Sec.) and 4-level (#### Sec.) hierarchies
  if (/^#{1,6}\s+sec\./im.test(sample)) {
    return 'markdown';
  }

  // Check for markdown division headers (## Div., ### Div.)
  if (/^#{1,6}\s+div/im.test(sample)) {
    return 'markdown';
  }

  // Check for markdown article headers (# Article)
  if (/^#\s+article\s+\d+/im.test(sample)) {
    return 'markdown';
  }

  // Default to legacy format
  return 'legacy';
}

/**
 * Main chunking function (AUTO-ROUTING)
 *
 * Takes raw text from scraped municipal code and returns an array of
 * semantically complete chunks with preserved hierarchy context.
 *
 * Automatically detects the format (Legacy vs Markdown) and routes to
 * the appropriate parser.
 *
 * @param rawText - The full text of a municipal code article/chapter
 * @param sourceUrl - Optional source URL for the document
 * @returns Array of regulation chunks with hierarchy preserved
 */
export function chunkMunicipalCode(
  rawText: string,
  sourceUrl?: string
): RegulationChunk[] {
  const format = detectFormat(rawText);

  if (format === 'markdown') {
    return chunkMarkdownCode(rawText, sourceUrl);
  } else {
    return chunkLegacyCode(rawText, sourceUrl);
  }
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
