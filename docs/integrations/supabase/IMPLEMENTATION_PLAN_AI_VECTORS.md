# AI Vectors Implementation Plan: Semantic Search for VMP

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Planning  
**Purpose:** Complete implementation plan for enabling semantic search using pgvector on existing VMP data  
**Auto-Generated:** No

---

## 📋 Executive Summary

This document outlines the implementation plan for **Option A: AI/Vector Prototype** - enabling semantic search on your existing VMP data using Supabase's built-in `pgvector` extension.

### Current State

✅ **pgvector is already installed** (version 0.8.0)  
✅ **`document_embeddings` table exists** with vector column  
✅ **Edge Function `process-document`** exists for document processing  
✅ **Multiple text-rich tables** ready for semantic search

### Goal

Enable **semantic search** on:
- Case subjects and descriptions
- Case messages
- Evidence titles and descriptions
- Metadata descriptions
- Glossary terms

---

## 🎯 Phase 1: Foundation (Day 1)

### Step 1.1: Verify pgvector Installation

```sql
-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Expected: version 0.8.0
```

**Status:** ✅ Already installed

### Step 1.2: Review Existing `document_embeddings` Table

```sql
-- Check current structure
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'document_embeddings';
```

**Current Structure:**
- `id` (UUID)
- `document_id` (UUID)
- `content` (TEXT)
- `embedding` (vector) - **Already exists!**
- `tenant_id` (UUID)
- `organization_id` (UUID)
- `created_at`, `updated_at`

**Action:** This table is ready. We'll use it as a reference pattern.

---

## 🚀 Phase 2: Enable Semantic Search on Core Tables (Days 2-3)

### Target Tables for Semantic Search

| Table | Text Fields | Use Case | Priority |
|-------|-------------|----------|----------|
| `nexus_cases` | `subject`, `description` | Find similar cases | **HIGH** |
| `nexus_case_messages` | `body`, `body_html` | Search message history | **HIGH** |
| `nexus_case_evidence` | `title`, `description` | Find related evidence | **MEDIUM** |
| `mdm_global_metadata` | `description` | Metadata search | **MEDIUM** |
| `mdm_glossary_term` | `term`, `description` | Glossary search | **LOW** |

### Step 2.1: Add Embedding Columns

**Migration: `042_add_semantic_search_embeddings.sql`**

```sql
-- ============================================================================
-- Add embedding columns to core tables for semantic search
-- ============================================================================

-- 1. NEXUS_CASES: Add embedding for subject + description
ALTER TABLE nexus_cases
ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN nexus_cases.embedding IS 
'OpenAI text-embedding-ada-002 embedding (1536 dimensions) for semantic search on subject and description';

-- 2. NEXUS_CASE_MESSAGES: Add embedding for body
ALTER TABLE nexus_case_messages
ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN nexus_case_messages.embedding IS 
'OpenAI text-embedding-ada-002 embedding (1536 dimensions) for semantic search on message body';

-- 3. NEXUS_CASE_EVIDENCE: Add embedding for title + description
ALTER TABLE nexus_case_evidence
ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN nexus_case_evidence.embedding IS 
'OpenAI text-embedding-ada-002 embedding (1536 dimensions) for semantic search on title and description';

-- 4. MDM_GLOBAL_METADATA: Add embedding for description
ALTER TABLE mdm_global_metadata
ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN mdm_global_metadata.embedding IS 
'OpenAI text-embedding-ada-002 embedding (1536 dimensions) for semantic search on metadata descriptions';
```

### Step 2.2: Create Indexes for Fast Similarity Search

```sql
-- ============================================================================
-- Create HNSW indexes for fast similarity search
-- ============================================================================

-- HNSW index for cases (faster, larger index)
CREATE INDEX IF NOT EXISTS idx_nexus_cases_embedding_hnsw
ON nexus_cases
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for messages
CREATE INDEX IF NOT EXISTS idx_nexus_messages_embedding_hnsw
ON nexus_case_messages
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for evidence
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_embedding_hnsw
ON nexus_case_evidence
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for metadata
CREATE INDEX IF NOT EXISTS idx_mdm_metadata_embedding_hnsw
ON mdm_global_metadata
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Index Selection Rationale:**
- **HNSW** chosen over IVFFlat for better query performance
- **m = 16** (default) - good balance of speed vs. index size
- **ef_construction = 64** (default) - good quality for most use cases

---

## 🔧 Phase 3: Create Search Functions (Day 3)

### Step 3.1: Create Similarity Search Function for Cases

```sql
-- ============================================================================
-- Semantic search function for cases
-- ============================================================================
CREATE OR REPLACE FUNCTION search_similar_cases(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  tenant_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  case_id text,
  subject text,
  description text,
  similarity float,
  status text,
  priority text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.case_id,
    c.subject,
    c.description,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.status,
    c.priority
  FROM nexus_cases c
  WHERE
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (tenant_filter IS NULL OR c.client_id = tenant_filter OR c.vendor_id = tenant_filter)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_cases IS 
'Semantic search for similar cases using cosine similarity. Returns cases with similarity > match_threshold.';
```

### Step 3.2: Create Hybrid Search Function (Vector + Full-Text)

```sql
-- ============================================================================
-- Hybrid search: Combine vector similarity + full-text search
-- ============================================================================
CREATE OR REPLACE FUNCTION hybrid_search_cases(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  tenant_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  case_id text,
  subject text,
  description text,
  similarity float,
  rank float,
  combined_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.case_id,
    c.subject,
    c.description,
    1 - (c.embedding <=> query_embedding) as similarity,
    ts_rank(
      to_tsvector('english', coalesce(c.subject, '') || ' ' || coalesce(c.description, '')),
      plainto_tsquery('english', query_text)
    ) as rank,
    -- Combined score: 70% vector, 30% full-text
    (
      (1 - (c.embedding <=> query_embedding)) * 0.7 +
      ts_rank(
        to_tsvector('english', coalesce(c.subject, '') || ' ' || coalesce(c.description, '')),
        plainto_tsquery('english', query_text)
      ) * 0.3
    ) as combined_score
  FROM nexus_cases c
  WHERE
    c.embedding IS NOT NULL
    AND (
      1 - (c.embedding <=> query_embedding) > match_threshold
      OR to_tsvector('english', coalesce(c.subject, '') || ' ' || coalesce(c.description, '')) 
         @@ plainto_tsquery('english', query_text)
    )
    AND (tenant_filter IS NULL OR c.client_id = tenant_filter OR c.vendor_id = tenant_filter)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_cases IS 
'Hybrid search combining vector similarity (70%) and full-text search (30%) for better results.';
```

### Step 3.3: Create Message Search Function

```sql
-- ============================================================================
-- Semantic search for case messages
-- ============================================================================
CREATE OR REPLACE FUNCTION search_similar_messages(
  query_embedding vector(1536),
  case_id_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  message_id text,
  case_id text,
  body text,
  similarity float,
  sender_context text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.message_id,
    m.case_id,
    m.body,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.sender_context,
    m.created_at
  FROM nexus_case_messages m
  WHERE
    m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (case_id_filter IS NULL OR m.case_id = case_id_filter)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 🤖 Phase 4: Embedding Generation (Days 4-5)

### Step 4.1: Create Embedding Generation Function

**Edge Function: `generate-embeddings`**

```typescript
// supabase/functions/generate-embeddings/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { table, record_id, text_fields } = await req.json()
    
    // Combine text fields
    const text = Object.values(text_fields).join(' ').trim()
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Generate embedding using OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }
    
    const { data } = await response.json()
    const embedding = data[0].embedding
    
    // Update record with embedding
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { error } = await supabase
      .from(table)
      .update({ embedding })
      .eq('id', record_id)
    
    if (error) throw error
    
    return new Response(
      JSON.stringify({ success: true, record_id }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 4.2: Create Database Trigger for Auto-Embedding

```sql
-- ============================================================================
-- Trigger function to generate embeddings on INSERT/UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_case_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  text_content text;
  embedding_result jsonb;
BEGIN
  -- Combine subject and description
  text_content := coalesce(NEW.subject, '') || ' ' || coalesce(NEW.description, '');
  
  -- Skip if no text or embedding already exists
  IF text_content = '' OR NEW.embedding IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Call Edge Function to generate embedding
  -- Note: This is async - embedding will be updated via webhook or scheduled job
  -- For now, we'll use a scheduled job to backfill embeddings
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_generate_case_embedding
AFTER INSERT OR UPDATE OF subject, description ON nexus_cases
FOR EACH ROW
WHEN (NEW.embedding IS NULL)
EXECUTE FUNCTION generate_case_embedding();
```

**Alternative Approach:** Use a **scheduled job** (pg_cron) to backfill embeddings for existing records and generate for new ones.

### Step 4.3: Create Backfill Script

```sql
-- ============================================================================
-- Backfill embeddings for existing records
-- ============================================================================
CREATE OR REPLACE FUNCTION backfill_case_embeddings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  case_record record;
  text_content text;
BEGIN
  -- Process cases without embeddings
  FOR case_record IN
    SELECT id, subject, description
    FROM nexus_cases
    WHERE embedding IS NULL
    AND (subject IS NOT NULL OR description IS NOT NULL)
    LIMIT 100  -- Process in batches
  LOOP
    text_content := coalesce(case_record.subject, '') || ' ' || coalesce(case_record.description, '');
    
    -- Call Edge Function via pg_net (async)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-embeddings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'table', 'nexus_cases',
        'record_id', case_record.id,
        'text_fields', jsonb_build_object(
          'subject', case_record.subject,
          'description', case_record.description
        )
      )
    );
  END LOOP;
END;
$$;

-- Schedule backfill job (runs every hour)
SELECT cron.schedule(
  'backfill-embeddings',
  '0 * * * *',  -- Every hour
  $$SELECT backfill_case_embeddings();$$
);
```

---

## 📊 Phase 5: API Integration (Day 6)

### Step 5.1: Create JavaScript Helper Functions

**File: `src/utils/semantic-search.js`**

```javascript
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

/**
 * Generate embedding for a text query
 */
async function generateQueryEmbedding(queryText) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: queryText,
  })
  
  return response.data[0].embedding
}

/**
 * Search for similar cases using semantic search
 */
export async function searchSimilarCases(queryText, options = {}) {
  const {
    matchThreshold = 0.7,
    matchCount = 10,
    tenantFilter = null,
  } = options
  
  // Generate embedding for query
  const queryEmbedding = await generateQueryEmbedding(queryText)
  
  // Call database function
  const { data, error } = await supabase.rpc('search_similar_cases', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    tenant_filter: tenantFilter,
  })
  
  if (error) throw error
  
  return data
}

/**
 * Hybrid search: Vector + Full-Text
 */
export async function hybridSearchCases(queryText, options = {}) {
  const {
    matchThreshold = 0.7,
    matchCount = 10,
    tenantFilter = null,
  } = options
  
  // Generate embedding for query
  const queryEmbedding = await generateQueryEmbedding(queryText)
  
  // Call database function
  const { data, error } = await supabase.rpc('hybrid_search_cases', {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    tenant_filter: tenantFilter,
  })
  
  if (error) throw error
  
  return data
}

/**
 * Search similar messages
 */
export async function searchSimilarMessages(queryText, caseId = null, options = {}) {
  const {
    matchThreshold = 0.7,
    matchCount = 20,
  } = options
  
  // Generate embedding for query
  const queryEmbedding = await generateQueryEmbedding(queryText)
  
  // Call database function
  const { data, error } = await supabase.rpc('search_similar_messages', {
    query_embedding: queryEmbedding,
    case_id_filter: caseId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })
  
  if (error) throw error
  
  return data
}
```

### Step 5.2: Create Route Handler

**File: `src/routes/semantic-search.js`**

```javascript
import express from 'express'
import { searchSimilarCases, hybridSearchCases, searchSimilarMessages } from '../utils/semantic-search.js'

const router = express.Router()

// Search similar cases
router.post('/cases/search', async (req, res) => {
  try {
    const { query, threshold, limit, tenant_id } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' })
    }
    
    const results = await hybridSearchCases(query, {
      matchThreshold: threshold || 0.7,
      matchCount: limit || 10,
      tenantFilter: tenant_id || null,
    })
    
    res.json({ results })
  } catch (error) {
    console.error('Semantic search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

// Search similar messages
router.post('/messages/search', async (req, res) => {
  try {
    const { query, case_id, threshold, limit } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' })
    }
    
    const results = await searchSimilarMessages(query, case_id, {
      matchThreshold: threshold || 0.7,
      matchCount: limit || 20,
    })
    
    res.json({ results })
  } catch (error) {
    console.error('Message search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

export default router
```

---

## 🧪 Phase 6: Testing & Validation (Day 7)

### Test Cases

1. **Basic Semantic Search**
   ```javascript
   // Search for "payment dispute"
   const results = await searchSimilarCases("payment dispute")
   // Should return cases about payment issues, even if they don't contain exact words
   ```

2. **Hybrid Search**
   ```javascript
   // Search for "invoice #12345"
   const results = await hybridSearchCases("invoice #12345")
   // Should match both semantically similar cases AND exact invoice number matches
   ```

3. **Message Search**
   ```javascript
   // Search for "delivery delay"
   const results = await searchSimilarMessages("delivery delay", "CASE-123")
   // Should find messages about shipping issues, late deliveries, etc.
   ```

### Performance Benchmarks

- **Target:** < 100ms for similarity search on 10,000 cases
- **Target:** < 200ms for hybrid search
- **Index Size:** ~50MB per 10,000 embeddings (1536 dimensions)

---

## 📈 Phase 7: Monitoring & Optimization (Ongoing)

### Metrics to Track

1. **Search Performance**
   - Average query time
   - Index hit rate
   - Cache hit rate

2. **Embedding Generation**
   - Success rate
   - OpenAI API latency
   - Cost per embedding

3. **User Engagement**
   - Search queries per day
   - Click-through rate
   - User satisfaction

### Optimization Strategies

1. **Caching:** Cache query embeddings for common searches
2. **Batch Processing:** Generate embeddings in batches
3. **Index Tuning:** Adjust HNSW parameters based on query patterns
4. **Selective Indexing:** Only index frequently searched tables

---

## 🎯 Success Criteria

### Phase 1-2: Foundation ✅
- [x] pgvector verified
- [ ] Embedding columns added
- [ ] Indexes created

### Phase 3: Functions ✅
- [ ] Search functions created
- [ ] Hybrid search implemented
- [ ] Functions tested

### Phase 4: Generation ✅
- [ ] Edge Function deployed
- [ ] Backfill job scheduled
- [ ] Embeddings generated for existing data

### Phase 5: Integration ✅
- [ ] JavaScript helpers created
- [ ] API routes implemented
- [ ] Frontend integration complete

### Phase 6: Testing ✅
- [ ] Unit tests passing
- [ ] Performance benchmarks met
- [ ] User acceptance testing complete

---

## 📚 Related Documentation

- [AI & Vectors Guide](./AI_VECTORS_GUIDE.md) - Complete pgvector guide
- [Cron Jobs Guide](./CRON_JOBS_GUIDE.md) - Scheduled embedding generation
- [Edge Functions Secrets](./EDGE_FUNCTIONS_SECRETS_GUIDE.md) - OpenAI API key management

---

## 🚀 Next Steps

1. **Review this plan** with the team
2. **Create migration file** `042_add_semantic_search_embeddings.sql`
3. **Deploy Edge Function** `generate-embeddings`
4. **Test with sample data** before full rollout
5. **Monitor performance** and adjust thresholds

---

**Estimated Timeline:** 7 days  
**Complexity:** Medium  
**Impact:** High - Enables semantic search across all case data

---

**Last Updated:** 2025-01-22  
**Next Review:** After Phase 1 completion

