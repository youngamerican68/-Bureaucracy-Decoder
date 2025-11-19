// The Bureaucracy Decoder - Type Definitions

// =============================================================================
// Database Types
// =============================================================================

export interface ZoningDoc {
  id: string;
  slug: string;
  city_name: string;
  code_name: string;
  region: string | null;
  source_url: string;
  is_featured: boolean;
  source_type: string;
  status: 'pending' | 'ingesting' | 'ingested' | 'error';
  error_message: string | null;
  chunk_count: number;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoningEmbedding {
  id: number;
  doc_id: string;
  chunk_index: number;
  content: string;
  section_ref: string | null;
  token_count: number | null;
  embedding?: number[];
  created_at: string;
}

export interface PreapprovalRequest {
  id: string;
  doc_id: string;
  city_name: string;
  user_input: PreapprovalUserInput;
  site_plan_metadata: SitePlanMetadata | null;
  packet_summary: string | null;
  packet_full: PreapprovalPacket | null;
  overall_risk: 'low' | 'medium' | 'high' | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// User Input Types
// =============================================================================

export interface PreapprovalUserInput {
  parcelZone?: string;
  lotSize?: number;
  lotSizeUnit?: 'sqft' | 'acres';
  proposedUse?: string;
  numberOfStories?: number;
  buildingHeight?: number;
  heightUnit?: 'feet' | 'meters';
  unitCount?: number;
  overlays?: string[];
  additionalNotes?: string;
}

export interface SitePlanMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  extractedText?: string;
}

// =============================================================================
// Pre-Approval Packet Types
// =============================================================================

export interface PreapprovalPacket {
  summary: string;
  sections: PacketSection[];
  overall_risk: 'low' | 'medium' | 'high';
  disclaimer: string;
  generated_at: string;
}

export interface PacketSection {
  category: PacketCategory;
  status: ComplianceStatus;
  analysis: string;
  citations: Citation[];
}

export type PacketCategory =
  | 'use'
  | 'height'
  | 'density_far'
  | 'setbacks'
  | 'parking'
  | 'lot_coverage'
  | 'overlays'
  | 'other';

export type ComplianceStatus =
  | 'appears_compliant'
  | 'likely_non_compliant'
  | 'ambiguous'
  | 'not_applicable';

export interface Citation {
  section_ref: string;
  snippet: string;
}

// =============================================================================
// RAG Types
// =============================================================================

export interface RetrievedChunk {
  id: number;
  doc_id: string;
  chunk_index: number;
  content: string;
  section_ref: string | null;
  similarity: number;
}

export interface RAGContext {
  chunks: RetrievedChunk[];
  doc: ZoningDoc;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface AskZoningRequest {
  docId: string;
  question: string;
}

export interface AskZoningResponse {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
}

export interface GeneratePacketRequest {
  docId: string;
  userInput: PreapprovalUserInput;
  sitePlanMetadata?: SitePlanMetadata;
}

export interface GeneratePacketResponse {
  requestId: string;
  packet: PreapprovalPacket;
}

export interface IngestRequest {
  slug: string;
  cityName: string;
  codeName: string;
  region?: string;
  sourceUrl: string;
}

export interface IngestResponse {
  docId: string;
  status: 'ingesting' | 'queued';
  message: string;
}

// =============================================================================
// Featured Metro Types
// =============================================================================

export interface FeaturedMetro {
  slug: string;
  cityName: string;
  codeName: string;
  region: string;
  sourceUrl: string;
  /** Code hosting platform - enables reusable scraping logic across cities */
  codifier?: 'municode' | 'ecode360' | 'amlegal' | 'custom';
}

// =============================================================================
// LLM Types
// =============================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
  preserveSections?: boolean;
}
