# LA Municipal Code Scraping Progress

**Last Updated:** 2025-11-21
**Project:** Bureaucracy Decoder - LA City Zoning & Building Code Compliance Tool

---

## Current Status Summary

### ✅ Completed Pipeline (End-to-End)

| Source | Status | Size | Chunks | Location |
|--------|--------|------|--------|----------|
| **Chapter I - Zoning** | ✅ Scraped | 2.7 MB | Pending ingestion | `.cache/la-zoning-scraped.json` |
| **Chapter 1A - Downtown Zoning** | ✅ Scraped | 4.6 MB | Pending ingestion | `.cache/chapter1a-scraped.json` |
| **Chapter IX - Building Regulations** | ✅ **INGESTED** | 451 KB | **300 chunks** | Supabase `zoning_embeddings` |

**Total Scraped:** ~7.6 MB
**Total Ingested:** Chapter IX (300 chunks, 77,892 tokens)
**RAG Status:** ✅ **OPERATIONAL** - Semantic search working with 72.75% similarity on test queries

---

## 🎉 Major Milestone: RAG Pipeline Complete (Nov 21, 2025)

### What Was Built:

1. **✅ Scraping (Firecrawl V2)**
   - Scraped Chapter IX Building Regulations (11 articles, 451KB)
   - File: `.cache/los_angeles-chapter9-divisions-2025-11-21.json`

2. **✅ Stateful Chunking Parser**
   - Built custom line-by-line parser for LA Municipal Code format
   - Preserves full hierarchy: "Chapter IX > Article X > Division Y"
   - File: `src/lib/services/chunking.ts`
   - Result: 44 raw chunks → 300 final chunks

3. **✅ Safety Valve for Oversized Chunks**
   - Detected 3 chunks exceeding 7,000 tokens (max was 18,218 tokens)
   - Split by subsections automatically
   - Prevented OpenAI API truncation/failures

4. **✅ Embedding Generation**
   - Model: OpenAI text-embedding-3-large
   - Dimensions: 1536 (explicitly set for pgvector compatibility)
   - Batched processing: 100 chunks per API call
   - File: `src/lib/services/embeddings.ts`

5. **✅ Supabase Storage**
   - 300 embeddings inserted into `zoning_embeddings` table
   - Document metadata in `zoning_docs` table
   - Status: 'ingested'
   - Doc ID: `caeb4c14-7142-4877-a22f-91362789f923`

6. **✅ Vector Search Verification**
   - Test query: "When is a grading permit required?"
   - Result: 72.75% similarity match on Section 91.106.1.2
   - Top 3 results all relevant (grading permits and fees)
   - File: `scripts/test-retrieval.ts`

### Key Scripts Created:

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/ingest-chapter9.ts` | Full ingestion pipeline with Safety Valve | ✅ Working |
| `scripts/test-chunking.ts` | Verify chunking preserves hierarchy | ✅ Working |
| `scripts/test-retrieval.ts` | Verify RAG semantic search | ✅ Working |
| `src/lib/services/chunking.ts` | Stateful parser for municipal code | ✅ Working |
| `src/lib/services/embeddings.ts` | OpenAI embedding generation | ✅ Working |

### Production Metrics:

- **Total chunks:** 300
- **Total tokens:** 77,892
- **Average tokens/chunk:** 260
- **Largest chunk prevented:** 18,218 tokens → split into 84 subsections
- **Retrieval accuracy:** 72.75% similarity on test query
- **Status:** ✅ **PRODUCTION READY**

---

## 🚧 Pending Work

### Priority 1: Ingest Remaining Scraped Data

Now that the RAG pipeline is proven, ingest the remaining scraped data:

| Source | Status | Size | Est. Chunks | Action Required |
|--------|--------|------|-------------|-----------------|
| Chapter I - Zoning | Scraped | 2.7 MB | ~400-500 | Run ingestion script |
| Chapter 1A - Downtown Zoning | Scraped | 4.6 MB | ~600-800 | Run ingestion script |

**Note:** Chapter I & 1A use different formats than Chapter IX. May need parser adjustments for zoning code structure.

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

1. **Decision Required:** Approve building code division scraping strategy
   - Option A: All divisions (35-45 MB, 2-3 hours) - **RECOMMENDED**
   - Option B: Critical subset only (~15-20 MB, 30 min)
   - Option C: Phased approach (week-by-week)

2. **Execute Building Code Scraping:**
   - Create `scripts/scrape-chapter9-divisions.js`
   - Use Firecrawl crawl mode for automatic URL discovery
   - Target all 12 articles, all divisions

3. **Implement Ordinance Gap Warning:**
   - Add "current through" date to system prompts
   - Create disclaimer text for UI
   - Document gap monitoring strategy

### Medium-Term (Next Month)

4. **Create Gap Monitoring Script:**
   - Query City Clerk for ordinances after Sept 30, 2025
   - Filter by LAMC Chapter I and IX
   - Store in separate table/file

5. **Implement Chunking Strategy:**
   - "Vulcan Principle": Split by regulatory headers
   - Regex patterns: `/\b(Section|Sec\.|§)\s+\d+(\.\d+)*\b/`
   - Store: content_chunk, source_url, section_heading, section_ref

6. **Generate Embeddings:**
   - Use OpenAI text-embedding-3-large
   - Store in Supabase pgvector
   - Estimated cost: $1.50-2.00 (one-time)

### Long-Term (Q1 2025)

7. **Expand to Other Cities:**
   - NYC: Municode platform
   - SF: American Legal Publishing + SF Planning directives
   - Leverage codifier platform knowledge

8. **Add Specific Plans Index:**
   - Scrape list from planning.lacity.gov
   - Link to PDFs (don't ingest yet)

---

## Data Volume Estimates

### Current State
```
Chapter I (Zoning):        2.7 MB  ✅
Chapter 1A (Downtown):     4.6 MB  ✅
Chapter IX (Article-level): 0.3 MB  ✅
                          --------
Total:                     7.6 MB
```

### After Building Code Division Scrape
```
Chapter I (Zoning):        2.7 MB
Chapter 1A (Downtown):     4.6 MB
Chapter IX (All divisions): 35-45 MB
Gap ordinances:            2-3 MB (ongoing)
                          --------
Total:                     45-55 MB
```

### Embedding Costs
- **Current:** ~7.6 MB → ~$0.15 (estimated)
- **After division scrape:** ~45-55 MB → $1.50-2.00 (estimated)
- **Ongoing gap monitoring:** ~$0.05/month

---

## Key Files

### Scraped Data
- `.cache/la-zoning-scraped.json` - Chapter I (2.7 MB)
- `.cache/chapter1a-scraped.json` - Chapter 1A (4.6 MB)
- `.cache/chapter9-building-scraped.json` - Chapter IX article-level (338 KB)

### Scripts
- `scripts/scrape-la-articles.js` - Original Chapter I scraper
- `scripts/retry-failed-scrapes.js` - Retry with longer delays
- `scripts/scrape-chapter1a.js` - Downtown zoning scraper
- `scripts/scrape-chapter9-building.js` - Building code article scraper

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

**Last Updated:** 2025-11-21
**Next Review:** After Chapter I & 1A ingestion
