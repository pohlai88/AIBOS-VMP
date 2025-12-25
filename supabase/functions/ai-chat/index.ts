/**
 * AI Chat Edge Function
 * 
 * Dedicated function for AI-powered chat using Ollama.
 * Supports conversation history, context-aware responses, and streaming.
 * 
 * Actions:
 * - chat: Send a chat message and get AI response
 * - stream-chat: Stream chat responses in real-time
 * - classify-intent: Classify user intent from message
 * 
 * Example usage:
 * POST /functions/v1/ai-chat
 * {
 *   "action": "chat",
 *   "message": "What is the status of my invoice?",
 *   "context": { "caseId": "123", "vendorId": "456" },
 *   "history": []
 * }
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { EdgeRouter } from '../_shared/router.ts'
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest,
  verifyAuth,
  getSecret,
} from '../_shared/utils.ts'

// Initialize router
const router = new EdgeRouter()

// Authentication middleware
router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse(auth.error || 'Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})

// Chat action
router.route('chat', async (ctx, data) => {
  // Validate request
  if (!data.message || typeof data.message !== 'string') {
    return createErrorResponse('Message is required', 400)
  }

  // Get Ollama URL
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'llama3'

  try {
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(data.context || {})
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(data.history || []),
      { role: 'user', content: data.message },
    ]

    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(data.options && { options: data.options }),
      }),
    })

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json().catch(() => ({}))
      return createErrorResponse(
        `Ollama API error: ${chatResponse.statusText}`,
        chatResponse.status,
        { details: errorData }
      )
    }

    const chatData = await chatResponse.json()

    return createSuccessResponse(
      {
        response: chatData.message?.content || '',
        model: chatData.model,
        done: chatData.done,
        ...(chatData.total_duration && { total_duration: chatData.total_duration }),
      },
      'Chat response generated successfully'
    )
  } catch (error) {
    console.error('AI Chat error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Stream chat action (for real-time streaming)
router.route('stream-chat', async (ctx, data) => {
  // Validate request
  if (!data.message || typeof data.message !== 'string') {
    return createErrorResponse('Message is required', 400)
  }

  // Get Ollama URL
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'llama3'

  try {
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(data.context || {})
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(data.history || []),
      { role: 'user', content: data.message },
    ]

    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(data.options && { options: data.options }),
      }),
    })

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json().catch(() => ({}))
      return createErrorResponse(
        `Ollama API error: ${chatResponse.statusText}`,
        chatResponse.status,
        { details: errorData }
      )
    }

    // Return streaming response
    return new Response(chatResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI Chat stream error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Classify intent action
router.route('classify-intent', async (ctx, data) => {
  // Validate request
  if (!data.message || typeof data.message !== 'string') {
    return createErrorResponse('Message is required', 400)
  }

  // Get Ollama URL
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'llama3'

  try {
    const systemPrompt = `You are an intent classification assistant for a Vendor Management Platform. 
Classify the user's message intent and return a JSON object with:
- intent: one of ["payment_inquiry", "invoice_inquiry", "status_inquiry", "evidence_submission", "urgent_request", "dispute", "general_inquiry"]
- confidence: number between 0 and 1
- entities: array of extracted entities (invoice numbers, PO numbers, amounts, dates, case references)

Return only valid JSON, no additional text.`

    const classifyResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this message: "${data.message}"` },
        ],
        format: 'json',
        stream: false,
      }),
    })

    if (!classifyResponse.ok) {
      const errorData = await classifyResponse.json().catch(() => ({}))
      return createErrorResponse(
        `Ollama API error: ${classifyResponse.statusText}`,
        classifyResponse.status,
        { details: errorData }
      )
    }

    const classifyData = await classifyResponse.json()
    
    // Parse JSON response
    let classification = {}
    try {
      classification = JSON.parse(classifyData.message?.content || '{}')
    } catch {
      classification = { 
        intent: 'general_inquiry', 
        confidence: 0.5,
        entities: []
      }
    }

    return createSuccessResponse(
      {
        classification,
        model: classifyData.model,
      },
      'Intent classified successfully'
    )
  } catch (error) {
    console.error('AI Chat classify error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context: Record<string, any>): string {
  let prompt = `You are a helpful AI assistant for a Vendor Management Platform (VMP). 
You help vendors and internal users with:
- Invoice inquiries and status
- Payment questions
- Case management
- Document requirements
- General support

Be professional, concise, and helpful.`

  // Add context-specific information
  if (context.caseId) {
    prompt += `\n\nCurrent context: User is asking about case ${context.caseId}.`
  }
  if (context.vendorId) {
    prompt += `\n\nUser is a vendor (ID: ${context.vendorId}).`
  }
  if (context.invoiceId) {
    prompt += `\n\nUser is asking about invoice ${context.invoiceId}.`
  }
  if (context.paymentId) {
    prompt += `\n\nUser is asking about payment ${context.paymentId}.`
  }

  return prompt
}

// Main handler
Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405)
  }

  // Route request
  return router.handle(req)
})

