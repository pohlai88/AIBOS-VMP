# Ollama Integration with Supabase Edge Functions

**Date:** 2025-01-XX  
**Status:** ✅ Ready for Deployment  
**Project:** VMP (Vendor Management Platform)

---

## Overview

This guide explains how to integrate Ollama with Supabase Edge Functions for AI-powered features including chat, embeddings, and classification.

---

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────┐
│   Client    │─────────▶│ Supabase Edge   │─────────▶│ Ollama  │
│  (Browser)  │          │    Functions     │          │ Server  │
└─────────────┘         └──────────────────┘         └─────────┘
                              │
                              │
                         ┌────▼────┐
                         │Supabase │
                         │  MCP    │
                         └─────────┘
```

---

## Setup Options

### Option 1: Local Ollama (Development)

1. **Install Ollama locally:**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Windows
   # Download from https://ollama.com/download
   ```

2. **Pull required models:**
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```

3. **Set Supabase secret:**
   ```bash
   supabase secrets set OLLAMA_URL=http://localhost:11434
   ```

### Option 2: Hosted Ollama (Production)

1. **Deploy Ollama on a server:**
   - Use Docker: `docker run -d -p 11434:11434 ollama/ollama`
   - Or deploy on cloud (AWS, GCP, Azure)

2. **Set Supabase secret:**
   ```bash
   supabase secrets set OLLAMA_URL=https://your-ollama-server.com
   ```

### Option 3: Supabase + Ollama (Recommended for Production)

For production, you can host Ollama as a separate service and connect via Edge Functions.

---

## Edge Functions

### 1. Integrations Function

**Location:** `supabase/functions/integrations/index.ts`

**Available Actions:**
- `ollama-chat` - Chat completion
- `ollama-embedding` - Generate embeddings
- `ollama-classify` - Classify text/intent

**Example Usage:**
```javascript
POST /functions/v1/integrations
{
  "action": "ollama-chat",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "llama3"
}
```

### 2. AI Chat Function

**Location:** `supabase/functions/ai-chat/index.ts`

**Available Actions:**
- `chat` - Context-aware chat
- `stream-chat` - Streaming chat responses
- `classify-intent` - Intent classification

**Example Usage:**
```javascript
POST /functions/v1/ai-chat
{
  "action": "chat",
  "message": "What is the status of my invoice?",
  "context": {
    "caseId": "123",
    "vendorId": "456"
  },
  "history": []
}
```

---

## Configuration

### 1. Set Ollama URL Secret

```bash
# Local development
supabase secrets set OLLAMA_URL=http://localhost:11434

# Production (hosted)
supabase secrets set OLLAMA_URL=https://ollama.yourdomain.com
```

### 2. Verify Secret

```bash
supabase secrets list
```

---

## Usage in Code

### Using Ollama Client Utility

```javascript
import { chatWithOllama, embedWithOllama, classifyWithOllama } from './src/utils/ollama-client.js'

// Chat
const response = await chatWithOllama(
  [{ role: 'user', content: 'Hello!' }],
  'llama3',
  {},
  supabaseUrl,
  anonKey
)

// Embedding
const embedding = await embedWithOllama(
  'Text to embed',
  'nomic-embed-text',
  supabaseUrl,
  anonKey
)

// Classification
const classification = await classifyWithOllama(
  'User message text',
  'System prompt',
  'Classification prompt',
  'llama3',
  supabaseUrl,
  anonKey
)
```

### Using AI Chat Function

```javascript
import { callAIChat } from './src/utils/ollama-client.js'

const response = await callAIChat(
  'What is the status of my invoice?',
  { caseId: '123', vendorId: '456' },
  [],
  'llama3',
  supabaseUrl,
  anonKey
)
```

---

## Deployment

### 1. Deploy Edge Functions

```bash
# Deploy integrations function
supabase functions deploy integrations

# Deploy AI chat function
supabase functions deploy ai-chat
```

### 2. Set Secrets

```bash
supabase secrets set OLLAMA_URL=https://your-ollama-server.com
```

### 3. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs integrations
supabase functions logs ai-chat
```

---

## Testing

### Test Ollama Connection

```bash
# Test locally
curl http://localhost:11434/api/tags

# Test via Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/integrations \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ollama-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "llama3"
  }'
```

---

## Models

### Recommended Models

| Model | Use Case | Size |
|-------|----------|------|
| `llama3` | General chat, classification | ~4.7GB |
| `llama3:8b` | Faster chat | ~4.7GB |
| `nomic-embed-text` | Embeddings | ~274MB |
| `mistral` | Alternative chat model | ~4.1GB |

### Pull Models

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

---

## Security

1. **Authentication:** All Edge Functions require JWT authentication
2. **Secrets:** Ollama URL stored as Supabase secret (not exposed)
3. **CORS:** Configured for your domain only
4. **Rate Limiting:** Implement rate limiting in Edge Functions if needed

---

## Troubleshooting

### Ollama Not Responding

1. Check Ollama is running: `ollama list`
2. Verify URL in secrets: `supabase secrets list`
3. Check Edge Function logs: `supabase functions logs integrations`

### Model Not Found

1. Pull the model: `ollama pull llama3`
2. Verify model exists: `ollama list`

### Connection Errors

1. Check network connectivity
2. Verify firewall rules allow connections
3. Check Ollama server logs

---

## Next Steps

1. Deploy Edge Functions
2. Set OLLAMA_URL secret
3. Test with curl or Postman
4. Integrate into your application using `ollama-client.js`

---

## References

- [Ollama Documentation](https://ollama.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase MCP Guide](../SUPABASE_MCP_GUIDE.md)

