/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Express API Route (JSON API)
 * Domain: {{Domain}} (finance | vendor | client | compliance | system)
 * Enforces: CRUD-S, RLS, Validation, Auth, Standardized JSON Responses
 * 
 * DO NOT MODIFY WITHOUT UPDATING:
 * - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
 * - docs/architecture/TEMPLATE_CONSTITUTION.md
 * - Version below
 * 
 * Version: 1.1.0 (Express SSR Aligned)
 * Last Updated: 2025-01-22
 * ============================================================================
 * 
 * Express API Route Template (JSON API)
 * 
 * This template is for JSON API endpoints (not SSR pages).
 * For SSR pages, use route.page.template.js instead.
 * 
 * This template enforces:
 * - Standardized JSON response format: { data, error, metadata }
 * - Context-aware tenant/user extraction
 * - Input validation with Zod
 * - Error handling with try/catch
 * - Authentication guards
 * - Adapter-only database access
 * 
 * Usage:
 * 1. Copy this file: cp src/templates/route.api.template.js src/routes/{{entity-name}}-api.js
 * 2. Replace placeholders:
 *    - {{EntityName}} → Invoice
 *    - {{entity-name}} → invoice
 *    - {{table_name}} → invoices
 *    - {{Domain}} → finance
 * 3. Customize validation schema and business logic
 * 4. Mount in server.js: app.use('/api/{{entity-name}}', {{entityName}}ApiRouter);
 * 
 * @module templates/route.api.template
 */

import express from 'express';
import { z } from 'zod';
import { nexusAdapter } from '../adapters/nexus-adapter.js';
import { requireAuth, requireTenant } from '../middleware/nexus-context.js';
import { logError } from '../utils/nexus-logger.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { assertUuid, isValidUuid } from '../utils/uuid-validator.js';

// Note: attachSupabaseClient is applied globally in server.js
// If needed in isolated routes, import from '../middleware/supabase-client.js'

const router = express.Router();

// ============================================================================
// MIDDLEWARE: Tenant isolation (applied to all routes)
// ============================================================================
// Note: attachSupabaseClient is applied globally in server.js
// If this route is mounted separately, uncomment:
// import { attachSupabaseClient } from '../middleware/supabase-client.js';
// router.use(attachSupabaseClient);

router.use(requireAuth);
router.use(requireTenant); // Sets req.tenantId, req.userId (CCP-16: Tenant isolation via middleware)

// ============================================================================
// VALIDATION SCHEMAS (Zod - Strict Input)
// ============================================================================

// UUID validation: Use shared utility (CCP-16: Replace regex with shared validator)
const idSchema = z.string().uuid('Invalid ID format');

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Add entity-specific fields here
  // Example:
  // amount: z.number().positive('Amount must be positive'),
  // due_date: z.string().refine(
  //   (date) => new Date(date) > new Date(),
  //   { message: 'Due date must be in the future' }
  // ),
  // case_id: z.string().uuid().optional(), // Link to case (if applicable)
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  // Add updatable fields here
});

// ============================================================================
// HELPER: Standardized JSON Response
// ============================================================================

function jsonResponse(res, data = null, error = null, status = 200, metadata = {}) {
  return res.status(status).json({ data, error, metadata });
}

// ============================================================================
// POST /api/{{entity-name}} - Create Entity
// ============================================================================

router.post('/', async (req, res) => {
  try {
    // Input Validation
    const validation = createSchema.safeParse(req.body);
    
    if (!validation.success) {
      return jsonResponse(res, null, {
        code: 'VALIDATION_FAILED',
        message: 'Validation Error',
        details: validation.error.format()
      }, 400);
    }

    // Business Logic: Create via adapter
    // NOTE: Implement create{{EntityName}} in nexusAdapter
    // Pattern: nexusAdapter.create{{EntityName}}(payload)
    const entity = await nexusAdapter.create{{EntityName}}({
      ...validation.data,
      tenant_id: req.tenantId,
      created_by: req.userId,
    });

    return jsonResponse(res, entity, null, 201, {
      created_at: new Date().toISOString(),
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);
  }
});

// ============================================================================
// GET /api/{{entity-name}} - List Entities
// ============================================================================

router.get('/', async (req, res) => {
  try {
    // Query Parameters
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const sort = req.query.sort || 'created_at';
    const order = req.query.order || 'desc';

    // Business Logic: List via adapter
    const entities = await nexusAdapter.get{{EntityName}}sByTenant({
      tenantId: req.tenantId,
      page,
      limit,
      sort,
      order,
    });

    return jsonResponse(res, entities, null, 200, {
      pagination: {
        page,
        limit,
        // total: entities.length, // Add if adapter returns total
      },
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// ============================================================================
// GET /api/{{entity-name}}/:id - Get Entity by ID
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Business Logic: Get via adapter
    const entity = await nexusAdapter.get{{EntityName}}ById(req.params.id, req.tenantId);

    if (!entity) {
      return jsonResponse(res, null, {
        code: 'NOT_FOUND',
        message: 'Entity not found'
      }, 404);
    }

    return jsonResponse(res, entity, null, 200);

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// ============================================================================
// PUT /api/{{entity-name}}/:id - Update Entity
// ============================================================================

router.put('/:id', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Input Validation
    const validation = updateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return jsonResponse(res, null, {
        code: 'VALIDATION_FAILED',
        message: 'Validation Error',
        details: validation.error.format()
      }, 400);
    }

    // Business Logic: Update via adapter
    const entity = await nexusAdapter.update{{EntityName}}(
      req.params.id,
      {
        ...validation.data,
        updated_by: req.userId,
      },
      req.tenantId
    );

    if (!entity) {
      return jsonResponse(res, null, {
        code: 'NOT_FOUND',
        message: 'Entity not found'
      }, 404);
    }

    return jsonResponse(res, entity, null, 200, {
      updated_at: new Date().toISOString(),
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'PUT',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// ============================================================================
// DELETE /api/{{entity-name}}/:id - Soft Delete Entity (CRUD-S)
// ============================================================================

router.delete('/:id', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Business Logic: Soft Delete via adapter (CCP-11: CRUD-S properly implemented)
    // Use generic CRUD-S helper (registry-enforced, safe-by-construction)
    // idColumn is auto-detected from registry if not provided
    // Throws SOFT_DELETE_NOT_SUPPORTED if table is not CRUD-S capable
    try {
      const entity = await nexusAdapter.softDeleteEntity({
        table: '{{table_name}}',
        // idColumn: '{{id_column}}', // Optional - auto-detected from registry
        id: req.params.id,
        userId: req.userId,
        tenantId: req.tenantId,
        tenantClientId: req.nexus?.tenantClientId || null,
        tenantVendorId: req.nexus?.tenantVendorId || null,
      });

      if (!entity) {
        return jsonResponse(res, null, {
          code: 'NOT_FOUND',
          message: 'Entity not found or already deleted'
        }, 404);
      }

      return jsonResponse(res, entity, null, 200, {
        deleted_at: new Date().toISOString(),
      });
    } catch (error) {
      // Handle SOFT_DELETE_NOT_SUPPORTED error
      if (error.message.includes('SOFT_DELETE_NOT_SUPPORTED')) {
        return jsonResponse(res, null, {
          code: 'SOFT_DELETE_NOT_SUPPORTED',
          message: `Table '{{table_name}}' does not support soft delete. Only core business entities support CRUD-S.`
        }, 400);
      }
      throw error; // Re-throw other errors
    }

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'DELETE',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// ============================================================================
// POST /api/{{entity-name}}/:id/restore - Restore Soft-Deleted Entity
// ============================================================================

router.post('/:id/restore', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Business Logic: Restore via adapter (CCP-11: CRUD-S properly implemented)
    // Use generic CRUD-S helper (registry-enforced, safe-by-construction)
    // idColumn is auto-detected from registry if not provided
    // Throws SOFT_DELETE_NOT_SUPPORTED if table is not CRUD-S capable
    try {
      const entity = await nexusAdapter.restoreEntity({
        table: '{{table_name}}',
        // idColumn: '{{id_column}}', // Optional - auto-detected from registry
        id: req.params.id,
        tenantId: req.tenantId,
        userId: req.userId,
        tenantClientId: req.nexus?.tenantClientId || null,
        tenantVendorId: req.nexus?.tenantVendorId || null,
      });

      if (!entity) {
        return jsonResponse(res, null, {
          code: 'NOT_FOUND',
          message: 'Entity not found or already active'
        }, 404);
      }

      return jsonResponse(res, entity, null, 200, {
        restored_at: new Date().toISOString(),
      });
    } catch (error) {
      // Handle SOFT_DELETE_NOT_SUPPORTED error
      if (error.message.includes('SOFT_DELETE_NOT_SUPPORTED')) {
        return jsonResponse(res, null, {
          code: 'SOFT_DELETE_NOT_SUPPORTED',
          message: `Table '{{table_name}}' does not support restore. Only core business entities support CRUD-S.`
        }, 400);
      }
      throw error; // Re-throw other errors
    }

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// ============================================================================
// ATTACHMENTS/STORAGE PATTERNS (Evidence First)
// ============================================================================

// POST /api/{{entity-name}}/:id/attachments - Upload or Link File
router.post('/:id/attachments', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Validate entity exists
    const entity = await nexusAdapter.get{{EntityName}}ById(req.params.id, req.tenantId);
    if (!entity) {
      return jsonResponse(res, null, {
        code: 'NOT_FOUND',
        message: 'Entity not found'
      }, 404);
    }

    // File upload validation
    const fileSchema = z.object({
      file_bucket: z.string().min(1),
      file_path: z.string().min(1),
      file_name: z.string().min(1),
      mime_type: z.string().min(1),
      file_size: z.number().positive(),
      file_hash: z.string().optional(), // SHA-256 hash for integrity
      case_id: z.string().uuid().optional(), // Link to case (Evidence First)
    });

    const validation = fileSchema.safeParse(req.body);
    if (!validation.success) {
      return jsonResponse(res, null, {
        code: 'VALIDATION_FAILED',
        message: 'Validation Error',
        details: validation.error.format()
      }, 400);
    }

    // Business Logic: Create attachment via adapter
    const attachment = await nexusAdapter.create{{EntityName}}Attachment({
      {{entity_name}}_id: req.params.id,
      ...validation.data,
      created_by: req.userId,
    });

    return jsonResponse(res, attachment, null, 201, {
      created_at: new Date().toISOString(),
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// GET /api/{{entity-name}}/:id/attachments - List Attachments
router.get('/:id/attachments', async (req, res) => {
  try {
    // ID Validation
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Business Logic: List attachments via adapter
    const attachments = await nexusAdapter.get{{EntityName}}Attachments(
      req.params.id,
      req.tenantId
    );

    return jsonResponse(res, attachments, null, 200);

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

// GET /api/{{entity-name}}/:id/attachments/:fileId/download - Get Signed Download URL
router.get('/:id/attachments/:fileId/download', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.fileId)) {
      return jsonResponse(res, null, {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }, 400);
    }

    // Business Logic: Get signed URL via adapter (standardized helper)
    // NOTE: You need to fetch the file record first to get bucket + path
    // Example pattern:
    // const fileRecord = await nexusAdapter.get{{EntityName}}AttachmentById(req.params.fileId, req.tenantId);
    // if (!fileRecord) {
    //   return jsonResponse(res, null, { code: 'NOT_FOUND', message: 'File not found' }, 404);
    // }
    // const signedUrl = await nexusAdapter.createSignedDownloadUrl(
    //   fileRecord.file_bucket,
    //   fileRecord.file_path,
    //   3600 // 1 hour TTL
    // );
    
    // For now, return 501 if file lookup not implemented
    return jsonResponse(res, null, {
      code: 'NOT_IMPLEMENTED',
      message: 'File download not yet implemented. Implement file lookup + createSignedDownloadUrl().'
    }, 501);

    if (!signedUrl) {
      return jsonResponse(res, null, {
        code: 'NOT_FOUND',
        message: 'File not found'
      }, 404);
    }

    // Redirect to signed URL (or return URL for client-side redirect)
    return jsonResponse(res, {
      download_url: signedUrl,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }, null, 200);

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    return jsonResponse(res, null, {
      code: 'SYS_ERR',
      message: 'Internal Server Error'
    }, 500);
  }
});

export default router;

