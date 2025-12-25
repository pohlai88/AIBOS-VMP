/**
 * Integrations Edge Function
 * 
 * Domain-based function for external API integrations using action-based routing.
 * 
 * Actions:
 * - generate-embedding: Generate embeddings using OpenAI
 * - create-payment: Create payment intent using Stripe
 * - call-external-api: Call external APIs with configured keys
 * - ollama-chat: Chat completion using Ollama
 * - ollama-embedding: Generate embeddings using Ollama
 * - ollama-classify: Classify text using Ollama
 * 
 * Example usage:
 * POST /functions/v1/integrations
 * {
 *   "action": "ollama-chat",
 *   "messages": [{"role": "user", "content": "Hello!"}],
 *   "model": "llama3"
 * }
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { EdgeRouter } from './_shared/router.ts'
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest,
  verifyAuth,
  validateSecrets,
  getSecret,
} from './_shared/utils.ts'
import { integrationSchemas } from './_shared/schemas.ts'

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

// Generate embedding action (OpenAI)
router.route('generate-embedding', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, integrationSchemas.generateEmbedding)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  // Check if OpenAI key is configured
  const openaiKey = getSecret('OPENAI_API_KEY', false)
  if (!openaiKey) {
    return createErrorResponse(
      'OPENAI_API_KEY not configured. Please set this secret in Supabase.',
      503
    )
  }

  try {
    const model = data.model || 'text-embedding-ada-002'
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: data.text,
      }),
    })

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.json().catch(() => ({}))
      return createErrorResponse(
        `OpenAI API error: ${embeddingResponse.statusText}`,
        embeddingResponse.status,
        { details: errorData }
      )
    }

    const embeddingData = await embeddingResponse.json()

    return createSuccessResponse(
      {
        embedding: embeddingData.data[0].embedding,
        model: embeddingData.model,
        usage: embeddingData.usage,
      },
      'Embedding generated successfully'
    )
  } catch (error) {
    console.error('Generate embedding error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Create payment intent action (Stripe)
router.route('create-payment', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, integrationSchemas.createPayment)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  // Check if Stripe key is configured
  const stripeKey = getSecret('STRIPE_SECRET_KEY', false)
  if (!stripeKey) {
    return createErrorResponse(
      'STRIPE_SECRET_KEY not configured. Please set this secret in Supabase.',
      503
    )
  }

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(data.amount),
        currency: data.currency,
        ...(data.description && { description: data.description }),
      }),
    })

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json().catch(() => ({}))
      return createErrorResponse(
        `Stripe API error: ${stripeResponse.statusText}`,
        stripeResponse.status,
        { details: errorData }
      )
    }

    const stripeData = await stripeResponse.json()

    return createSuccessResponse(
      {
        client_secret: stripeData.client_secret,
        id: stripeData.id,
        amount: stripeData.amount,
        currency: stripeData.currency,
        status: stripeData.status,
      },
      'Payment intent created successfully'
    )
  } catch (error) {
    console.error('Create payment error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Call external API action
router.route('call-external-api', async (ctx, data) => {
  // Check if external API key is configured
  const externalApiKey = getSecret('EXTERNAL_API_KEY', false)
  if (!externalApiKey) {
    return createErrorResponse(
      'EXTERNAL_API_KEY not configured. Please set this secret in Supabase.',
      503
    )
  }

  try {
    const endpoint = data.endpoint || 'https://api.example.com/data'
    const method = data.method || 'GET'

    const externalResponse = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${externalApiKey}`,
        'Content-Type': 'application/json',
        ...(data.headers || {}),
      },
      ...(data.body && { body: JSON.stringify(data.body) }),
    })

    if (!externalResponse.ok) {
      const errorData = await externalResponse.json().catch(() => ({}))
      return createErrorResponse(
        `External API error: ${externalResponse.statusText}`,
        externalResponse.status,
        { details: errorData }
      )
    }

    const responseData = await externalResponse.json()

    return createSuccessResponse(
      { data: responseData },
      'External API call successful'
    )
  } catch (error) {
    console.error('External API call error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Ollama Chat action
router.route('ollama-chat', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, integrationSchemas.ollamaChat)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  // Get Ollama URL (can be local or hosted)
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'llama3'

  try {
    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: data.messages,
        stream: data.stream || false,
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
        message: chatData.message,
        model: chatData.model,
        done: chatData.done,
        ...(chatData.total_duration && { total_duration: chatData.total_duration }),
      },
      'Chat completion generated successfully'
    )
  } catch (error) {
    console.error('Ollama chat error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Ollama Embedding action
router.route('ollama-embedding', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, integrationSchemas.ollamaEmbedding)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  // Get Ollama URL
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'nomic-embed-text'

  try {
    const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: data.text,
      }),
    })

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.json().catch(() => ({}))
      return createErrorResponse(
        `Ollama API error: ${embeddingResponse.statusText}`,
        embeddingResponse.status,
        { details: errorData }
      )
    }

    const embeddingData = await embeddingResponse.json()

    return createSuccessResponse(
      {
        embedding: embeddingData.embedding,
        model: embeddingData.model,
      },
      'Embedding generated successfully'
    )
  } catch (error) {
    console.error('Ollama embedding error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Ollama Classify action (for intent classification, sentiment, etc.)
router.route('ollama-classify', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, integrationSchemas.ollamaClassify)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  // Get Ollama URL
  const ollamaUrl = getSecret('OLLAMA_URL', false) || 'http://localhost:11434'
  const model = data.model || 'llama3'

  try {
    // Build classification prompt
    const systemPrompt = data.systemPrompt || `You are a classification assistant. Classify the following text and return a JSON object with the classification result.`
    const classificationPrompt = data.prompt || `Classify the following text: "${data.text}"`
    
    const classifyResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: classificationPrompt },
        ],
        format: 'json', // Request JSON response
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
    
    // Try to parse JSON response
    let classification = {}
    try {
      classification = JSON.parse(classifyData.message?.content || '{}')
    } catch {
      // If not JSON, return raw content
      classification = { result: classifyData.message?.content || '' }
    }

    return createSuccessResponse(
      {
        classification,
        model: classifyData.model,
        confidence: data.confidence || null,
      },
      'Classification completed successfully'
    )
  } catch (error) {
    console.error('Ollama classify error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Get available secrets status (without exposing values)
router.route('secrets-status', async (ctx, data) => {
  const availableSecrets = {
    supabase: {
      url: !!getSecret('SUPABASE_URL', false),
      serviceRoleKey: !!getSecret('SUPABASE_SERVICE_ROLE_KEY', false),
    },
    custom: {
      openai: !!getSecret('OPENAI_API_KEY', false),
      stripe: !!getSecret('STRIPE_SECRET_KEY', false),
      externalApi: !!getSecret('EXTERNAL_API_KEY', false),
      ollama: !!getSecret('OLLAMA_URL', false),
    },
  }

  return createSuccessResponse(
    availableSecrets,
    'Secrets status retrieved. This shows which secrets are configured (not their values).'
  )
})

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

