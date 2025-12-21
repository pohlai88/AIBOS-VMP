/**
 * Example Edge Function with Secrets Management
 * 
 * This function demonstrates:
 * - Accessing default Supabase secrets
 * - Using custom secrets (OpenAI, Stripe, etc.)
 * - Validating secrets before use
 * - Proper error handling
 * 
 * Deploy: supabase functions deploy example-with-secrets
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface FunctionResponse {
    success: boolean
    message?: string
    error?: string
    data?: any
}

/**
 * Validates that required secrets are configured
 */
function validateSecrets(): { valid: boolean; missing: string[] } {
    const requiredSecrets = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
    ]

    const missing = requiredSecrets.filter(
        key => !Deno.env.get(key)
    )

    return {
        valid: missing.length === 0,
        missing,
    }
}

/**
 * Gets a secret with optional validation
 */
function getSecret(key: string, required = false): string | undefined {
    const value = Deno.env.get(key)

    if (required && !value) {
        throw new Error(`Required secret ${key} is not configured`)
    }

    return value
}

Deno.serve(async (req: Request): Promise<Response> => {
    try {
        // Validate required secrets
        const secretValidation = validateSecrets()
        if (!secretValidation.valid) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Missing required secrets: ${secretValidation.missing.join(', ')}`,
                } as FunctionResponse),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Access default Supabase secrets
        const supabaseUrl = getSecret('SUPABASE_URL', true)!
        const supabaseKey = getSecret('SUPABASE_SERVICE_ROLE_KEY', true)!

        // Access custom secrets (optional)
        const openaiKey = getSecret('OPENAI_API_KEY', false)
        const stripeKey = getSecret('STRIPE_SECRET_KEY', false)
        const externalApiKey = getSecret('EXTERNAL_API_KEY', false)

        // Create Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get request data
        const body = await req.json().catch(() => ({}))
        const { action, data: requestData } = body

        // Example: Use OpenAI if available
        if (action === 'generate-embedding' && openaiKey) {
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'text-embedding-ada-002',
                    input: requestData?.text || 'Hello, world!',
                }),
            })

            if (!embeddingResponse.ok) {
                throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`)
            }

            const embeddingData = await embeddingResponse.json()

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Embedding generated successfully',
                    data: {
                        embedding: embeddingData.data[0].embedding,
                        model: embeddingData.model,
                    },
                } as FunctionResponse),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Example: Use Stripe if available
        if (action === 'create-payment' && stripeKey) {
            const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${stripeKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    amount: requestData?.amount || '1000',
                    currency: requestData?.currency || 'usd',
                }),
            })

            if (!stripeResponse.ok) {
                throw new Error(`Stripe API error: ${stripeResponse.statusText}`)
            }

            const stripeData = await stripeResponse.json()

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Payment intent created',
                    data: {
                        client_secret: stripeData.client_secret,
                        id: stripeData.id,
                    },
                } as FunctionResponse),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Example: Use external API if available
        if (action === 'external-api' && externalApiKey) {
            const externalResponse = await fetch('https://api.example.com/data', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${externalApiKey}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!externalResponse.ok) {
                throw new Error(`External API error: ${externalResponse.statusText}`)
            }

            const externalData = await externalResponse.json()

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'External API call successful',
                    data: externalData,
                } as FunctionResponse),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Default: Return available secrets status (without exposing values)
        const availableSecrets = {
            supabase: {
                url: !!supabaseUrl,
                serviceRoleKey: !!supabaseKey,
            },
            custom: {
                openai: !!openaiKey,
                stripe: !!stripeKey,
                externalApi: !!externalApiKey,
            },
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Function is running. Available secrets status:',
                data: availableSecrets,
                note: 'This endpoint shows which secrets are configured (not their values)',
            } as FunctionResponse),
            {
                headers: { 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Function error:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            } as FunctionResponse),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
})

