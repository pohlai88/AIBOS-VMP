import express from 'express';
import { vmpAdapter } from '../adapters/supabase.js';
import { requireAuth, handleRouteError, handlePartialError } from '../utils/route-helpers.js';

const clientRouter = express.Router();

/**
 * Case Detail Page
 * Route: GET /cases/:id
 *
 * Displays full case with metadata, tabs (overview, thread, evidence, checklist, activity)
 * Anti-drift: Tabs lazy load via HTMX; NO full page reload
 */
clientRouter.get('/:id', (req, res) => {
  // Check auth first
  if (!requireAuth(req, res)) {
    return;
  }

  const caseId = req.params.id;
  const activeTab = req.query.tab || 'overview';

  (async () => {
    try {
      // Fetch case data with related info
      const caseData = await vmpAdapter.getCaseDetail(caseId);

      if (!caseData) {
        return res.status(404).render('pages/error.html', {
          error: { status: 404, message: 'Case not found' }
        });
      }

      // Fetch vendor and company in parallel if needed
      const [vendor, company] = await Promise.all([
        caseData.vendor_id ? vmpAdapter.getVendor(caseData.vendor_id) : null,
        caseData.company_id ? vmpAdapter.getCompany(caseData.company_id) : null
      ]);

      // Render template with data
      res.render('pages/case-detail.html', {
        case: caseData,
        vendor,
        company,
        active_tab: activeTab
      });
    } catch (error) {
      handleRouteError(error, req, res, 'pages/error.html');
    }
  })();
});

/**
 * HTMX Endpoint: Load Message Thread Tab
 * Route: GET /cases/:id/thread
 *
 * Returns partial HTML for thread tab (lazy loaded)
 * Anti-drift: Returns fragment only; NO layout wrap
 */
clientRouter.get('/:id/thread', (req, res) => {
  if (!requireAuth(req, res)) {
    return;
  }

  const caseId = req.params.id;
  const page = req.query.page || 1;

  (async () => {
    try {
      const messages = await vmpAdapter.getMessages(caseId, {
        limit: 20,
        page
      });

      res.render('partials/message-thread.html', {
        messages,
        caseId,
        pagination: messages.pagination
      });
    } catch (error) {
      handlePartialError(
        error,
        req,
        res,
        'partials/error-partial.html',
        { caseId }
      );
    }
  })();
});

/**
 * HTMX Endpoint: Load Evidence Tab
 * Route: GET /cases/:id/evidence
 *
 * Returns partial HTML for evidence gallery (lazy loaded)
 * Anti-drift: Returns fragment only; NO layout wrap
 */
clientRouter.get('/:id/evidence', (req, res) => {
  if (!requireAuth(req, res)) {
    return;
  }

  const caseId = req.params.id;

  (async () => {
    try {
      const files = await vmpAdapter.getEvidence(caseId);

      res.render('partials/evidence-gallery.html', {
        files,
        caseId
      });
    } catch (error) {
      handlePartialError(
        error,
        req,
        res,
        'partials/error-partial.html',
        { caseId }
      );
    }
  })();
});

/**
 * API Endpoint: Send Message
 * Route: POST /api/cases/:id/messages
 *
 * Creates new message in case thread
 * Request: { content: string }
 * Response: { id, created_at, sender_name, body }
 */
clientRouter.post('/api/:id/messages', (req, res) => {
  if (!requireAuth(req, res)) {
    return;
  }

  const caseId = req.params.id;
  const { content } = req.body;

  // Validation before adapter
  if (!content || content.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'Message content required' });
  }

  if (content.trim().length > 5000) {
    return res
      .status(400)
      .json({ error: 'Message must be less than 5000 characters' });
  }

  (async () => {
    try {
      const message = await vmpAdapter.createMessage(caseId, {
        sender_user_id: req.user.id,
        sender_type: req.user.role || 'vendor',
        body: content.trim()
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Message creation error:', error);
      res.status(500).json({ error: 'Could not send message' });
    }
  })();
});

/**
 * API Endpoint: Upload Evidence File
 * Route: POST /api/cases/:id/evidence
 *
 * Uploads file to case evidence
 * Multipart form data with 'file' field
 */
clientRouter.post('/api/:id/evidence', (req, res) => {
  if (!requireAuth(req, res)) {
    return;
  }

  const caseId = req.params.id;
  // Note: Assumes multer middleware is attached upstream
  // req.file will be populated by multer

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  (async () => {
    try {
      const evidence = await vmpAdapter.uploadEvidence(caseId, {
        file: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploader_type: req.user.role || 'vendor'
      });

      res.status(201).json(evidence);
    } catch (error) {
      console.error('Evidence upload error:', error);
      res.status(500).json({ error: 'Could not upload file' });
    }
  })();
});

export default clientRouter;
