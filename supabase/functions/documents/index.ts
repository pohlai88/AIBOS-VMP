/**
 * Documents Edge Function
 * 
 * Domain-based function for document operations using action-based routing.
 * 
 * Actions:
 * - create: Create a new document
 * - update: Update an existing document
 * - delete: Delete a document
 * - process: Process document and generate embeddings
 * 
 * Example usage:
 * POST /functions/v1/documents
 * {
 *   "action": "create",
 *   "name": "Invoice.pdf",
 *   "category": "invoice",
 *   "tenant_id": "...",
 *   "organization_id": "..."
 * }
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EdgeRouter } from '../_shared/router.ts'
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest,
  verifyAuth,
} from '../_shared/utils.ts'
import { documentSchemas } from '../_shared/schemas.ts'

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

// Create document action
router.route('create', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, documentSchemas.create)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Create document record
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        name: data.name,
        category: data.category || null,
        tenant_id: data.tenant_id,
        organization_id: data.organization_id || null,
        content: data.content || null,
        created_by: ctx.user?.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to create document', 500, {
        details: error.message,
      })
    }

    return createSuccessResponse(
      { document },
      'Document created successfully',
      201
    )
  } catch (error) {
    console.error('Create document error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Update document action
router.route('update', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, documentSchemas.update)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update document
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.category !== undefined) updateData.category = data.category
    if (data.content !== undefined) updateData.content = data.content
    updateData.updated_at = new Date().toISOString()

    const { data: document, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', data.document_id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to update document', 500, {
        details: error.message,
      })
    }

    if (!document) {
      return createErrorResponse('Document not found', 404)
    }

    return createSuccessResponse({ document }, 'Document updated successfully')
  } catch (error) {
    console.error('Update document error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Delete document action
router.route('delete', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, documentSchemas.delete)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Delete document
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', data.document_id)
      .eq('tenant_id', data.tenant_id)

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to delete document', 500, {
        details: error.message,
      })
    }

    return createSuccessResponse(null, 'Document deleted successfully')
  } catch (error) {
    console.error('Delete document error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
})

// Process document action (migrated from process-document)
router.route('process', async (ctx, data) => {
  // Validate request
  const validation = validateRequest(data, documentSchemas.process)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, {
      errors: validation.errors,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Generate embedding for document
    const content = `${data.name || ''} ${data.category || ''}`.trim()

    if (content) {
      // Use Supabase AI for embeddings (if available)
      try {
        const model = new (globalThis as any).Supabase.ai.Session('gte-small')
        const embedding = await model.run(content, {
          mean_pool: true,
          normalize: true,
        })

        // Store embedding
        await supabase
          .from('document_embeddings')
          .upsert(
            {
              document_id: data.document_id,
              content,
              embedding: JSON.stringify(embedding),
              tenant_id: data.tenant_id,
              organization_id: data.organization_id || null,
            },
            {
              onConflict: 'document_id',
            }
          )
          .catch((err) =>
            console.error('Failed to store embedding:', err)
          )
      } catch (embeddingError) {
        console.warn('Embedding generation failed:', embeddingError)
        // Continue without embedding
      }
    }

    return createSuccessResponse(
      { document_id: data.document_id },
      `Document ${data.document_id} processed successfully`
    )
  } catch (error) {
    console.error('Process document error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
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

