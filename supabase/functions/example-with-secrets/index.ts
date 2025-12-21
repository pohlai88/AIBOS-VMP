/**
 * Example Edge Function with Secrets Management
 * 
 * REFACTORED: Now uses shared utilities and EdgeRouter pattern.
 * 
 * This function demonstrates:
 * - Using shared utilities from _shared/
 * - Action-based routing with EdgeRouter
 * - Standardized responses
 * - Proper error handling
 * 
 * NOTE: For production use, see the 'integrations' function which provides
 * the same functionality with better organization.
 * 
 * Deploy: supabase functions deploy example-with-secrets
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { EdgeRouter } from '../_shared/router.ts'
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest,
  validateSecrets,
  getSecret,
  verifyAuth,
} from '../_shared/utils.ts'
import { integrationSchemas } from '../_shared/schemas.ts'

// Initialize router
const router = new EdgeRouter()

// Authentication middleware (optional for demo)
router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse(auth.error || 'Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})

// Validate secrets middleware
router.use(async (ctx, next) => {
  const secretValidation = validateSecrets(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  if (!secretValidation.valid) {
    return createErrorResponse(
      `Missing required secrets: ${secretValidation.missing.join(', ')}`,
      500
    )
  }
  return next()
})

// Generate embedding action (OpenAI) - Example
router.route('generate-embedding', async (ctx, data) => {
  const validation = validateRequest(data, integrationSchemas.generateEmbedding)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, { errors: validation.errors })
  }

  const openaiKey = getSecret('OPENAI_API_KEY', false)
  if (!openaiKey) {
    return createErrorResponse('OPENAI_API_KEY not configured', 503)
  }

  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: data.model || 'text-embedding-ada-002',
        input: data.text,
      }),
    })

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`)
    }

    const embeddingData = await embeddingResponse.json()

    return createSuccessResponse(
      {
        embedding: embeddingData.data[0].embedding,
        model: embeddingData.model,
      },
      'Embedding generated successfully'
    )
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Create payment action (Stripe) - Example
router.route('create-payment', async (ctx, data) => {
  const validation = validateRequest(data, integrationSchemas.createPayment)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, { errors: validation.errors })
  }

  const stripeKey = getSecret('STRIPE_SECRET_KEY', false)
  if (!stripeKey) {
    return createErrorResponse('STRIPE_SECRET_KEY not configured', 503)
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
      }),
    })

    if (!stripeResponse.ok) {
      throw new Error(`Stripe API error: ${stripeResponse.statusText}`)
    }

    const stripeData = await stripeResponse.json()

    return createSuccessResponse(
      {
        client_secret: stripeData.client_secret,
        id: stripeData.id,
      },
      'Payment intent created'
    )
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// External API action - Example
router.route('external-api', async (ctx, data) => {
  const externalApiKey = getSecret('EXTERNAL_API_KEY', false)
  if (!externalApiKey) {
    return createErrorResponse('EXTERNAL_API_KEY not configured', 503)
  }

  try {
    const externalResponse = await fetch('https://api.example.com/data', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${externalApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!externalResponse.ok) {
      throw new Error(`External API error: ${externalResponse.statusText}`)
    }

    const externalData = await externalResponse.json()

    return createSuccessResponse(externalData, 'External API call successful')
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Secrets status action
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
    },
  }

  return createSuccessResponse(
    availableSecrets,
    'Function is running. Available secrets status (values not exposed).'
  )
})

// Main handler
Deno.serve(async (req: Request): Promise<Response> => {
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

  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405)
  }

  return router.handle(req)
})

