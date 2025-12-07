# Municipal Code Ingestion Process

A repeatable factory pattern for ingesting municipal codes with quality gates.

```
PDF → Chunking → Guardrail → Ingest → Hybrid Search → RAGAS Gate → Ship
```

---

## Overview

This process ensures high-quality RAG retrieval for compliance tools. Each chapter goes through the same pipeline with measurable quality gates before shipping.

**Target Metrics:**
- Context Recall: ≥80%
- Hit Rate: ≥90%
- Tier 1 Section Coverage: 100%

**GATE PASSED when:**
- Recall ≥ 80% AND
- Hit Rate ≥ 90% AND
- All critical categories (parking, hillside) ≥ 90%

---

## Pipeline Stages

### 1. PDF Acquisition

Download the official PDF from the municipal code source (e.g., AmLegal CodeLibrary).

```bash
# Store in .cache directory
.cache/chapter1.pdf
.cache/chapter1a.pdf
.cache/chapter9.pdf
```

### 2. Chunking

Parse PDF text and split into semantic chunks using `chunkMunicipalCode()`.

**Key Parameters:**
- `MAX_CHUNK_TOKENS = 6000` (OpenAI embedding limit is ~8K)
- Split on section boundaries (SEC. X.XX)
- Split oversized sections on subsections (A., B., 1., 2.)

```typescript
import { chunkMunicipalCode } from '../src/lib/services/chunking';

const chunks = chunkMunicipalCode(pdfText, sourceUrl);
```

**Quality Check:**
- No chunks > 6000 tokens
- Section refs preserved (12.21.A.4, not "unknown")

### 3. Coverage Guardrail

Validate Tier 1 critical sections exist before ingestion proceeds.

```typescript
// scripts/coverage-guardrail.ts
export const TIER1_CRITICAL_SECTIONS: CriticalSection[] = [
  {
    id: '12.21.A.4',
    name: 'Off-Street Parking Requirements',
    requiredKeywords: ['parking', 'automobile', '500 square feet'],
    minContentLength: 5000,
  },
  // ... more sections
];
```

**Gate:** Ingestion FAILS if any Tier 1 section is missing or too short.

### 4. Ingest to Supabase

Generate embeddings and store in `zoning_embeddings` table.

```bash
INGEST_VERSION=v1.0.0-chapter1 npx tsx scripts/ingest-chapter1-pdf.ts
```

**Process:**
1. Delete old chunks for this doc_id
2. Generate embeddings (text-embedding-3-large, 1536 dims)
3. Insert chunks with section_ref, hierarchy, token_count
4. Verify critical sections exist in DB

### 5. Hybrid Search Setup

Configure retrieval with BM25 + Vector + Tier 1 boosting.

**Database Functions:**
- `match_zoning_sections_filtered` - Vector search with doc_id filter
- `search_zoning_bm25` - Full-text search with OR logic

**RRF Merge:**
```typescript
// Reciprocal Rank Fusion combines vector + BM25
const merged = rrfMerge(vectorResults, bm25Results);

// Tier 1 sections get 1.5x boost
if (isTier1Section(section_ref)) {
  score *= 1.5;
}
```

### 6. RAGAS Baseline Test

Run gold queries to measure retrieval quality.

```bash
npx tsx scripts/ragas-baseline.ts
```

**Gold Query Categories:**
- Parking (12.21.A.4)
- Height/Density (12.21.1)
- Zone-specific (12.08, 12.09, 12.10, 12.14)
- Setbacks/Exceptions (12.22)
- Permits/Variances (12.23, 12.24)
- Hillside (12.21.C)
- Definitions (12.03)

**Gate:** Do NOT ship until metrics pass (see Overview).

### 7. Ship

Deploy to production once RAGAS gate passes.

**Post-ship Monitoring:**
- Log query coverage (% hitting Tier 1 sections)
- Track architect upvote/downvote feedback
- Alert on coverage check warnings

### 8. Version & Deploy

```bash
# Tag the ingestion run
INGEST_VERSION=v1.0.0-chapter1 npx tsx scripts/ingest-chapter1-pdf.ts

# Update app config
DOC_VERSION=1.0.0  # For query logging/monitoring
```

Track which version served a query when architects give feedback.

---

## Chapter-Specific Configuration

### Chapter I: General Provisions & Zoning ✓

**Status:** SHIPPED

**Chapter I Results:**
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Recall | 92.5% | ≥80% | ✓ |
| Hit Rate | 95% | ≥90% | ✓ |
| Parking | 100% | ≥90% | ✓ |
| Hillside | 100% | ≥90% | ✓ |

**Tier 1 Sections:**
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

### Chapter 1A: Downtown (TODO)

**Priority:** High (modifies Chapter I for downtown overlays)

**Tier 1 Sections (proposed):**
- Article 4: Development Standards
- Article 5: Uses
- Article 9: Sign Districts
- Parking overlays

**Gold Queries:**
- "Downtown C2 parking overlay"
- "DTLA height bonus"
- "Downtown mixed-use requirements"

### Chapter IX: Building Code (TODO)

**Priority:** Medium (procedural, less frequent queries)

**Tier 1 Sections (proposed):**
- 91.106: Permits
- 91.107: Fees
- 91.1705: Special Inspections

**Gold Queries:**
- "building permit process"
- "LADBS fees"
- "special inspection requirements"

---

## Troubleshooting

### Chunks Missing Critical Content

**Symptom:** Guardrail fails, section not found

**Causes:**
1. PDF text extraction failed (check raw text)
2. Section header not matching regex
3. Chunk too large, got truncated

**Fix:** Run `scripts/diagnose-parser.ts` to analyze raw PDF

### Low RAGAS Recall

**Symptom:** <80% recall on gold queries

**Causes:**
1. Vector embeddings not matching semantic intent
2. BM25 query parsing issues (stopwords, AND vs OR)
3. Tier 1 sections not in top-k results

**Fix:**
1. Check BM25 returns expected section: `SELECT * FROM search_zoning_bm25('parking restaurant', doc_id, 10)`
2. Increase Tier 1 boost (1.5x → 2.0x)
3. Add section-specific gold queries

### Embedding API Errors

**Symptom:** Chunks fail silently during ingestion

**Cause:** OpenAI embedding API limit (~8K tokens)

**Fix:** Ensure MAX_CHUNK_TOKENS ≤ 6000 in chunking.ts

---

## Files Reference

```
scripts/
  ingest-chapter1-pdf.ts    # Chapter I ingestion
  coverage-guardrail.ts     # Tier 1 validation
  ragas-baseline.ts         # Retrieval quality test
  diagnose-parser.ts        # Debug chunking issues

src/lib/services/
  chunking.ts               # PDF text → chunks

supabase/migrations/
  add_fulltext_search_for_hybrid.sql
  add_filtered_match_zoning_sections.sql
```

---

## Expansion Checklist

For each new chapter:

- [ ] Download PDF to `.cache/`
- [ ] Add chapter config to ingestion script
- [ ] Define 5-8 Tier 1 sections in guardrail
- [ ] Add 5-10 gold queries to RAGAS test
- [ ] Run ingestion with guardrail
- [ ] Run RAGAS baseline
- [ ] Gate: Recall ≥ 80%, Hit Rate ≥ 90%
- [ ] Ship + monitor
