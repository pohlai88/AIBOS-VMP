/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Express SSR Route (Server-Side Rendered Pages)
 * Domain: {{Domain}} (finance | vendor | client | compliance | system)
 * Enforces: CRUD-S, RLS, Validation, Auth, HTMX Integration
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
 * Express SSR Route Template (Server-Side Rendered Pages)
 * 
 * This template is for SSR pages rendered with Nunjucks (not JSON API).
 * For JSON API endpoints, use route.api.template.js instead.
 * 
 * This template enforces:
 * - Server-side rendering with Nunjucks
 * - HTMX integration for dynamic updates
 * - Context-aware tenant/user extraction
 * - Input validation
 * - Error handling with user-friendly pages
 * - Authentication guards
 * - Adapter-only database access
 * 
 * Usage:
 * 1. Copy this file: cp src/templates/route.page.template.js src/routes/{{entity-name}}.js
 * 2. Replace placeholders:
 *    - {{EntityName}} → Invoice
 *    - {{entity-name}} → invoice
 *    - {{table_name}} → invoices
 *    - {{Domain}} → finance
 * 3. Customize validation and business logic
 * 4. Mount in server.js: app.use('/{{entity-name}}', {{entityName}}Router);
 * 
 * @module templates/route.page.template
 */

import express from 'express';
import { z } from 'zod';
import { nexusAdapter } from '../adapters/nexus-adapter.js';
import { requireAuth, requireTenant } from '../middleware/nexus-context.js';
import { logError } from '../utils/nexus-logger.js';
import { isValidUuid } from '../utils/uuid-validator.js';

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
  // case_id: z.string().uuid().optional(), // Link to case (Evidence First)
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  // Add updatable fields here
});

// ============================================================================
// GET /{{entity-name}} - List Page (SSR)
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

    // Render SSR page
    res.render('pages/{{entity_name}}_list.html', {
      entities,
      pagination: {
        page,
        limit,
        // total: entities.length, // Add if adapter returns total
      },
      user: req.user,
      tenantId: req.tenantId,
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to load {{entity-name}} list' }
    });
  }
});

// ============================================================================
// GET /{{entity-name}}/:id - Detail Page (SSR)
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    // ID Validation
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'Invalid ID format' }
      });
    }

    // Business Logic: Get via adapter
    const entity = await nexusAdapter.get{{EntityName}}ById(req.params.id, req.tenantId);

    if (!entity) {
      return res.status(404).render('pages/error.html', {
        error: { status: 404, message: '{{EntityName}} not found' }
      });
    }

    // Get attachments (if applicable)
    const attachments = await nexusAdapter.get{{EntityName}}Attachments(
      req.params.id,
      req.tenantId
    );

    // Render SSR page
    res.render('pages/{{entity_name}}_detail.html', {
      entity,
      attachments,
      user: req.user,
      tenantId: req.tenantId,
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to load {{entity-name}}' }
    });
  }
});

// ============================================================================
// GET /partials/{{entity-name}}-list.html - HTMX Partial (List)
// ============================================================================

router.get('/partials/{{entity-name}}-list.html', async (req, res) => {
  try {
    // Query Parameters
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');

    // Business Logic: List via adapter
    const entities = await nexusAdapter.get{{EntityName}}sByTenant({
      tenantId: req.tenantId,
      page,
      limit,
    });

    // Render HTMX partial
    res.render('partials/{{entity_name}}_list.html', {
      entities,
      pagination: { page, limit },
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('partials/error.html', {
      error: { message: 'Failed to load {{entity-name}} list' }
    });
  }
});

// ============================================================================
// POST /{{entity-name}} - Create Entity (Form Submission)
// ============================================================================

router.post('/', async (req, res) => {
  try {
    // Input Validation
    const validation = createSchema.safeParse(req.body);
    
    if (!validation.success) {
      // Re-render form with errors
      return res.status(400).render('pages/{{entity_name}}_form.html', {
        errors: validation.error.format(),
        formData: req.body,
        user: req.user,
      });
    }

    // Business Logic: Create via adapter
    const entity = await nexusAdapter.create{{EntityName}}({
      ...validation.data,
      tenant_id: req.tenantId,
      created_by: req.userId,
    });

    // Redirect to detail page
    res.redirect(`/{{entity-name}}/${entity.id}`);

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to create {{entity-name}}' }
    });
  }
});

// ============================================================================
// POST /{{entity-name}}/:id - Update Entity (Form Submission)
// ============================================================================

router.post('/:id', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'Invalid ID format' }
      });
    }

    // Input Validation
    const validation = updateSchema.safeParse(req.body);
    
    if (!validation.success) {
      // Re-render form with errors
      const entity = await nexusAdapter.get{{EntityName}}ById(req.params.id, req.tenantId);
      return res.status(400).render('pages/{{entity_name}}_form.html', {
        entity,
        errors: validation.error.format(),
        formData: req.body,
        user: req.user,
      });
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
      return res.status(404).render('pages/error.html', {
        error: { status: 404, message: '{{EntityName}} not found' }
      });
    }

    // Redirect to detail page
    res.redirect(`/{{entity-name}}/${entity.id}`);

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to update {{entity-name}}' }
    });
  }
});

// ============================================================================
// POST /{{entity-name}}/:id/delete - Soft Delete Entity (CRUD-S)
// ============================================================================

router.post('/:id/delete', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'Invalid ID format' }
      });
    }

    // Business Logic: Soft Delete via adapter (CCP-11: CRUD-S properly implemented)
    // Use generic CRUD-S helper (registry-enforced, safe-by-construction)
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
        return res.status(404).render('pages/error.html', {
          error: { status: 404, message: '{{EntityName}} not found or already deleted' }
        });
      }

      // Redirect to list page
      res.redirect('/{{entity-name}}');
    } catch (error) {
      // Handle SOFT_DELETE_NOT_SUPPORTED error
      if (error.message.includes('SOFT_DELETE_NOT_SUPPORTED')) {
        return res.status(400).render('pages/error.html', {
          error: { 
            status: 400, 
            message: `Table '{{table_name}}' does not support soft delete. Only core business entities support CRUD-S.` 
          }
        });
      }
      throw error; // Re-throw other errors
    }

    if (!entity) {
      return res.status(404).render('pages/error.html', {
        error: { status: 404, message: '{{EntityName}} not found or already deleted' }
      });
    }

    // Redirect to list page
    res.redirect('/{{entity-name}}');

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to delete {{entity-name}}' }
    });
  }
});

// ============================================================================
// POST /{{entity-name}}/:id/attachments - Upload Attachment (HTMX)
// ============================================================================

router.post('/:id/attachments', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id)) {
      return res.status(400).render('partials/error.html', {
        error: { message: 'Invalid ID format' }
      });
    }

    // Validate entity exists
    const entity = await nexusAdapter.get{{EntityName}}ById(req.params.id, req.tenantId);
    if (!entity) {
      return res.status(404).render('partials/error.html', {
        error: { message: '{{EntityName}} not found' }
      });
    }

    // File upload handling (using multer or similar)
    // This is a placeholder - implement based on your file upload strategy
    const fileData = {
      file_bucket: req.body.bucket || '{{entity-name}}-attachments',
      file_path: req.body.path,
      file_name: req.body.filename,
      mime_type: req.body.mimetype,
      file_size: parseInt(req.body.size),
      file_hash: req.body.hash, // SHA-256 hash
      case_id: req.body.case_id, // Link to case (Evidence First)
    };

    // Business Logic: Create attachment via adapter
    const attachment = await nexusAdapter.create{{EntityName}}Attachment({
      {{entity_name}}_id: req.params.id,
      ...fileData,
      created_by: req.userId,
    });

    // Render HTMX partial response
    res.render('partials/attachment_item.html', {
      attachment,
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'POST',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('partials/error.html', {
      error: { message: 'Failed to upload attachment' }
    });
  }
});

// ============================================================================
// GET /{{entity-name}}/:id/attachments/:fileId/download - Download File
// ============================================================================

router.get('/:id/attachments/:fileId/download', async (req, res) => {
  try {
    // ID Validation (using shared utility - CCP-16)
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.fileId)) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'Invalid ID format' }
      });
    }

    // Business Logic: Get signed URL via adapter (standardized helper)
    // NOTE: You need to fetch the file record first to get bucket + path
    // Example pattern:
    // const fileRecord = await nexusAdapter.get{{EntityName}}AttachmentById(req.params.fileId, req.tenantId);
    // if (!fileRecord) {
    //   return res.status(404).render('pages/error.html', {
    //     error: { status: 404, message: 'File not found' }
    //   });
    // }
    // const signedUrl = await nexusAdapter.createSignedDownloadUrl(
    //   fileRecord.file_bucket,
    //   fileRecord.file_path,
    //   3600 // 1 hour TTL
    // );
    // res.redirect(signedUrl);
    
    // For now, return error if file lookup not implemented
    return res.status(501).render('pages/error.html', {
      error: { status: 501, message: 'File download not yet implemented' }
    });

  } catch (error) {
    logError(error, { 
      path: req.path,
      method: 'GET',
      userId: req.userId,
      tenantId: req.tenantId
    });
    
    res.status(500).render('pages/error.html', {
      error: { status: 500, message: 'Failed to generate download link' }
    });
  }
});

export default router;

