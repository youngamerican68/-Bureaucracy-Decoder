# LA Municipal Code Scraping Progress

**Last Updated:** 2025-12-06
**Project:** Bureaucracy Decoder - LA City Zoning & Building Code Compliance Tool

---

## 🎉 Latest Updates: Chat App + Hybrid RAG + Row-Level Parking Data (Dec 6, 2025)

### What Was Built:

1. **✅ /chat App with Clerk Authentication**
   - New chat interface at `/chat` route with Google SSO via Clerk
   - Example query buttons for common zoning questions
   - Real-time streaming responses with citation highlighting
   - Files: `src/app/chat/`, `src/app/api/chat/`, `src/middleware.ts`

2. **✅ Hybrid RAG: LLM Knowledge First, RAG Confirms**
   - Changed from strict "only use excerpts" to hybrid approach
   - LLM uses training knowledge + RAG excerpts, clearly labeled
   - Answers now distinguish: "Confirmed by excerpts" vs "Based on typical LA/CA practice"
   - State preemption warnings for ADUs, SB 9, density bonus
   - Files: `src/lib/services/packet.ts:146-152`, `src/lib/services/llm.ts:100-104`

3. **✅ Surgical Re-Ingestion: §12.21.A.4 Parking Table**
   - Created row-level chunks for parking requirements (1 chunk per use type)
   - 12 use types: restaurant, office, retail, warehouse, hotel, medical, theater, church, school, manufacturing, gym, bank
   - Each chunk includes keywords for better semantic matching
   - Files: `scripts/data/parking-12.21.A.4.json`, `scripts/ingest-parking-table.ts`

4. **✅ Confidence Boost for Tier-1 Sections**
   - When tier-1 sections (§12.21.A.4, §12.22.D.33, §12.22.C.25, §12.08, §12.21.1) are cited:
   - Confidence bumps up one level: low→medium, medium→high
   - Parking and ADU queries now show "medium" instead of "low" confidence
   - File: `src/lib/services/packet.ts:163-191`

5. **✅ Concise Response Style**
   - Added "RESPONSE STYLE - BE CONCISE" to QA prompt
   - Instructs: one-sentence direct answer first, then cite, then 2-3 most important caveats
   - Reduces wall-of-text responses for simple queries
   - File: `src/lib/services/llm.ts:100-104`

6. **✅ Database Function Fix**
   - Fixed `match_zoning_sections_filtered` to return proper `id` (bigint) and `chunk_index`
   - Previously returned `doc_id` as `id`, breaking RRF deduplication
   - Applied via Supabase SQL editor

### Test Results:

**Before (Dec 5):**
- "parking requirements for restaurant in C2" → "Low confidence, excerpts don't contain specific ratios"

**After (Dec 6):**
- "parking requirements for restaurant in C2" → "1 parking space for each 100 square feet of floor area" citing §12.21.A.4
- Confidence: medium (boosted from low due to tier-1 citation)

### Key Files Changed:

| File | Change |
|------|--------|
| `src/lib/services/packet.ts` | Hybrid RAG user message + tier-1 confidence boost |
| `src/lib/services/llm.ts` | Concise style prompt + hybrid RAG instructions |
| `scripts/ingest-parking-table.ts` | Row-level parking ingestion script |
| `scripts/data/parking-12.21.A.4.json` | 12 parking requirement rows with keywords |
| `src/app/chat/` | New chat interface with Clerk auth |

### Production Status:
- **Chat App:** ✅ Live at `/chat` with Clerk SSO
- **Hybrid RAG:** ✅ LLM knowledge + RAG confirmation active
- **Parking Data:** ✅ 12 row-level chunks ingested (indices 963-974)
- **Confidence Heuristic:** ✅ Tier-1 boost active

---

## 🔧 Previous: Query-Intent Routing (Dec 5, 2025)

### What Was Built:

1. **✅ Query-Intent Classification**
   - Keyword-based classifier routes queries to relevant chapters
   - Returns 'zoning', 'building', or 'mixed' intent based on query content
   - Scoring: Longer keyword matches get 2x weight (stronger signal)
   - No LLM calls - pure keyword matching for speed
   - File: `src/lib/services/rag.ts:64-91`

2. **✅ Intent-Aware Chapter Weights**
   - Zoning queries: Boost Chapter 1 (1.3x Tier1, 1.2x other), penalize Chapter IX (0.7-0.8x)
   - Building queries: Boost Chapter IX (1.3x Tier1, 1.2x other), penalize Chapter 1 (0.7-0.8x)
   - Mixed queries: Neutral weighting (default behavior)
   - File: `src/lib/services/rag.ts:158-187`

3. **✅ Keyword Lists for Classification**
   - BUILDING_CODE_KEYWORDS: 35 terms (permit, inspection, LADBS, calgreen, 91.xxx, etc.)
   - ZONING_CODE_KEYWORDS: 40 terms (r1 zone, setback, FAR, parking requirement, 12.xxx, etc.)
   - File: `src/lib/services/rag.ts:17-58`

### RAGAS Baseline Results (With Intent Routing):

| Category | Recall | Hit Rate | Status |
|----------|--------|----------|--------|
| **Parking** | 100% | 100% | ✓ (was 66.7%) |
| **Height** | 83.3% | 100% | ✓ |
| **Definitions** | 100% | 100% | ✓ |
| **Setbacks** | 100% | 100% | ✓ |
| **Density Bonus** | 80% | 100% | ✓ |
| **TOC** | 50% | 100% | ✓ |
| **Housing Fees** | 100% | 100% | ✓ |
| **Subdivisions** | 100% | 100% | ✓ |
| **Emergency** | 100% | 100% | ✓ |
| **CO** | 100% | 100% | ✓ |
| **Grading** | 75% | 100% | ✓ |
| **Enforcement** | 100% | 100% | ✓ |
| **Green Building** | 100% | 100% | ✓ (was 33.3%) |
| Zoning | 75% | 75% | ⚠️ |
| Permits | 66.7% | 66.7% | ⚠️ |
| Hillside | 50% | 50% | ⚠️ |
| Permits_Building | 66.7% | 66.7% | ⚠️ |
| Inspections | 66.7% | 66.7% | ⚠️ |
| Fees_Building | 0% | 0% | ❌ |

**Overall:** Recall 80.0% ✓, Hit Rate 86.0%

**Improvement from Intent Routing:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Recall | 69% | **80%** | +11pp ✓ |
| Hit Rate | 76% | **86%** | +10pp |
| Parking | 66.7% | **100%** | +33pp |
| Green Building | 33.3% | **100%** | +67pp |

**Key Benefits:**
- Parking queries now route to zoning code (12.21.A.4) instead of being crowded by building code EV sections
- Building queries route to Chapter IX, zoning queries to Chapter 1
- Mixed queries (e.g., "grading permit hillside") search all chapters fairly

---

## 🔧 Previous: Full 3-Chapter Multi-Doc Search (Dec 5, 2025)

### What Was Built:

1. **✅ 3-Chapter Multi-Document Search (Chapter 1 + 1A + IX)**
   - RAG now searches ALL THREE Los Angeles chapters in parallel
   - Chapter 1 (traditional zoning), Chapter 1A (new zoning), Chapter IX (building code)
   - Interleaved RRF merge ensures fair competition across chapters
   - Tier 1 boost (3.0x) + chapter-level weights prevent cross-corpus crowding
   - File: `src/lib/services/rag.ts`

2. **✅ Chapter IX Tier 1 Sections Added**
   - `91.106` - Permits Required
   - `91.107` - Fees
   - `91.108` - Inspections
   - `91.109` - Certificate of Occupancy
   - `91.1705` - Special Inspections
   - `91.1704` - Structural Inspections
   - `91.7006` - Grading Permits
   - `91.7003` - Grading Definitions
   - `98.0403` - Department Powers/Enforcement
   - `99.04.100` - Green Building Residential (Basic Provisions)
   - `99.05.100` - Green Building Non-Residential (Basic Provisions)

3. **✅ RAGAS Expanded for Chapter IX**
   - Added 17 new gold queries for building code topics
   - Categories: permits_building, fees_building, inspections, co, grading, enforcement, green_building
   - Total queries: 50 (20 Chapter 1 + 13 Chapter 1A + 17 Chapter IX)
   - File: `scripts/ragas-baseline.ts`

4. **✅ Interleaved RRF Merge**
   - Solved BM25 score incompatibility across different-sized corpora
   - Per-chapter sorting before interleaving ensures fair position-based ranking
   - Chapter 1's #1 result now competes fairly with Chapter IX's #1 result

5. **✅ Chapter-Level Weights**
   - Non-Tier 1 sections: Chapter 1 (1.15x), Chapter 1A (1.1x), Chapter IX (0.95x)
   - Tier 1 sections: No chapter penalty (compete fairly at 1.0x)
   - Prevents building code from crowding out zoning for general queries

**Key Technical Challenges Solved:**
- BM25 rank values not comparable across corpora (solved with interleaved RRF)
- Chapter IX "parking" sections (99.04.106 EV charging) crowding out 12.21.A.4 (solved with refined Tier 1 prefixes)
- Semantic overlap between chapters (solved with chapter-level weights + intent routing)

---

## 🔧 Previous: Multi-Doc Search (Chapter 1 + 1A) (Dec 5, 2025)

### What Was Built:

1. **✅ Multi-Document Search (Chapter 1 + 1A Fusion)**
   - RAG now searches BOTH Chapter 1 (traditional zoning) AND Chapter 1A (new zoning code)
   - Results merged via Reciprocal Rank Fusion (RRF) with Tier 1 boosting
   - Fetches 20 results per chapter before merge (prevents canonical section dropout)
   - File: `src/lib/services/rag.ts`

2. **✅ Chapter 1A Tier 1 Sections Added**
   - `9.2.1` - State Density Bonus Program
   - `9.2.2` - Affordable Housing Incentive Program
   - `9.2.5` - Transit Oriented Incentive Program
   - `9.2.7` - Transit Oriented Communities (TOC) Program
   - `9.3.2` - Local Affordable Housing Incentive Program
   - `1.5.16` - Transit Oriented Incentive Map
   - `1.6` - Emergency Provisions
   - `14.2` - Definitions (Measurements)
   - `15.4` - Affordable Housing Program Fees
   - `11.5` - Tract Maps & Conversions

3. **✅ RAGAS Expanded for Chapter 1A**
   - Added 13 new gold queries for downtown/Chapter 1A topics
   - Categories: density_bonus, toc, housing_fees, subdivisions, emergency
   - Total queries: 33 (20 Chapter 1 + 13 Chapter 1A)
   - File: `scripts/ragas-baseline.ts`

4. **✅ Tier 1 Boost Increased to 2.0x**
   - Higher boost needed for multi-doc search (more results to rank)
   - Ensures canonical sections bubble up over noise
   - Lower threshold (0.15) for better recall

### RAGAS Baseline Results (Chapter 1 + 1A Combined):

**Overall:** Recall 74.2%, Hit Rate 81.8%

---

## 🔧 Previous: Hybrid RAG Search + RAGAS Baseline (Dec 5, 2025 AM)

### What Was Built:

1. **✅ Hybrid Search (BM25 + Vector + Tier 1 Boosting)**
   - Replaced city-wide vector-only search with hybrid retrieval
   - BM25 full-text search via `search_zoning_bm25` RPC function
   - Reciprocal Rank Fusion (RRF) merges vector and BM25 results
   - File: `src/lib/services/rag.ts`

2. **✅ Doc ID Filtering**
   - Prevents Chapter 9 (building code) from crowding out zoning results
   - New RPC: `match_zoning_sections_filtered` with `filter_doc_id` param

3. **✅ Coverage Guardrail System**
   - Validates 11 Tier 1 critical sections exist before ingestion
   - Fails fast if parking (12.21.A.4) or other critical sections missing
   - Checks content length and required keywords
   - File: `scripts/coverage-guardrail.ts`

4. **✅ Oversized Chunk Splitting**
   - Fixed 72K token chunk bug that caused silent embedding failures
   - `MAX_CHUNK_TOKENS = 6000` (OpenAI limit is ~8K)
   - Splits on lettered subsections (A., B.) and numbered items (1., 2.)
   - File: `src/lib/services/chunking.ts`

5. **✅ RAGAS Baseline Testing**
   - 20 gold queries across 7 categories (parking, height, zoning, etc.)
   - Measures Context Recall, Precision, and Hit Rate
   - Results saved to `scripts/data/ragas-baseline-{date}.json`
   - File: `scripts/ragas-baseline.ts`

6. **✅ LLM Switch: DeepSeek → Gemini 2.0 Flash**
   - Switched from slow DeepSeek to fast Gemini 2.0 Flash via OpenRouter
   - Response time: ~15-30s → ~2-5s
   - Model: `google/gemini-2.0-flash-001`
   - File: `src/lib/services/llm.ts:69`

7. **✅ Ingestion Process Documentation**
   - Created factory pattern documentation for municipal code ingestion
   - Pipeline: PDF → Chunking → Guardrail → Ingest → Hybrid Search → RAGAS Gate → Ship
   - File: `docs/INGESTION_PROCESS.md`

### RAGAS Baseline Results (Chapter I):

| Metric | Before Hybrid | After Hybrid + Tier 1 Boost |
|--------|---------------|----------------------------|
| **Recall** | 52.5% | **92.5%** ✓ |
| **Hit Rate** | 60% | **95%** ✓ |
| Precision | 24% | 35% |
| **Parking** | 0% | **100%** ✓ |
| **Hillside** | 0% | **100%** ✓ |

### Chapter I Re-Ingestion Stats:

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Total chunks | 280 | **963** |
| Max tokens | 98,202 | **5,999** |
| 12.21.A.4 present | NO | **YES (3 parts)** |
| Coverage check | N/A | **11/11 sections pass** |

### Tier 1 Critical Sections (Coverage Guardrail):

| Section   | Name                        | Status |
|-----------|-----------------------------|--------|
| 12.21.A.4 | Off-Street Parking          | ✓      |
| 12.21.1   | Height of Buildings         | ✓      |
| 12.08     | R1 One-Family Zone          | ✓      |
| 12.09     | R2 Two-Family Zone          | ✓      |
| 12.10     | R3 Multiple Dwelling        | ✓      |
| 12.14     | C2 Commercial Zone          | ✓      |
| 12.03     | Definitions                 | ✓      |
| 12.22     | Exceptions                  | ✓      |
| 12.24     | Conditional Use Permits     | ✓      |
| 12.21.C   | Hillside Regulations        | ✓      |
| 12.23     | Variances                   | ✓      |

### Key Technical Decisions:

- **Why hybrid search?** Pure vector failed on parking queries (retrieved exceptions instead of requirements)
- **Why BM25 OR logic?** AND logic missed results when query had stopwords
- **Why Tier 1 boost?** Canonical sections like 12.21.A.4 need priority over edge cases
- **Why Gemini 2.0 Flash?** DeepSeek was 15-30s, Gemini is 2-5s with same quality

### Database Migrations Applied:

- `add_fulltext_search_for_hybrid` - Added `content_tsv` column + GIN index
- `add_filtered_match_zoning_sections` - Vector search with doc_id filter
- `bm25_search_with_or_logic` - Full-text search with OR matching

### Production Status:
- **RAG Retrieval:** ✅ Hybrid search live (92.5% recall)
- **LLM Response:** ✅ Gemini 2.0 Flash (2-5s responses)
- **Chapter I:** ✅ Re-ingested with 963 chunks, all Tier 1 sections present
- **RAGAS Gate:** ✅ Passed (Recall 92.5%, Hit Rate 95%)

---

## 🎉 Previous Updates: Hybrid LLM Cost Optimization (Nov 24, 2025)

### What Was Built:

1. **✅ OpenRouter Integration**
   - Added OpenRouter client for cost-efficient LLM routing
   - Configured with baseURL: https://openrouter.ai/api/v1
   - File: `src/lib/services/llm.ts:41-52`

2. **✅ Hybrid LLM Architecture**
   - **Planner:** GPT-4o-mini via OpenAI (reliable section mapping)
   - **Brain:** DeepSeek via OpenRouter (90% cost reduction vs Claude)
   - Attempted Gemini but reverted due to failed section mapping instructions
   - Function: `decomposeQuery()` - GPT-4o-mini, `callClaude()` - DeepSeek

3. **✅ DeepSeek Bold Citation Support**
   - Added regex patterns for bold citations: `**Section 12.08**`, `**Sec. 12.21.A**`
   - Strip asterisks from display text while maintaining clickability
   - Backward compatible with existing citation formats (§, [Sec.], Section)
   - File: `src/app/analyze/page.tsx:89-151`

### Key Technical Decisions:

- **Why not Gemini for planning?** Failed to follow R1 → Section 12.08 mapping instructions
- **Why GPT-4o-mini?** Reliable query decomposition with exact section references
- **Why DeepSeek for answers?** 90% cost reduction vs Claude with comparable quality
- **Citation fix necessity:** DeepSeek outputs citations in bold markdown format

### Cost Savings:
- **Brain (Answer Generation):** 90% reduction (Claude Sonnet 4 → DeepSeek)
- **Planner (Query Decomposition):** Already cheap (GPT-4o-mini)
- **Net Result:** Massive cost reduction with maintained quality

### Environment Variables:
- Added `OPENROUTER_API_KEY` to `.env.local` (gitignored)

---

## 🎉 Previous Updates: Compliance Compass Rebranding & RAG Enhancement (Nov 23, 2025)

### What Was Built:

1. **✅ Context Window Retrieval Strategy**
   - Updated `match_zoning_sections_city_wide` database function
   - Automatically fetches neighboring chunks (chunk_index ± 1) alongside vector matches
   - Prevents orphaned chunks from losing parent context after splitting
   - Uses PostgreSQL CTEs with LATERAL JOIN for efficient retrieval
   - File: `db/schema.sql`

2. **✅ Height District Query Enhancement**
   - Added specific handling in QUERY_PLANNER for Height District queries
   - Forces searches to use exact section "12.21.1" instead of generic terms
   - Prevents downtown-specific rules from crowding out base zoning results
   - File: `src/lib/services/llm.ts:233-240`

3. **✅ Section 12.21 Context Stamping**
   - Created script to add context headers to all Section 12.21 chunks
   - Stamped 8/8 chunks with 100% coverage
   - Pattern: `[CONTEXT: Section 12.21.A Off-Street Parking]`
   - Ensures chunks carry full legal path after chunking
   - File: `scripts/refine-section-12-21.ts`

4. **✅ Compliance Compass Rebranding (Frontend)**
   - New headline: "Know the Rules Before You Draw the Lines."
   - Subhead targets pre-design intelligence for architects
   - Updated "The Challenge" section to emphasize design hours and liability
   - Replaced "Legal Review" language with "Feasibility Study"
   - Removed entire Team section
   - Updated workflow demo from fence to parking example
   - File: `src/app/page.tsx`

5. **✅ Compliance Compass Rebranding (Backend)**
   - Repositioned AI as "navigator, not oracle"
   - Added COMPASS MODE fallback for difficult extractions
   - Updated QA and PACKET system prompts to be citation-first
   - Added warnings for overlay trap, state preemption, discretionary approvals
   - File: `src/lib/services/llm.ts:70-194`

6. **✅ Click-to-Scroll Citations**
   - Implemented clickable citations in chat interface
   - Smooth scroll to citation cards on click
   - Highlight animation (amber ring) on target citation
   - Conditional rendering: clickable if retrieved, gray italic if not
   - Fuzzy citation ID matching for consistency
   - File: `src/app/analyze/page.tsx`

7. **✅ Workflow Demo Update**
   - Updated InterfaceMockup component to match parking example
   - Changed from fence example to Case File #2025-COMMERCIAL-C5
   - Question: "What are the parking requirements for a 40,000 sq ft C5 mixed-use project?"
   - Answer: "1 space per 500 sq ft = 80 Spaces"
   - Citation: SEC. 12.21.A.4(c) — Commercial and Industrial Parking
   - File: `src/components/landing/Diagrams.tsx`

### Key Technical Decisions:

- **Context Window Retrieval:** Database-level solution using CTEs prevents orphaned chunks without application-level complexity
- **Height District Handling:** Section number precision prevents generic searches from failing
- **Context Stamping:** Header prepending ensures chunks are self-describing
- **Conditional Citations:** Only make retrieved citations clickable to avoid broken links
- **Compliance Compass Positioning:** Navigator metaphor aligns brand message with AI behavior

### Production Status:
- **RAG System:** ✅ Production ready with context window retrieval
- **Frontend:** ✅ Rebranded for architect audience
- **Backend Prompts:** ✅ Citation-first "Compass Mode" active
- **Chat UI:** ✅ Click-to-scroll citations implemented
- **Git Status:** ✅ Committed (commit 982d8fc)

---

## Current Status Summary

### ✅ Completed Pipeline (End-to-End)

| Source | Status | Size | Chunks | Tokens | Location |
|--------|--------|------|--------|--------|----------|
| **Chapter I - Zoning** | ✅ **INGESTED (PDF)** | 5.54 MB PDF | **270 chunks** | **648,307 tokens** | Supabase `zoning_embeddings` |
| **Chapter 1A - Downtown Zoning** | ✅ **INGESTED** | 4.6 MB | **335 chunks** | **304,651 tokens** | Supabase `zoning_embeddings` |
| **Chapter IX - Building Regulations** | ✅ **INGESTED (PDF)** | 4.41 MB PDF | **776 chunks** | **413,536 tokens** | Supabase `zoning_embeddings` |

**Total Scraped:** ~14.5 MB
**Total Ingested:** 1,381 chunks, 1,366,494 tokens across 3 documents
**RAG Status:** ✅ **PRODUCTION READY** - All three chapters ingested with full hierarchy tracking

---

## 🎉 Major Milestone: Full RAG Knowledge Base Ingested (Nov 21-22, 2025)

### What Was Built:

1. **✅ Data Acquisition (Multiple Strategies)**
   - **Chapter I Zoning:** PDF ingestion (5.54 MB, 590 pages) - replaced ghost data from failed web scraping
   - **Chapter 1A Downtown Zoning:** Web scraping via Firecrawl V1 (4.6 MB, 15 articles)
   - **Chapter IX Building Regulations:** PDF ingestion (4.41 MB, 336 pages) - replaced thin article-level scraped data

2. **✅ Polymorphic Chunking Parser**
   - Built custom line-by-line parser supporting THREE formats:
     - **Legacy Format** (Chapters I & IX): `SEC. 91.101` (uppercase, plain text)
     - **Markdown Format** (Chapter 1A): `### Sec. 1.3.1` (CamelCase, markdown headers)
   - Auto-detects format by examining first 5000 characters
   - Pre-scan step skips navigation junk in scraped content
   - Preserves full hierarchy: "Chapter IX > Article X > Division Y"
   - File: `src/lib/services/chunking.ts`

3. **✅ Safety Valve for Oversized Chunks**
   - Token limit: 7,000 tokens (hard limit 7,500)
   - Splits by subsections or truncates if unsplittable
   - Prevented OpenAI API truncation/failures across all chapters
   - Chapter IX: 3 chunks split
   - Chapter 1A: 7 chunks truncated

4. **✅ Hierarchy Data Migration**
   - **Critical Bug Fix**: Added `hierarchy` column to `zoning_embeddings` table
   - Re-ingested Chapters I & IX to backfill hierarchy data
   - All chunks now have full context: "Chapter > Article > Division"

5. **✅ Embedding Generation**
   - Model: OpenAI text-embedding-3-large
   - Dimensions: 1536 (explicitly set for pgvector compatibility)
   - Batched processing: 100 chunks per API call
   - File: `src/lib/services/embeddings.ts`

6. **✅ Supabase Storage**
   - **730 total embeddings** inserted into `zoning_embeddings` table
   - 3 documents in `zoning_docs` table with hierarchy tracking
   - Status: 'ingested'
   - Doc IDs:
     - Chapter I: TBD (from previous session)
     - Chapter IX: TBD (from previous session)
     - Chapter 1A: `6d02e4d5-5361-4132-843a-27a65b083925`

7. **✅ Vector Search Verification**
   - Test query: "When is a grading permit required?"
   - Result: 72.75% similarity match on Section 91.106.1.2
   - Top 3 results all relevant (grading permits and fees)
   - File: `scripts/test-retrieval.ts`

### Key Scripts Created:

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/ingest-chapter1-pdf.ts` | Chapter I PDF ingestion (replaces web scraping) | ✅ Working |
| `scripts/ingest-chapter1a.ts` | Chapter 1A downtown zoning ingestion | ✅ Working |
| `scripts/ingest-chapter9-pdf.ts` | Chapter IX PDF ingestion (replaces thin web scraping) | ✅ Working |
| `scripts/test-parser-compatibility.ts` | Verify parser on all 3 formats | ✅ Working |
| `scripts/test-chapter1a-chunking.ts` | Verify markdown parser on real data | ✅ Working |
| `scripts/test-pdf-read.ts` | Test PDF parsing capabilities | ✅ Working |
| **`scripts/refine-section-12-21.ts`** | **Context stamping for Section 12.21 chunks** | ✅ **Working (100% coverage)** |
| `src/lib/services/chunking.ts` | Polymorphic parser for municipal code | ✅ Working |
| `src/lib/services/embeddings.ts` | OpenAI embedding generation | ✅ Working |

### Production Metrics:

- **Total chapters:** 3 (I, 1A, IX)
- **Total chunks:** 1,381
- **Total tokens:** 1,366,494
- **Average tokens/chunk:** 990
- **Chapter I:** 270 chunks, 648,307 tokens (avg 2,401 tokens/chunk) - **PDF source**
- **Chapter 1A:** 335 chunks, 304,651 tokens (avg 909 tokens/chunk)
- **Chapter IX:** 776 chunks, 413,536 tokens (avg 533 tokens/chunk) - **PDF source**
- **Retrieval accuracy:** 72.75% similarity on test query
- **Status:** ✅ **PRODUCTION READY** - Full knowledge base operational
- **Parser upgrade:** 4-level hierarchy support increased Chapter 1A coverage by 102% (166→335 chunks)
- **Chapter I quality fix:** Replaced 264 chunks of ghost data with 270 chunks of real regulatory content from PDF (+100% usable data)
- **Chapter IX quality fix:** Replaced 300 thin article-level chunks with 776 chunks of real building code content from PDF (+158% coverage)

---

## 🚧 Pending Work

### Priority 1: ~~Ingest Remaining Scraped Data~~ ✅ COMPLETED

All scraped data has been successfully ingested:

| Source | Status | Size | Actual Chunks | Result |
|--------|--------|------|---------------|--------|
| Chapter I - Zoning | ✅ Ingested (PDF) | 5.54 MB | 270 chunks | Complete - Real content |
| Chapter 1A - Downtown Zoning | ✅ Ingested | 4.6 MB | 335 chunks | Complete |
| Chapter IX - Building | ✅ Ingested (PDF) | 4.41 MB | 776 chunks | Complete - Real content |

**Parser Upgrades Made:**
- Polymorphic parser supports both Legacy and Markdown formats
- Auto-detection with 5000-char sample window
- Pre-scan to skip navigation junk
- Hierarchy column added to database schema

**Chapter I Data Quality Fix:**
- **Problem:** AmLegal SPA only returned navigation shell (language selector, footer) - no actual legal text
- **Attempts:** Firecrawl V1, V2, crawl mode, waitFor delays - all failed
- **Solution:** Switched to PDF ingestion using `pdf-parse` library
- **Result:** 270 chunks of real regulatory content (vs 264 chunks of ghost data)
- **Coverage:** 590 pages, 2.7M characters, including verified parking regulations (SEC. 12.21)

**Chapter IX Data Quality Fix:**
- **Problem:** Web scraping only captured thin article-level table of contents (~300 chunks, 77k tokens)
- **Solution:** Switched to PDF ingestion using `pdf-parse` library
- **Result:** 776 chunks of real building code content (vs 300 thin article-level chunks)
- **Coverage:** 336 pages, 1.77M characters, including Building Code, Electrical Code, Plumbing Code, Mechanical Code
- **Token count:** 413,536 tokens (5.3x improvement over thin scraped data)

### Priority 2: Ordinance Gap Protection (CRITICAL FOR LIABILITY)

**Issue:** The codified text on amlegal.com has a 3-month delay between ordinance passage and posting.

**Current Through Date:** September 30, 2025

**What This Means:**
- Any ordinances passed after Sept 30, 2025 are NOT in our scraped data
- Users could rely on outdated code → liability risk
- Competitors may have fresher data

**Solution Required:**
1. ✅ Document the gap in system prompts/disclaimers
2. ⏳ Create script to query LA City Clerk system for recent ordinances
3. ⏳ Implement weekly monitoring for gap ordinances
4. ⏳ Add UI warning when gap ordinances exist

**City Clerk System:** https://cityclerk.lacity.org/lacityclerkconnect/index.cfm

---

## Data Sources & Platform Details

### Primary Source: American Legal Publishing (amlegal.com)

**Platform:** One of the "Big Three" municipal code hosts
**Coverage:** ~70-80% of U.S. municipalities

**URL Structure:**
```
https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-[ID]
```

**Characteristics:**
- Non-sequential database IDs (cannot construct URLs programmatically)
- JavaScript-rendered content (requires Firecrawl)
- Clean HTML → Markdown conversion
- Hierarchical navigation in left sidebar
- 3-month codification delay (gap warning required)

**Current Through:** September 30, 2025

### Secondary Source: LA Zoning Portal (zoning.lacity.gov)

**Coverage:** Chapter 1A (Downtown Zoning) only
**URL Structure:** `https://zoning.lacity.gov/browse/{article_number}`

**Status:** ✅ All 15 articles scraped (4.6 MB)

---

## Technical Details

### Scraping Scripts

| Script | Purpose | API | Status |
|--------|---------|-----|--------|
| `scripts/scrape-la-articles.js` | Chapter I zoning (100ms delays) | V1 | ✅ Complete |
| `scripts/retry-failed-scrapes.js` | Retry with 3s delays | V1 | ✅ Complete |
| `scripts/scrape-chapter1a.js` | Downtown zoning from zoning.lacity.gov | V1 | ✅ Complete |
| `scripts/scrape-chapter9-building.js` | Building codes (article-level) | V1 | ✅ Complete |
| **scripts/scrape-amlegal-divisions.js** | **Division-level building codes (generalized)** | **V2** | ✅ **READY** |
| **scripts/monitor-ordinance-gap.js** | **Check City Clerk for recent ordinances** | N/A | ⏳ **TODO** |

### Firecrawl API Versions

**V1 API** (used for existing data):
- Endpoint: `api.firecrawl.dev/v1/scrape`
- Used for: Chapter I, 1A, IX article-level
- Status: Working, data is production-ready

**V2 API** (use going forward):
- Endpoint: `api.firecrawl.dev/v2/scrape` and `/v2/crawl`
- Version: v2.6.0 (Nov 2024 release)
- Benefits:
  - ✅ **500% faster** with 2-day default caching (`maxAge: 172800000`)
  - ✅ **Better defaults**: `blockAds: true`, `skipTlsVerification: true`, `removeBase64Images: true`
  - ✅ **Smart proxy**: Auto-retry with stealth if basic fails (`proxy: "auto"`)
  - ✅ **Improved markdown parsing** for cleaner output
  - ✅ **Unified billing**: Credits instead of tokens
- Use for: Division scraping, future cities

**Migration Note:** No need to re-scrape V1 data. V1 markdown is clean and usable. Use V2 for new scraping only.

### Rate Limiting Strategy

- **Initial approach:** 100ms delays → hit rate limits after ~15 requests
- **Current approach:** 3-second delays → successful
- **V2 approach:** Crawl mode with built-in rate handling + 2-day cache reduces requests by 500%

### Firecrawl Configuration

**V1 Scrape (what we used):**
```javascript
// POST https://api.firecrawl.dev/v1/scrape
{
  url: 'https://codelibrary.amlegal.com/codes/...',
  formats: ['markdown'],
  onlyMainContent: true
}
```

**V2 Crawl (generalized division scraper):**
```javascript
// POST https://api.firecrawl.dev/v2/crawl
{
  url: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-172105',
  limit: 200,
  maxDepth: 2,
  allowBackwardLinks: false,
  allowExternalLinks: false,
  scrapeOptions: {
    formats: ['markdown'],
    onlyMainContent: true
    // V2 defaults automatically applied:
    // - blockAds: true
    // - skipTlsVerification: true
    // - removeBase64Images: true
    // - maxAge: 172800000 (2-day cache)
  }
}
```

**Usage:**
```bash
# Scrape LA Chapter IX divisions
node scripts/scrape-amlegal-divisions.js --city=los_angeles --chapter=chapter9

# Works for any amlegal city (future-proof)
node scripts/scrape-amlegal-divisions.js --city=san_francisco --chapter=building
```

---

## Known Gaps & Limitations

### 1. Specific Plans NOT Included

LA has 100+ Specific Plans (zoning overlays) that modify base zoning:
- Examples: Hollywood Community Plan, Venice Coastal Zone Specific Plan
- Location: planning.lacity.gov (separate PDFs)
- Status: **Not scraped** (Phase 2 feature)

**Recommendation:** Add disclaimer: "This tool covers base zoning. Specific Plans may apply to your property."

### 2. Building Code Divisions Missing

Current scraping captures article-level table of contents only, not detailed regulations.

**Example:**
- ✅ Have: "Article 1 has 97 divisions"
- ❌ Missing: Full text of each division (~25-30 MB)

### 3. Ordinance Gap (3-month delay)

Codified text lags behind actual law by up to 3 months.

**Must implement:**
- Warning to users about gap
- Weekly monitoring of City Clerk system
- Link to recent ordinances

---

## Competitive Analysis

### What We Have vs. Competitors

**CivCheck (Competitor):**
- Checks zoning AND building codes ✅ (we will have this after division scrape)
- 25% time savings for DOB plan reviewers
- Target: Department of Buildings staff

**CodeComply.Ai (Competitor):**
- Building code automation
- Focus: Code compliance checking

**Our Advantage:**
- Same data sources (American Legal Publishing)
- Fresher approach (ordinance gap monitoring)
- Better chunking strategy ("Vulcan Principle" - split by regulatory headers)

---

## Next Steps

### Immediate (This Week)

1. **✅ COMPLETED - Building Code Ingestion:**
   - Replaced thin article-level web scrape with full PDF ingestion
   - Result: 776 chunks, 413,536 tokens (5.3x improvement)
   - Coverage: Building Code, Electrical Code, Plumbing Code, Mechanical Code

2. **Implement Ordinance Gap Warning:**
   - Add "current through" date to system prompts
   - Create disclaimer text for UI
   - Document gap monitoring strategy

### Medium-Term (Next Month)

3. **Create Gap Monitoring Script:**
   - Query City Clerk for ordinances after Sept 30, 2025
   - Filter by LAMC Chapter I and IX
   - Store in separate table/file

4. **✅ COMPLETED - Chunking & Embeddings:**
   - Built polymorphic parser supporting Legacy & Markdown formats
   - Generated 1,381 chunks with full hierarchy tracking
   - Created embeddings using OpenAI text-embedding-3-large (1536 dims)
   - Stored in Supabase pgvector
   - Actual cost: ~$0.30

### Long-Term (Q1 2026)

5. **Expand to Other Cities:**
   - NYC: Municode platform
   - SF: American Legal Publishing + SF Planning directives
   - Leverage codifier platform knowledge

6. **Add Specific Plans Index:**
   - Scrape list from planning.lacity.gov
   - Link to PDFs (don't ingest yet)

---

## Data Volume Estimates

### Current State
```
Chapter I (Zoning PDF):     5.54 MB  ✅
Chapter 1A (Downtown):      4.6 MB   ✅
Chapter IX (Building PDF):  4.41 MB  ✅
                           ---------
Total:                      14.5 MB
```

### Future Expansion Estimates
```
Chapter I (Zoning PDF):     5.54 MB  ✅ Complete
Chapter 1A (Downtown):      4.6 MB   ✅ Complete
Chapter IX (Building PDF):  4.41 MB  ✅ Complete
Gap ordinances:            2-3 MB    ⏳ Future
Additional chapters:       10-20 MB  ⏳ Future
                           ---------
Future Total:              ~27-37 MB
```

### Embedding Costs
- **Current:** ~14.5 MB → ~$0.30 (estimated, already spent)
- **Gap monitoring:** ~$0.05/month (when implemented)
- **Additional chapters:** ~$0.25-0.50 (if expanded)

---

## Key Files

### Scraped Data
- `.cache/chapter1.pdf` - Chapter I PDF (5.54 MB, 590 pages) - **PRODUCTION SOURCE**
- `.cache/chapter9.pdf` - Chapter IX PDF (4.41 MB, 336 pages) - **PRODUCTION SOURCE**
- `.cache/la-zoning-scraped.json` - Chapter I web scrape (2.7 MB) - ⚠️ Ghost data, not used
- `.cache/chapter1a-scraped.json` - Chapter 1A (4.6 MB) - **PRODUCTION SOURCE**
- `.cache/chapter9-building-scraped.json` - Chapter IX article-level (338 KB) - ⚠️ Thin data, replaced by PDF

### Scripts
- `scripts/scrape-la-articles.js` - Original Chapter I scraper (deprecated - produced ghost data)
- `scripts/retry-failed-scrapes.js` - Retry with longer delays (deprecated)
- `scripts/scrape-chapter9-building.js` - Building code article scraper (deprecated - replaced by PDF)
- `scripts/ingest-chapter1-pdf.ts` - **Chapter I PDF ingestion** (production)
- `scripts/ingest-chapter9-pdf.ts` - **Chapter IX PDF ingestion** (production)
- `scripts/test-pdf-read.ts` - PDF parsing verification
- `scripts/scrape-chapter1a.js` - Downtown zoning scraper

### Configuration
- `src/lib/featured-metros.ts` - Metro definitions including codifier_platform
- Environment: `FIRECRAWL_API_KEY` required

---

## Important URLs

### LA Municipal Code
- **Codified Text:** https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/
- **Downtown Zoning:** https://zoning.lacity.gov/
- **City Clerk (Gap Ordinances):** https://cityclerk.lacity.org/lacityclerkconnect/

### Specific Chapters
- **Chapter I Root:** https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-107408
- **Chapter 1A Root:** https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-423580
- **Chapter IX Root:** https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-172082

---

## Business Context

**Product:** Bureaucracy Decoder
**Goal:** Upload site plan → Get compliance report

**Market:** $2.15B permitting software market

**MVP Scope:**
- "Chat with zoning code" with citations (NOT full pre-approval packet)
- LA City only (not LA County)
- Both zoning AND building codes
- Month 1 target: LA, SF, NYC

**Key Requirements:**
- Citation-first responses (liability protection)
- Ordinance gap warnings
- "Vulcan Principle" chunking by regulatory headers
- Bias toward under-claiming ("Not Determinable" vs hallucinating)
- Clear disclaimer: "Informational only, not legal advice"

---

## Disclaimers & Warnings

⚠️ **Ordinance Gap:** The codified text is current through September 30, 2025. Recent ordinances may not be reflected. Always verify with LA City Clerk.

⚠️ **Specific Plans:** This data does NOT include Specific Plans or overlay zones. Check planning.lacity.gov for additional regulations.

⚠️ **Not Legal Advice:** This tool provides informational analysis only. Consult licensed professionals for legal/architectural advice.

---

**Last Updated:** 2025-11-22
**Next Review:** After implementing ordinance gap warnings
