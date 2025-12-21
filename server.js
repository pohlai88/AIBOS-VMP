/// <reference path="./types/express.d.ts" />
import express from 'express';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { cleanEnv, str, url } from 'envalid';
import 'express-async-errors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import { vmpAdapter } from './src/adapters/supabase.js';
import { createErrorResponse, logError, NotFoundError } from './src/utils/errors.js';

// Environment validation
dotenv.config();
const env = cleanEnv(process.env, {
  SUPABASE_URL: url({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  DEMO_VENDOR_ID: str({ default: '' }),
  SESSION_SECRET: str({ default: 'dev-secret-change-in-production' }),
  PORT: str({ default: '9000' }),
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  // Rollback switches for production pages (allows quick rollback without code changes)
  VMP_HOME_PAGE: str({ default: 'home5' }),
  VMP_LOGIN_PAGE: str({ default: 'login3' }),
});

const app = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory (we'll upload to Supabase Storage)
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, images, Word, Excel`), false);
    }
  }
});

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", env.SUPABASE_URL],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Request timeout middleware (30 seconds)
// Wraps async route handlers to enforce timeout
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.',
      });
    }
  }, 30000); // 30 second timeout

  // Clear timeout when response is sent
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    clearTimeout(timeout);
    return originalEnd(...args);
  };

  next();
});

// Compression
app.use(compression());

// --- CONFIG ---
const nunjucksEnv = nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  watch: env.NODE_ENV === 'development',
});

// Add custom filters
nunjucksEnv.addFilter('upper', (str) => {
  return str ? String(str).toUpperCase() : '';
});

nunjucksEnv.addFilter('tojson', (obj) => {
  return JSON.stringify(obj);
});

// Date formatting filter (replaces Python's strftime)
nunjucksEnv.addFilter('date', (date, format) => {
  if (!date) return '';

  try {
    // Handle different date input types
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }

    if (isNaN(d.getTime())) return '';

    // Format patterns
    const patterns = {
      '%b %d': () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
      },
      '%H:%M': () => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      },
      '%Y-%m-%d': () => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    };

    if (format && patterns[format]) {
      return patterns[format]();
    }

    // Default format
    return d.toLocaleDateString();
  } catch (error) {
    console.error('Date filter error:', error, 'Input:', date);
    return '';
  }
});

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieSession({
    name: 'vmp_session',
    keys: [env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  })
);

// --- MIDDLEWARE: Real Auth (Session Lookup) ---
app.use(async (req, res, next) => {
  // Skip auth for public routes
  const publicRoutes = ['/login', '/login4', '/', '/health', '/home3', '/home4'];
  if (publicRoutes.includes(req.path) || req.path.startsWith('/partials/login-')) {
    return next();
  }

  // Test mode: Allow bypass with test header (for automated testing)
  if (env.NODE_ENV === 'test' && req.headers['x-test-auth'] === 'bypass') {
    const testUserId = req.headers['x-test-user-id'] || 'test-user-id';
    const testVendorId = req.headers['x-test-vendor-id'] || env.DEMO_VENDOR_ID;
    const isInternal = req.headers['x-test-is-internal'] === 'true';

    req.user = {
      id: testUserId,
      email: 'test@example.com',
      displayName: 'Test User',
      vendorId: testVendorId,
      vendor: { id: testVendorId, name: 'Test Vendor' },
      isInternal: isInternal || false
    };
    return next();
  }

  const sessionId = req.session.sessionId;

  if (!sessionId) {
    return res.redirect('/login');
  }

  try {
    // Lookup session in database
    const session = await vmpAdapter.getSession(sessionId);

    if (!session) {
      // Session not found or expired
      req.session = null;
      return res.redirect('/login');
    }

    // Load user context
    const userContext = await vmpAdapter.getVendorContext(session.user_id);

    if (!userContext || !userContext.is_active) {
      // User not found or inactive
      await vmpAdapter.deleteSession(sessionId);
      req.session = null;
      return res.redirect('/login');
    }

    // Set user on request
    req.user = {
      id: userContext.id,
      email: userContext.email,
      displayName: userContext.display_name || userContext.email,
      vendorId: userContext.vendor_id,
      vendor: userContext.vmp_vendors,
      isInternal: userContext.is_internal === true || userContext.is_internal === 'true' || false
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.session = null;
    return res.redirect('/login');
  }
});

// --- ROUTES ---

// Health check endpoint (for Vercel monitoring)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// 1. Landing Page (Public)
app.get('/', (req, res) => {
  res.render('pages/landing.html');
});

// ==========================================
// 🔒 LOCKED PRODUCTION ROUTES
// ==========================================

// 2. Home (Production - Unified Console v7)
// LOCKED to home5.html - No rollback switches
async function renderHomePage(req, res) {
  try {
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    let actionCount = 0;
    let openCount = 0;
    let soaCount = 0;
    let paidCount = 0;

    if (VENDOR_ID_HARDCODED) {
      try {
        const rawCases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);

        // Calculate metrics
        actionCount = rawCases.filter(c => c.status === 'blocked' || c.status === 'waiting_supplier').length;
        openCount = rawCases.filter(c => c.status === 'open').length;
        soaCount = rawCases.filter(c => c.case_type === 'soa').length;
        paidCount = rawCases.filter(c => c.status === 'resolved' || c.status === 'paid').length;
      } catch (error) {
        console.error('Error loading metrics for home:', error);
      }
    }

    res.render('pages/home5.html', {
      user: req.user,
      actionCount: actionCount,
      openCount: openCount,
      soaCount: soaCount,
      paidCount: paidCount
    });
  } catch (error) {
    console.error('Error rendering home:', error);
    res.status(500).render('pages/home5.html', {
      user: req.user,
      actionCount: 0,
      openCount: 0,
      soaCount: 0,
      paidCount: 0,
      error: error.message
    });
  }
}

app.get('/home', renderHomePage);

// ==========================================
// 📄 CASE DETAIL PAGE (Direct Route)
// ==========================================

// Case Detail Page (Full Page Route)
app.get('/cases/:id', async (req, res) => {
  try {
    const caseId = req.params.id;
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    // Validate case ID format (UUID)
    if (!caseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)) {
      return res.status(400).render('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid case ID format'
        }
      });
    }

    if (!VENDOR_ID_HARDCODED) {
      return res.status(500).render('pages/error.html', {
        error: {
          status: 500,
          message: 'DEMO_VENDOR_ID not configured. Please set it in your .env file.'
        }
      });
    }

    // Fetch case detail from adapter
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);

      // Verify vendor has access to this case
      if (caseDetail && caseDetail.vendor_id !== VENDOR_ID_HARDCODED) {
        // For internal users, allow access; for vendors, deny
        if (!req.user?.isInternal) {
          return res.status(403).render('pages/error.html', {
            error: {
              status: 403,
              message: 'Access denied to this case'
            }
          });
        }
      }
    } catch (adapterError) {
      console.error('Adapter error loading case detail:', adapterError);

      // If case not found, render page with empty state (not an error)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message.includes('not found')) {
        caseDetail = null;
      } else {
        // Other errors: show error page
        return res.status(500).render('pages/error.html', {
          error: {
            status: 500,
            message: 'Failed to load case details'
          }
        });
      }
    }

    // Render full page with case detail
    res.render('pages/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      user: req.user
    });
  } catch (error) {
    console.error('Error in GET /cases/:id:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'An error occurred while loading the case'
      }
    });
  }
});

// ==========================================
// 🔄 LEGACY REDIRECTS (Handle Old Traffic)
// ==========================================
// Legacy redirects - all experimental routes redirect to canonical /home
const legacyHomeRoutes = ['/home2', '/home3', '/home4', '/home5', '/dashboard'];
legacyHomeRoutes.forEach(route => {
  app.get(route, (req, res) => res.redirect(302, '/home'));
});

// ==========================================
// 📦 HTMX PARTIALS (The "Cells")
// ==========================================
// Note: All partials are explicitly whitelisted via individual routes below.
// Future: Consider consolidating into a single handler with ALLOWED_PARTIALS whitelist.

app.get('/partials/case-inbox.html', async (req, res) => {
  try {
    // Fetch REAL data from Supabase
    // Note: For Day 1 without auth, hardcode the vendor_id from your seed data
    // run `select id from vmp_vendors` to get it.
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    if (!VENDOR_ID_HARDCODED) {
      return res.status(500).render('partials/case_inbox.html', {
        cases: [],
        error: 'DEMO_VENDOR_ID not configured. Please set it in your .env file.'
      });
    }

    const cases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);
    res.render('partials/case_inbox.html', { cases });
  } catch (error) {
    console.error('Error loading case inbox:', error);
    res.status(500).render('partials/case_inbox.html', {
      cases: [],
      error: error.message
    });
  }
});

app.get('/partials/case-detail.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    if (!caseId) {
      return res.render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        isInternal: req.user?.isInternal || false
      });
    }

    if (!VENDOR_ID_HARDCODED) {
      return res.status(500).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        isInternal: req.user?.isInternal || false,
        error: 'DEMO_VENDOR_ID not configured'
      });
    }

    // Fetch case detail from adapter
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
    } catch (adapterError) {
      console.error('Adapter error:', adapterError);
      // Continue with null caseDetail - template handles it gracefully
    }

    res.render('partials/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error loading case detail:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: null,
      caseDetail: null,
      error: error.message
    });
  }
});

// Case Thread Partial
app.get('/partials/case-thread.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_thread.html', { caseId: null, messages: [] });
    }

    // Fetch messages from adapter
    let messages = [];
    try {
      messages = await vmpAdapter.getMessages(caseId);
    } catch (adapterError) {
      console.error('Adapter error loading messages:', adapterError);
      // Return 200 with error message for graceful degradation
      return res.status(200).render('partials/case_thread.html', {
        caseId,
        messages: [],
        error: `Failed to load messages: ${adapterError.message}`
      });
    }

    res.render('partials/case_thread.html', { caseId, messages });
  } catch (error) {
    console.error('Error loading case thread:', error);
    res.status(500).render('partials/case_thread.html', {
      caseId: req.query.case_id || null,
      messages: [],
      error: error.message
    });
  }
});

// Case Checklist Partial
app.get('/partials/case-checklist.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_checklist.html', {
        caseId: null,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false
      });
    }

    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
    let checklistSteps = [];

    try {
      // Get case detail to determine case type
      let caseDetail = null;
      if (VENDOR_ID_HARDCODED) {
        try {
          caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
        } catch (adapterError) {
          console.error('Adapter error loading case for checklist:', adapterError);
        }
      }

      // Ensure checklist steps exist (create if missing based on case type)
      if (caseDetail && caseDetail.case_type) {
        try {
          checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
        } catch (ensureError) {
          console.error('Error ensuring checklist steps:', ensureError);
          // Try to get existing steps even if ensure failed
          try {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          } catch (getError) {
            console.error('Error getting checklist steps:', getError);
            // Continue with empty array
          }
        }
      } else {
        // Case type unknown, just get existing steps
        try {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        } catch (getError) {
          console.error('Error getting checklist steps:', getError);
          // Continue with empty array
        }
      }
    } catch (adapterError) {
      console.error('Adapter error loading checklist:', adapterError);
      // Continue with empty checklistSteps array
    }

    res.render('partials/case_checklist.html', {
      caseId,
      checklistSteps,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error loading case checklist:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.query.case_id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// Case Evidence Partial
app.get('/partials/case-evidence.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_evidence.html', { caseId: null, evidence: [] });
    }

    // Fetch evidence from adapter
    let evidence = [];
    try {
      evidence = await vmpAdapter.getEvidence(caseId);

      // Generate signed URLs for each evidence file (in parallel with timeout protection)
      // Use Promise.allSettled to ensure all promises complete even if some fail
      const urlPromises = evidence.map(async (ev) => {
        // Add timeout wrapper to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Signed URL generation timeout')), 3000); // 3 second timeout per URL
        });

        try {
          const signedUrlPromise = vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600); // 1 hour expiry
          ev.download_url = await Promise.race([signedUrlPromise, timeoutPromise]);
        } catch (urlError) {
          console.error(`Error generating signed URL for ${ev.storage_path}:`, urlError);
          ev.download_url = '#'; // Fallback
        }
      });
      // Use allSettled to continue even if some URLs fail to generate
      await Promise.allSettled(urlPromises);
    } catch (adapterError) {
      console.error('Adapter error loading evidence:', adapterError);
      // Continue with empty evidence array
    }

    res.render('partials/case_evidence.html', { caseId, evidence });
  } catch (error) {
    console.error('Error loading case evidence:', error);
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.query.case_id || null,
      evidence: [],
      error: error.message
    });
  }
});

// Escalation Partial
app.get('/partials/escalation.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    let caseDetail = null;
    let directorInfo = null;

    if (caseId) {
      if (!req.user) {
        return res.status(401).render('partials/escalation.html', {
          caseId,
          caseDetail: null,
          isInternal: false,
          error: 'Authentication required'
        });
      }

      try {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);

        // If Level 3 escalation, fetch Director info
        if (caseDetail && caseDetail.escalation_level >= 3) {
          const groupId = caseDetail.group_id || null;
          try {
            directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
          } catch (directorError) {
            console.error('Error fetching director info:', directorError);
            // Continue without director info
          }
        }
      } catch (adapterError) {
        console.error('Adapter error loading case for escalation:', adapterError);
        // Continue with null caseDetail
      }
    }

    res.render('partials/escalation.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      directorInfo: directorInfo || null
    });
  } catch (error) {
    console.error('Error loading escalation:', error);
    res.status(500).render('partials/escalation.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// GET: Case Row Partial (Single Case Row for HTMX Refresh)
app.get('/partials/case-row.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;

    if (!caseId) {
      return res.status(400).render('partials/case_row.html', {
        case: null,
        error: 'Case ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).render('partials/case_row.html', {
        case: null,
        error: 'Authentication required'
      });
    }

    // Fetch single case
    let caseData = null;
    try {
      caseData = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);
      if (!caseData) {
        return res.status(404).render('partials/case_row.html', {
          case: null,
          error: 'Case not found or access denied'
        });
      }
    } catch (adapterError) {
      console.error('Adapter error fetching case row:', adapterError);
      return res.status(500).render('partials/case_row.html', {
        case: null,
        error: `Failed to load case: ${adapterError.message}`
      });
    }

    res.render('partials/case_row.html', {
      case: caseData,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/case-row.html:', error);
    res.status(500).render('partials/case_row.html', {
      case: null,
      error: error.message
    });
  }
});

// POST: Create Message
app.post('/cases/:id/messages', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { body } = req.body;

    if (!caseId) {
      return res.status(400).render('partials/case_thread.html', {
        caseId: null,
        messages: [],
        error: 'Case ID is required'
      });
    }

    if (!body || !body.trim()) {
      // Return refreshed thread without error (just ignore empty message)
      try {
        const messages = await vmpAdapter.getMessages(caseId);
        return res.render('partials/case_thread.html', { caseId, messages });
      } catch (error) {
        return res.status(500).render('partials/case_thread.html', {
          caseId,
          messages: [],
          error: 'Failed to refresh thread'
        });
      }
    }

    // Get user context (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_thread.html', {
        caseId,
        messages: [],
        error: 'Authentication required'
      });
    }

    // Create message
    let messageCreated = false;
    try {
      await vmpAdapter.createMessage(
        caseId,
        body.trim(),
        'vendor', // sender_type
        'portal', // channel_source
        user.id, // sender_user_id
        false // is_internal_note
      );
      messageCreated = true;
    } catch (createError) {
      console.error('Error creating message:', createError);
      // Still try to return refreshed thread (graceful degradation)
    }

    // Return refreshed thread with new message
    try {
      const messages = await vmpAdapter.getMessages(caseId);
      return res.render('partials/case_thread.html', { caseId, messages });
    } catch (error) {
      console.error('Error refreshing thread after message creation:', error);
      // If message was created but refresh fails, return 500 (error path)
      // If message creation failed, return 200 (graceful degradation)
      const statusCode = messageCreated ? 500 : 200;
      return res.status(statusCode).render('partials/case_thread.html', {
        caseId,
        messages: [],
        error: `Failed to refresh thread: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/messages:', error);
    res.status(500).render('partials/case_thread.html', {
      caseId: req.params.id || null,
      messages: [],
      error: error.message
    });
  }
});

// POST: Upload Evidence
app.post('/cases/:id/evidence', upload.single('file'), async (req, res) => {
  try {
    const caseId = req.params.id;
    const { evidence_type, checklist_step_id } = req.body;
    const file = req.file;

    // Validate file is present
    if (!file) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'File is required'
      });
    }

    if (!caseId) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId: null,
        evidence: [],
        error: 'Case ID is required'
      });
    }

    if (!file) {
      // File is required for evidence upload
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'File is required'
      });
    }

    if (!evidence_type) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence type is required'
      });
    }

    // Get user context (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Authentication required'
      });
    }

    // Verify case belongs to vendor (security check)
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
    if (VENDOR_ID_HARDCODED) {
      try {
        const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
        if (!caseDetail) {
          return res.status(404).render('partials/case_evidence.html', {
            caseId,
            evidence: [],
            error: 'Case not found'
          });
        }
      } catch (checkError) {
        return res.status(403).render('partials/case_evidence.html', {
          caseId,
          evidence: [],
          error: 'Access denied to this case'
        });
      }
    }

    // Upload evidence
    try {
      await vmpAdapter.uploadEvidence(
        caseId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        },
        evidence_type,
        checklist_step_id || null,
        'vendor',
        user.id
      );
    } catch (uploadError) {
      console.error('Error uploading evidence:', uploadError);
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: `Failed to upload evidence: ${uploadError.message}`
      });
    }

    // Return refreshed evidence and checklist
    try {
      // Get updated evidence
      const evidence = await vmpAdapter.getEvidence(caseId);
      // Generate signed URLs in parallel with timeout protection
      const urlPromises = evidence.map(async (ev) => {
        // Add timeout wrapper to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Signed URL generation timeout')), 3000); // 3 second timeout per URL
        });

        try {
          const signedUrlPromise = vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600);
          ev.download_url = await Promise.race([signedUrlPromise, timeoutPromise]);
        } catch (urlError) {
          ev.download_url = '#';
        }
      });
      // Use allSettled to continue even if some URLs fail to generate
      await Promise.allSettled(urlPromises);

      // Return evidence partial (HTMX will refresh checklist separately)
      return res.render('partials/case_evidence.html', { caseId, evidence });
    } catch (error) {
      console.error('Error refreshing evidence after upload:', error);
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence uploaded but failed to refresh view'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/evidence:', error);
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.params.id || null,
      evidence: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Verify Evidence
app.post('/cases/:id/verify-evidence', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { checklist_step_id } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can verify evidence
    if (!user.isInternal) {
      return res.status(403).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Only internal staff can verify evidence'
      });
    }

    if (!checklist_step_id) {
      return res.status(400).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'checklist_step_id is required'
      });
    }

    // Verify evidence
    try {
      await vmpAdapter.verifyEvidence(checklist_step_id, user.id, null);
    } catch (verifyError) {
      console.error('Error verifying evidence:', verifyError);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false,
        error: `Failed to verify evidence: ${verifyError.message}`
      });
    }

    // Day 11: Create notification for vendor (evidence verified)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_verified',
        'Evidence Verified',
        'Your evidence has been verified by internal staff.'
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail verification if notification fails
    }

    // Return refreshed checklist
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (VENDOR_ID_HARDCODED) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
          if (caseDetail && caseDetail.case_type) {
            checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
          } else {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          }
        } catch (error) {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        }
      } else {
        checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
      }

      return res.render('partials/case_checklist.html', { caseId, checklistSteps });
    } catch (error) {
      console.error('Error refreshing checklist after verify:', error);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Evidence verified but failed to refresh checklist'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/verify-evidence:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Reject Evidence
app.post('/cases/:id/reject-evidence', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { checklist_step_id, reason } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can reject evidence
    if (!user.isInternal) {
      return res.status(403).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Only internal staff can reject evidence'
      });
    }

    if (!checklist_step_id || !reason || !reason.trim()) {
      return res.status(400).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'checklist_step_id and reason are required'
      });
    }

    // Reject evidence
    try {
      await vmpAdapter.rejectEvidence(checklist_step_id, user.id, reason.trim());
    } catch (rejectError) {
      console.error('Error rejecting evidence:', rejectError);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false,
        error: `Failed to reject evidence: ${rejectError.message}`
      });
    }

    // Day 11: Create notification for vendor (evidence rejected)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_rejected',
        'Evidence Rejected',
        `Your evidence was rejected. Reason: ${reason.trim()}`
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail rejection if notification fails
    }

    // Return refreshed checklist
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (VENDOR_ID_HARDCODED) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
          if (caseDetail && caseDetail.case_type) {
            checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
          } else {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          }
        } catch (error) {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        }
      } else {
        checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
      }

      return res.render('partials/case_checklist.html', { caseId, checklistSteps });
    } catch (error) {
      console.error('Error refreshing checklist after reject:', error);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Evidence rejected but failed to refresh checklist'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/reject-evidence:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Reassign Case
app.post('/cases/:id/reassign', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { owner_team } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can reassign cases
    if (!user.isInternal) {
      return res.status(403).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Only internal staff can reassign cases'
      });
    }

    if (!owner_team || !['procurement', 'ap', 'finance'].includes(owner_team)) {
      return res.status(400).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'owner_team must be one of: procurement, ap, finance'
      });
    }

    // Reassign case
    try {
      await vmpAdapter.reassignCase(caseId, owner_team, user.id);
    } catch (reassignError) {
      console.error('Error reassigning case:', reassignError);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: `Failed to reassign case: ${reassignError.message}`
      });
    }

    // Return refreshed case detail
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (VENDOR_ID_HARDCODED) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail });
    } catch (error) {
      console.error('Error refreshing case detail after reassign:', error);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Case reassigned but failed to refresh detail'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/reassign:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Update Case Status
app.post('/cases/:id/update-status', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { status } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can update case status
    if (!user.isInternal) {
      return res.status(403).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Only internal staff can update case status'
      });
    }

    if (!status || !['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'].includes(status)) {
      return res.status(400).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'
      });
    }

    // Update case status
    try {
      await vmpAdapter.updateCaseStatus(caseId, status, user.id);
    } catch (updateError) {
      console.error('Error updating case status:', updateError);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: `Failed to update case status: ${updateError.message}`
      });
    }

    // Return refreshed case detail
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (VENDOR_ID_HARDCODED) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail });
    } catch (error) {
      console.error('Error refreshing case detail after status update:', error);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Case status updated but failed to refresh detail'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/update-status:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      error: error.message
    });
  }
});

// POST: Escalate Case
app.post('/cases/:id/escalate', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { escalation_level, reason } = req.body;

    if (!req.user) {
      return res.status(401).render('partials/escalation.html', {
        caseId,
        caseDetail: null,
        isInternal: false,
        error: 'Authentication required'
      });
    }

    if (!caseId) {
      return res.status(400).render('partials/escalation.html', {
        caseId: null,
        caseDetail: null,
        isInternal: req.user?.isInternal || false,
        error: 'Case ID is required'
      });
    }

    const escalationLevel = parseInt(escalation_level, 10);
    if (!escalationLevel || escalationLevel < 1 || escalationLevel > 3) {
      return res.status(400).render('partials/escalation.html', {
        caseId,
        caseDetail: null,
        isInternal: req.user?.isInternal || false,
        error: 'Invalid escalation level (must be 1-3)'
      });
    }

    // Verify case exists and user has access
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);
      if (!caseDetail) {
        return res.status(404).render('partials/escalation.html', {
          caseId,
          caseDetail: null,
          isInternal: req.user?.isInternal || false,
          error: 'Case not found or access denied'
        });
      }
    } catch (adapterError) {
      console.error('Adapter error fetching case for escalation:', adapterError);
      return res.status(500).render('partials/escalation.html', {
        caseId,
        caseDetail: null,
        isInternal: req.user?.isInternal || false,
        error: `Failed to load case: ${adapterError.message}`
      });
    }

    // Level 3 requires Break Glass Protocol
    if (escalationLevel === 3) {
      // Get group_id from case (or use mock for Sprint 1)
      const groupId = caseDetail.group_id || null;

      // Get Director info (mock for Sprint 1, real DB in Sprint 2)
      let directorInfo = null;
      try {
        directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
      } catch (directorError) {
        console.error('Error fetching director info (using mock):', directorError);
        // Continue with mock data for Sprint 1
      }

      // Log Break Glass event
      try {
        await vmpAdapter.logBreakGlass(caseId, req.user.id, groupId, directorInfo);
      } catch (breakGlassError) {
        console.error('Error logging break glass event:', breakGlassError);
        // Continue with escalation even if logging fails
      }
    }

    // Perform escalation
    try {
      const updatedCase = await vmpAdapter.escalateCase(
        caseId,
        escalationLevel,
        req.user.id,
        reason || null
      );

      // Fetch updated case detail with all relations
      caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);

      // For Level 3, get Director info to display
      let directorInfo = null;
      if (escalationLevel === 3) {
        const groupId = caseDetail.group_id || null;
        try {
          directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
        } catch (directorError) {
          console.error('Error fetching director info after escalation:', directorError);
        }
      }

      // Re-render escalation partial with updated data
      res.render('partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        directorInfo: directorInfo || null
      });
    } catch (escalateError) {
      console.error('Error escalating case:', escalateError);
      res.status(500).render('partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        error: `Failed to escalate case: ${escalateError.message}`
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/escalate:', error);
    res.status(500).render('partials/escalation.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// ============================================================================
// SPRINT 2: Invoice Transparency + Manual Ingest
// ============================================================================

// GET: Ops Ingest Page (Internal Only)
app.get('/ops/ingest', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    // Get org tree for scope selection
    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    res.render('pages/ops_ingest.html', {
      title: 'Data Ingest',
      orgTree,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops/ingest:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load ingest page'
      }
    });
  }
});

// POST: Ingest Invoices from CSV (Internal Only)
app.post('/ops/ingest/invoices', upload.single('csv_file'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).json({
        error: 'Access denied. Internal users only.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'text/csv' &&
      req.file.mimetype !== 'application/vnd.ms-excel' &&
      !req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({
        error: 'File must be a CSV file'
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required'
      });
    }

    // Validate company_id format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company_id)) {
      return res.status(400).json({
        error: 'Invalid company_id format'
      });
    }

    // Ingest invoices
    const result = await vmpAdapter.ingestInvoicesFromCSV(
      req.file.buffer,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    res.json({
      success: true,
      message: `Ingested ${result.upserted} invoices successfully`,
      total: result.total,
      upserted: result.upserted,
      failed: result.failed,
      errors: result.errors,
      failures: result.failures
    });
  } catch (error) {
    console.error('Error in POST /ops/ingest/invoices:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest invoices'
    });
  }
});

// POST: Ingest Payments from CSV (Internal Only)
app.post('/ops/ingest/payments', upload.single('csv_file'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).json({
        error: 'Access denied. Internal users only.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'text/csv' &&
      req.file.mimetype !== 'application/vnd.ms-excel' &&
      !req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({
        error: 'File must be a CSV file'
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required'
      });
    }

    // Validate company_id format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company_id)) {
      return res.status(400).json({
        error: 'Invalid company_id format'
      });
    }

    // Ingest payments
    const result = await vmpAdapter.ingestPaymentsFromCSV(
      req.file.buffer,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    res.json({
      success: true,
      message: `Ingested ${result.upserted} payments successfully, updated ${result.invoicesUpdated} invoices`,
      total: result.total,
      upserted: result.upserted,
      failed: result.failed,
      invoicesUpdated: result.invoicesUpdated,
      errors: result.errors,
      failures: result.failures
    });
  } catch (error) {
    console.error('Error in POST /ops/ingest/payments:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest payments'
    });
  }
});

// POST: Ingest Remittances (Bulk PDF Upload - Internal Only)
app.post('/ops/ingest/remittances', upload.array('remittance_files', 50), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).json({
        error: 'Access denied. Internal users only.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'At least one PDF file is required'
      });
    }

    // Validate all files are PDFs
    const invalidFiles = req.files.filter(file =>
      file.mimetype !== 'application/pdf' && !file.originalname.endsWith('.pdf')
    );

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'All files must be PDF format',
        invalidFiles: invalidFiles.map(f => f.originalname)
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required'
      });
    }

    // Validate company_id format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company_id)) {
      return res.status(400).json({
        error: 'Invalid company_id format'
      });
    }

    // Ingest remittances
    const result = await vmpAdapter.ingestRemittances(
      req.files,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    res.json({
      success: true,
      message: `Processed ${result.processed} remittance files successfully`,
      total: result.total,
      processed: result.processed,
      failed: result.failed,
      results: result.results,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error in POST /ops/ingest/remittances:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest remittances'
    });
  }
});

// ============================================================================
// SPRINT 4: Payment Visibility + Remittance Drop
// ============================================================================

// GET: Payment List Page
app.get('/payments', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    res.render('pages/payments.html', {
      title: 'Payments',
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error in GET /payments:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load payments page'
      }
    });
  }
});

// GET: Payment List Partial
app.get('/partials/payment-list.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/payment_list.html', {
        payments: [],
        error: 'Authentication required'
      });
    }

    const { payment_ref, invoice_num, date_from, date_to, company_id } = req.query;
    const filters = {};
    if (payment_ref) filters.payment_ref = payment_ref;
    if (invoice_num) filters.invoice_num = invoice_num;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;

    const payments = await vmpAdapter.getPayments(
      req.user.vendorId,
      company_id || null,
      filters
    );

    res.render('partials/payment_list.html', {
      payments: payments || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/payment-list.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/payment_list.html', {
      payments: [],
      error: error.message || 'Failed to load payments'
    });
  }
});

// GET: Payment Detail Page
app.get('/payments/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const paymentId = req.params.id;

    // Validate paymentId format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId)) {
      return res.status(400).render('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid payment ID format'
        }
      });
    }

    // Fetch payment detail from adapter
    let paymentDetail = null;
    try {
      paymentDetail = await vmpAdapter.getPaymentDetail(paymentId, req.user.vendorId);

      // Verify vendor has access to this payment
      if (paymentDetail && paymentDetail.vendor_id !== req.user.vendorId) {
        // For internal users, allow access; for vendors, deny
        if (!req.user?.isInternal) {
          return res.status(403).render('pages/error.html', {
            error: {
              status: 403,
              message: 'Access denied to this payment'
            }
          });
        }
      }
    } catch (adapterError) {
      console.error('Adapter error loading payment detail:', adapterError);

      // If payment not found, render page with empty state (not an error)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message.includes('not found')) {
        paymentDetail = null;
      } else {
        // Other errors: show error page
        return res.status(500).render('pages/error.html', {
          error: {
            status: 500,
            message: 'Failed to load payment details'
          }
        });
      }
    }

    // Render full page with payment detail
    res.render('pages/payment_detail.html', {
      paymentId,
      paymentDetail,
      isInternal: req.user?.isInternal || false,
      user: req.user
    });
  } catch (error) {
    console.error('Error in GET /payments/:id:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'An error occurred while loading the payment'
      }
    });
  }
});

// ============================================================================
// SPRINT 5: Supplier Profile & Compliance (VMP-02)
// ============================================================================

// GET: Profile Page
app.get('/profile', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    // Fetch vendor profile
    let vendorProfile = null;
    try {
      vendorProfile = await vmpAdapter.getVendorProfile(req.user.vendorId);

      if (!vendorProfile) {
        return res.status(404).render('pages/error.html', {
          error: {
            status: 404,
            message: 'Vendor profile not found'
          }
        });
      }
    } catch (adapterError) {
      console.error('Adapter error loading vendor profile:', adapterError);
      return res.status(500).render('pages/error.html', {
        error: {
          status: 500,
          message: 'Failed to load vendor profile'
        }
      });
    }

    res.render('pages/profile.html', {
      title: 'Profile',
      vendorProfile,
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error in GET /profile:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'An error occurred while loading the profile'
      }
    });
  }
});

// GET: Profile Form Partial
app.get('/partials/profile-form.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/profile_form.html', {
        vendorProfile: null,
        error: 'Authentication required'
      });
    }

    const vendorProfile = await vmpAdapter.getVendorProfile(req.user.vendorId);

    if (!vendorProfile) {
      return res.status(404).render('partials/profile_form.html', {
        vendorProfile: null,
        error: 'Vendor profile not found'
      });
    }

    res.render('partials/profile_form.html', {
      vendorProfile,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/profile-form.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/profile_form.html', {
      vendorProfile: null,
      error: error.message || 'Failed to load profile form'
    });
  }
});

// POST: Bank Details Change Request
app.post('/profile/bank-details', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const {
      account_name,
      account_number,
      bank_name,
      swift_code,
      branch_address,
      currency
    } = req.body;

    // Validate required fields
    if (!account_name || !account_number || !bank_name || !swift_code) {
      return res.status(400).json({
        error: 'Missing required fields: account_name, account_number, bank_name, swift_code'
      });
    }

    // Create bank details change case
    const newCase = await vmpAdapter.requestBankDetailsChange(
      req.user.vendorId,
      {
        account_name,
        account_number,
        bank_name,
        swift_code,
        branch_address: branch_address || null,
        currency: currency || null
      },
      req.user.id
    );

    // Redirect to the case detail page
    res.redirect(`/cases/${newCase.id}`);
  } catch (error) {
    console.error('Error in POST /profile/bank-details:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to request bank details change'
    });
  }
});

// ============================================================================
// SPRINT 6: Command Center (Internal Ops + Org Tree)
// ============================================================================

// GET: Command Center Home (Internal Only)
app.get('/ops', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    res.render('pages/ops_command_center.html', {
      title: 'Command Center',
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load command center'
      }
    });
  }
});

// GET: Org Tree Sidebar Partial
app.get('/partials/org-tree-sidebar.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/org_tree_sidebar.html', {
        orgTree: null,
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).render('partials/org_tree_sidebar.html', {
        orgTree: null,
        error: 'Access denied. Internal users only.'
      });
    }

    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    res.render('partials/org_tree_sidebar.html', {
      orgTree,
      error: null,
      currentScope: {
        type: req.query.scope_type || null,
        id: req.query.scope_id || null
      }
    });
  } catch (error) {
    console.error('Error in GET /partials/org-tree-sidebar.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/org_tree_sidebar.html', {
      orgTree: null,
      error: error.message || 'Failed to load organization tree'
    });
  }
});

// GET: Scoped Dashboard
app.get('/ops/dashboard', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    const { scope_type, scope_id } = req.query;

    // If no scope provided, use user's default scope
    let finalScopeType = scope_type;
    let finalScopeId = scope_id;

    if (!finalScopeType || !finalScopeId) {
      // Get user context to determine default scope
      const userContext = await vmpAdapter.getVendorContext(req.user.id);
      if (userContext.scope_group_id) {
        finalScopeType = 'group';
        finalScopeId = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        finalScopeType = 'company';
        finalScopeId = userContext.scope_company_id;
      } else {
        // Super admin: show tenant view (all groups/companies)
        // For now, redirect to /ops (command center home)
        return res.redirect('/ops');
      }
    }

    res.render('pages/ops_dashboard.html', {
      title: 'Dashboard',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops/dashboard:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load dashboard'
      }
    });
  }
});

// GET: Scoped Dashboard Partial
app.get('/partials/scoped-dashboard.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/scoped_dashboard.html', {
        dashboard: null,
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).render('partials/scoped_dashboard.html', {
        dashboard: null,
        error: 'Access denied. Internal users only.'
      });
    }

    const { scope_type, scope_id } = req.query;

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/scoped_dashboard.html', {
        dashboard: null,
        error: 'scope_type and scope_id are required'
      });
    }

    const dashboard = await vmpAdapter.getScopedDashboard(scope_type, scope_id, req.user.id);

    res.render('partials/scoped_dashboard.html', {
      dashboard,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/scoped-dashboard.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/scoped_dashboard.html', {
      dashboard: null,
      error: error.message || 'Failed to load dashboard'
    });
  }
});

// GET: Ops Case Queue
app.get('/ops/cases', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    const { scope_type, scope_id } = req.query;

    // If no scope provided, use user's default scope
    let finalScopeType = scope_type;
    let finalScopeId = scope_id;

    if (!finalScopeType || !finalScopeId) {
      const userContext = await vmpAdapter.getVendorContext(req.user.id);
      if (userContext.scope_group_id) {
        finalScopeType = 'group';
        finalScopeId = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        finalScopeType = 'company';
        finalScopeId = userContext.scope_company_id;
      } else {
        return res.redirect('/ops');
      }
    }

    res.render('pages/ops_cases.html', {
      title: 'Case Queue',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops/cases:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load case queue'
      }
    });
  }
});

// GET: Ops Case Queue Partial
app.get('/partials/ops-case-queue.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/ops_case_queue.html', {
        cases: [],
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).render('partials/ops_case_queue.html', {
        cases: [],
        error: 'Access denied. Internal users only.'
      });
    }

    const { scope_type, scope_id, status, owner_team, case_type } = req.query;

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/ops_case_queue.html', {
        cases: [],
        error: 'scope_type and scope_id are required'
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (owner_team) filters.owner_team = owner_team;
    if (case_type) filters.case_type = case_type;

    const cases = await vmpAdapter.getOpsCaseQueue(scope_type, scope_id, req.user.id, filters);

    res.render('partials/ops_case_queue.html', {
      cases,
      filters: { status, owner_team, case_type },
      scopeType: scope_type,
      scopeId: scope_id,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/ops-case-queue.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/ops_case_queue.html', {
      cases: [],
      error: error.message || 'Failed to load case queue'
    });
  }
});

// GET: Vendor Directory
app.get('/ops/vendors', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    const { scope_type, scope_id } = req.query;

    // If no scope provided, use user's default scope
    let finalScopeType = scope_type;
    let finalScopeId = scope_id;

    if (!finalScopeType || !finalScopeId) {
      const userContext = await vmpAdapter.getVendorContext(req.user.id);
      if (userContext.scope_group_id) {
        finalScopeType = 'group';
        finalScopeId = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        finalScopeType = 'company';
        finalScopeId = userContext.scope_company_id;
      } else {
        return res.redirect('/ops');
      }
    }

    res.render('pages/ops_vendors.html', {
      title: 'Vendor Directory',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops/vendors:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load vendor directory'
      }
    });
  }
});

// GET: Decision Log Partial
app.get('/partials/decision-log.html', async (req, res) => {
  try {
    const { case_id } = req.query;

    if (!case_id) {
      return res.render('partials/decision_log.html', {
        caseId: null,
        decisions: [],
        error: 'case_id is required'
      });
    }

    // Validate case_id format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(case_id)) {
      return res.status(400).render('partials/decision_log.html', {
        caseId: case_id,
        decisions: [],
        error: 'Invalid case_id format'
      });
    }

    // Fetch decision log
    let decisions = [];
    try {
      decisions = await vmpAdapter.getDecisionLog(case_id);
    } catch (adapterError) {
      console.error('Adapter error loading decision log:', adapterError);
      return res.render('partials/decision_log.html', {
        caseId: case_id,
        decisions: [],
        error: 'Failed to load decision log'
      });
    }

    res.render('partials/decision_log.html', {
      caseId: case_id,
      decisions,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/decision-log.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/decision_log.html', {
      caseId: req.query.case_id || null,
      decisions: [],
      error: error.message || 'Failed to load decision log'
    });
  }
});

// GET: Vendor Directory Partial
app.get('/partials/vendor-directory.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/vendor_directory.html', {
        vendors: [],
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).render('partials/vendor_directory.html', {
        vendors: [],
        error: 'Access denied. Internal users only.'
      });
    }

    const { scope_type, scope_id, status } = req.query;

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/vendor_directory.html', {
        vendors: [],
        error: 'scope_type and scope_id are required'
      });
    }

    const filters = {};
    if (status) filters.status = status;

    const vendors = await vmpAdapter.getVendorDirectory(scope_type, scope_id, req.user.id, filters);

    res.render('partials/vendor_directory.html', {
      vendors,
      filters: { status },
      scopeType: scope_type,
      scopeId: scope_id,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/vendor-directory.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/vendor_directory.html', {
      vendors: [],
      error: error.message || 'Failed to load vendor directory'
    });
  }
});

// GET: Internal Ops Case Detail
app.get('/ops/cases/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    const caseId = req.params.id;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)) {
      return res.status(400).render('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid case ID format'
        }
      });
    }

    // Get case detail for internal users
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetailForOps(caseId, req.user.id);
      
      if (!caseDetail) {
        return res.status(404).render('pages/error.html', {
          error: {
            status: 404,
            message: 'Case not found'
          }
        });
      }
    } catch (adapterError) {
      console.error('Adapter error loading case detail:', adapterError);
      return res.status(500).render('pages/error.html', {
        error: {
          status: 500,
          message: 'Failed to load case details'
        }
      });
    }

    res.render('pages/ops_case_detail.html', {
      caseId,
      caseDetail,
      isInternal: true,
      user: req.user
    });
  } catch (error) {
    console.error('Error in GET /ops/cases/:id:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'An error occurred while loading the case'
      }
    });
  }
});

// GET: Compliance Docs Partial
app.get('/partials/compliance-docs.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/compliance_docs.html', {
        complianceDocs: [],
        error: 'Authentication required'
      });
    }

    // Fetch compliance documents from adapter
    let complianceDocs = [];
    try {
      complianceDocs = await vmpAdapter.getComplianceDocuments(req.user.vendorId);
    } catch (adapterError) {
      console.error('Adapter error loading compliance documents:', adapterError);
      return res.render('partials/compliance_docs.html', {
        complianceDocs: [],
        error: 'Failed to load compliance documents'
      });
    }

    res.render('partials/compliance_docs.html', {
      complianceDocs,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/compliance-docs.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/compliance_docs.html', {
      complianceDocs: [],
      error: error.message || 'Failed to load compliance documents'
    });
  }
});

// GET: Contract Library Partial
app.get('/partials/contract-library.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/contract_library.html', {
        contracts: [],
        error: 'Authentication required'
      });
    }

    // Fetch contracts from adapter
    let contracts = [];
    try {
      contracts = await vmpAdapter.getContractLibrary(req.user.vendorId);
    } catch (adapterError) {
      console.error('Adapter error loading contracts:', adapterError);
      return res.render('partials/contract_library.html', {
        contracts: [],
        error: 'Failed to load contracts'
      });
    }

    res.render('partials/contract_library.html', {
      contracts,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/contract-library.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/contract_library.html', {
      contracts: [],
      error: error.message || 'Failed to load contracts'
    });
  }
});

// GET: Remittance Viewer Partial
app.get('/partials/remittance-viewer.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/remittance_viewer.html', {
        remittanceUrl: null,
        error: 'Authentication required'
      });
    }

    const { payment_id } = req.query;
    if (!payment_id) {
      return res.status(400).render('partials/remittance_viewer.html', {
        remittanceUrl: null,
        error: 'payment_id is required'
      });
    }

    // Get payment detail to retrieve remittance URL
    const payment = await vmpAdapter.getPaymentDetail(payment_id, req.user.vendorId);

    if (!payment) {
      return res.status(404).render('partials/remittance_viewer.html', {
        remittanceUrl: null,
        error: 'Payment not found'
      });
    }

    if (!payment.remittance_url) {
      return res.render('partials/remittance_viewer.html', {
        remittanceUrl: null,
        error: 'No remittance document available for this payment'
      });
    }

    res.render('partials/remittance_viewer.html', {
      remittanceUrl: payment.remittance_url,
      payment: payment,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/remittance-viewer.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/remittance_viewer.html', {
      remittanceUrl: null,
      error: error.message || 'Failed to load remittance viewer'
    });
  }
});

// GET: Invoice List Page
app.get('/invoices', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    res.render('pages/invoices.html', {
      title: 'Invoices',
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error in GET /invoices:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load invoices page'
      }
    });
  }
});

// GET: Invoice List Partial
app.get('/partials/invoice-list.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/invoice_list.html', {
        invoices: [],
        error: 'Authentication required'
      });
    }

    const { status, search, company_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    const invoices = await vmpAdapter.getInvoices(
      req.user.vendorId,
      company_id || null,
      filters
    );

    res.render('partials/invoice_list.html', {
      invoices: invoices || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/invoice-list.html:', error);
    res.status(500).render('partials/invoice_list.html', {
      invoices: [],
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// GET: Invoice Detail Page
app.get('/invoices/:id', async (req, res) => {
  try {
    const invoiceId = req.params.id;

    if (!req.user) {
      return res.redirect('/login');
    }

    if (!invoiceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) {
      return res.status(400).render('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid invoice ID format'
        }
      });
    }

    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);

    if (!invoice) {
      return res.status(404).render('pages/error.html', {
        error: {
          status: 404,
          message: 'Invoice not found or access denied'
        }
      });
    }

    res.render('pages/invoice_detail.html', {
      title: `Invoice ${invoice.invoice_num}`,
      invoiceId,
      invoice,
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error in GET /invoices/:id:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load invoice'
      }
    });
  }
});

// GET: Invoice Detail Partial
app.get('/partials/invoice-detail.html', async (req, res) => {
  try {
    const invoiceId = req.query.invoice_id;

    if (!req.user) {
      return res.status(401).render('partials/invoice_detail.html', {
        invoice: null,
        error: 'Authentication required'
      });
    }

    if (!invoiceId) {
      return res.status(400).render('partials/invoice_detail.html', {
        invoice: null,
        error: 'Invoice ID is required'
      });
    }

    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);

    if (!invoice) {
      return res.status(404).render('partials/invoice_detail.html', {
        invoice: null,
        error: 'Invoice not found or access denied'
      });
    }

    res.render('partials/invoice_detail.html', {
      invoice,
      isInternal: req.user?.isInternal || false,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/invoice-detail.html:', error);
    res.status(500).render('partials/invoice_detail.html', {
      invoice: null,
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// GET: Matching Status Partial
app.get('/partials/matching-status.html', async (req, res) => {
  try {
    const invoiceId = req.query.invoice_id;

    if (!req.user) {
      return res.status(401).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Authentication required'
      });
    }

    if (!invoiceId) {
      return res.status(400).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invoice ID is required'
      });
    }

    // Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invoice not found or access denied'
      });
    }

    const matchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);

    res.render('partials/matching_status.html', {
      matchingStatus,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/matching-status.html:', error);
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message
    });
  }
});

// POST: Create Case from Invoice
app.post('/invoices/:id/open-case', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { subject } = req.body;

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!invoiceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID format'
      });
    }

    // Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found or access denied'
      });
    }

    // Create case from invoice
    const newCase = await vmpAdapter.createCaseFromInvoice(
      invoiceId,
      req.user.vendorId,
      req.user.id,
      subject || null
    );

    // Redirect to case detail page
    res.redirect(`/cases/${newCase.id}`);
  } catch (error) {
    console.error('Error in POST /invoices/:id/open-case:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to create case from invoice'
    });
  }
});

// ============================================================================
// SPRINT 3: Supplier Onboarding Flow
// ============================================================================

// GET: New Invite Page (Internal Only)
app.get('/ops/invites/new', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (!req.user.isInternal) {
      return res.status(403).render('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.'
        }
      });
    }

    res.render('pages/ops_invite_new.html', {
      title: 'Invite Supplier',
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    console.error('Error in GET /ops/invites/new:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to load invite form'
      }
    });
  }
});

// GET: Invite Form Partial
app.get('/partials/invite-form.html', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).render('partials/invite_form.html', {
        orgTree: null,
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).render('partials/invite_form.html', {
        orgTree: null,
        error: 'Access denied. Internal users only.'
      });
    }

    // Get org tree for company selection
    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    res.render('partials/invite_form.html', {
      orgTree,
      error: null
    });
  } catch (error) {
    console.error('Error in GET /partials/invite-form.html:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/invite_form.html', {
      orgTree: null,
      error: error.message || 'Failed to load invite form'
    });
  }
});

// POST: Create Invite (Internal Only)
app.post('/ops/invites', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).json({
        error: 'Access denied. Internal users only.'
      });
    }

    const { vendor_name, email, company_ids } = req.body;

    if (!vendor_name || !email) {
      return res.status(400).json({
        error: 'vendor_name and email are required'
      });
    }

    // Get user context to determine tenant
    const userContext = await vmpAdapter.getVendorContext(req.user.id);
    if (!userContext.vmp_vendors?.tenant_id) {
      return res.status(400).json({
        error: 'User must be associated with a tenant'
      });
    }

    const tenantId = userContext.vmp_vendors.tenant_id;

    // Create or get vendor
    let vendorId;
    try {
      // Check if vendor already exists
      const existingVendorQuery = supabase
        .from('vmp_vendors')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', vendor_name.trim())
        .single();

      const { data: existingVendor } = await withTimeout(existingVendorQuery, 5000, 'checkExistingVendor');

      if (existingVendor) {
        vendorId = existingVendor.id;
      } else {
        // Create new vendor
        const newVendorQuery = supabase
          .from('vmp_vendors')
          .insert({
            tenant_id: tenantId,
            name: vendor_name.trim(),
            status: 'invited'
          })
          .select('id')
          .single();

        const { data: newVendor, error: vendorError } = await withTimeout(newVendorQuery, 5000, 'createVendor');
        if (vendorError || !newVendor) {
          throw new Error('Failed to create vendor');
        }
        vendorId = newVendor.id;
      }
    } catch (vendorError) {
      console.error('Error creating/getting vendor:', vendorError);
      return res.status(500).json({
        error: 'Failed to create or find vendor'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Parse company_ids (can be array or comma-separated string)
    let companyIdsArray = [];
    if (company_ids) {
      if (Array.isArray(company_ids)) {
        companyIdsArray = company_ids;
      } else if (typeof company_ids === 'string') {
        companyIdsArray = company_ids.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    // Create invite
    const invite = await vmpAdapter.createInvite(
      vendorId,
      email,
      companyIdsArray,
      req.user.id
    );

    const inviteUrl = `${req.protocol}://${req.get('host')}${invite.invite_url}`;

    // Return success message as HTML (for HTMX)
    res.render('partials/invite_form.html', {
      orgTree: await vmpAdapter.getOrgTree(req.user.id),
      error: null,
      success: true,
      inviteUrl: inviteUrl,
      inviteEmail: email
    });
  } catch (error) {
    console.error('Error in POST /ops/invites:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to create invite'
    });
  }
});

// GET: Accept Invite Page
app.get('/accept', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.render('pages/accept.html', {
        error: 'Invite token is required',
        invite: null,
        companies: []
      });
    }

    // Get invite by token
    const invite = await vmpAdapter.getInviteByToken(token);

    if (!invite) {
      return res.render('pages/accept.html', {
        error: 'Invalid or expired invite token',
        invite: null,
        companies: []
      });
    }

    if (invite.expired) {
      return res.render('pages/accept.html', {
        error: 'This invite has expired. Please request a new invite.',
        invite: null,
        companies: []
      });
    }

    if (invite.used) {
      return res.render('pages/accept.html', {
        error: 'This invite has already been used.',
        invite: null,
        companies: []
      });
    }

    // Extract companies from vendor-company links
    const companies = invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];

    res.render('pages/accept.html', {
      error: null,
      invite: {
        id: invite.id,
        email: invite.email,
        vendor: invite.vmp_vendors,
        companies: companies
      },
      token: token
    });
  } catch (error) {
    console.error('Error in GET /accept:', error);
    logError(error, { path: req.path });
    res.status(500).render('pages/accept.html', {
      error: error.message || 'Failed to load invite',
      invite: null,
      companies: []
    });
  }
});

// POST: Accept Invite & Create Account
app.post('/accept', async (req, res) => {
  try {
    const { token, password, password_confirm, display_name } = req.body;

    if (!token) {
      return res.status(400).render('pages/accept.html', {
        error: 'Invite token is required',
        invite: null,
        companies: []
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).render('pages/accept.html', {
        error: 'Password must be at least 8 characters long',
        invite: await vmpAdapter.getInviteByToken(token).catch(() => null),
        companies: [],
        token: token
      });
    }

    if (password !== password_confirm) {
      return res.status(400).render('pages/accept.html', {
        error: 'Passwords do not match',
        invite: await vmpAdapter.getInviteByToken(token).catch(() => null),
        companies: [],
        token: token
      });
    }

    // Get invite by token
    const invite = await vmpAdapter.getInviteByToken(token);

    if (!invite) {
      return res.status(400).render('pages/accept.html', {
        error: 'Invalid or expired invite token',
        invite: null,
        companies: []
      });
    }

    if (invite.expired) {
      return res.status(400).render('pages/accept.html', {
        error: 'This invite has expired. Please request a new invite.',
        invite: null,
        companies: []
      });
    }

    if (invite.used) {
      return res.status(400).render('pages/accept.html', {
        error: 'This invite has already been used.',
        invite: null,
        companies: []
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create vendor user
    const user = await vmpAdapter.createVendorUser(
      invite.vendor_id,
      invite.email,
      passwordHash,
      display_name || null
    );

    // Mark invite as used
    await vmpAdapter.markInviteAsUsed(invite.id, user.id);

    // Create onboarding case
    const companyId = invite.vmp_vendor_company_links?.[0]?.company_id || null;
    const onboardingCase = await vmpAdapter.createOnboardingCase(
      invite.vendor_id,
      companyId
    );

    // Create session and log user in
    const session = await vmpAdapter.createSession(user.id);
    req.session.sessionId = session.sessionId;

    // Redirect to onboarding case
    res.redirect(`/cases/${onboardingCase.id}`);
  } catch (error) {
    console.error('Error in POST /accept:', error);
    logError(error, { path: req.path });

    // Try to get invite for error display
    let invite = null;
    try {
      invite = await vmpAdapter.getInviteByToken(req.body.token);
    } catch (e) {
      // Ignore
    }

    res.status(500).render('pages/accept.html', {
      error: error.message || 'Failed to create account',
      invite: invite,
      companies: invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [],
      token: req.body.token || null
    });
  }
});

// POST: Approve Onboarding (Internal Only)
app.post('/cases/:id/approve-onboarding', async (req, res) => {
  try {
    const caseId = req.params.id;

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.user.isInternal) {
      return res.status(403).json({
        error: 'Access denied. Internal users only.'
      });
    }

    if (!caseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)) {
      return res.status(400).json({
        error: 'Invalid case ID format'
      });
    }

    // Approve onboarding
    const updatedCase = await vmpAdapter.approveOnboarding(caseId, req.user.id);

    // Fetch updated case detail and return refreshed partial
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);
      res.render('partials/case_detail.html', {
        caseId,
        caseDetail,
        isInternal: req.user.isInternal,
        user: req.user
      });
    } catch (refreshError) {
      console.error('Error refreshing case detail after approval:', refreshError);
      // Return JSON fallback if refresh fails
      res.json({
        success: true,
        message: 'Onboarding approved successfully. Vendor account activated.',
        caseId: updatedCase.id
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/approve-onboarding:', error);
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to approve onboarding'
    });
  }
});

// 3. Login (Production - NOIR + Enterprise)
// LOCKED to login3.html - No rollback switches
app.get('/login', (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.sessionId) {
    return res.redirect('/home');
  }
  res.render('pages/login3.html', { error: null });
});

// Legacy login redirects
app.get('/login4', (req, res) => {
  if (req.session?.sessionId) {
    return res.redirect('/home');
  }
  res.redirect(302, '/login');
});

// 3a. Login POST Handler
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('pages/login3.html', {
        error: 'Email and password are required'
      });
    }

    // Get user by email
    const user = await vmpAdapter.getUserByEmail(email);

    if (!user) {
      return res.render('pages/login3.html', {
        error: 'Invalid email or password'
      });
    }

    if (!user.is_active) {
      return res.render('pages/login3.html', {
        error: 'Account is inactive. Please contact support.'
      });
    }

    // Verify password
    const isValid = await vmpAdapter.verifyPassword(user.id, password);

    if (!isValid) {
      return res.render('pages/login3.html', {
        error: 'Invalid email or password'
      });
    }

    // Create session
    const { sessionId } = await vmpAdapter.createSession(user.id, {
      email: user.email,
      loginAt: new Date().toISOString()
    });

    // Set session cookie
    req.session.sessionId = sessionId;
    req.session.userId = user.id;

    // Redirect to home
    res.redirect('/home');
  } catch (error) {
    console.error('Login error:', error);
    res.render('pages/login3.html', {
      error: 'An error occurred during login. Please try again.'
    });
  }
});

// 3b. Logout Handler
app.post('/logout', async (req, res) => {
  const sessionId = req.session?.sessionId;

  if (sessionId) {
    try {
      await vmpAdapter.deleteSession(sessionId);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  req.session = null;
  res.redirect('/login');
});

// 3b. Login3 (Canonical redirect to /login) - handled above
// 3c. Login2/Login4 (Redirect to canonical) - handled above

// 4. Login Partials (HTMX)
app.get('/partials/login-help-access.html', (req, res) => {
  res.render('partials/login-help-access.html');
});

app.get('/partials/login-help-sso.html', (req, res) => {
  res.render('partials/login-help-sso.html');
});

app.get('/partials/login-help-security.html', (req, res) => {
  res.render('partials/login-help-security.html');
});

app.post('/partials/login-mock-success.html', (req, res) => {
  res.render('partials/login-mock-success.html');
});

app.post('/partials/login-mock-magic-sent.html', (req, res) => {
  res.render('partials/login-mock-magic-sent.html');
});

app.get('/partials/login-mock-forgot.html', (req, res) => {
  res.render('partials/login-mock-forgot.html');
});

app.get('/partials/login-mock-sso.html', (req, res) => {
  res.render('partials/login-mock-sso.html');
});

app.get('/partials/login-mock-passkey.html', (req, res) => {
  res.render('partials/login-mock-passkey.html');
});

app.get('/partials/login-gate-ritual.html', (req, res) => {
  res.render('partials/login-gate-ritual.html');
});

// 5. Test page (for debugging)
app.get('/test', (req, res) => {
  try {
    res.render('pages/test.html');
  } catch (error) {
    console.error('Error rendering test page:', error);
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});

// 6. Supabase UI Examples (for reference)
app.get('/examples', (req, res) => {
  try {
    res.render('pages/examples.html');
  } catch (error) {
    console.error('Error rendering examples page:', error);
    res.status(500).send(`
            <h1>Error loading examples</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 7. Components Showcase (new Supabase components)
app.get('/components', (req, res) => {
  try {
    res.render('pages/components-showcase.html');
  } catch (error) {
    console.error('Error rendering components showcase:', error);
    res.status(500).send(`
            <h1>Error loading components showcase</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 8. Snippets Test Page (IDE code generation testing)
app.get('/snippets-test', (req, res) => {
  try {
    res.render('pages/snippets-test.html');
  } catch (error) {
    console.error('Error rendering snippets test page:', error);
    res.status(500).send(`
            <h1>Error loading snippets test page</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 9. Testing routes for partials (Design System isolation testing)
// Per .cursorrules Section 5: All partials should be testable independently via direct URL
app.get('/partials/file-upload-dropzone.html', (req, res) => {
  res.render('partials/file_upload_dropzone.html', {
    maxSize: 10485760,
    acceptedTypes: [],
    multiple: false
  });
});

app.get('/partials/avatar-component.html', (req, res) => {
  res.render('partials/avatar-component.html');
});

app.get('/partials/oauth-github-button.html', (req, res) => {
  res.render('partials/oauth-github-button.html');
});

app.get('/partials/supabase-ui-examples.html', (req, res) => {
  res.render('partials/supabase-ui-examples.html');
});

// --- ERROR HANDLING ---
// 404 handler
app.use((req, res) => {
  const notFoundError = new NotFoundError('Page');
  res.status(404).render('pages/error.html', {
    error: {
      status: 404,
      message: notFoundError.message,
      code: notFoundError.code,
    },
  });
});

// Global error handler
// Uses structured error handling per Supabase best practices
// @see https://supabase.com/docs/guides/functions/error-handling
app.use((err, req, res, next) => {
  // Log error with context
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Create standardized error response
  const errorResponse = createErrorResponse(err, req);

  // Render error page with proper status code
  res.status(errorResponse.status).render('pages/error.html', {
    error: {
      status: errorResponse.status,
      message: errorResponse.body.error.message,
      code: errorResponse.body.error.code,
      ...(env.NODE_ENV !== 'production' && { details: errorResponse.body.error.details })
    },
  });
});

// --- START ---
// Export app for Vercel
export default app;

// Keep listen for local development (skip in test environment)
if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
  const PORT = parseInt(env.PORT, 10);
  app.listen(PORT, () => {
    console.log(`NexusCanon VMP (Phase 0) running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}
