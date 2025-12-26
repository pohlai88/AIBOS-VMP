/**
 * Nexus Client Routes (CMP Phase C3)
 *
 * Client Command Center - Routes for tenants acting as CLIENTS
 * All routes require authenticated user with active client context (TC-*)
 *
 * Mount: /nexus/client/* (via server.js)
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
// MIDDLEWARE: Client Context Required
// ============================================================================

// Load session and inject locals for all routes
router.use(loadNexusSession);
router.use(injectNexusLocals);

// Require authenticated user
router.use(requireNexusAuth);

// Require client context (TC-*) - blocks vendors accessing /nexus/client/*
router.use(requireNexusContext('client'));

// ============================================================================
// HELPER: Get Client ID from Session
// ============================================================================

function getClientId(req) {
  // Client context uses tenant_client_id (TC-*)
  return req.nexus?.tenant?.tenant_client_id;
}

// ============================================================================
// CLIENT ROUTES
// ============================================================================

/**
 * GET /nexus/client
 * Command Center Dashboard - Aggregate view of all client operations
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    // Fetch all data in parallel for dashboard aggregation
    const [vendors, invoices, payments, cases] = await Promise.all([
      nexusAdapter.getVendorsByClient(clientId),
      nexusAdapter.getInvoicesByClient(clientId),
      nexusAdapter.getPaymentsByClient(clientId),
      nexusAdapter.getCasesByClient(clientId),
    ]);

    // Compute dashboard metrics
    const metrics = {
      vendors: {
        total: vendors.length,
        active: vendors.filter(v => v.status === 'active').length,
      },
      invoices: {
        total: invoices.length,
        pending: invoices.filter(i => ['sent', 'viewed'].includes(i.status)).length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        disputed: invoices.filter(i => i.status === 'disputed').length,
        totalOutstanding: invoices.reduce((sum, i) => sum + parseFloat(i.amount_outstanding || 0), 0),
      },
      payments: {
        total: payments.length,
        pending: payments.filter(p => p.status === 'pending').length,
        processing: payments.filter(p => p.status === 'processing').length,
        completed: payments.filter(p => p.status === 'completed').length,
      },
      cases: {
        total: cases.length,
        open: cases.filter(c => c.status === 'open').length,
        inProgress: cases.filter(c => c.status === 'in_progress').length,
        escalated: cases.filter(c => c.priority === 'urgent' || c.priority === 'critical').length,
      },
    };

    // Recent activity (last 5 of each)
    const recent = {
      invoices: invoices.slice(0, 5),
      payments: payments.slice(0, 5),
      cases: cases.slice(0, 5),
    };

    res.render('nexus/pages/client-dashboard.html', {
      metrics,
      recent,
      vendors,
    });
  } catch (error) {
    console.error('Client dashboard error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load dashboard' }
    });
  }
});

/**
 * GET /nexus/client/vendors
 * Vendor Directory - List all vendors I work with
 */
router.get('/vendors', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    const vendors = await nexusAdapter.getVendorsByClient(clientId);

    // Group by status for display
    const active = vendors.filter(v => v.status === 'active');
    const pending = vendors.filter(v => v.status === 'pending');
    const inactive = vendors.filter(v => v.status !== 'active' && v.status !== 'pending');

    res.render('nexus/pages/vendor-directory.html', {
      vendors,
      groups: { active, pending, inactive },
      counts: {
        total: vendors.length,
        active: active.length,
        pending: pending.length,
      },
      query: req.query,
    });
  } catch (error) {
    console.error('Vendor directory error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load vendor directory' }
    });
  }
});

/**
 * GET /nexus/client/invoices
 * AP Queue - Invoice Inbox with tabs, filters, and pagination (C8.1)
 */
router.get('/invoices', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    // Parse query params
    const tab = req.query.tab || req.query.status || 'needs_review';
    const vendorId = req.query.vendor_id || req.query.vendor || null;
    const q = req.query.q || null;
    const dateFrom = req.query.from || null;
    const dateTo = req.query.to || null;
    const minAmount = req.query.min || null;
    const maxAmount = req.query.max || null;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    // Get paginated inbox
    const inbox = await nexusAdapter.getInvoiceInboxByClient({
      clientId,
      tab,
      vendorId,
      q,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      limit,
      offset,
    });

    // Build pagination helpers
    const hasPrev = inbox.offset > 0;
    const hasNext = inbox.offset + inbox.limit < inbox.total;

    const pagination = {
      total: inbox.total,
      limit: inbox.limit,
      offset: inbox.offset,
      hasPrev,
      hasNext,
      prevOffset: Math.max(0, inbox.offset - inbox.limit),
      nextOffset: inbox.offset + inbox.limit,
      fromRow: inbox.total ? inbox.offset + 1 : 0,
      toRow: Math.min(inbox.total, inbox.offset + inbox.rows.length),
    };

    // Summary metrics (from current page - fast approximation)
    const invoices = inbox.rows;
    const summary = {
      totalCount: inbox.total,
      totalOutstanding: invoices.reduce((sum, i) => sum + parseFloat(i.amount_outstanding || 0), 0),
      overdueCount: invoices.filter(i => i.status === 'overdue').length,
      overdueAmount: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + parseFloat(i.amount_outstanding || 0), 0),
    };

    res.render('nexus/pages/client-invoices.html', {
      invoices,
      tab: inbox.tab,
      summary,
      pagination,
      filters: { tab: inbox.tab, vendorId, q, dateFrom, dateTo, minAmount, maxAmount },
      query: req.query,
    });
  } catch (error) {
    console.error('Client invoices error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load invoices' }
    });
  }
});

/**
 * GET /nexus/client/invoices/:invoice_id
 * Invoice Detail - Single invoice view with payments
 */
router.get('/invoices/:invoice_id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    const { invoice_id } = req.params;
    const invoice = await nexusAdapter.getInvoiceDetailByClient(clientId, invoice_id);

    // If invoice doesn't exist or doesn't belong to client → 404
    if (!invoice) {
      return res.status(404).render('nexus/pages/error.html', {
        error: { status: 404, message: 'Invoice not found' }
      });
    }

    // C8.2 Matching Pilot: Compute/refresh match signal if feature enabled
    let matchSignal = null;
    if (process.env.FEATURE_MATCHING_PILOT === 'true') {
      try {
        // Refresh and persist the signal
        const updated = await nexusAdapter.refreshInvoiceMatchSignal({ invoiceId: invoice_id, clientId });
        matchSignal = {
          status: updated.match_status,
          score: updated.match_score,
          reason: updated.match_reason,
          updatedAt: updated.match_updated_at,
        };
      } catch (err) {
        // Fallback to in-memory compute if persist fails
        console.warn('Match signal refresh failed, using compute-only:', err.message);
        const signal = nexusAdapter.computeInvoiceMatchSignal(invoice);
        matchSignal = {
          status: signal.match_status,
          score: signal.match_score,
          reason: signal.match_reason,
          updatedAt: null,
        };
      }
    }

    // Parse line_items from JSONB
    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

    // Build status timeline from timestamps
    const statusHistory = [];
    if (invoice.created_at) statusHistory.push({ status: 'created', timestamp: invoice.created_at });
    if (invoice.sent_at) statusHistory.push({ status: 'sent', timestamp: invoice.sent_at });
    if (invoice.paid_at) statusHistory.push({ status: 'paid', timestamp: invoice.paid_at });
    // Current status if not already in timeline
    if (!statusHistory.find(s => s.status === invoice.status)) {
      statusHistory.push({ status: invoice.status, timestamp: invoice.updated_at });
    }

    res.render('nexus/pages/client-invoice-detail.html', {
      invoice,
      lineItems,
      payments: invoice.payments || [],
      statusHistory,
      matchSignal,
    });
  } catch (error) {
    console.error('Invoice detail error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load invoice' }
    });
  }
});

// ============================================================================
// INVOICE DECISION (MVP Patch)
// ============================================================================

/**
 * POST /nexus/client/invoices/:invoice_id/approve
 * Approve an invoice - marks status as 'approved'
 */
router.post('/invoices/:invoice_id/approve', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(401).send('Unauthorized: missing client context');
    }

    const { invoice_id } = req.params;
    const actorUserId = req.nexus?.user?.user_id || null;

    await nexusAdapter.approveInvoiceByClient({
      invoiceId: invoice_id,
      clientId,
      actorUserId,
    });

    return res.redirect(`/nexus/client/invoices/${invoice_id}?ok=approved`);
  } catch (error) {
    console.error('Invoice approve error:', error);
    return res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: error.message || 'Failed to approve invoice' }
    });
  }
});

/**
 * POST /nexus/client/invoices/:invoice_id/dispute
 * Dispute an invoice - creates a case linked to the invoice
 */
router.post('/invoices/:invoice_id/dispute', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(401).send('Unauthorized: missing client context');
    }

    const { invoice_id } = req.params;
    const actorUserId = req.nexus?.user?.user_id || null;
    const subject = (req.body?.subject || '').trim();
    const description = (req.body?.description || '').trim();

    const result = await nexusAdapter.disputeInvoiceByClient({
      invoiceId: invoice_id,
      clientId,
      actorUserId,
      subject,
      description,
    });

    // Redirect to case detail for best UX
    if (result?.caseId) {
      return res.redirect(`/nexus/client/cases/${result.caseId}?ok=disputed`);
    }
    return res.redirect(`/nexus/client/invoices/${invoice_id}?ok=disputed`);
  } catch (error) {
    console.error('Invoice dispute error:', error);
    return res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: error.message || 'Failed to dispute invoice' }
    });
  }
});

/**
 * GET /nexus/client/payments
 * Payment Outbox - Payments I have sent/am sending
 */
router.get('/payments', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    // Apply query filters
    const filters = {};
    if (req.query.status) filters.status = req.query.status;

    const payments = await nexusAdapter.getPaymentsByClient(clientId, filters);

    // Group by status
    const byStatus = {
      all: payments,
      pending: payments.filter(p => p.status === 'pending'),
      processing: payments.filter(p => p.status === 'processing'),
      completed: payments.filter(p => p.status === 'completed'),
      failed: payments.filter(p => p.status === 'failed'),
    };

    // Summary metrics
    const summary = {
      totalCount: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
      pendingCount: byStatus.pending.length,
      pendingAmount: byStatus.pending.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    };

    res.render('nexus/pages/client-payments.html', {
      payments,
      byStatus,
      summary,
      filters: req.query,
    });
  } catch (error) {
    console.error('Client payments error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load payments' }
    });
  }
});

/**
 * GET /nexus/client/payments/:payment_id
 * Payment Detail - Single payment view with linked invoice
 */
router.get('/payments/:payment_id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    const { payment_id } = req.params;
    const payment = await nexusAdapter.getPaymentDetailByClient(clientId, payment_id);

    // If payment doesn't exist or doesn't belong to client → 404
    if (!payment) {
      return res.status(404).render('nexus/pages/error.html', {
        error: { status: 404, message: 'Payment not found' }
      });
    }

    // Build processing timeline from timestamps
    const statusHistory = [];
    if (payment.created_at) statusHistory.push({ status: 'created', timestamp: payment.created_at });
    if (payment.scheduled_date) statusHistory.push({ status: 'scheduled', timestamp: payment.scheduled_date });
    if (payment.payment_date) statusHistory.push({ status: 'processed', timestamp: payment.payment_date });
    if (payment.reconciled_at) statusHistory.push({ status: 'reconciled', timestamp: payment.reconciled_at });
    // Current status if not already in timeline
    if (!['created', 'scheduled', 'processed', 'reconciled'].includes(payment.status)) {
      statusHistory.push({ status: payment.status, timestamp: payment.updated_at || payment.created_at });
    }

    res.render('nexus/pages/client-payment-detail.html', {
      payment,
      linkedInvoice: payment.linked_invoice,
      statusHistory,
    });
  } catch (error) {
    console.error('Payment detail error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load payment' }
    });
  }
});

/**
 * GET /nexus/client/cases
 * Issue Tracker - Cases where I am the client
 */
router.get('/cases', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    // Apply query filters
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.vendor) filters.vendorId = req.query.vendor;

    const cases = await nexusAdapter.getCasesByClient(clientId, filters);

    // Group by status
    const byStatus = {
      all: cases,
      open: cases.filter(c => c.status === 'open'),
      inProgress: cases.filter(c => c.status === 'in_progress'),
      escalated: cases.filter(c => c.status === 'escalated'),
      resolved: cases.filter(c => c.status === 'resolved'),
      closed: cases.filter(c => c.status === 'closed'),
    };

    // Group by priority for attention
    const urgent = cases.filter(c =>
      (c.priority === 'urgent' || c.priority === 'critical') &&
      c.status !== 'closed' && c.status !== 'resolved'
    );

    res.render('nexus/pages/client-cases.html', {
      cases,
      byStatus,
      urgent,
      filters: req.query,
    });
  } catch (error) {
    console.error('Client cases error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load cases' }
    });
  }
});

/**
 * GET /nexus/client/cases/:case_id
 * Case Detail - Investigation record with timeline
 */
router.get('/cases/:case_id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    const { case_id } = req.params;
    const caseData = await nexusAdapter.getCaseDetailByClient(clientId, case_id);

    // If case doesn't exist or doesn't belong to client → 404
    if (!caseData) {
      return res.status(404).render('nexus/pages/error.html', {
        error: { status: 404, message: 'Case not found' }
      });
    }

    // Build timeline from messages + status events
    const timeline = (caseData.messages || []).map(msg => ({
      id: msg.message_id,
      type: msg.message_type,
      actor: msg.sender?.display_name || msg.sender?.email || 'Unknown',
      actorContext: msg.sender_context,
      content: msg.body,
      timestamp: msg.created_at,
    }));

    // Get available status transitions for current status
    const availableTransitions = nexusAdapter.getAvailableTransitions(caseData.status);

    res.render('nexus/pages/client-case-detail.html', {
      caseData,
      timeline,
      evidence: caseData.evidence || [],
      references: caseData.references,
      availableTransitions,
    });
  } catch (error) {
    console.error('Case detail error:', error);
    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to load case' }
    });
  }
});

/**
 * POST /nexus/client/cases/:case_id/notes
 * Add Note - HTMX append to timeline
 */
router.post('/cases/:case_id/notes', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const userId = req.nexus?.user?.user_id;
    const tenantId = req.nexus?.tenant?.tenant_id;

    if (!clientId || !userId || !tenantId) {
      return res.status(400).send('<div class="nexus-error-inline">Authentication required</div>');
    }

    const { case_id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).send('<div class="nexus-error-inline">Note content is required</div>');
    }

    // Verify case belongs to client before writing
    const caseData = await nexusAdapter.getCaseDetailByClient(clientId, case_id);
    if (!caseData) {
      return res.status(404).send('<div class="nexus-error-inline">Case not found</div>');
    }

    // Create the note
    const note = await nexusAdapter.createCaseNoteByClient({
      caseId: case_id,
      clientId,
      userId,
      tenantId,
      content: content.trim(),
    });

    // Return timeline item partial for HTMX append
    const timelineItem = {
      id: note.message_id,
      type: note.message_type,
      actor: note.sender?.display_name || note.sender?.email || 'You',
      actorContext: 'client',
      content: note.body,
      timestamp: note.created_at,
    };

    res.render('nexus/partials/case-timeline-item.html', { item: timelineItem });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).send('<div class="nexus-error-inline">Failed to add note</div>');
  }
});

/**
 * POST /nexus/client/cases/:case_id/evidence
 * Upload Evidence - HTMX append to timeline + refresh sidebar
 */
router.post('/cases/:case_id/evidence', evidenceUpload.single('file'), async (req, res) => {
  try {
    const clientId = getClientId(req);
    const userId = req.nexus?.user?.user_id;
    const tenantId = req.nexus?.tenant?.tenant_id;

    if (!clientId || !userId || !tenantId) {
      return res.status(400).send('<div class="nexus-error-inline">Authentication required</div>');
    }

    const { case_id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).send('<div class="nexus-error-inline">Please select a file to upload</div>');
    }

    // Upload evidence (adapter handles validation and storage)
    const evidence = await nexusAdapter.createCaseEvidenceByClient({
      caseId: case_id,
      clientId,
      userId,
      tenantId,
      file,
    });

    // Get download URL for the new evidence
    const downloadUrl = await nexusAdapter.getEvidenceDownloadUrl(evidence.storage_path);

    // Return combined response for HTMX:
    // 1. Timeline item for append to #case-timeline
    // 2. Evidence item for append to #evidence-list (via OOB swap)
    const timelineItem = {
      id: evidence.evidence_id,
      type: 'evidence_uploaded',
      actor: req.nexus?.user?.display_name || req.nexus?.user?.email || 'You',
      actorContext: 'client',
      content: `Uploaded evidence: ${evidence.original_filename}`,
      timestamp: evidence.created_at,
    };

    const evidenceItem = {
      ...evidence,
      download_url: downloadUrl,
      uploader: {
        display_name: req.nexus?.user?.display_name || req.nexus?.user?.email,
      },
    };

    res.render('nexus/partials/case-evidence-upload-response.html', {
      timelineItem,
      evidenceItem,
    });
  } catch (error) {
    console.error('Evidence upload error:', error);
    // Handle multer errors specifically
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('<div class="nexus-error-inline">File too large. Maximum size is 10MB</div>');
    }
    res.status(500).send(`<div class="nexus-error-inline">${error.message || 'Failed to upload evidence'}</div>`);
  }
});

/**
 * POST /nexus/client/invite
 * Onboard Vendor - Send relationship invitation
 */
router.post('/invite', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const tenantId = req.nexus?.tenant?.tenant_id;

    if (!clientId || !tenantId) {
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Client context not found' }
      });
    }

    const { vendor_email, vendor_name } = req.body;

    if (!vendor_email) {
      // HTMX partial response for validation error
      if (req.headers['hx-request']) {
        return res.status(400).send('<div class="vmp-text-danger">Vendor email is required</div>');
      }
      return res.status(400).render('nexus/pages/error.html', {
        error: { status: 400, message: 'Vendor email is required' }
      });
    }

    // Create relationship invite (existing adapter function)
    // Signature: createRelationshipInvite(invitingTenantId, inviteeEmail, options)
    await nexusAdapter.createRelationshipInvite(tenantId, vendor_email, {
      inviteeName: vendor_name || null,
    });

    // HTMX response
    if (req.headers['hx-request']) {
      return res.send(`
        <div class="vmp-panel vmp-text-ok">
          <strong>Invitation Sent!</strong><br>
          An invitation has been sent to ${vendor_email}
        </div>
      `);
    }

    // Full page redirect
    res.redirect('/nexus/client/vendors?invited=true');
  } catch (error) {
    console.error('Vendor invite error:', error);

    if (req.headers['hx-request']) {
      return res.status(500).send('<div class="vmp-text-danger">Failed to send invitation</div>');
    }

    res.status(500).render('nexus/pages/error.html', {
      error: { status: 500, message: 'Failed to send invitation' }
    });
  }
});

/**
 * POST /nexus/client/cases/:case_id/status
 * Transition Case Status - HTMX update timeline + status badge
 */
router.post('/cases/:case_id/status', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const userId = req.nexus?.user?.user_id;
    const tenantId = req.nexus?.tenant?.tenant_id;

    if (!clientId || !userId || !tenantId) {
      return res.status(400).send('<div class="nexus-error-inline">Authentication required</div>');
    }

    const { case_id } = req.params;
    const { to_status, note } = req.body;

    // Validate to_status is provided
    if (!to_status) {
      return res.status(400).send('<div class="nexus-error-inline">Target status is required</div>');
    }

    // Validate to_status is one of the allowed workflow statuses
    const allowedWorkflowStatuses = ['in_progress', 'resolved', 'closed'];
    if (!allowedWorkflowStatuses.includes(to_status)) {
      return res.status(400).send(`<div class="nexus-error-inline">Invalid status: ${to_status}</div>`);
    }

    // Validate note length if provided
    if (note && note.length > 500) {
      return res.status(400).send('<div class="nexus-error-inline">Note must be less than 500 characters</div>');
    }

    // Perform the transition
    const result = await nexusAdapter.transitionCaseStatusByClient({
      caseId: case_id,
      clientId,
      userId,
      tenantId,
      toStatus: to_status,
      note: note || null,
    });

    // Build timeline items for HTMX response
    const timelineItems = [];

    // System event (always present)
    if (result.systemEvent) {
      timelineItems.push({
        id: result.systemEvent.message_id,
        type: 'status_change',
        actor: result.systemEvent.sender?.display_name || result.systemEvent.sender?.email || 'System',
        actorContext: 'system',
        content: result.toStatus,
        timestamp: result.systemEvent.created_at,
      });
    }

    // Optional note
    if (result.noteEvent) {
      timelineItems.push({
        id: result.noteEvent.message_id,
        type: 'note',
        actor: result.noteEvent.sender?.display_name || result.noteEvent.sender?.email || 'You',
        actorContext: 'client',
        content: result.noteEvent.body,
        timestamp: result.noteEvent.created_at,
      });
    }

    // Get available next transitions
    const availableTransitions = nexusAdapter.getAvailableTransitions(result.toStatus);

    res.render('nexus/partials/case-status-transition-response.html', {
      timelineItems,
      newStatus: result.toStatus,
      availableTransitions,
      caseId: case_id,
    });
  } catch (error) {
    console.error('Status transition error:', error);
    res.status(400).send(`<div class="nexus-error-inline">${error.message || 'Failed to update status'}</div>`);
  }
});

// ============================================================================
// EXPORT
// ============================================================================

export default router;
