# AI Chat Edge Function

**Status:** ✅ Ready for Deployment  
**Purpose:** AI-powered chat using Ollama for context-aware conversations

---

## Overview

This Edge Function provides AI chat capabilities using Ollama, with support for:
- Context-aware conversations
- Conversation history
- Streaming responses
- Intent classification

---

## Actions

### 1. `chat`

Send a chat message and get AI response.

**Request:**
```json
{
  "action": "chat",
  "message": "What is the status of my invoice?",
  "context": {
    "caseId": "123",
    "vendorId": "456"
  },
  "history": [],
  "model": "llama3"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Your invoice is currently pending review...",
    "model": "llama3",
    "done": true,
    "total_duration": 1234
  }
}
```

### 2. `stream-chat`

Stream chat responses in real-time (Server-Sent Events).

**Request:**
```json
{
  "action": "stream-chat",
  "message": "Tell me about my payments",
  "context": {},
  "history": [],
  "model": "llama3"
}
```

**Response:** Server-Sent Events stream

### 3. `classify-intent`

Classify user intent from a message.

**Request:**
```json
{
  "action": "classify-intent",
  "message": "I need to check my payment status",
  "model": "llama3"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "classification": {
      "intent": "payment_inquiry",
      "confidence": 0.95,
      "entities": ["payment", "status"]
    },
    "model": "llama3"
  }
}
```

---

## Configuration

Set the `OLLAMA_URL` secret in Supabase:

```bash
supabase secrets set OLLAMA_URL=http://localhost:11434
# or for production
supabase secrets set OLLAMA_URL=https://ollama.yourdomain.com
```

---

## Deployment

```bash
supabase functions deploy ai-chat
```

---

## Usage Example

```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/ai-chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: 'chat',
    message: 'Hello!',
    context: {},
    history: [],
  }),
})
```

