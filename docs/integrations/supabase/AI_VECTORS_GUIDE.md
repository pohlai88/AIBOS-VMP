# Supabase AI & Vectors: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase AI & Vectors - pgvector extension, embeddings, and semantic search  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Vector Operations](#vector-operations)
4. [Similarity Search](#similarity-search)
5. [Hybrid Search](#hybrid-search)
6. [Use Cases](#use-cases)
7. [Performance Optimization](#performance-optimization)
8. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is pgvector?

**pgvector** is a Postgres extension that adds vector similarity search capabilities to Supabase. It enables:
- ✅ **Vector Storage** - Store embeddings as vectors
- ✅ **Similarity Search** - Find similar vectors efficiently
- ✅ **Multiple Indexes** - HNSW and IVFFlat indexes
- ✅ **Distance Metrics** - Cosine, L2, Inner Product
- ✅ **Hybrid Search** - Combine vector + full-text search

### Use Cases

- Semantic search
- Recommendation systems
- RAG (Retrieval Augmented Generation)
- Image similarity
- Document clustering
- Anomaly detection

---

## 🚀 Getting Started

### Enable Extension

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Create Vector Column

```sql
-- Add vector column (1536 dimensions for OpenAI embeddings)
ALTER TABLE documents
ADD COLUMN embedding vector(1536);

-- Or create table with vector column
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Generate Embeddings

```javascript
// Generate embedding using OpenAI
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  })
  
  return response.data[0].embedding
}

// Store embedding
const embedding = await generateEmbedding('Your document text')

await supabase
  .from('documents')
  .insert({
    content: 'Your document text',
    embedding: embedding
  })
```

---

## 🔍 Vector Operations

### Distance Metrics

pgvector supports three distance metrics:

1. **Cosine Distance** - Best for normalized vectors
2. **L2 Distance** - Euclidean distance
3. **Inner Product** - Dot product (for normalized vectors)

### Similarity Queries

```sql
-- Cosine similarity (most common)
SELECT *
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- L2 distance
SELECT *
FROM documents
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Inner product
SELECT *
FROM documents
ORDER BY embedding <#> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

### JavaScript Example

```javascript
// Find similar documents
async function findSimilarDocuments(queryText, limit = 10) {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText)
  
  // Find similar documents
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  })
  
  return data
}
```

---

## 📊 Similarity Search

### Create Search Function

```sql
-- Create similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Use Search Function

```javascript
// Call search function
const { data, error } = await supabase.rpc('match_documents', {
  query_embedding: embedding,
  match_threshold: 0.7,
  match_count: 10
})
```

---

## 🔄 Hybrid Search

### Combine Vector + Full-Text Search

```sql
-- Hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  rank float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity,
    ts_rank(to_tsvector('english', documents.content), plainto_tsquery('english', query_text)) as rank
  FROM documents
  WHERE
    1 - (documents.embedding <=> query_embedding) > match_threshold
    OR to_tsvector('english', documents.content) @@ plainto_tsquery('english', query_text)
  ORDER BY
    (1 - (documents.embedding <=> query_embedding) * 0.7 + ts_rank(to_tsvector('english', documents.content), plainto_tsquery('english', query_text)) * 0.3) DESC
  LIMIT match_count;
END;
$$;
```

---

## 🎯 Use Cases

### Use Case 1: Semantic Search

```javascript
// Semantic document search
async function semanticSearch(query) {
  const embedding = await generateEmbedding(query)
  
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 10
  })
  
  return data
}
```

### Use Case 2: RAG (Retrieval Augmented Generation)

```javascript
// RAG pipeline
async function ragQuery(userQuery) {
  // 1. Find relevant documents
  const relevantDocs = await semanticSearch(userQuery)
  
  // 2. Build context
  const context = relevantDocs.map(doc => doc.content).join('\n\n')
  
  // 3. Generate response with context
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `Context: ${context}\n\nQuestion: ${userQuery}` }
    ]
  })
  
  return response.choices[0].message.content
}
```

### Use Case 3: Recommendation System

```sql
-- Find similar users
CREATE OR REPLACE FUNCTION find_similar_users(
  user_embedding vector(1536),
  limit_count int
)
RETURNS TABLE (
  user_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    users.id,
    1 - (users.profile_embedding <=> user_embedding) as similarity
  FROM users
  WHERE users.profile_embedding IS NOT NULL
  ORDER BY users.profile_embedding <=> user_embedding
  LIMIT limit_count;
END;
$$;
```

### Use Case 4: Image Similarity

```javascript
// Image similarity search
async function findSimilarImages(imageUrl) {
  // Generate image embedding (using vision model)
  const imageEmbedding = await generateImageEmbedding(imageUrl)
  
  // Find similar images
  const { data } = await supabase.rpc('match_images', {
    query_embedding: imageEmbedding,
    match_threshold: 0.8,
    match_count: 10
  })
  
  return data
}
```

---

## ⚡ Performance Optimization

### Create Indexes

```sql
-- HNSW index (faster, larger)
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- IVFFlat index (smaller, slower)
CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Index Selection

- **HNSW**: Best for large datasets, fast queries, larger index size
- **IVFFlat**: Best for smaller datasets, smaller index size, slower queries

### Tune Index Parameters

```sql
-- HNSW parameters
-- m: number of connections (default 16)
-- ef_construction: search width during construction (default 64)

CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 128);

-- IVFFlat parameters
-- lists: number of clusters (default 100, should be rows/1000)

CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);
```

### Query Performance

```sql
-- Set index search parameters
SET ivfflat.probes = 10;  -- For IVFFlat (default 1)
SET hnsw.ef_search = 40;  -- For HNSW (default 40)

-- Higher values = more accurate but slower
```

---

## 🔧 Advanced Patterns

### Pattern 1: Batch Embedding Generation

```javascript
// Generate embeddings in batch
async function batchGenerateEmbeddings(texts) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts
  })
  
  return response.data.map(item => item.embedding)
}

// Store batch
const texts = ['Text 1', 'Text 2', 'Text 3']
const embeddings = await batchGenerateEmbeddings(texts)

const documents = texts.map((text, i) => ({
  content: text,
  embedding: embeddings[i]
}))

await supabase.from('documents').insert(documents)
```

### Pattern 2: Incremental Updates

```sql
-- Update embeddings for new documents
CREATE OR REPLACE FUNCTION update_embeddings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  doc record;
BEGIN
  FOR doc IN SELECT * FROM documents WHERE embedding IS NULL
  LOOP
    -- Generate embedding (via Edge Function or external service)
    -- Update document
    UPDATE documents
    SET embedding = generated_embedding
    WHERE id = doc.id;
  END LOOP;
END;
$$;
```

### Pattern 3: Multi-Modal Search

```sql
-- Store multiple embeddings per document
ALTER TABLE documents
ADD COLUMN text_embedding vector(1536),
ADD COLUMN image_embedding vector(1536);

-- Search across both
CREATE OR REPLACE FUNCTION multi_modal_search(
  text_embedding vector(1536),
  image_embedding vector(1536),
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    GREATEST(
      1 - (documents.text_embedding <=> text_embedding),
      1 - (documents.image_embedding <=> image_embedding)
    ) as similarity
  FROM documents
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [Database Guide](./database/SCHEMA_REFERENCE.md) - Database schema
- [pgvector Docs](https://github.com/pgvector/pgvector) - pgvector documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

