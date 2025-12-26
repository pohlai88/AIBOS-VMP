/**
 * Nexus Vendor Routes (CMP Phase C6.4)
 *
 * Vendor Portal - Routes for tenants acting as VENDORS
 * All routes require authenticated user with active vendor context (TV-*)
 *
 * Mount: /nexus/vendor/* (via server.js)
 */

import express from 'express';
import multer from 'multer';
import { nexusAdapter } from '../adapters/nexus-adapter.js';
import {
  loadNexusSession,
  requireNexusAuth,
  requireNexusContext,
  injectNexusLocals,
} from '../middleware/nexus-context.js';

const router = express.Router();

// ============================================================================
// MULTER CONFIGURATION (Evidence Upload)
// ============================================================================

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: nexusAdapter.EVIDENCE_CONSTRAINTS.maxSize,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = nexusAdapter.EVIDENCE_CONSTRAINTS.allowedTypes;
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG, DOCX, XLSX'), false);
    }
  },
});

// ============================================================================
// MIDDLEWARE: Vendor Context Required
// ============================================================================

// Load session and inject locals for all routes
router.use(loadNexusSession);
router.use(injectNexusLocals);

// Require authenticated user
router.use(requireNexusAuth);

// Require vendor context (TV-*) - blocks clients accessing /nexus/vendor/*
router.use(requireNexusContext('vendor'));

// ============================================================================
// HELPER: Get Vendor ID from Session
// ============================================================================

function getVendorId(req) {
  // Vendor context uses tenant_vendor_id (TV-*)
  return req.nexus?.tenant?.tenant_vendor_id;
}

// ============================================================================
// ROUTES: Vendor Case Detail (C6.4)
// ============================================================================

/**
 * GET /nexus/vendor/cases/:case_id
 * Vendor case detail page
 */
router.get('/cases/:case_id', async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const userId = req.nexus?.user?.user_id;
    const caseId = req.params.case_id;

    if (!vendorId) {
      return res.status(403).render('nexus/pages/error.html', {
        error: { status: 403, message: 'Vendor context required' },
      });
    }

    if (!caseId || !caseId.startsWith('CASE-')) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Invalid case ID' },
      });
    }

    const detail = await nexusAdapter.getCaseDetailByVendor(vendorId, caseId);
    if (!detail) {
      return res.status(404).render('nexus/pages/error.html', {
        error: { status: 404, message: 'Case not found or you do not have access to it.' },
      });
    }

    // Build timeline items (same shape as client)
    const timelineItems = (detail.messages || []).map(m => ({
      type: m.message_type,
      actorContext: m.sender_context,
      content: m.body || m.content,
      createdAt: m.created_at,
      sender: m.sender,
    }));

    return res.render('nexus/pages/vendor-case-detail.html', {
      caseData: detail.case,
      evidence: detail.evidence || [],
      timeline: timelineItems,
      references: {
        invoice_id: detail.case?.related_invoice_id,
        payment_id: detail.case?.related_payment_id,
      },
      vendorId,
      userId,
    });
  } catch (error) {
    console.error('Vendor case detail error:', error);
    return res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load case details' },
    });
  }
});

/**
 * POST /nexus/vendor/cases/:case_id/notes
 * Add a note to a case (vendor context)
 */
router.post('/cases/:case_id/notes', async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const tenantId = req.nexus?.tenant?.tenant_id;
    const userId = req.nexus?.user?.user_id;
    const caseId = req.params.case_id;

    if (!vendorId) {
      return res.status(403).send('Vendor context required');
    }

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).send('Missing content');
    }
    if (content.length > 500) {
      return res.status(400).send('Note too long (max 500 characters)');
    }

    const msg = await nexusAdapter.createCaseNoteByVendor({
      caseId,
      vendorId,
      userId,
      tenantId,
      content,
    });

    if (!msg) {
      return res.status(404).send('Case not found');
    }

    const item = {
      type: 'note',
      actorContext: 'vendor',
      content: msg.body || msg.content,
      createdAt: msg.created_at,
      sender: msg.sender,
    };

    return res.render('nexus/partials/case-timeline-item.html', { item });
  } catch (error) {
    console.error('Vendor note creation error:', error);
    return res.status(500).send('Failed to add note');
  }
});

/**
 * POST /nexus/vendor/cases/:case_id/evidence
 * Upload evidence to a case (vendor context)
 */
router.post('/cases/:case_id/evidence', evidenceUpload.single('file'), async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const tenantId = req.nexus?.tenant?.tenant_id;
    const userId = req.nexus?.user?.user_id;
    const caseId = req.params.case_id;

    if (!vendorId) {
      return res.status(403).send('Vendor context required');
    }

    if (!req.file) {
      return res.status(400).send('Missing file');
    }

    const created = await nexusAdapter.createCaseEvidenceByVendor({
      caseId,
      vendorId,
      userId,
      tenantId,
      file: req.file,
    });

    if (!created) {
      return res.status(404).send('Case not found');
    }

    // Timeline evidence event
    const timelineItem = {
      type: 'evidence_uploaded',
      actorContext: 'vendor',
      content: `Uploaded evidence: ${req.file.originalname}`,
      createdAt: new Date().toISOString(),
    };

    // Build evidenceItem matching partial expectations
    const evidenceItem = {
      ...created.evidence,
      uploader: {
        display_name: req.nexus?.user?.display_name || req.nexus?.user?.email,
      },
    };

    // Reuse existing evidence upload response partial
    return res.render('nexus/partials/case-evidence-upload-response.html', {
      timelineItem,
      evidenceItem,
    });
  } catch (error) {
    console.error('Vendor evidence upload error:', error);
    // Return HTMX-friendly error into #evidence-upload-status
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('<div id="evidence-upload-status" hx-swap-oob="innerHTML" class="nexus-upload-error">File too large. Max 10MB</div>');
    }
    return res.status(500).send(`<div id="evidence-upload-status" hx-swap-oob="innerHTML" class="nexus-upload-error">${error.message || 'Upload failed'}</div>`);
  }
});

export default router;
