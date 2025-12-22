# Ollama AI Integration Plan for VMP

**Date:** 2025-01-XX  
**Status:** 📋 Planning Document (Implementation Pending)  
**Purpose:** Comprehensive plan for integrating Ollama AI into VMP's AI features  
**Reference:** `__INTEGRATION_WIREFRAME_PLAN_V2.md` (Sprint 13: AI Features)

---

## 📋 Executive Summary

This document provides a comprehensive plan for enhancing VMP's AI capabilities by integrating Ollama (self-hosted LLM) into existing AI utilities. Currently, AI features use rule-based fallbacks. This plan outlines how to replace/enhance them with Ollama-powered AI for better accuracy, context understanding, and natural language processing.

**Current State:**
- ✅ Ollama infrastructure ready (Supabase Edge Functions deployed)
- ✅ AI utilities exist but use rule-based fallbacks
- ⏳ Ollama integration into utilities (pending)

**Target State:**
- ✅ AI Message Parser uses Ollama for intent classification
- ✅ AI Data Validation uses Ollama for smart validation
- ✅ AI Search uses Ollama for natural language understanding
- ✅ Context-aware AI responses throughout the platform

---

## 🏗️ Architecture Overview

### Current Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP/HTTPS
       │
┌──────▼──────────────────┐
│   Express Server        │
│   (server.js)           │
│                         │
│  ┌──────────────────┐   │
│  │ AI Utilities     │   │
│  │ (Rule-based)     │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

### Target Architecture (With Ollama)

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP/HTTPS
       │
┌──────▼──────────────────┐
│   Express Server        │
│   (server.js)           │
│                         │
│  ┌──────────────────┐   │
│  │ AI Utilities     │   │
│  │ (Enhanced)       │   │
│  └──────┬───────────┘   │
│         │                │
│         │ HTTP/HTTPS     │
│         │                │
┌─────────▼──────────────────┐
│  Supabase Edge Functions    │
│  (integrations/ai-chat)     │
└─────────┬──────────────────┘
          │
          │ OLLAMA_URL
          │
┌─────────▼─────────┐
│  Ollama Server     │
│  (Local/Hosted)    │
└────────────────────┘
```

---

## 🎯 Integration Points

### 1. AI Message Parser Enhancement

**File:** `src/utils/ai-message-parser.js`

**Current Implementation:**
- Rule-based intent classification
- Pattern matching for entity extraction
- Basic case matching logic

**Ollama Enhancement Plan:**

#### A. Intent Classification with Ollama

**Function:** `classifyMessageIntent()`

**Current:**
```javascript
export async function classifyMessageIntent(messageText, channel = 'email') {
  // Rule-based classification
  const intent = await classifyIntentRuleBased(messageText, channel);
  return {
    intent: intent.primary,
    confidence: intent.confidence,
    secondaryIntents: intent.secondary || [],
    entities: intent.entities || []
  };
}
```

**Enhanced with Ollama:**
```javascript
import { classifyWithOllama } from './ollama-client.js';
import { env } from '../config.js'; // Or get from server.js

export async function classifyMessageIntent(messageText, channel = 'email') {
  try {
    // Try Ollama first
    const systemPrompt = `You are an intent classification assistant for a Vendor Management Platform.
Classify the user's message intent and return a JSON object with:
- intent: one of ["payment_inquiry", "invoice_inquiry", "status_inquiry", "evidence_submission", "urgent_request", "dispute", "general_inquiry"]
- confidence: number between 0 and 1
- secondaryIntents: array of other possible intents
- entities: array of extracted entities (invoice numbers, PO numbers, amounts, dates, case references)

Return only valid JSON, no additional text.`;

    const classification = await classifyWithOllama(
      messageText,
      systemPrompt,
      `Classify this ${channel} message: "${messageText}"`,
      'llama3',
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (classification && classification.classification) {
      return {
        intent: classification.classification.intent || 'general_inquiry',
        confidence: classification.classification.confidence || 0.7,
        secondaryIntents: classification.classification.secondaryIntents || [],
        entities: classification.classification.entities || []
      };
    }
  } catch (error) {
    console.error('[AI Parser] Ollama classification failed, using fallback:', error);
  }

  // Fallback to rule-based
  const intent = await classifyIntentRuleBased(messageText, channel);
  return {
    intent: intent.primary,
    confidence: intent.confidence,
    secondaryIntents: intent.secondary || [],
    entities: intent.entities || []
  };
}
```

#### B. Structured Data Extraction with Ollama

**Function:** `extractStructuredData()`

**Enhanced Approach:**
```javascript
import { chatWithOllama } from './ollama-client.js';

export async function extractStructuredData(messageText, subject = '') {
  try {
    const fullText = subject ? `${subject}\n\n${messageText}` : messageText;
    
    const systemPrompt = `You are a data extraction assistant for a Vendor Management Platform.
Extract structured data from the message and return a JSON object with:
- invoiceNumbers: array of invoice numbers (e.g., ["INV-12345", "INV-67890"])
- poNumbers: array of PO numbers (e.g., ["PO-123", "PO-456"])
- grnNumbers: array of GRN numbers (e.g., ["GRN-789"])
- paymentReferences: array of payment references
- amounts: array of monetary amounts with currency
- dates: array of dates mentioned
- caseReferences: array of case IDs or case numbers
- urgency: one of ["low", "normal", "high", "urgent"]
- confidence: number between 0 and 1

Return only valid JSON, no additional text.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract structured data from: "${fullText}"` }
    ];

    const response = await chatWithOllama(
      messages,
      'llama3',
      { format: 'json' },
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.message && response.message.content) {
      try {
        const extracted = JSON.parse(response.message.content);
        return {
          invoiceNumbers: extracted.invoiceNumbers || [],
          poNumbers: extracted.poNumbers || [],
          grnNumbers: extracted.grnNumbers || [],
          paymentReferences: extracted.paymentReferences || [],
          amounts: extracted.amounts || [],
          dates: extracted.dates || [],
          caseReferences: extracted.caseReferences || [],
          urgency: extracted.urgency || 'normal',
          confidence: extracted.confidence || 0.7
        };
      } catch (parseError) {
        console.error('[AI Parser] Failed to parse Ollama JSON response:', parseError);
      }
    }
  } catch (error) {
    console.error('[AI Parser] Ollama extraction failed, using fallback:', error);
  }

  // Fallback to rule-based extraction
  return await extractDataRuleBased(fullText);
}
```

#### C. Enhanced Case Matching with Ollama

**Function:** `findBestMatchingCase()`

**Enhanced Approach:**
```javascript
import { chatWithOllama } from './ollama-client.js';

export async function findBestMatchingCase(messageData, candidateCases, extractedData) {
  try {
    if (!candidateCases || candidateCases.length === 0) {
      return null;
    }

    // Build context for Ollama
    const casesContext = candidateCases.map((c, idx) => ({
      index: idx,
      id: c.id,
      caseNum: c.case_num,
      subject: c.subject,
      status: c.status,
      caseType: c.case_type,
      createdAt: c.created_at
    })).slice(0, 10); // Limit to 10 candidates for context

    const systemPrompt = `You are a case matching assistant for a Vendor Management Platform.
Given a message and a list of candidate cases, determine which case best matches the message.
Return a JSON object with:
- bestMatchIndex: index of the best matching case (0-based)
- confidence: number between 0 and 1
- reasoning: brief explanation of why this case matches

If no case is a good match (confidence < 0.5), return bestMatchIndex: -1.

Return only valid JSON, no additional text.`;

    const userPrompt = `Message: "${messageData.text || messageData.subject}"
Extracted Data: ${JSON.stringify(extractedData)}
Candidate Cases: ${JSON.stringify(casesContext)}

Which case best matches this message?`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await chatWithOllama(
      messages,
      'llama3',
      { format: 'json' },
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.message && response.message.content) {
      try {
        const matchResult = JSON.parse(response.message.content);
        if (matchResult.bestMatchIndex >= 0 && matchResult.confidence >= 0.5) {
          const matchedCase = candidateCases[matchResult.bestMatchIndex];
          return {
            case: matchedCase,
            confidence: matchResult.confidence,
            reasoning: matchResult.reasoning
          };
        }
      } catch (parseError) {
        console.error('[AI Parser] Failed to parse Ollama match response:', parseError);
      }
    }
  } catch (error) {
    console.error('[AI Parser] Ollama matching failed, using fallback:', error);
  }

  // Fallback to rule-based matching
  return await findBestMatchingCaseRuleBased(messageData, candidateCases, extractedData);
}
```

---

### 2. AI Data Validation Enhancement

**File:** `src/utils/ai-data-validation.js`

**Current Implementation:**
- Rule-based completeness checking
- Pattern matching for missing documents
- Basic escalation logic

**Ollama Enhancement Plan:**

#### A. Smart Validation with Ollama

**Function:** `validateCaseData()`

**Enhanced Approach:**
```javascript
import { callAIChat } from './ollama-client.js';

export async function validateCaseData(caseData, checklistSteps, evidence) {
  try {
    // Build context for Ollama
    const validationContext = {
      caseType: caseData.case_type,
      status: caseData.status,
      createdAt: caseData.created_at,
      slaDueAt: caseData.sla_due_at,
      checklistSteps: checklistSteps.map(step => ({
        label: step.label,
        requiredType: step.required_evidence_type,
        status: step.status
      })),
      evidence: evidence.map(ev => ({
        type: ev.evidence_type,
        status: ev.status,
        uploadedAt: ev.uploaded_at
      }))
    };

    const systemPrompt = `You are a case validation assistant for a Vendor Management Platform.
Analyze the case data and provide validation feedback.
Return a JSON object with:
- completeness: percentage (0-100)
- issues: array of data issues [{type: "critical|high|medium|low", message: "..."}]
- missingDocuments: array of missing required documents
- escalationTriggered: boolean
- escalationReason: string (if escalation triggered)
- confidence: number between 0 and 1

Return only valid JSON, no additional text.`;

    const userPrompt = `Validate this case:
${JSON.stringify(validationContext, null, 2)}`;

    const response = await callAIChat(
      userPrompt,
      { caseId: caseData.id, caseType: caseData.case_type },
      [],
      'llama3',
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.response) {
      try {
        // Try to parse JSON from response
        const validation = JSON.parse(response.response);
        return {
          completeness: validation.completeness || 0,
          issues: validation.issues || [],
          missingDocuments: validation.missingDocuments || [],
          escalationTriggered: validation.escalationTriggered || false,
          escalationReason: validation.escalationReason || null,
          confidence: validation.confidence || 0.7
        };
      } catch (parseError) {
        // If not JSON, use rule-based fallback
        console.warn('[AI Validation] Ollama response not JSON, using fallback');
      }
    }
  } catch (error) {
    console.error('[AI Validation] Ollama validation failed, using fallback:', error);
  }

  // Fallback to rule-based validation
  return await validateCaseDataRuleBased(caseData, checklistSteps, evidence);
}
```

#### B. Enhanced Actionable Requests Generation

**Function:** `generateActionableRequests()`

**Enhanced Approach:**
```javascript
import { chatWithOllama } from './ollama-client.js';

export async function generateActionableRequests(validationResult) {
  try {
    const systemPrompt = `You are an action planning assistant for a Vendor Management Platform.
Given validation results, generate prioritized actionable requests.
Return a JSON array of requests, each with:
- priority: "high" | "medium" | "low"
- action: string (action description)
- details: string (detailed explanation)
- requiredEvidenceType: string (if applicable)
- templateGuidance: string (if applicable)

Sort by priority (high first). Return only valid JSON array, no additional text.`;

    const userPrompt = `Generate actionable requests for:
${JSON.stringify(validationResult, null, 2)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await chatWithOllama(
      messages,
      'llama3',
      { format: 'json' },
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.message && response.message.content) {
      try {
        const requests = JSON.parse(response.message.content);
        if (Array.isArray(requests)) {
          return requests;
        }
      } catch (parseError) {
        console.error('[AI Validation] Failed to parse Ollama requests:', parseError);
      }
    }
  } catch (error) {
    console.error('[AI Validation] Ollama request generation failed, using fallback:', error);
  }

  // Fallback to rule-based generation
  return await generateActionableRequestsRuleBased(validationResult);
}
```

---

### 3. AI Search Enhancement

**File:** `src/utils/ai-search.js`

**Current Implementation:**
- Rule-based intent parsing
- Pattern matching for filters
- Basic keyword matching

**Ollama Enhancement Plan:**

#### A. Natural Language Query Understanding

**Function:** `parseSearchIntent()`

**Enhanced Approach:**
```javascript
import { chatWithOllama } from './ollama-client.js';

export async function parseSearchIntent(query) {
  try {
    const systemPrompt = `You are a search intent parser for a Vendor Management Platform.
Parse the user's search query and return a JSON object with:
- type: "case" | "invoice" | "payment" | "action" | "general"
- entities: array of extracted entities (IDs, numbers, etc.)
- filters: object with {status, dateRange, amount, etc.}
- keywords: array of search keywords
- confidence: number between 0 and 1

Return only valid JSON, no additional text.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Parse this search query: "${query}"` }
    ];

    const response = await chatWithOllama(
      messages,
      'llama3',
      { format: 'json' },
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.message && response.message.content) {
      try {
        const intent = JSON.parse(response.message.content);
        return {
          type: intent.type || 'general',
          entities: intent.entities || [],
          filters: intent.filters || {},
          keywords: intent.keywords || [],
          confidence: intent.confidence || 0.7
        };
      } catch (parseError) {
        console.error('[AI Search] Failed to parse Ollama intent:', parseError);
      }
    }
  } catch (error) {
    console.error('[AI Search] Ollama intent parsing failed, using fallback:', error);
  }

  // Fallback to rule-based parsing
  return await parseSearchIntentRuleBased(query);
}
```

#### B. Enhanced Search Suggestions

**Function:** `generateSearchSuggestions()`

**Enhanced Approach:**
```javascript
import { chatWithOllama } from './ollama-client.js';

export async function generateSearchSuggestions(query, recentSearches = [], userContext = {}) {
  try {
    const systemPrompt = `You are a search suggestion assistant for a Vendor Management Platform.
Generate helpful search suggestions based on the user's query and context.
Return a JSON array of suggestions, each with:
- text: string (suggestion text)
- category: "suggestion" | "completion" | "recent" | "context"

Return only valid JSON array, no additional text.`;

    const userPrompt = `Query: "${query}"
Recent Searches: ${JSON.stringify(recentSearches)}
User Context: ${JSON.stringify(userContext)}

Generate 5 helpful search suggestions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await chatWithOllama(
      messages,
      'llama3',
      { format: 'json' },
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY
    );

    if (response && response.message && response.message.content) {
      try {
        const suggestions = JSON.parse(response.message.content);
        if (Array.isArray(suggestions)) {
          return suggestions.slice(0, 5);
        }
      } catch (parseError) {
        console.error('[AI Search] Failed to parse Ollama suggestions:', parseError);
      }
    }
  } catch (error) {
    console.error('[AI Search] Ollama suggestion generation failed, using fallback:', error);
  }

  // Fallback to rule-based suggestions
  return await generateSearchSuggestionsRuleBased(query, recentSearches, userContext);
}
```

---

## 🔧 Configuration & Setup

### 1. Environment Variables

**File:** `.env` or environment configuration

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ollama Configuration (Optional - defaults to localhost)
OLLAMA_URL=http://localhost:11434
# Or for production:
# OLLAMA_URL=https://ollama.yourdomain.com

# Feature Flags (Optional)
ENABLE_OLLAMA_AI=true
OLLAMA_FALLBACK_TO_RULES=true
```

### 2. Feature Flag Implementation

**File:** `src/utils/ai-config.js` (new file)

```javascript
/**
 * AI Configuration Utility
 * Manages feature flags and Ollama settings
 */

export const aiConfig = {
  // Feature flags
  enableOllama: process.env.ENABLE_OLLAMA_AI !== 'false',
  fallbackToRules: process.env.OLLAMA_FALLBACK_TO_RULES !== 'false',
  
  // Ollama settings
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_MODEL || 'llama3',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  
  // Timeout settings
  requestTimeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10),
  
  // Retry settings
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '2', 10),
  retryDelay: parseInt(process.env.OLLAMA_RETRY_DELAY || '1000', 10),
};

/**
 * Check if Ollama is enabled and available
 */
export async function isOllamaAvailable() {
  if (!aiConfig.enableOllama) {
    return false;
  }

  try {
    const response = await fetch(`${aiConfig.ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.warn('[AI Config] Ollama not available:', error.message);
    return false;
  }
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  };
}
```

### 3. Enhanced Ollama Client with Retry Logic

**File:** `src/utils/ollama-client.js` (enhancement)

```javascript
import { aiConfig, isOllamaAvailable } from './ai-config.js';

/**
 * Enhanced Ollama call with retry logic and fallback
 */
export async function callOllamaWithFallback(
  action,
  data,
  fallbackFn,
  supabaseUrl,
  anonKey
) {
  // Check if Ollama is enabled
  if (!aiConfig.enableOllama) {
    return await fallbackFn();
  }

  // Check if Ollama is available
  const available = await isOllamaAvailable();
  if (!available && aiConfig.fallbackToRules) {
    console.warn('[Ollama] Ollama not available, using fallback');
    return await fallbackFn();
  }

  // Try Ollama with retry logic
  let lastError = null;
  for (let attempt = 0; attempt <= aiConfig.maxRetries; attempt++) {
    try {
      const response = await callOllamaViaEdgeFunction(
        action,
        data,
        supabaseUrl,
        anonKey
      );
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < aiConfig.maxRetries) {
        await new Promise(resolve => 
          setTimeout(resolve, aiConfig.retryDelay * (attempt + 1))
        );
        continue;
      }
    }
  }

  // All retries failed, use fallback
  if (aiConfig.fallbackToRules) {
    console.warn('[Ollama] All retries failed, using fallback:', lastError);
    return await fallbackFn();
  }

  throw lastError || new Error('Ollama call failed');
}
```

---

## 📝 Implementation Checklist

### Phase 1: Infrastructure Setup ✅ (Complete)
- [x] Deploy Ollama Edge Functions
- [x] Create Ollama client utility
- [x] Set up configuration structure
- [x] Document architecture

### Phase 2: AI Message Parser Enhancement
- [ ] Update `classifyMessageIntent()` to use Ollama
- [ ] Update `extractStructuredData()` to use Ollama
- [ ] Update `findBestMatchingCase()` to use Ollama
- [ ] Add feature flag support
- [ ] Add retry logic and error handling
- [ ] Test with real messages
- [ ] Compare accuracy vs rule-based

### Phase 3: AI Data Validation Enhancement
- [ ] Update `validateCaseData()` to use Ollama
- [ ] Update `generateActionableRequests()` to use Ollama
- [ ] Update `generateValidationResponse()` to use Ollama
- [ ] Add context-aware validation
- [ ] Test with various case types
- [ ] Measure improvement in validation accuracy

### Phase 4: AI Search Enhancement
- [ ] Update `parseSearchIntent()` to use Ollama
- [ ] Update `generateSearchSuggestions()` to use Ollama
- [ ] Enhance `scoreSearchResult()` with AI insights
- [ ] Test with natural language queries
- [ ] Measure search relevance improvement

### Phase 5: Testing & Optimization
- [ ] Performance testing (response times)
- [ ] Accuracy testing (compare with rule-based)
- [ ] Cost analysis (if using hosted Ollama)
- [ ] Error handling and fallback testing
- [ ] User acceptance testing

### Phase 6: Monitoring & Analytics
- [ ] Add Ollama usage metrics
- [ ] Track accuracy improvements
- [ ] Monitor response times
- [ ] Log errors and fallbacks
- [ ] Create analytics dashboard

---

## 🎯 Use Cases & Examples

### Use Case 1: Intent Classification

**Scenario:** Vendor sends email: "Hi, I haven't received payment for invoice INV-12345. Can you check the status?"

**Rule-Based Result:**
```json
{
  "intent": "payment_inquiry",
  "confidence": 0.7,
  "entities": ["INV-12345"]
}
```

**Ollama-Enhanced Result:**
```json
{
  "intent": "payment_inquiry",
  "confidence": 0.95,
  "secondaryIntents": ["status_inquiry"],
  "entities": [
    {
      "type": "invoice_number",
      "value": "INV-12345",
      "confidence": 0.98
    },
    {
      "type": "urgency",
      "value": "normal",
      "confidence": 0.8
    }
  ]
}
```

### Use Case 2: Data Validation

**Scenario:** Case with missing invoice PDF but has PO confirmation

**Rule-Based Result:**
```json
{
  "completeness": 50,
  "missingDocuments": ["invoice_pdf"],
  "escalationTriggered": false
}
```

**Ollama-Enhanced Result:**
```json
{
  "completeness": 65,
  "missingDocuments": ["invoice_pdf"],
  "issues": [
    {
      "type": "medium",
      "message": "Invoice PDF missing, but PO confirmation present. May proceed with PO-based validation."
    }
  ],
  "escalationTriggered": false,
  "confidence": 0.85,
  "reasoning": "PO confirmation provides sufficient validation for invoice amount. Invoice PDF can be requested but is not blocking."
}
```

### Use Case 3: Natural Language Search

**Scenario:** User searches: "show me all unpaid invoices from last month over $1000"

**Rule-Based Result:**
```json
{
  "type": "invoice",
  "filters": {
    "status": "pending"
  },
  "keywords": ["unpaid", "invoices", "month", "1000"]
}
```

**Ollama-Enhanced Result:**
```json
{
  "type": "invoice",
  "filters": {
    "status": "pending",
    "dateRange": "month",
    "amount": 1000,
    "amountOperator": "greater_than"
  },
  "keywords": ["unpaid", "invoices"],
  "confidence": 0.92,
  "parsedQuery": {
    "entities": ["invoice"],
    "timeframe": "last_month",
    "amount": 1000,
    "status": "unpaid"
  }
}
```

---

## 🔒 Security & Privacy Considerations

### 1. Data Privacy
- **Message Content:** Only send to Ollama what's necessary for processing
- **PII Handling:** Consider masking sensitive data before sending to Ollama
- **Data Retention:** Ensure Ollama doesn't store conversation history (if self-hosted)

### 2. Authentication
- ✅ All Edge Functions require JWT authentication
- ✅ User context passed for authorization checks
- ✅ No direct Ollama access from client

### 3. Error Handling
- ✅ Never expose Ollama errors to end users
- ✅ Graceful fallback to rule-based methods
- ✅ Log errors for debugging without exposing sensitive data

### 4. Rate Limiting
- Consider implementing rate limits per user
- Prevent abuse of Ollama resources
- Monitor usage patterns

---

## 📊 Performance Considerations

### 1. Response Time Targets
- **Intent Classification:** < 2 seconds
- **Data Extraction:** < 3 seconds
- **Case Matching:** < 5 seconds
- **Search Parsing:** < 1 second

### 2. Caching Strategy
- Cache common intent classifications
- Cache frequently used entity extractions
- Cache search suggestions

### 3. Optimization Techniques
- Use smaller models for simple tasks (e.g., `llama3:8b`)
- Batch requests when possible
- Implement request queuing for high load

### 4. Fallback Strategy
- Always have rule-based fallback ready
- Use feature flags to disable Ollama if needed
- Monitor Ollama availability and health

---

## 🧪 Testing Strategy

### 1. Unit Tests
- Test Ollama client functions
- Test fallback logic
- Test error handling

### 2. Integration Tests
- Test end-to-end AI flows
- Test Edge Function integration
- Test with mock Ollama responses

### 3. Accuracy Tests
- Compare Ollama vs rule-based results
- Measure confidence scores
- Track improvement metrics

### 4. Performance Tests
- Measure response times
- Test under load
- Monitor resource usage

---

## 📈 Success Metrics

### Accuracy Metrics
- **Intent Classification Accuracy:** Target > 90% (vs 70% rule-based)
- **Entity Extraction Accuracy:** Target > 85% (vs 60% rule-based)
- **Case Matching Accuracy:** Target > 80% (vs 65% rule-based)

### Performance Metrics
- **Average Response Time:** Target < 3 seconds
- **Fallback Rate:** Target < 10% (90% success rate)
- **Error Rate:** Target < 1%

### User Experience Metrics
- **User Satisfaction:** Measure via feedback
- **Task Completion Rate:** Compare before/after
- **Time to Resolution:** Measure improvement

---

## 🚀 Deployment Plan

### Step 1: Preparation
1. Set up Ollama server (local or hosted)
2. Configure `OLLAMA_URL` secret in Supabase
3. Deploy Edge Functions (already done ✅)
4. Set feature flags to `false` initially

### Step 2: Gradual Rollout
1. Enable for internal testing (`ENABLE_OLLAMA_AI=true` for test users)
2. Monitor performance and accuracy
3. Enable for 10% of users
4. Gradually increase to 100%

### Step 3: Monitoring
1. Set up monitoring dashboards
2. Track accuracy metrics
3. Monitor response times
4. Alert on high error rates

### Step 4: Optimization
1. Fine-tune prompts based on results
2. Optimize model selection
3. Implement caching where beneficial
4. Adjust retry logic and timeouts

---

## 🔄 Rollback Plan

### If Issues Arise:
1. **Immediate:** Set `ENABLE_OLLAMA_AI=false` in environment
2. **All functions will automatically fallback to rule-based methods**
3. **No code changes needed** - feature flag controls behavior
4. **Investigate issues** while rule-based continues to work

### Rollback Checklist:
- [ ] Set feature flag to `false`
- [ ] Verify fallback is working
- [ ] Monitor error rates
- [ ] Investigate root cause
- [ ] Fix issues
- [ ] Re-enable gradually

---

## 📚 Reference Implementation

### Example: Complete Enhanced Function

```javascript
// src/utils/ai-message-parser-enhanced.js
import { classifyWithOllama, chatWithOllama } from './ollama-client.js';
import { aiConfig, isOllamaAvailable, getSupabaseConfig } from './ai-config.js';
import { classifyIntentRuleBased } from './ai-message-parser.js'; // Original fallback

export async function classifyMessageIntentEnhanced(messageText, channel = 'email') {
  // Check if Ollama should be used
  if (!aiConfig.enableOllama) {
    return await classifyIntentRuleBased(messageText, channel);
  }

  // Check if Ollama is available
  const available = await isOllamaAvailable();
  if (!available && aiConfig.fallbackToRules) {
    return await classifyIntentRuleBased(messageText, channel);
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    
    const systemPrompt = `You are an intent classification assistant for a Vendor Management Platform.
Classify the user's message intent and return a JSON object with:
- intent: one of ["payment_inquiry", "invoice_inquiry", "status_inquiry", "evidence_submission", "urgent_request", "dispute", "general_inquiry"]
- confidence: number between 0 and 1
- secondaryIntents: array of other possible intents
- entities: array of extracted entities (invoice numbers, PO numbers, amounts, dates, case references)

Return only valid JSON, no additional text.`;

    const classification = await classifyWithOllama(
      messageText,
      systemPrompt,
      `Classify this ${channel} message: "${messageText}"`,
      aiConfig.defaultModel,
      url,
      anonKey
    );

    if (classification && classification.classification) {
      const result = {
        intent: classification.classification.intent || 'general_inquiry',
        confidence: classification.classification.confidence || 0.7,
        secondaryIntents: classification.classification.secondaryIntents || [],
        entities: classification.classification.entities || []
      };

      // Log for analytics
      console.log('[AI Parser] Ollama classification successful:', {
        intent: result.intent,
        confidence: result.confidence,
        channel
      });

      return result;
    }
  } catch (error) {
    console.error('[AI Parser] Ollama classification failed:', error);
    
    // Fallback to rule-based
    if (aiConfig.fallbackToRules) {
      return await classifyIntentRuleBased(messageText, channel);
    }
    
    // If fallback disabled, throw error
    throw error;
  }

  // Final fallback
  return await classifyIntentRuleBased(messageText, channel);
}
```

---

## 🎓 Best Practices

### 1. Prompt Engineering
- **Be Specific:** Clearly define expected output format
- **Use Examples:** Include examples in system prompts
- **Request JSON:** Always request JSON format for structured data
- **Set Context:** Provide relevant context about the domain

### 2. Error Handling
- **Always Have Fallback:** Never rely solely on Ollama
- **Log Errors:** Log for debugging but don't expose to users
- **Retry Logic:** Implement retry with exponential backoff
- **Timeout Protection:** Set reasonable timeouts

### 3. Performance
- **Cache Results:** Cache common queries/responses
- **Batch Requests:** Group related requests when possible
- **Use Smaller Models:** Use smaller models for simple tasks
- **Monitor Performance:** Track response times and optimize

### 4. Security
- **Validate Input:** Always validate input before sending to Ollama
- **Sanitize Output:** Validate and sanitize Ollama responses
- **Rate Limiting:** Implement rate limits to prevent abuse
- **Audit Logging:** Log AI decisions for audit purposes

---

## 📝 Notes & Considerations

### Model Selection
- **llama3** - Good balance of speed and accuracy (recommended default)
- **llama3:8b** - Faster, good for simple tasks
- **mistral** - Alternative, sometimes better for certain tasks
- **nomic-embed-text** - For embeddings only

### Cost Considerations
- **Self-Hosted:** No API costs, but infrastructure costs
- **Hosted Ollama:** May have hosting costs
- **Compute Resources:** Consider GPU requirements for larger models

### Future Enhancements
- **Fine-Tuning:** Fine-tune models on VMP-specific data
- **RAG (Retrieval Augmented Generation):** Use embeddings for context
- **Multi-Model Strategy:** Use different models for different tasks
- **Streaming Responses:** Implement streaming for better UX

---

## 🔗 Related Documents

- `docs/integrations/OLLAMA_SETUP.md` - Setup and deployment guide
- `docs/integrations/OLLAMA_INTEGRATION_SUMMARY.md` - Implementation summary
- `supabase/functions/ai-chat/README.md` - AI Chat function docs
- `supabase/functions/integrations/README.md` - Integrations function docs
- `.dev/dev-note/__INTEGRATION_WIREFRAME_PLAN_V2.md` - Main roadmap

---

## 📅 Implementation Timeline

### Estimated Timeline: 2-3 weeks

**Week 1:**
- Day 1-2: Set up configuration and feature flags
- Day 3-4: Enhance AI Message Parser
- Day 5: Testing and refinement

**Week 2:**
- Day 1-2: Enhance AI Data Validation
- Day 3-4: Enhance AI Search
- Day 5: Integration testing

**Week 3:**
- Day 1-2: Performance optimization
- Day 3: User acceptance testing
- Day 4-5: Documentation and deployment

---

**Document Status:** 📋 Planning Complete - Ready for Implementation  
**Last Updated:** 2025-01-XX  
**Version:** 1.0.0  
**Next Step:** Begin Phase 2 implementation when ready

