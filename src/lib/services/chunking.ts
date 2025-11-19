import { ChunkingOptions } from '@/types';

interface Chunk {
  content: string;
  chunkIndex: number;
  sectionRef: string | null;
  tokenCount: number;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxTokens: 1000,
  overlapTokens: 100,
  preserveSections: true,
};

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract section reference from text (e.g., "§12.21.A.1", "Section 5.2")
 */
function extractSectionRef(text: string): string | null {
  // Common patterns for zoning code section references
  const patterns = [
    /§\s*[\d.]+[A-Za-z]*[\d.]*/,           // §12.21.A.1
    /Section\s+[\d.]+[A-Za-z]?[\d.]*/i,     // Section 5.2.1
    /Article\s+[\dIVXLCDM]+/i,               // Article IV
    /Chapter\s+[\d.]+/i,                     // Chapter 12.21
    /Part\s+[\d]+/i,                         // Part 2
    /^\d+\.\d+[\.\d]*[A-Za-z]*/m,           // 12.21.A at start of line
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Split text into semantic chunks while preserving section boundaries
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

  // If preserving sections, try to split on section boundaries first
  let segments: string[];

  if (opts.preserveSections) {
    // Split on common section delimiters
    segments = normalizedText.split(/(?=§\s*[\d.]+|(?:Section|Article|Chapter)\s+[\dIVXLCDM.]+)/i);
    // Filter out empty segments
    segments = segments.filter(s => s.trim().length > 0);
  } else {
    segments = [normalizedText];
  }

  let chunkIndex = 0;

  for (const segment of segments) {
    const segmentTokens = estimateTokens(segment);
    const sectionRef = extractSectionRef(segment);

    if (segmentTokens <= opts.maxTokens) {
      // Segment fits in one chunk
      chunks.push({
        content: segment.trim(),
        chunkIndex: chunkIndex++,
        sectionRef,
        tokenCount: segmentTokens,
      });
    } else {
      // Need to split segment into smaller chunks
      const subChunks = splitLongSegment(segment, opts.maxTokens, opts.overlapTokens);

      for (const subChunk of subChunks) {
        chunks.push({
          content: subChunk.trim(),
          chunkIndex: chunkIndex++,
          sectionRef: extractSectionRef(subChunk) || sectionRef,
          tokenCount: estimateTokens(subChunk),
        });
      }
    }
  }

  return chunks;
}

/**
 * Split a long segment into smaller chunks with overlap
 */
function splitLongSegment(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());

      // Create overlap by keeping last portion
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(overlapTokens / 1.3); // ~1.3 tokens per word
      currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Clean and normalize text extracted from web pages
 */
export function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove common boilerplate patterns
    .replace(/Skip to (main )?content/gi, '')
    .replace(/Cookie (policy|consent|notice)/gi, '')
    .replace(/Privacy policy/gi, '')
    .replace(/Terms (of use|and conditions)/gi, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
