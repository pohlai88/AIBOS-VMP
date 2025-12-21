/// <reference path="./types/express.d.ts" />
import express from 'express';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { cleanEnv, str, url } from 'envalid';
import 'express-async-errors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import { vmpAdapter } from './src/adapters/supabase.js';
import { createErrorResponse, logError, NotFoundError, ValidationError } from './src/utils/errors.js';
import { requireAuth, requireInternal, validateUUIDParam, validateRequired, validateRequiredQuery, handleRouteError, handlePartialError } from './src/utils/route-helpers.js';

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
    logError(error, { operation: 'dateFilter', input: date });
    return '';
  }
});

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL Session Store (Production-Ready)
// Uses Supabase PostgreSQL connection via connect-pg-simple
const PgSession = connectPgSimple(session);

// Session store configuration
// For Supabase, use connection pooling URL format:
// postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Or provide full SESSION_DB_URL in environment
let sessionStore;
if (process.env.SESSION_DB_URL) {
  // Production: Use provided connection string
  sessionStore = new PgSession({
    conString: process.env.SESSION_DB_URL,
    tableName: 'session',
    createTableIfMissing: true
  });
} else if (env.NODE_ENV === 'development') {
  // Development: Use MemoryStore with warning (for local dev without DB config)
  console.warn('⚠️  WARNING: Using MemoryStore for sessions in development.');
  console.warn('   Set SESSION_DB_URL in .env for PostgreSQL session store.');
  console.warn('   Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
  sessionStore = undefined; // Will use MemoryStore (express-session default)
} else {
  // Production without SESSION_DB_URL: Error
  throw new Error('SESSION_DB_URL must be set for production session store. See DEPLOYMENT_GUIDE.md for setup instructions.');
}

app.use(
  session({
    store: sessionStore,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'vmp_session',
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
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

  // Check if user is stored in session (express-session stores data in req.session)
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Load user context from database (session stores userId, we fetch fresh user data)
    const userContext = await vmpAdapter.getVendorContext(req.session.userId);

    if (!userContext || !userContext.is_active) {
      // User not found or inactive - destroy session
      req.session.destroy((err) => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
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
    logError(error, { operation: 'authMiddleware', path: req.path });
    req.session.destroy((err) => {
      if (err) logError(err, { operation: 'authMiddleware', path: req.path });
    });
    return res.redirect('/login');
  }
});

// --- ROUTES ---

// Health check endpoint (for Vercel monitoring)
// GET: Health Check (Public)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// GET: Landing Page (Public)
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
        logError(error, { path: '/home', operation: 'loadMetrics' });
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
    logError(error, { path: '/home', operation: 'renderHomePage' });
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
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res)) return;

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(500).render('pages/error.html', {
        error: {
          status: 500,
          message: 'Vendor ID not available. Please ensure you are logged in or DEMO_VENDOR_ID is configured.'
        }
      });
    }

    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);

      // Verify vendor has access to this case
      if (caseDetail && caseDetail.vendor_id !== vendorId && !req.user?.isInternal) {
        return res.status(403).render('pages/error.html', {
          error: {
            status: 403,
            message: 'Access denied to this case'
          }
        });
      }
    } catch (adapterError) {
      // If case not found, render page with empty state (not an error)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message?.includes('not found')) {
        caseDetail = null;
      } else {
        // Other errors: throw to be handled by catch block
        throw adapterError;
      }
    }

    // 4. Render response
    res.render('pages/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      user: req.user
    });
  } catch (error) {
    handleRouteError(error, req, res);
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
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new Error('Vendor ID not available. Please ensure you are logged in or DEMO_VENDOR_ID is configured.'),
        req,
        res,
        'partials/case_inbox.html',
        { cases: [] }
      );
    }

    const cases = await vmpAdapter.getInbox(vendorId);
    
    // 3. Render response
    res.render('partials/case_inbox.html', { cases });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_inbox.html', { cases: [] });
  }
});

app.get('/partials/case-detail.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false
    };

    if (!caseId) {
      return res.render('partials/case_detail.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/case_detail.html')) return;

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new Error('Vendor ID not available'),
        req,
        res,
        'partials/case_detail.html',
        defaultData
      );
    }

    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
    } catch (adapterError) {
      // Continue with null caseDetail - template handles it gracefully
      // Only log if it's not a "not found" error
      if (adapterError.code !== 'NOT_FOUND' && !adapterError.message?.includes('not found')) {
        logError(adapterError, { path: req.path, caseId, vendorId });
      }
    }

    // 4. Render response
    res.render('partials/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_detail.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false
    });
  }
});

// Case Thread Partial
app.get('/partials/case-thread.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = { caseId: null, messages: [] };

    if (!caseId) {
      return res.render('partials/case_thread.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/case_thread.html')) return;

    // 3. Business logic
    let messages = [];
    try {
      messages = await vmpAdapter.getMessages(caseId);
    } catch (adapterError) {
      // Return with error message for graceful degradation (HTMX partial)
      return handlePartialError(adapterError, req, res, 'partials/case_thread.html', {
        caseId,
        messages: []
      });
    }

    // 4. Render response
    res.render('partials/case_thread.html', { caseId, messages });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_thread.html', {
      caseId: req.query.case_id || null,
      messages: []
    });
  }
});

// Case Checklist Partial
app.get('/partials/case-checklist.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    };

    if (!caseId) {
      return res.render('partials/case_checklist.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/case_checklist.html')) return;

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    let checklistSteps = [];

    try {
      // Get case detail to determine case type
      let caseDetail = null;
      if (vendorId) {
        try {
          caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
        } catch (adapterError) {
          // Log but continue - will try to get steps anyway
          if (adapterError.code !== 'NOT_FOUND') {
            logError(adapterError, { path: req.path, caseId, operation: 'getCaseDetail' });
          }
        }
      }

      // Ensure checklist steps exist (create if missing based on case type)
      if (caseDetail && caseDetail.case_type) {
        try {
          checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
        } catch (ensureError) {
          // Try to get existing steps even if ensure failed
          try {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          } catch (getError) {
            // Continue with empty array
            logError(getError, { path: req.path, caseId, operation: 'getChecklistSteps' });
          }
        }
      } else {
        // Case type unknown, just get existing steps
        try {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        } catch (getError) {
          // Continue with empty array
          logError(getError, { path: req.path, caseId, operation: 'getChecklistSteps' });
        }
      }
    } catch (adapterError) {
      // Continue with empty checklistSteps array
      logError(adapterError, { path: req.path, caseId, operation: 'loadChecklist' });
    }

    // 4. Render response
    res.render('partials/case_checklist.html', {
      caseId,
      checklistSteps,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_checklist.html', {
      caseId: req.query.case_id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    });
  }
});

// Case Evidence Partial
app.get('/partials/case-evidence.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = { caseId: null, evidence: [] };

    if (!caseId) {
      return res.render('partials/case_evidence.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/case_evidence.html')) return;

    // 3. Business logic
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
          logError(urlError, { path: req.path, caseId, storagePath: ev.storage_path, operation: 'getEvidenceSignedUrl' });
          ev.download_url = '#'; // Fallback
        }
      });
      // Use allSettled to continue even if some URLs fail to generate
      await Promise.allSettled(urlPromises);
    } catch (adapterError) {
      // Continue with empty evidence array
      logError(adapterError, { path: req.path, caseId, operation: 'getEvidence' });
    }

    // 4. Render response
    res.render('partials/case_evidence.html', { caseId, evidence });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_evidence.html', {
      caseId: req.query.case_id || null,
      evidence: []
    });
  }
});

// Escalation Partial
app.get('/partials/escalation.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null
    };

    if (!caseId) {
      return res.render('partials/escalation.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/escalation.html')) return;

    // 3. Business logic
    let caseDetail = null;
    let directorInfo = null;

    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);

      // If Level 3 escalation, fetch Director info
      if (caseDetail && caseDetail.escalation_level >= 3) {
        const groupId = caseDetail.group_id || null;
        try {
          directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
        } catch (directorError) {
          // Continue without director info
          logError(directorError, { path: req.path, caseId, groupId, operation: 'getGroupDirectorInfo' });
        }
      }
    } catch (adapterError) {
      // Continue with null caseDetail
      logError(adapterError, { path: req.path, caseId, operation: 'getCaseDetail' });
    }

    // 4. Render response
    res.render('partials/escalation.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      directorInfo: directorInfo || null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/escalation.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null
    });
  }
});

// GET: Case Row Partial (Single Case Row for HTMX Refresh)
app.get('/partials/case-row.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.query.case_id;
    const defaultData = { case: null };

    if (!validateRequiredQuery(caseId, 'case_id', res, 'partials/case_row.html', defaultData)) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(caseId, res, 'partials/case_row.html')) return;

    // 3. Business logic
    let caseData = null;
    try {
      caseData = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);
      if (!caseData) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_row.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_row.html', defaultData);
    }

    // 4. Render response
    res.render('partials/case_row.html', {
      case: caseData,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_row.html', { case: null });
  }
});

// POST: Create Message
app.post('/cases/:id/messages', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_thread.html')) return;

    const { body } = req.body;
    const defaultData = { caseId, messages: [] };

    if (!body || !body.trim()) {
      // Return refreshed thread without error (just ignore empty message)
      try {
        const messages = await vmpAdapter.getMessages(caseId);
        return res.render('partials/case_thread.html', { caseId, messages });
      } catch (error) {
        return handlePartialError(error, req, res, 'partials/case_thread.html', defaultData);
      }
    }

    // 3. Business logic
    let messageCreated = false;
    try {
      await vmpAdapter.createMessage(
        caseId,
        body.trim(),
        'vendor', // sender_type
        'portal', // channel_source
        req.user.id, // sender_user_id
        false // is_internal_note
      );
      messageCreated = true;
    } catch (createError) {
      // Still try to return refreshed thread (graceful degradation)
      logError(createError, { path: req.path, caseId, userId: req.user.id, operation: 'createMessage' });
    }

    // 4. Return refreshed thread with new message
    try {
      const messages = await vmpAdapter.getMessages(caseId);
      return res.render('partials/case_thread.html', { caseId, messages });
    } catch (error) {
      // If message was created but refresh fails, return 500 error
      // If message creation failed, return 200 (graceful degradation)
      if (messageCreated) {
        return handlePartialError(error, req, res, 'partials/case_thread.html', defaultData, true);
      } else {
        return handlePartialError(error, req, res, 'partials/case_thread.html', defaultData, false);
      }
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_thread.html', {
      caseId: req.params.id || null,
      messages: []
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
      logError(uploadError, { path: req.path, userId: req.user?.id, caseId, operation: 'uploadEvidence' });
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
      logError(error, { path: req.path, userId: req.user?.id, caseId, operation: 'refreshEvidenceAfterUpload' });
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence uploaded but failed to refresh view'
      });
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, caseId: req.params.id, operation: 'postEvidence' });
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
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/case_checklist.html', 'Only internal staff can verify evidence')) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_checklist.html')) return;

    const { checklist_step_id } = req.body;
    const defaultData = {
      caseId,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    };

    if (!checklist_step_id) {
      return handlePartialError(
        new ValidationError('checklist_step_id is required'),
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true // Use proper status codes
      );
    }

    // 3. Business logic - Verify evidence
    try {
      await vmpAdapter.verifyEvidence(checklist_step_id, req.user.id, null);
    } catch (verifyError) {
      const wrappedError = new Error('Failed to verify evidence');
      wrappedError.statusCode = verifyError.statusCode || 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_checklist.html', defaultData, true);
    }

    // 4. Create notification for vendor (evidence verified)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_verified',
        'Evidence Verified',
        'Your evidence has been verified by internal staff.'
      );
    } catch (notifError) {
      // Don't fail verification if notification fails
      logError(notifError, { path: req.path, caseId, operation: 'notifyVendorUsersForCase' });
    }

    // 5. Return refreshed checklist
    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (vendorId) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
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

      return res.render('partials/case_checklist.html', { caseId, checklistSteps, isInternal: req.user.isInternal });
    } catch (error) {
      const wrappedError = new Error('Evidence verified but failed to refresh checklist');
      wrappedError.statusCode = 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_checklist.html', defaultData, true);
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    });
  }
});

// Day 9: Internal Ops - Reject Evidence
app.post('/cases/:id/reject-evidence', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/case_checklist.html', 'Only internal staff can reject evidence')) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_checklist.html')) return;

    const { checklist_step_id, reason } = req.body;
    const defaultData = {
      caseId,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    };

    if (!checklist_step_id || !reason || !reason.trim()) {
      return handlePartialError(
        new ValidationError('checklist_step_id and reason are required'),
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true // Use proper status codes
      );
    }

    // 3. Business logic - Reject evidence
    try {
      await vmpAdapter.rejectEvidence(checklist_step_id, req.user.id, reason.trim());
    } catch (rejectError) {
      const wrappedError = new Error('Failed to reject evidence');
      wrappedError.statusCode = rejectError.statusCode || 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_checklist.html', defaultData, true);
    }

    // 4. Create notification for vendor (evidence rejected)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_rejected',
        'Evidence Rejected',
        `Your evidence was rejected. Reason: ${reason.trim()}`
      );
    } catch (notifError) {
      // Don't fail rejection if notification fails
      logError(notifError, { path: req.path, caseId, operation: 'notifyVendorUsersForCase' });
    }

    // 5. Return refreshed checklist
    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (vendorId) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
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

      return res.render('partials/case_checklist.html', { caseId, checklistSteps, isInternal: req.user.isInternal });
    } catch (error) {
      const wrappedError = new Error('Evidence rejected but failed to refresh checklist');
      wrappedError.statusCode = 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_checklist.html', defaultData, true);
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false
    }, true);
  }
});

// Day 9: Internal Ops - Reassign Case
app.post('/cases/:id/reassign', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/case_detail.html', 'Only internal staff can reassign cases')) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_detail.html')) return;

    const { owner_team } = req.body;
    const defaultData = { caseId, caseDetail: null };

    if (!owner_team || !['procurement', 'ap', 'finance'].includes(owner_team)) {
      return handlePartialError(
        new ValidationError('owner_team must be one of: procurement, ap, finance'),
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true // Use proper status codes
      );
    }

    // 3. Business logic - Reassign case
    try {
      await vmpAdapter.reassignCase(caseId, owner_team, req.user.id);
    } catch (reassignError) {
      const wrappedError = new Error('Failed to reassign case');
      wrappedError.statusCode = reassignError.statusCode || 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_detail.html', defaultData, true);
    }

    // 4. Return refreshed case detail
    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (vendorId) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail, isInternal: req.user.isInternal });
    } catch (error) {
      const wrappedError = new Error('Case reassigned but failed to refresh detail');
      wrappedError.statusCode = 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_detail.html', defaultData, true);
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null
    }, true);
  }
});

// Day 9: Internal Ops - Update Case Status
app.post('/cases/:id/update-status', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/case_detail.html', 'Only internal staff can update case status')) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_detail.html')) return;

    const { status } = req.body;
    const defaultData = { caseId, caseDetail: null };

    if (!status || !['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'].includes(status)) {
      return handlePartialError(
        new ValidationError('status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'),
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true // Use proper status codes
      );
    }

    // 3. Business logic - Update case status
    try {
      await vmpAdapter.updateCaseStatus(caseId, status, req.user.id);
    } catch (updateError) {
      const wrappedError = new Error('Failed to update case status');
      wrappedError.statusCode = updateError.statusCode || 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_detail.html', defaultData, true);
    }

    // 4. Return refreshed case detail
    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (vendorId) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail, isInternal: req.user.isInternal });
    } catch (error) {
      const wrappedError = new Error('Case status updated but failed to refresh detail');
      wrappedError.statusCode = 500;
      return handlePartialError(wrappedError, req, res, 'partials/case_detail.html', defaultData, true);
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null
    }, true);
  }
});

// POST: Escalate Case
app.post('/cases/:id/escalate', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/escalation.html')) return;

    const { escalation_level, reason } = req.body;
    const defaultData = {
      caseId,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null
    };

    const escalationLevel = parseInt(escalation_level, 10);
    if (!escalationLevel || escalationLevel < 1 || escalationLevel > 3) {
      return handlePartialError(
        new Error('Invalid escalation level (must be 1-3)'),
        req,
        res,
        'partials/escalation.html',
        defaultData
      );
    }

    // 3. Verify case exists and user has access
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, req.user.vendorId);
      if (!caseDetail) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/escalation.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/escalation.html', defaultData);
    }

    // 4. Level 3 requires Break Glass Protocol
    if (escalationLevel === 3) {
      const groupId = caseDetail.group_id || null;

      // Get Director info (mock for Sprint 1, real DB in Sprint 2)
      let directorInfo = null;
      try {
        directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
      } catch (directorError) {
        // Continue with mock data for Sprint 1
        logError(directorError, { path: req.path, caseId, groupId, operation: 'getGroupDirectorInfo' });
      }

      // Log Break Glass event
      try {
        await vmpAdapter.logBreakGlass(caseId, req.user.id, groupId, directorInfo);
      } catch (breakGlassError) {
        // Continue with escalation even if logging fails
        logError(breakGlassError, { path: req.path, caseId, groupId, operation: 'logBreakGlass' });
      }
    }

    // 5. Perform escalation
    try {
      await vmpAdapter.escalateCase(
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
          logError(directorError, { path: req.path, caseId, groupId, operation: 'getGroupDirectorInfo' });
        }
      }

      // 6. Re-render escalation partial with updated data
      return res.render('partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        directorInfo: directorInfo || null
      });
    } catch (escalateError) {
      return handlePartialError(escalateError, req, res, 'partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        directorInfo: null
      });
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/escalation.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null
    });
  }
});

// ============================================================================
// SPRINT 2: Invoice Transparency + Manual Ingest
// ============================================================================

// GET: Ops Ingest Page (Internal Only)
app.get('/ops/ingest', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Business logic - Get org tree for scope selection
    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    // 3. Render response
    res.render('pages/ops_ingest.html', {
      title: 'Data Ingest',
      orgTree,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// POST: Ingest Invoices from CSV (Internal Only)
app.post('/ops/ingest/invoices', upload.single('csv_file'), async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
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
    if (!validateUUIDParam(company_id, res)) return;

    // 3. Business logic - Ingest invoices
    const result = await vmpAdapter.ingestInvoicesFromCSV(
      req.file.buffer,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    // 4. Return response
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
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest invoices'
    });
  }
});

// POST: Ingest Payments from CSV (Internal Only)
app.post('/ops/ingest/payments', upload.single('csv_file'), async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
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
    if (!validateUUIDParam(company_id, res)) return;

    // 3. Business logic - Ingest payments
    const result = await vmpAdapter.ingestPaymentsFromCSV(
      req.file.buffer,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    // 4. Return response
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
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest payments'
    });
  }
});

// POST: Ingest Remittances (Bulk PDF Upload - Internal Only)
app.post('/ops/ingest/remittances', upload.array('remittance_files', 50), async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
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
    if (!validateUUIDParam(company_id, res)) return;

    // 3. Business logic - Ingest remittances
    const result = await vmpAdapter.ingestRemittances(
      req.files,
      req.user.vendorId, // For now, use user's vendorId (Sprint 6 will add scope selection)
      company_id
    );

    // 4. Return response
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
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render response
    res.render('pages/payments.html', {
      title: 'Payments',
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Payment List Partial
app.get('/partials/payment-list.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
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

    // 3. Render response
    res.render('partials/payment_list.html', {
      payments: payments || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/payment_list.html', {
      payments: [],
      isInternal: req.user?.isInternal || false,
      query: req.query
    });
  }
});

// GET: Payment Detail Page
app.get('/payments/:id', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const paymentId = req.params.id;
    if (!validateUUIDParam(paymentId, res)) return;

    // 3. Business logic
    let paymentDetail = null;
    try {
      paymentDetail = await vmpAdapter.getPaymentDetail(paymentId, req.user.vendorId);

      // Verify vendor has access to this payment
      if (paymentDetail && paymentDetail.vendor_id !== req.user.vendorId && !req.user?.isInternal) {
        return res.status(403).render('pages/error.html', {
          error: {
            status: 403,
            message: 'Access denied to this payment'
          }
        });
      }
    } catch (adapterError) {
      // If payment not found, render page with empty state (not an error)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message?.includes('not found')) {
        paymentDetail = null;
      } else {
        // Other errors: throw to be handled by catch block
        throw adapterError;
      }
    }

    // 4. Render response
    res.render('pages/payment_detail.html', {
      paymentId,
      paymentDetail,
      isInternal: req.user?.isInternal || false,
      user: req.user
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// ============================================================================
// SPRINT 5: Supplier Profile & Compliance (VMP-02)
// ============================================================================

// GET: Profile Page
app.get('/profile', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Fetch vendor profile
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
      // Throw to be handled by catch block
      throw adapterError;
    }

    // 3. Render response
    res.render('pages/profile.html', {
      title: 'Profile',
      vendorProfile,
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Profile Form Partial
app.get('/partials/profile-form.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    const vendorProfile = await vmpAdapter.getVendorProfile(req.user.vendorId);

    if (!vendorProfile) {
      return handlePartialError(
        new NotFoundError('Vendor profile'),
        req,
        res,
        'partials/profile_form.html',
        { vendorProfile: null }
      );
    }

    // 3. Render response
    res.render('partials/profile_form.html', {
      vendorProfile,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/profile_form.html', {
      vendorProfile: null
    });
  }
});

// POST: Update Vendor Contact Information (Low Risk Fields)
app.post('/profile/contact', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { address, phone, website } = req.body;

    // At least one field must be provided
    if (!address && !phone && !website) {
      return handlePartialError(
        new ValidationError('At least one contact field (address, phone, website) must be provided'),
        req,
        res,
        'partials/profile_form.html',
        { vendorProfile: null }
      );
    }

    // 3. Business logic - Update contact info (allow-list enforced in adapter)
    const updatedVendor = await vmpAdapter.updateVendorContact(req.user.vendorId, {
      address: address || null,
      phone: phone || null,
      website: website || null
    });

    // 4. Fetch updated profile to render
    const vendorProfile = await vmpAdapter.getVendorProfile(req.user.vendorId);

    // 5. Render response (refresh the form with updated data)
    res.render('partials/profile_form.html', {
      vendorProfile,
      error: null,
      success: 'Contact information updated successfully'
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    handlePartialError(error, req, res, 'partials/profile_form.html', {
      vendorProfile: null
    });
  }
});

// POST: Bank Details Change Request (Creates Change Request Case)
app.post('/profile/bank-details', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { account_name, account_number, bank_name, swift_code, branch_address, currency } = req.body;

    // Validate required fields using validateRequired helper
    if (!validateRequired(account_name, 'account_name')) {
      return res.status(400).json({
        error: 'account_name is required'
      });
    }
    if (!validateRequired(account_number, 'account_number')) {
      return res.status(400).json({
        error: 'account_number is required'
      });
    }
    if (!validateRequired(bank_name, 'bank_name')) {
      return res.status(400).json({
        error: 'bank_name is required'
      });
    }
    if (!validateRequired(swift_code, 'swift_code')) {
      return res.status(400).json({
        error: 'swift_code is required'
      });
    }

    // 3. Business logic - Create change request case (does NOT update vmp_vendors)
    const newCase = await vmpAdapter.requestBankDetailsChange(
      req.user.vendorId,
      {
        account_name: account_name.trim(),
        account_number: account_number.trim(),
        bank_name: bank_name.trim(),
        swift_code: swift_code.trim(),
        branch_address: branch_address?.trim() || null,
        currency: currency?.trim() || null
      },
      req.user.id
    );

    // 4. Redirect to case detail page (user can upload Bank Letter there)
    res.redirect(`/cases/${newCase.id}`);
  } catch (error) {
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
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Render response
    res.render('pages/ops_command_center.html', {
      title: 'Command Center',
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Org Tree Sidebar Partial
app.get('/partials/org-tree-sidebar.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/org_tree_sidebar.html')) return;

    // 2. Business logic
    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    // 3. Render response
    res.render('partials/org_tree_sidebar.html', {
      orgTree,
      error: null,
      currentScope: {
        type: req.query.scope_type || null,
        id: req.query.scope_id || null
      }
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/org_tree_sidebar.html', {
      orgTree: null,
      currentScope: {
        type: req.query.scope_type || null,
        id: req.query.scope_id || null
      }
    });
  }
});

// GET: Scoped Dashboard (Ops Dashboard with Metrics)
app.get('/ops/dashboard', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Get user context to determine tenant and default scope
    const userContext = await vmpAdapter.getVendorContext(req.user.id);
    const tenantId = userContext.vmp_vendors?.tenant_id;
    if (!tenantId) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'User must be associated with a tenant' }
      });
    }

    // 3. Business logic - Determine scope from query params or user context
    const { scope_type, scope_id } = req.query;
    let userScope = null; // null = Super Admin (all), or group_id/company_id

    if (scope_id) {
      // Use provided scope
      userScope = scope_id;
    } else {
      // Use user's default scope
      if (userContext.scope_group_id) {
        userScope = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        userScope = userContext.scope_company_id;
      }
      // If neither, userScope remains null (Super Admin)
    }

    // 4. Fetch dashboard metrics
    const dashboardMetrics = await vmpAdapter.getOpsDashboardMetrics(tenantId, userScope);

    // 5. Determine scope type for UI display
    let finalScopeType = dashboardMetrics.userScope.type;
    let finalScopeId = dashboardMetrics.userScope.id;

    // 6. Render response
    res.render('pages/ops_dashboard.html', {
      title: 'Dashboard',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      dashboardMetrics,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Scoped Dashboard Partial
app.get('/partials/scoped-dashboard.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/scoped_dashboard.html')) return;

    // 2. Input validation
    const { scope_type, scope_id } = req.query;
    const defaultData = { dashboard: null };

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/scoped_dashboard.html', {
        ...defaultData,
        error: 'scope_type and scope_id are required'
      });
    }

    // 3. Business logic
    const dashboard = await vmpAdapter.getScopedDashboard(scope_type, scope_id, req.user.id);

    // 4. Render response
    res.render('partials/scoped_dashboard.html', {
      dashboard,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/scoped_dashboard.html', {
      dashboard: null
    });
  }
});

// GET: Ops Case Queue
app.get('/ops/cases', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Business logic - Determine scope
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

    // 3. Render response
    res.render('pages/ops_cases.html', {
      title: 'Case Queue',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Ops Case Queue Partial
app.get('/partials/ops-case-queue.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/ops_case_queue.html')) return;

    // 2. Input validation
    const { scope_type, scope_id, status, owner_team, case_type } = req.query;
    const defaultData = { cases: [] };

    if (!validateRequiredQuery(scope_type, 'scope_type', res, 'partials/ops_case_queue.html', defaultData)) {
      return;
    }

    if (!validateRequiredQuery(scope_id, 'scope_id', res, 'partials/ops_case_queue.html', defaultData)) {
      return;
    }

    // 3. Business logic
    const filters = {};
    if (status) filters.status = status;
    if (owner_team) filters.owner_team = owner_team;
    if (case_type) filters.case_type = case_type;

    const cases = await vmpAdapter.getOpsCaseQueue(scope_type, scope_id, req.user.id, filters);

    // 4. Render response
    res.render('partials/ops_case_queue.html', {
      cases,
      filters: { status, owner_team, case_type },
      scopeType: scope_type,
      scopeId: scope_id,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/ops_case_queue.html', {
      cases: [],
      scopeType: req.query.scope_type || null,
      scopeId: req.query.scope_id || null
    });
  }
});

// GET: Vendor Directory
app.get('/ops/vendors', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Business logic - Determine scope
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

    // 3. Render response
    res.render('pages/ops_vendors.html', {
      title: 'Vendor Directory',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Decision Log Partial
app.get('/partials/decision-log.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const { case_id } = req.query;
    const defaultData = { caseId: null, decisions: [] };

    if (!case_id) {
      return res.render('partials/decision_log.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(case_id, res, 'partials/decision_log.html')) return;

    // 3. Business logic
    let decisions = [];
    try {
      decisions = await vmpAdapter.getDecisionLog(case_id);
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/decision_log.html', {
        caseId: case_id,
        decisions: []
      });
    }

    // 4. Render response
    res.render('partials/decision_log.html', {
      caseId: case_id,
      decisions,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/decision_log.html', {
      caseId: req.query.case_id || null,
      decisions: []
    });
  }
});

// GET: Vendor Directory Partial
app.get('/partials/vendor-directory.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/vendor_directory.html')) return;

    // 2. Input validation
    const { scope_type, scope_id, status } = req.query;
    const defaultData = {
      vendors: [],
      filters: { status: null },
      scopeType: null,
      scopeId: null
    };

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/vendor_directory.html', {
        ...defaultData,
        error: 'scope_type and scope_id are required'
      });
    }

    // 3. Business logic
    const filters = {};
    if (status) filters.status = status;

    const vendors = await vmpAdapter.getVendorDirectory(scope_type, scope_id, req.user.id, filters);

    // 4. Render response
    res.render('partials/vendor_directory.html', {
      vendors,
      filters: { status },
      scopeType: scope_type,
      scopeId: scope_id,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/vendor_directory.html', {
      vendors: [],
      filters: { status: req.query.status || null },
      scopeType: req.query.scope_type || null,
      scopeId: req.query.scope_id || null
    });
  }
});

// GET: Internal Ops Case Detail
app.get('/ops/cases/:id', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res)) return;

    // 3. Business logic - Get case detail for internal users
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
      // If case not found, render page with empty state (not an error)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message?.includes('not found')) {
        caseDetail = null;
      } else {
        // Other errors: throw to be handled by catch block
        throw adapterError;
      }
    }

    // 4. Render response
    res.render('pages/ops_case_detail.html', {
      caseId,
      caseDetail,
      isInternal: true,
      user: req.user
    });
  } catch (error) {
    handleRouteError(error, req, res);
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
      logError(adapterError, { path: req.path, userId: req.user?.id, operation: 'loadComplianceDocuments' });
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
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    let contracts = [];
    try {
      contracts = await vmpAdapter.getContractLibrary(req.user.vendorId);
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/contract_library.html', {
        contracts: []
      });
    }

    // 3. Render response
    res.render('partials/contract_library.html', {
      contracts,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/contract_library.html', {
      contracts: []
    });
  }
});

// GET: Remittance Viewer Partial
app.get('/partials/remittance-viewer.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { payment_id } = req.query;
    const defaultData = { remittanceUrl: null, payment: null };

    if (!validateRequiredQuery(payment_id, 'payment_id', res, 'partials/remittance_viewer.html', defaultData)) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(payment_id, res, 'partials/remittance_viewer.html')) return;

    // 3. Business logic - Get payment detail to retrieve remittance URL
    const payment = await vmpAdapter.getPaymentDetail(payment_id, req.user.vendorId);

    if (!payment) {
      return handlePartialError(
        new NotFoundError('Payment'),
        req,
        res,
        'partials/remittance_viewer.html',
        defaultData
      );
    }

    if (!payment.remittance_url) {
      return res.render('partials/remittance_viewer.html', {
        remittanceUrl: null,
        payment: payment,
        error: 'No remittance document available for this payment'
      });
    }

    // 4. Render response
    res.render('partials/remittance_viewer.html', {
      remittanceUrl: payment.remittance_url,
      payment: payment,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/remittance_viewer.html', {
      remittanceUrl: null,
      payment: null
    });
  }
});

// GET: Invoice List Page
app.get('/invoices', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render response
    res.render('pages/invoices.html', {
      title: 'Invoices',
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Invoice List Partial
app.get('/partials/invoice-list.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    const { status, search, company_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    const invoices = await vmpAdapter.getInvoices(
      req.user.vendorId,
      company_id || null,
      filters
    );

    // 3. Render response
    res.render('partials/invoice_list.html', {
      invoices: invoices || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_list.html', {
      invoices: [],
      isInternal: req.user?.isInternal || false,
      query: req.query
    });
  }
});

// GET: Invoice Detail Page
app.get('/invoices/:id', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.params.id;
    if (!validateUUIDParam(invoiceId, res)) return;

    // 3. Business logic
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);

    if (!invoice) {
      return res.status(404).render('pages/error.html', {
        error: {
          status: 404,
          message: 'Invoice not found or access denied'
        }
      });
    }

    // 4. Render response
    res.render('pages/invoice_detail.html', {
      title: `Invoice ${invoice.invoice_num}`,
      invoiceId,
      invoice,
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Invoice Detail Partial
app.get('/partials/invoice-detail.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.query.invoice_id;
    const defaultData = {
      invoice: null,
      isInternal: req.user?.isInternal || false
    };

    if (!validateRequiredQuery(invoiceId, 'invoice_id', res, 'partials/invoice_detail.html', defaultData)) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(invoiceId, res, 'partials/invoice_detail.html')) return;

    // 3. Business logic
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);

    if (!invoice) {
      return handlePartialError(
        new NotFoundError('Invoice'),
        req,
        res,
        'partials/invoice_detail.html',
        defaultData
      );
    }

    // 4. Render response
    res.render('partials/invoice_detail.html', {
      invoice,
      isInternal: req.user?.isInternal || false,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_detail.html', {
      invoice: null,
      isInternal: req.user?.isInternal || false
    });
  }
});

// GET: Matching Status Partial
app.get('/partials/matching-status.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.query.invoice_id;
    const defaultData = { matchingStatus: null };

    if (!validateRequiredQuery(invoiceId, 'invoice_id', res, 'partials/matching_status.html', defaultData)) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(invoiceId, res, 'partials/matching_status.html')) return;

    // 3. Business logic - Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return handlePartialError(
        new NotFoundError('Invoice'),
        req,
        res,
        'partials/matching_status.html',
        defaultData
      );
    }

    const matchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);

    // 4. Render response
    res.render('partials/matching_status.html', {
      matchingStatus,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/matching_status.html', {
      matchingStatus: null
    });
  }
});

// POST: Create Case from Invoice
app.post('/invoices/:id/open-case', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.params.id;
    if (!validateUUIDParam(invoiceId, res)) return;

    const { subject } = req.body;

    // 3. Business logic - Verify invoice access
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

    // 4. Redirect to case detail page
    res.redirect(`/cases/${newCase.id}`);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
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
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Render response
    res.render('pages/ops_invite_new.html', {
      title: 'Invite Supplier',
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Invite Form Partial
app.get('/partials/invite-form.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res, 'partials/invite_form.html')) return;

    // 2. Business logic - Get org tree for company selection
    const orgTree = await vmpAdapter.getOrgTree(req.user.id);

    // 3. Render response
    res.render('partials/invite_form.html', {
      orgTree,
      error: null
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invite_form.html', {
      orgTree: null
    });
  }
});

// POST: Create Invite (Internal Only)
app.post('/ops/invites', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const { vendor_name, email, company_ids } = req.body;

    if (!validateRequired(vendor_name, 'vendor_name')) {
      return res.status(400).json({
        error: 'vendor_name is required'
      });
    }

    if (!validateRequired(email, 'email')) {
      return res.status(400).json({
        error: 'email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // 3. Business logic - Get user context to determine tenant
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
      logError(vendorError, { path: req.path, userId: req.user?.id, operation: 'createOrGetVendor' });
      return res.status(500).json({
        error: 'Failed to create or find vendor'
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

    // 4. Return JSON response with invite link (for copy-paste)
    res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        expires_at: invite.expires_at,
        link: inviteUrl,
        invite_url: invite.invite_url // Relative URL path
      },
      vendor: {
        id: vendorId,
        name: vendor_name.trim()
      },
      companies: companyIdsArray.length > 0 ? companyIdsArray : null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to create invite'
    });
  }
});

// GET: Accept Invite Page (Public Route - No Auth Required)
app.get('/accept', async (req, res) => {
  try {
    // 1. Input validation - token is required for this route
    const { token } = req.query;
    const defaultData = {
      error: null,
      invite: null,
      companies: [],
      token: null,
      vendorName: null,
      tenantName: null
    };

    // Use validateRequiredQuery helper for standardization
    if (!validateRequiredQuery(token, 'token', res, 'pages/accept.html', defaultData)) {
      return;
    }

    // 2. Business logic - Validate invite token
    const invite = await vmpAdapter.getInviteByToken(token);

    if (!invite) {
      return res.render('pages/accept.html', {
        ...defaultData,
        error: 'Invalid or expired invite token'
      });
    }

    if (invite.expired) {
      return res.render('pages/accept.html', {
        ...defaultData,
        error: 'This invite has expired. Please request a new invite.'
      });
    }

    if (invite.used) {
      return res.render('pages/accept.html', {
        ...defaultData,
        error: 'This invite has already been used.'
      });
    }

    // Extract companies from vendor-company links
    const companies = invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
    
    // Extract vendor and tenant names
    const vendorName = invite.vmp_vendors?.name || 'Vendor';
    const tenantName = invite.vmp_vendors?.vmp_tenants?.name || 'Organization';

    // 3. Render response
    res.render('pages/accept.html', {
      error: null,
      invite: {
        id: invite.id,
        email: invite.email,
        vendor: invite.vmp_vendors,
        companies: companies
      },
      token: token,
      vendorName: vendorName,
      tenantName: tenantName
    });
  } catch (error) {
    logError(error, { path: req.path });
    res.status(500).render('pages/accept.html', {
      error: error.message || 'Failed to load invite',
      invite: null,
      companies: [],
      token: req.query.token || null
    });
  }
});

// POST: Accept Invite & Create Account
app.post('/accept', async (req, res) => {
  try {
    // 1. Input validation (Public Route - No Auth Required)
    const { token, password, password_confirm, display_name } = req.body;
    const defaultData = {
      error: null,
      invite: null,
      companies: [],
      token: null,
      vendorName: null,
      tenantName: null
    };

    // Use validateRequired helper for standardization
    if (!validateRequired(token, 'token')) {
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Invite token is required'
      });
    }

    if (!validateRequired(password, 'password')) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies = invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Password is required',
        invite: invite,
        token: token,
        companies: companies
      });
    }

    if (password.length < 8) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies = invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Password must be at least 8 characters long',
        invite: invite,
        token: token,
        companies: companies
      });
    }

    if (password !== password_confirm) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies = invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Passwords do not match',
        invite: invite,
        token: token,
        companies: companies
      });
    }

    // 2. Business logic - Accept invite and create user (atomic operation)
    const { user, invite } = await vmpAdapter.acceptInviteAndCreateUser(
      token,
      password,
      display_name || null
    );

    // 3. Create onboarding case
    const companyId = invite.vmp_vendor_company_links?.[0]?.company_id || null;
    const onboardingCase = await vmpAdapter.createOnboardingCase(
      invite.vendor_id,
      companyId
    );

    // 4. Create session and log user in (express-session stores userId in session)
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        logError(err, { path: req.path, operation: 'createSession' });
        return res.status(500).render('pages/error.html', {
          error: { status: 500, message: 'Failed to create session' }
        });
      }
      // 5. Redirect to onboarding case
      res.redirect(`/cases/${onboardingCase.id}`);
    });
  } catch (error) {
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
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res)) return;

    // 3. Business logic - Approve onboarding
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
      logError(refreshError, { path: req.path, userId: req.user?.id, operation: 'refreshCaseDetailAfterApproval' });
      // Return JSON fallback if refresh fails
      res.json({
        success: true,
        message: 'Onboarding approved successfully. Vendor account activated.',
        caseId: updatedCase.id
      });
    }
  } catch (error) {
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
  if (req.session?.userId) {
    return res.redirect('/home');
  }
  res.render('pages/login3.html', { error: null });
});

// Legacy login redirects
app.get('/login4', (req, res) => {
  if (req.session?.userId) {
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

    // Create session (express-session stores userId in session)
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        logError(err, { path: req.path, operation: 'createSession' });
        return res.status(500).render('pages/error.html', {
          error: { status: 500, message: 'Failed to create session' }
        });
      }
      // Redirect to home
      res.redirect('/home');
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'login' });
    res.render('pages/login3.html', {
      error: 'An error occurred during login. Please try again.'
    });
  }
});

// 3b. Logout Handler
app.post('/logout', async (req, res) => {
  // Destroy session (express-session handles cleanup in PostgreSQL)
  req.session.destroy((err) => {
    if (err) {
      logError(err, { path: req.path, operation: 'logout' });
    }
    res.redirect('/login');
  });
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
    logError(error, { path: req.path, operation: 'renderTestPage' });
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});

// 6. Supabase UI Examples (for reference)
app.get('/examples', (req, res) => {
  try {
    res.render('pages/examples.html');
  } catch (error) {
    logError(error, { path: req.path, operation: 'renderExamplesPage' });
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
    logError(error, { path: req.path, operation: 'renderComponentsShowcase' });
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
    logError(error, { path: req.path, operation: 'renderSnippetsTestPage' });
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

