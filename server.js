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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { vmpAdapter } from './src/adapters/supabase.js';
import { createErrorResponse, logError, NotFoundError, ValidationError } from './src/utils/errors.js';
import { requireAuth, requireInternal, validateUUIDParam, validateRequired, validateRequiredQuery, handleRouteError, handlePartialError } from './src/utils/route-helpers.js';
import { parseEmailWebhook, extractCaseReference, extractVendorIdentifier } from './src/utils/email-parser.js';
import { parseWhatsAppWebhook, extractCaseReferenceFromWhatsApp, extractVendorIdentifierFromWhatsApp } from './src/utils/whatsapp-parser.js';
import { classifyMessageIntent, extractStructuredData, findBestMatchingCase } from './src/utils/ai-message-parser.js';
import { validateCaseData, generateValidationResponse } from './src/utils/ai-data-validation.js';
import { performAISearch, parseSearchIntent, generateSearchSuggestions } from './src/utils/ai-search.js';
import { checkAndSendSLAReminders, getSLAReminderStats } from './src/utils/sla-reminders.js';
import { generatePDF, generateExcel, getExportFields } from './src/utils/export-utils.js';

// Environment validation
dotenv.config();
const env = cleanEnv(process.env, {
  SUPABASE_URL: url({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  DEMO_VENDOR_ID: str({ default: '' }),
  SESSION_SECRET: str({ default: 'dev-secret-change-in-production' }),
  PORT: str({ default: '9000' }),
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  // Rollback switch for home page (allows quick rollback without code changes)
  // Note: Login route is LOCKED to login3.html (no rollback switch)
  VMP_HOME_PAGE: str({ default: 'home5' }),
  // VAPID keys for push notifications (optional)
  VAPID_PUBLIC_KEY: str({ default: '' }),
  VAPID_PRIVATE_KEY: str({ default: '' }),
});

// Create Supabase client for direct queries (used in notification routes)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' }
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

// Add global variables for templates
nunjucksEnv.addGlobal('vapid_public_key', env.VAPID_PUBLIC_KEY || '');

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

// PWA Manifest and Service Worker (Sprint 12.2)
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/offline.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'offline.html'));
});

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
  const publicRoutes = ['/login', '/', '/health'];
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

// ==========================================
// 🔒 LOCKED PRODUCTION ROUTE - LANDING PAGE
// ==========================================
// GET: Landing Page (Public) - LOCKED to landing.html
// Status: Production-ready with radar scan logo and governance engine branding
// Date Locked: 2025-01-XX
// DO NOT CHANGE: This route is locked to landing.html. Any experimental landing pages
// should be archived to src/views/pages/.archive/ before making changes.
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

    // 4. AI Data Validation (Sprint 13.2) - Run validation if case exists
    let validationResult = null;
    if (caseDetail) {
      try {
        const checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        const evidence = await vmpAdapter.getEvidence(caseId);
        validationResult = await validateCaseData(caseDetail, checklistSteps, evidence);
      } catch (validationError) {
        // Don't fail if validation fails - just log it
        logError(validationError, { path: req.path, caseId, operation: 'aiDataValidation' });
      }
    }

    // 5. Render response
    res.render('pages/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      user: req.user,
      validationResult
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

    // 4. AI Data Validation (Sprint 13.2) - Run validation if case exists
    let validationResult = null;
    if (caseDetail) {
      try {
        const checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        const evidence = await vmpAdapter.getEvidence(caseId);
        validationResult = await validateCaseData(caseDetail, checklistSteps, evidence);
      } catch (validationError) {
        // Don't fail if validation fails - just log it
        logError(validationError, { path: req.path, caseId, operation: 'aiDataValidation' });
      }
    }

    // 5. Render response
    res.render('partials/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      validationResult
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

// Case Activity Feed Partial (Sprint 8.1)
app.get('/partials/case-activity.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.query.case_id;
    const defaultData = { activities: [], error: null };

    if (!caseId) {
      return res.render('partials/case_activity.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(caseId, res, 'partials/case_activity.html')) return;

    // 3. Business logic
    let activities = [];
    try {
      activities = await vmpAdapter.getCaseActivity(caseId);
    } catch (adapterError) {
      // Return with error message for graceful degradation
      return res.render('partials/case_activity.html', {
        activities: [],
        error: adapterError.message || 'Failed to load activity feed'
      });
    }

    // 4. Render response
    res.render('partials/case_activity.html', { activities, error: null });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_activity.html', { activities: [], error: error.message || 'Failed to load activity' });
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

// GET: Document Template Download (Sprint 8.2)
app.get('/templates/:type-template.pdf', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const templateType = req.params.type;
    const validTypes = ['po_number', 'grn', 'invoice_pdf', 'contract', 'certificate', 'misc'];
    
    if (!validTypes.includes(templateType)) {
      return res.status(400).render('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid template type'
        }
      });
    }

    // 3. Generate template PDF content (basic implementation)
    // In production, this would load actual template files from storage
    const templateContent = `
Document Template: ${templateType.replace('_', ' ').toUpperCase()}

This is a template document for ${templateType.replace('_', ' ')}.

Instructions:
- Fill in all required fields
- Ensure all signatures are present
- Submit the completed document through the case portal

Generated: ${new Date().toISOString()}
    `.trim();

    // 4. Return as PDF (for now, return as text - can be enhanced with PDF generation library)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${templateType}-template.pdf"`);
    // For now, return text content - in production, use a PDF library like pdfkit
    res.send(templateContent);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, templateType: req.params.type });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: 'Failed to download template'
      }
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
        const groupId = caseDetail.group_id || (caseDetail.vmp_companies && caseDetail.vmp_companies.group_id) || null;
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
      
      // Log decision
      try {
        const step = await vmpAdapter.getChecklistStep(checklist_step_id);
        await vmpAdapter.logDecision(
          caseId,
          'evidence_verified',
          req.user.display_name || req.user.email,
          `Verified evidence for: ${step?.label || 'checklist step'}`,
          'Evidence meets requirements and has been approved'
        );
      } catch (logError) {
        // Don't fail verification if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-verify' });
      }
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
      
      // Log decision
      try {
        const steps = await vmpAdapter.getChecklistSteps(caseId);
        const step = steps.find(s => s.id === checklist_step_id);
        await vmpAdapter.logDecision(
          caseId,
          'evidence_rejected',
          req.user.display_name || req.user.email,
          `Rejected evidence for: ${step?.label || 'checklist step'}`,
          reason.trim()
        );
      } catch (logError) {
        // Don't fail rejection if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-reject' });
      }
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
      
      // Log decision
      try {
        await vmpAdapter.logDecision(
          caseId,
          'case_reassigned',
          req.user.display_name || req.user.email,
          `Reassigned case to ${owner_team} team`,
          `Case ownership transferred to ${owner_team} team`
        );
      } catch (logError) {
        // Don't fail reassignment if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-reassign' });
      }
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
      
      // Log decision
      try {
        await vmpAdapter.logDecision(
          caseId,
          'case_escalated',
          req.user.display_name || req.user.email,
          `Escalated case to level ${escalationLevel}`,
          reason || `Case escalated to level ${escalationLevel} for urgent attention`
        );
      } catch (logError) {
        // Don't fail escalation if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-escalate' });
      }

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
    let paymentStatusInfo = null;
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

      // Sprint 8.3: Get payment status info (blocking cases, explanation, forecast)
      if (paymentDetail) {
        try {
          paymentStatusInfo = await vmpAdapter.getPaymentStatusInfo(paymentId, req.user.vendorId);
        } catch (statusError) {
          // Don't fail if status info fails - just log it
          logError(statusError, { path: req.path, paymentId, operation: 'getPaymentStatusInfo' });
        }
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
      paymentStatusInfo,
      isInternal: req.user?.isInternal || false,
      user: req.user
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Payment History Page (Sprint 7.3)
app.get('/payments/history', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render response
    res.render('pages/payment_history.html', {
      title: 'Payment History',
      user: req.user,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Payment History Partial (Sprint 7.3)
app.get('/partials/payment-history.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    const { payment_ref, invoice_num, date_from, date_to, company_id, amount_min, amount_max, status } = req.query;
    const filters = {};
    if (payment_ref) filters.payment_ref = payment_ref;
    if (invoice_num) filters.invoice_num = invoice_num;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (amount_min) filters.amount_min = amount_min;
    if (amount_max) filters.amount_max = amount_max;
    if (status) filters.status = status;

    const payments = await vmpAdapter.getPayments(
      req.user.vendorId,
      company_id || null,
      filters
    );

    // Sort chronologically (oldest first for timeline)
    const sortedPayments = (payments || []).sort((a, b) => {
      const dateA = new Date(a.payment_date || a.created_at);
      const dateB = new Date(b.payment_date || b.created_at);
      return dateA - dateB; // Ascending order (oldest first)
    });

    // 3. Render response
    res.render('partials/payment_history.html', {
      payments: sortedPayments,
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.render('partials/payment_history.html', {
      payments: [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: error.message || 'Failed to load payment history'
    });
  }
});

// GET: Payment Receipt Download (Sprint 7.4)
app.get('/payments/:id/receipt', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const paymentId = req.params.id;
    if (!validateUUIDParam(paymentId, res)) return;

    // 3. Business logic - Verify payment access
    const payment = await vmpAdapter.getPaymentDetail(paymentId, req.user.vendorId);
    if (!payment) {
      return res.status(404).render('pages/error.html', {
        error: {
          status: 404,
          message: 'Payment not found or access denied'
        }
      });
    }

    // 4. Generate receipt
    // If remittance URL exists, redirect to it (remittance_url is already a public URL from storage)
    if (payment.remittance_url) {
      // Remittance URL is already a full public URL from Supabase Storage
      return res.redirect(payment.remittance_url);
    } else {
      // No remittance - generate simple text receipt
      const receiptText = `
PAYMENT RECEIPT
===============

Payment Reference: ${payment.payment_ref}
Payment Date: ${payment.payment_date || 'N/A'}
Amount: ${payment.currency_code || 'USD'} ${payment.amount ? payment.amount.toFixed(2) : '0.00'}
Company: ${payment.vmp_companies?.name || 'N/A'}
${payment.invoice_num ? `Invoice: ${payment.invoice_num}` : ''}
${payment.description ? `Description: ${payment.description}` : ''}

Generated: ${new Date().toISOString()}
      `.trim();

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="payment-receipt-${payment.payment_ref}.txt"`);
      res.send(receiptText);
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, paymentId: req.params.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: error.message || 'Failed to download receipt'
      }
    });
  }
});

// GET: Payment History CSV Export (Sprint 7.3)
app.get('/payments/history/export', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Apply same filters as history view
    const { payment_ref, invoice_num, date_from, date_to, company_id, amount_min, amount_max, status } = req.query;
    const filters = {};
    if (payment_ref) filters.payment_ref = payment_ref;
    if (invoice_num) filters.invoice_num = invoice_num;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (amount_min) filters.amount_min = amount_min;
    if (amount_max) filters.amount_max = amount_max;
    if (status) filters.status = status;

    const payments = await vmpAdapter.getPayments(
      req.user.vendorId,
      company_id || null,
      filters
    );

    // 3. Generate CSV
    const csvRows = [];
    
    // CSV Header
    csvRows.push([
      'Payment Date',
      'Payment Reference',
      'Amount',
      'Currency',
      'Company',
      'Invoice Number',
      'Remittance Available',
      'Source System',
      'Description'
    ].join(','));

    // CSV Data Rows
    for (const payment of payments || []) {
      csvRows.push([
        payment.payment_date || '',
        payment.payment_ref || '',
        payment.amount || '0.00',
        payment.currency_code || 'USD',
        payment.vmp_companies?.name || '',
        payment.vmp_invoices?.invoice_num || payment.invoice_num || '',
        payment.remittance_url ? 'Yes' : 'No',
        payment.source_system || 'manual',
        (payment.description || '').replace(/"/g, '""') // Escape quotes in CSV
      ].map(field => `"${field}"`).join(','));
    }

    const csvContent = csvRows.join('\n');

    // 4. Set response headers for CSV download
    const filename = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to export payment history'
    });
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

// ==========================================
// 📅 SLA REMINDERS (Sprint 14)
// ==========================================

// POST: Trigger SLA Reminders Check (Internal Only)
app.post('/ops/sla-reminders/check', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const { warningThresholdHours = 24, sendToVendors = true, sendToInternal = true } = req.body;

    // 3. Business logic - Run SLA reminder check
    const summary = await checkAndSendSLAReminders({
      warningThresholdHours: parseInt(warningThresholdHours, 10),
      sendToVendors: sendToVendors !== false,
      sendToInternal: sendToInternal !== false,
    });

    // 4. Return response
    return res.json({
      success: true,
      summary,
      message: `Checked ${summary.checked} cases. Sent ${summary.warningsSent} warnings and ${summary.overdueSent} overdue reminders.`,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'triggerSLAReminders' });
    return res.status(500).json({
      success: false,
      error: 'Failed to check SLA reminders',
      message: error.message,
    });
  }
});

// GET: SLA Reminder Statistics (Internal Only)
app.get('/ops/sla-reminders/stats', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Business logic - Get SLA stats
    const stats = await getSLAReminderStats();

    // 3. Return response
    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'getSLAReminderStats' });
    return res.status(500).json({
      success: false,
      error: 'Failed to get SLA reminder statistics',
      message: error.message,
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

// GET: Notification Badge Partial (Sprint 7.4)
app.get('/partials/notification-badge.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Get unread notification count
    const unreadNotifications = await vmpAdapter.getUserNotifications(req.user.id, 50, true);
    const unreadCount = unreadNotifications ? unreadNotifications.length : 0;

    // 3. Render response
    res.render('partials/notification_badge.html', {
      unreadCount,
      error: null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.render('partials/notification_badge.html', {
      unreadCount: 0,
      error: null
    });
  }
});

// GET: Notifications Page (Sprint 7.4)
app.get('/notifications', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Get user notifications
    const notifications = await vmpAdapter.getUserNotifications(req.user.id, 100, false);

    // 3. Render response
    res.render('pages/notifications.html', {
      title: 'Notifications',
      user: req.user,
      notifications: notifications || [],
      unreadCount: (notifications || []).filter(n => !n.is_read).length
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// POST: Mark Notification as Read (Sprint 7.4)
app.post('/notifications/:id/read', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const notificationId = req.params.id;
    if (!validateUUIDParam(notificationId, res)) return;

    // 3. Business logic - Mark notification as read
    const updateQuery = supabase
      .from('vmp_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    const { data, error } = await withTimeout(updateQuery, 5000, 'markNotificationRead');

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to mark notification as read'
      });
    }

    // 4. Return success (redirect back to notifications page if from page, else JSON)
    if (req.headers['hx-request']) {
      // HTMX request - return updated notification badge
      const unreadNotifications = await vmpAdapter.getUserNotifications(req.user.id, 50, true);
      const unreadCount = unreadNotifications ? unreadNotifications.length : 0;
      res.render('partials/notification_badge.html', {
        unreadCount,
        error: null
      });
    } else {
      res.redirect('/notifications');
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, notificationId: req.params.id });
    res.status(500).json({
      error: error.message || 'Failed to mark notification as read'
    });
  }
});

// POST: Mark All Notifications as Read (Sprint 7.4)
app.post('/notifications/mark-all-read', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Mark all user notifications as read
    const updateQuery = supabase
      .from('vmp_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    const { error } = await withTimeout(updateQuery, 5000, 'markAllNotificationsRead');

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to mark all notifications as read'
      });
    }

    // 3. Redirect back to notifications page
    res.redirect('/notifications');
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to mark all notifications as read'
    });
  }
});

// ============================================================================
// SPRINT 9.1: EMAIL-TO-CASE WEBHOOK ENDPOINT
// ============================================================================

// POST: Email Webhook (Sprint 9.1)
app.post('/ports/email', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // 1. Accept webhook from email providers (no auth required - webhook uses secret key)
    // In production, verify webhook signature here
    
    // 2. Determine email provider from headers or query param
    const provider = req.query.provider || req.headers['x-email-provider'] || 'generic';
    
    // 3. Parse email webhook payload
    let emailData;
    try {
      emailData = parseEmailWebhook(req.body, provider);
    } catch (parseError) {
      logError(parseError, { path: req.path, provider, operation: 'parseEmailWebhook' });
      return res.status(400).json({
        error: 'Failed to parse email webhook',
        message: parseError.message
      });
    }

    // 4. Extract vendor identifier from sender email
    const senderEmail = extractVendorIdentifier(emailData);
    if (!senderEmail) {
      return res.status(400).json({
        error: 'Could not extract sender email from webhook'
      });
    }

    // 5. Find vendor by email
    let vendorInfo;
    try {
      vendorInfo = await vmpAdapter.findVendorByEmail(senderEmail);
    } catch (vendorError) {
      logError(vendorError, { path: req.path, senderEmail, operation: 'findVendorByEmail' });
      return res.status(500).json({
        error: 'Failed to find vendor',
        message: vendorError.message
      });
    }

    if (!vendorInfo) {
      // Vendor not found - could create case manually or return error
      return res.status(404).json({
        error: 'Vendor not found',
        message: `No vendor found for email: ${senderEmail}. Please ensure the sender is registered.`
      });
    }

    // 6. Extract case reference from email (if replying to existing case)
    const caseReference = extractCaseReference(emailData);

    // 7. Find or create case
    let caseId;
    try {
      caseId = await vmpAdapter.findOrCreateCaseFromEmail(emailData, vendorInfo, caseReference);
    } catch (caseError) {
      logError(caseError, { path: req.path, vendorInfo, caseReference, operation: 'findOrCreateCaseFromEmail' });
      return res.status(500).json({
        error: 'Failed to find or create case',
        message: caseError.message
      });
    }

    // 9. Log webhook received activity (with AI analysis)
    try {
      await vmpAdapter.logPortActivity('email', 'webhook_received', 'success', {
        messageId: emailData.messageId,
        from: emailData.from,
        provider: emailData.provider,
        aiIntent: aiAnalysis?.intent,
        aiConfidence: aiAnalysis?.confidence,
        matchedCase: matchedCase?.caseNum || null
      }, caseId);
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Failed to log port activity:', logError);
    }

    // 10. Create message from email (with AI-extracted metadata)
    const messageBody = emailData.text || emailData.html || emailData.subject || 'Email received';
    const emailMetadata = {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      messageId: emailData.messageId,
      provider: emailData.provider,
      headers: emailData.headers,
      // AI-extracted metadata (Sprint 13.1)
      aiIntent: aiAnalysis?.intent,
      aiConfidence: aiAnalysis?.confidence,
      extractedInvoiceNumbers: extractedData?.invoiceNumbers || [],
      extractedPONumbers: extractedData?.poNumbers || [],
      extractedPaymentRefs: extractedData?.paymentReferences || [],
      urgency: extractedData?.urgency || 'normal',
      matchedCaseConfidence: matchedCase?.confidence || null
    };

    try {
      await vmpAdapter.createMessage(
        caseId,
        messageBody,
        'vendor', // sender_type
        'email', // channel_source
        vendorInfo.userId, // sender_user_id
        false, // is_internal_note
        emailMetadata // metadata
      );

      // Log message processed activity
      await vmpAdapter.logPortActivity('email', 'message_processed', 'success', {
        messageId: emailData.messageId,
        caseId: caseId,
        vendorId: vendorInfo.vendorId
      });
    } catch (messageError) {
      logError(messageError, { path: req.path, caseId, operation: 'createMessage' });
      
      // Log error activity
      try {
        await vmpAdapter.logPortActivity('email', 'error', 'error', {
          messageId: emailData.messageId,
          caseId: caseId,
          errorMessage: messageError.message
        });
      } catch (logError) {
        // Don't fail if logging fails
      }
      
      // Continue even if message creation fails - case was created
    }

    // 10. Log case created activity if new case
    if (!caseReference) {
      try {
        await vmpAdapter.logPortActivity('email', 'case_created', 'success', {
          messageId: emailData.messageId,
          caseId: caseId,
          vendorId: vendorInfo.vendorId
        });
      } catch (logError) {
        // Don't fail if logging fails
      }
    }

    // 9. Handle attachments (log for now - full upload to evidence can be added later)
    if (emailData.attachments && emailData.attachments.length > 0) {
      logError(null, {
        path: req.path,
        caseId,
        operation: 'emailAttachments',
        attachmentsCount: emailData.attachments.length,
        attachmentNames: emailData.attachments.map(att => att.filename).join(', ')
      });
    }

    // 10. Return success response
    return res.status(200).json({
      success: true,
      caseId,
      message: 'Email processed successfully',
      caseCreated: !caseReference,
      attachmentsCount: emailData.attachments?.length || 0
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'emailWebhook' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================================================
// SPRINT 9.2: WHATSAPP-TO-CASE WEBHOOK ENDPOINT
// ============================================================================

// POST: WhatsApp Webhook (Sprint 9.2)
app.post('/ports/whatsapp', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // 1. Accept webhook from WhatsApp providers (no auth required - webhook uses secret key)
    // In production, verify webhook signature here
    
    // 2. Determine WhatsApp provider from headers or query param
    const provider = req.query.provider || req.headers['x-whatsapp-provider'] || 'whatsapp';
    
    // 3. Parse WhatsApp webhook payload
    let whatsappData;
    try {
      whatsappData = parseWhatsAppWebhook(req.body, provider);
    } catch (parseError) {
      logError(parseError, { path: req.path, provider, operation: 'parseWhatsAppWebhook' });
      return res.status(400).json({
        error: 'Failed to parse WhatsApp webhook',
        message: parseError.message
      });
    }

    // 4. Skip status updates (only process actual messages)
    if (whatsappData.messageType === 'status') {
      return res.status(200).json({
        success: true,
        message: 'Status update received',
        skipped: true
      });
    }

    // 5. Extract vendor identifier from phone number
    const phoneNumber = extractVendorIdentifierFromWhatsApp(whatsappData);
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Could not extract phone number from webhook'
      });
    }

    // 6. Find vendor by phone number
    let vendorInfo;
    try {
      vendorInfo = await vmpAdapter.findVendorByPhone(phoneNumber);
    } catch (vendorError) {
      logError(vendorError, { path: req.path, phoneNumber, operation: 'findVendorByPhone' });
      return res.status(500).json({
        error: 'Failed to find vendor',
        message: vendorError.message
      });
    }

    if (!vendorInfo) {
      return res.status(404).json({
        error: 'Vendor not found',
        message: `No vendor found for phone number: ${phoneNumber}. Please ensure the phone number is registered with a vendor account.`
      });
    }

    // 7. Extract case reference from message (if replying to existing case)
    const caseReference = extractCaseReferenceFromWhatsApp(whatsappData);

    // 8. Find or create case
    // Convert WhatsApp data to email-like format for reuse
    const emailLikeData = {
      from: whatsappData.fromName ? `${whatsappData.fromName} <${whatsappData.from}@whatsapp>` : `${whatsappData.from}@whatsapp`,
      to: whatsappData.to || '',
      subject: `WhatsApp Message from ${whatsappData.fromName || whatsappData.from}`,
      text: whatsappData.text || '',
      html: whatsappData.text || '',
      attachments: (whatsappData.media || []).map(media => ({
        filename: media.filename || `${media.type}-${media.id || 'unknown'}`,
        contentType: media.mimeType,
        content: null, // Media URLs need to be downloaded separately
        size: 0,
        url: media.url,
        mediaId: media.id
      })),
      headers: {},
      messageId: whatsappData.messageId,
      timestamp: whatsappData.timestamp
    };

    let caseId;
    try {
      caseId = await vmpAdapter.findOrCreateCaseFromEmail(emailLikeData, vendorInfo, caseReference);
    } catch (caseError) {
      logError(caseError, { path: req.path, vendorInfo, caseReference, operation: 'findOrCreateCaseFromWhatsApp' });
      return res.status(500).json({
        error: 'Failed to find or create case',
        message: caseError.message
      });
    }

    // 9. Log webhook received activity
    try {
      await vmpAdapter.logPortActivity('whatsapp', 'webhook_received', 'success', {
        messageId: whatsappData.messageId,
        from: whatsappData.from,
        provider: whatsappData.provider
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Failed to log port activity:', logError);
    }

    // 10. Create message from WhatsApp
    const messageBody = whatsappData.text || `WhatsApp message from ${whatsappData.fromName || whatsappData.from}`;
    const whatsappMetadata = {
      from: whatsappData.from,
      fromName: whatsappData.fromName,
      to: whatsappData.to,
      messageId: whatsappData.messageId,
      messageType: whatsappData.messageType,
      provider: whatsappData.provider,
      media: whatsappData.media,
      metadata: whatsappData.metadata
    };

    try {
      await vmpAdapter.createMessage(
        caseId,
        messageBody,
        'vendor', // sender_type
        'whatsapp', // channel_source
        vendorInfo.userId, // sender_user_id
        false, // is_internal_note
        whatsappMetadata // metadata
      );

      // Log message processed activity
      await vmpAdapter.logPortActivity('whatsapp', 'message_processed', 'success', {
        messageId: whatsappData.messageId,
        caseId: caseId,
        vendorId: vendorInfo.vendorId
      });
    } catch (messageError) {
      logError(messageError, { path: req.path, caseId, operation: 'createMessage' });
      
      // Log error activity
      try {
        await vmpAdapter.logPortActivity('whatsapp', 'error', 'error', {
          messageId: whatsappData.messageId,
          caseId: caseId,
          errorMessage: messageError.message
        });
      } catch (logError) {
        // Don't fail if logging fails
      }
      
      // Continue even if message creation fails - case was created
    }

    // 11. Log case created activity if new case
    if (!caseReference) {
      try {
        await vmpAdapter.logPortActivity('whatsapp', 'case_created', 'success', {
          messageId: whatsappData.messageId,
          caseId: caseId,
          vendorId: vendorInfo.vendorId
        });
      } catch (logError) {
        // Don't fail if logging fails
      }
    }

    // 12. Handle media attachments (download and upload as evidence if needed)
    if (whatsappData.media && whatsappData.media.length > 0) {
      // Log media information for audit trail
      // Full media download and upload to evidence storage can be implemented as needed
      const mediaInfo = whatsappData.media.map(media => ({
        type: media.type,
        mimeType: media.mimeType,
        url: media.url,
        id: media.id,
        filename: media.filename
      }));
      
      logError(null, {
        path: req.path,
        caseId,
        operation: 'whatsappMediaReceived',
        mediaCount: whatsappData.media.length,
        media: mediaInfo
      });
    }

    // 13. Return success response
    return res.status(200).json({
      success: true,
      caseId,
      message: 'WhatsApp message processed successfully',
      caseCreated: !caseReference,
      mediaCount: whatsappData.media?.length || 0
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'whatsappWebhook' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================================================
// SPRINT 9.3: PORT CONFIGURATION UI (Internal Only)
// ============================================================================

// GET: Port Configuration Page
app.get('/ops/ports', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Render response
    res.render('pages/ops_ports.html', {
      title: 'Port Configuration',
      user: req.user,
      isInternal: true
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Port Configuration Partial
app.get('/partials/port-configuration.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Business logic - Get port configurations
    let ports = [];
    try {
      ports = await vmpAdapter.getPortConfiguration();
    } catch (adapterError) {
      logError(adapterError, { path: req.path, operation: 'getPortConfiguration' });
    }

    // 3. Render response
    res.render('partials/port_configuration.html', {
      ports: ports || []
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/port_configuration.html', { ports: [] });
  }
});

// POST: Update Port Configuration
app.post('/ops/ports/:portType', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const portType = req.params.portType;
    const { is_enabled, webhook_url, provider, configuration } = req.body;

    const validPortTypes = ['email', 'whatsapp', 'slack'];
    if (!validPortTypes.includes(portType)) {
      return res.status(400).json({
        error: 'Invalid port type',
        message: `Port type must be one of: ${validPortTypes.join(', ')}`
      });
    }

    // 3. Build update object
    const updates = {};
    if (is_enabled !== undefined) {
      // Handle checkbox: 'true' string or boolean true
      updates.is_enabled = is_enabled === 'true' || is_enabled === true;
    }
    if (webhook_url !== undefined) {
      updates.webhook_url = webhook_url || null;
    }
    if (provider !== undefined) {
      updates.provider = provider || null;
    }
    if (configuration !== undefined) {
      try {
        updates.configuration = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      } catch (parseError) {
        return res.status(400).json({
          error: 'Invalid configuration JSON',
          message: parseError.message
        });
      }
    }

    // 4. Business logic - Update port configuration
    const updatedPort = await vmpAdapter.updatePortConfiguration(portType, updates);

    // 5. Return success response
    return res.status(200).json({
      success: true,
      port: updatedPort,
      message: 'Port configuration updated successfully'
    });

  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, portType: req.params.portType });
    return res.status(500).json({
      error: 'Failed to update port configuration',
      message: error.message
    });
  }
});

// GET: Port Activity Log Partial
app.get('/partials/port-activity-log.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const portType = req.query.port_type || null;
    const limit = parseInt(req.query.limit || '100', 10);

    // 3. Business logic - Get activity log
    let activities = [];
    try {
      activities = await vmpAdapter.getPortActivityLog(portType, limit);
    } catch (adapterError) {
      logError(adapterError, { path: req.path, portType, operation: 'getPortActivityLog' });
    }

    // 4. Render response
    res.render('partials/port_activity_log.html', {
      activities: activities || [],
      portType: portType || 'all'
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/port_activity_log.html', { activities: [], portType: null });
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

// GET: Invoice Card Feed Partial (Sprint 12.1: Action Mode)
app.get('/partials/invoice-card-feed.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Pagination support
    const { status, search, company_id, page = 1 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = 12; // Cards per page
    const offset = (pageNum - 1) * pageSize;

    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    // Get all invoices (we'll paginate in memory for now)
    // TODO: Add pagination to adapter for better performance
    const allInvoices = await vmpAdapter.getInvoices(
      req.user.vendorId,
      company_id || null,
      filters
    );

    // Paginate
    const totalInvoices = allInvoices?.length || 0;
    const paginatedInvoices = allInvoices?.slice(offset, offset + pageSize) || [];
    const hasMore = offset + pageSize < totalInvoices;
    const nextPage = hasMore ? pageNum + 1 : null;

    // 3. Render response
    res.render('partials/invoice_card_feed.html', {
      invoices: paginatedInvoices,
      current_page: pageNum,
      next_page: nextPage,
      has_more: hasMore,
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null,
      request: req
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_card_feed.html', {
      invoices: [],
      current_page: 1,
      next_page: null,
      has_more: false,
      isInternal: req.user?.isInternal || false,
      query: req.query,
      request: req
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

// POST: Request GRN (Sprint 7.1 - Action Button)
app.post('/invoices/:id/request-grn', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.params.id;
    if (!validateUUIDParam(invoiceId, res)) return;

    // 3. Business logic - Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found or access denied'
      });
    }

    // Get matching status to check GRN reference
    const matchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);
    const grnRef = matchingStatus.invoice_grn_ref || 'N/A';

    // Create case with exception details
    const newCase = await vmpAdapter.createCaseFromInvoice(
      invoiceId,
      req.user.vendorId,
      req.user.id,
      `Missing GRN for Invoice ${invoice.invoice_num} (GRN Ref: ${grnRef})`
    );

    // 4. Return updated matching status (HTMX will refresh the partial)
    const updatedMatchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);
    res.render('partials/matching_status.html', {
      matchingStatus: updatedMatchingStatus,
      error: null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to request GRN'
    });
  }
});

// POST: Dispute Amount (Sprint 7.1 - Action Button)
app.post('/invoices/:id/dispute-amount', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.params.id;
    if (!validateUUIDParam(invoiceId, res)) return;

    // 3. Business logic - Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found or access denied'
      });
    }

    // Get matching status to get mismatch details
    const matchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);
    const amountMismatches = matchingStatus.mismatches?.amount || [];
    
    // Build dispute subject with mismatch details
    let disputeSubject = `Amount Dispute for Invoice ${invoice.invoice_num}`;
    if (amountMismatches.length > 0) {
      const firstMismatch = amountMismatches[0];
      if (firstMismatch.type === 'po_invoice') {
        disputeSubject = `Amount Dispute: Invoice ${invoice.invoice_num} (${firstMismatch.currency} ${firstMismatch.invoice_amount}) vs PO (${firstMismatch.currency} ${firstMismatch.po_amount}) - Difference: ${firstMismatch.currency} ${firstMismatch.difference.toFixed(2)}`;
      } else if (firstMismatch.type === 'grn_invoice') {
        disputeSubject = `Amount Dispute: Invoice ${invoice.invoice_num} (${firstMismatch.currency} ${firstMismatch.invoice_amount}) vs GRN (${firstMismatch.currency} ${firstMismatch.grn_amount}) - Difference: ${firstMismatch.currency} ${firstMismatch.difference.toFixed(2)}`;
      }
    }

    // Create case with exception details
    const newCase = await vmpAdapter.createCaseFromInvoice(
      invoiceId,
      req.user.vendorId,
      req.user.id,
      disputeSubject,
      'amount_mismatch'
    );

    // 4. Return updated matching status (HTMX will refresh the partial)
    const updatedMatchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);
    res.render('partials/matching_status.html', {
      matchingStatus: updatedMatchingStatus,
      error: null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to dispute amount'
    });
  }
});

// POST: Report Exception (Sprint 7.2 - Exception Workflow)
app.post('/invoices/:id/report-exception', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const invoiceId = req.params.id;
    if (!validateUUIDParam(invoiceId, res)) return;

    const { exception_type, notes } = req.body;
    if (!exception_type) {
      return res.status(400).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Exception type is required'
      });
    }

    // Validate exception type
    const validExceptionTypes = ['missing_grn', 'amount_mismatch', 'date_mismatch', 'missing_po', 'po_status', 'grn_status'];
    if (!validExceptionTypes.includes(exception_type)) {
      return res.status(400).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invalid exception type'
      });
    }

    // 3. Business logic - Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invoice not found or access denied'
      });
    }

    // Build subject with exception details
    const exceptionLabels = {
      missing_grn: 'Missing GRN',
      amount_mismatch: 'Amount Mismatch',
      date_mismatch: 'Date Mismatch',
      missing_po: 'Missing PO',
      po_status: 'PO Status Issue',
      grn_status: 'GRN Status Issue'
    };
    
    let caseSubject = `${exceptionLabels[exception_type]}: Invoice ${invoice.invoice_num}`;
    if (notes && notes.trim()) {
      caseSubject += ` - ${notes.trim()}`;
    }

    // Create case with exception type
    const newCase = await vmpAdapter.createCaseFromInvoice(
      invoiceId,
      req.user.vendorId,
      req.user.id,
      caseSubject,
      exception_type
    );

    // 4. Return updated matching status (HTMX will refresh the partial)
    const updatedMatchingStatus = await vmpAdapter.getMatchingStatus(invoiceId);
    res.render('partials/matching_status.html', {
      matchingStatus: updatedMatchingStatus,
      error: null
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to report exception'
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

// Legacy login redirects (backward compatibility)
app.get('/login4', (req, res) => {
  if (req.session?.userId) {
    return res.redirect('/home');
  }
  res.redirect(302, '/login');
});

// Legacy login2 redirect (backward compatibility)
app.get('/login2', (req, res) => {
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

// 3b. Login Route Consistency
// Production: /login → login3.html (LOCKED)
// Legacy redirects: /login2, /login4 → /login (backward compatibility)

// 3c. Logout Handler
app.post('/logout', async (req, res) => {
  // Destroy session (express-session handles cleanup in PostgreSQL)
  req.session.destroy((err) => {
    if (err) {
      logError(err, { path: req.path, operation: 'logout' });
    }
    res.redirect('/login');
  });
});

// 3b. Legacy Login Routes (Redirect to canonical /login)
// - /login2 → /login (backward compatibility)
// - /login4 → /login (backward compatibility)

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
// ============================================================================
// SPRINT 10.1: COMMAND PALETTE SEARCH API
// ============================================================================

// GET: Command Palette Search (Enhanced with AI - Sprint 13.3)
app.get('/api/command-palette/search', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const query = req.query.q || '';
    if (!query || query.length < 2) {
      // Return suggestions for empty/short queries
      const suggestions = await generateSearchSuggestions(query, [], {
        vendorId: req.user.vendorId,
        isInternal: req.user.isInternal
      });
      return res.json({ 
        results: [],
        suggestions,
        intent: { type: 'general', confidence: 0 }
      });
    }

    // 3. AI-Powered Search (Sprint 13.3)
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.json({ results: [], error: 'Vendor ID not available' });
    }

    // Parse search intent
    const intent = await parseSearchIntent(query);
    
    const results = [];
    const searchTerm = query.toLowerCase().trim();

    // 4. Search Cases (with intent-based filtering)
    try {
      const allCases = await vmpAdapter.getInbox(vendorId, {});
      let filteredCases = allCases.filter(caseItem => {
        const subject = (caseItem.subject || '').toLowerCase();
        const caseNum = (caseItem.case_num || '').toLowerCase();
        const id = (caseItem.id || '').toLowerCase();
        return subject.includes(searchTerm) || caseNum.includes(searchTerm) || id.includes(searchTerm);
      });

      // Apply intent filters
      if (intent.filters.status) {
        filteredCases = filteredCases.filter(c => c.status === intent.filters.status);
      }

      filteredCases.slice(0, 5).forEach(caseItem => {
        results.push({
          id: `case-${caseItem.id}`,
          category: 'Cases',
          label: caseItem.subject || `Case ${caseItem.case_num || caseItem.id.substring(0, 8)}`,
          hint: `Status: ${caseItem.status || 'open'} • ${caseItem.case_type || 'general'}`,
          url: `/cases/${caseItem.id}`,
          action: 'navigate',
          icon: '📋',
          metadata: `${caseItem.case_num || ''} ${caseItem.subject || ''}`,
          timestamp: caseItem.created_at
        });
      });
    } catch (caseError) {
      logError(caseError, { path: req.path, operation: 'searchCases' });
    }

    // 5. Search Invoices (with intent-based filtering)
    try {
      const allInvoices = await vmpAdapter.getInvoices(vendorId);
      let filteredInvoices = allInvoices.filter(invoice => {
        const invoiceNum = (invoice.invoice_num || '').toLowerCase();
        const id = (invoice.id || '').toLowerCase();
        return invoiceNum.includes(searchTerm) || id.includes(searchTerm);
      });

      // Apply intent filters
      if (intent.filters.status) {
        filteredInvoices = filteredInvoices.filter(i => i.status === intent.filters.status);
      }
      if (intent.filters.amount) {
        filteredInvoices = filteredInvoices.filter(i => Math.abs(i.amount - intent.filters.amount) < 100);
      }

      filteredInvoices.slice(0, 5).forEach(invoice => {
        results.push({
          id: `invoice-${invoice.id}`,
          category: 'Invoices',
          label: invoice.invoice_num || `Invoice ${invoice.id.substring(0, 8)}`,
          hint: `Amount: ${invoice.currency_code || 'USD'} ${(invoice.amount || 0).toFixed(2)} • ${invoice.status || 'pending'}`,
          url: `/invoices/${invoice.id}`,
          action: 'navigate',
          icon: '🧾',
          metadata: `${invoice.invoice_num || ''} ${invoice.vmp_companies?.name || ''}`,
          timestamp: invoice.created_at
        });
      });
    } catch (invoiceError) {
      logError(invoiceError, { path: req.path, operation: 'searchInvoices' });
    }

    // 6. Search Payments (with intent-based filtering)
    try {
      const allPayments = await vmpAdapter.getPayments(vendorId);
      let filteredPayments = allPayments.filter(payment => {
        const paymentRef = (payment.payment_ref || '').toLowerCase();
        const id = (payment.id || '').toLowerCase();
        return paymentRef.includes(searchTerm) || id.includes(searchTerm);
      });

      // Apply intent filters
      if (intent.filters.status) {
        filteredPayments = filteredPayments.filter(p => p.status === intent.filters.status);
      }
      if (intent.filters.amount) {
        filteredPayments = filteredPayments.filter(p => Math.abs(p.amount - intent.filters.amount) < 100);
      }
      if (intent.filters.dateRange) {
        const now = new Date();
        const rangeStart = new Date(now);
        if (intent.filters.dateRange === 'today') {
          rangeStart.setHours(0, 0, 0, 0);
        } else if (intent.filters.dateRange === 'week') {
          rangeStart.setDate(now.getDate() - 7);
        } else if (intent.filters.dateRange === 'month') {
          rangeStart.setMonth(now.getMonth() - 1);
        }
        filteredPayments = filteredPayments.filter(p => new Date(p.payment_date || p.created_at) >= rangeStart);
      }

      filteredPayments.slice(0, 5).forEach(payment => {
        results.push({
          id: `payment-${payment.id}`,
          category: 'Payments',
          label: payment.payment_ref || `Payment ${payment.id.substring(0, 8)}`,
          hint: `Amount: ${payment.currency_code || 'USD'} ${(payment.amount || 0).toFixed(2)} • ${payment.status || 'pending'}`,
          url: `/payments/${payment.id}`,
          action: 'navigate',
          icon: '💰',
          metadata: `${payment.payment_ref || ''} ${payment.vmp_companies?.name || ''}`,
          timestamp: payment.payment_date || payment.created_at
        });
      });
    } catch (paymentError) {
      logError(paymentError, { path: req.path, operation: 'searchPayments' });
    }

    // 7. Add Quick Actions based on search term
    if (searchTerm.includes('new') || searchTerm.includes('create')) {
      results.push({
        id: 'action-new-case',
        category: 'Actions',
        label: 'New Case',
        hint: 'Create a new case',
        url: '/cases/new',
        action: 'navigate',
        icon: '➕',
        shortcut: '⌘N'
      });
    }

    if (searchTerm.includes('invoice') || searchTerm.includes('invoices')) {
      results.push({
        id: 'action-view-invoices',
        category: 'Actions',
        label: 'View All Invoices',
        hint: 'Browse all invoices',
        url: '/invoices',
        action: 'navigate',
        icon: '📋'
      });
    }

    if (searchTerm.includes('payment') || searchTerm.includes('payments')) {
      results.push({
        id: 'action-view-payments',
        category: 'Actions',
        label: 'View Payment History',
        hint: 'Browse payment timeline',
        url: '/payments/history',
        action: 'navigate',
        icon: '💰'
      });
    }

    // 8. Enhance results with AI (Sprint 13.3)
    const { enhanceSearchResults } = await import('./src/utils/ai-search.js');
    const enhancedResults = await enhanceSearchResults(results, intent, {
      vendorId: req.user.vendorId,
      isInternal: req.user.isInternal
    });

    // Generate suggestions
    const suggestions = await generateSearchSuggestions(query, [], {
      vendorId: req.user.vendorId,
      isInternal: req.user.isInternal
    });

    // 9. Return enhanced results
    return res.json({ 
      results: enhancedResults,
      intent,
      suggestions,
      totalResults: enhancedResults.length
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'commandPaletteSearch' });
    return res.json({ results: [] });
  }
});

// ============================================================================
// SPRINT 11.1: BULK ACTIONS API
// ============================================================================

// POST: Bulk Actions (Cases, Invoices, Payments)
app.post('/api/bulk-actions/:listType/:action', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { listType, action } = req.params;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'No items selected',
        message: 'Please select at least one item to perform the action'
      });
    }

    // Validate UUIDs
    for (const id of ids) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(id)) {
        return res.status(400).json({
          error: 'Invalid ID format',
          message: `Invalid ID: ${id}`
        });
      }
    }

    const validListTypes = ['cases', 'invoices', 'payments'];
    const validActions = ['approve', 'reject', 'export', 'close'];

    if (!validListTypes.includes(listType)) {
      return res.status(400).json({
        error: 'Invalid list type',
        message: `List type must be one of: ${validListTypes.join(', ')}`
      });
    }

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        message: `Action must be one of: ${validActions.join(', ')}`
      });
    }

    // 3. Business logic - Execute bulk action
    let results = [];
    
    try {
      switch (listType) {
        case 'cases':
          results = await executeBulkCaseAction(action, ids, req.user);
          break;
        case 'invoices':
          results = await executeBulkInvoiceAction(action, ids, req.user);
          break;
        case 'payments':
          results = await executeBulkPaymentAction(action, ids, req.user);
          break;
      }
    } catch (actionError) {
      logError(actionError, { path: req.path, listType, action, ids, operation: 'bulkAction' });
      return res.status(500).json({
        error: 'Failed to execute bulk action',
        message: actionError.message
      });
    }

    // 4. Return success response
    return res.status(200).json({
      success: true,
      action,
      listType,
      processed: results.length,
      results
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'bulkAction' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Helper: Execute bulk case actions
async function executeBulkCaseAction(action, caseIds, user) {
  const results = [];
  
  for (const caseId of caseIds) {
    try {
      // Verify case access
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, user.vendorId);
      if (!caseDetail) {
        results.push({ id: caseId, success: false, error: 'Case not found or access denied' });
        continue;
      }

      switch (action) {
        case 'approve':
          // Approve case (internal only)
          if (!user.isInternal) {
            results.push({ id: caseId, success: false, error: 'Unauthorized' });
            continue;
          }
          await vmpAdapter.updateCaseStatus(caseId, 'resolved', user.id);
          results.push({ id: caseId, success: true });
          break;

        case 'reject':
          // Reject case (internal only)
          if (!user.isInternal) {
            results.push({ id: caseId, success: false, error: 'Unauthorized' });
            continue;
          }
          await vmpAdapter.updateCaseStatus(caseId, 'rejected', user.id);
          results.push({ id: caseId, success: true });
          break;

        case 'close':
          // Close case (vendor can close their own cases)
          if (caseDetail.vendor_id !== user.vendorId && !user.isInternal) {
            results.push({ id: caseId, success: false, error: 'Unauthorized' });
            continue;
          }
          await vmpAdapter.updateCaseStatus(caseId, 'resolved', user.id);
          results.push({ id: caseId, success: true });
          break;

        case 'export':
          // Export case data (return case info for export)
          results.push({ id: caseId, success: true, data: caseDetail });
          break;

        default:
          results.push({ id: caseId, success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logError(error, { caseId, action, operation: 'executeBulkCaseAction' });
      results.push({ id: caseId, success: false, error: error.message });
    }
  }

  return results;
}

// Helper: Execute bulk invoice actions
async function executeBulkInvoiceAction(action, invoiceIds, user) {
  const results = [];
  
  for (const invoiceId of invoiceIds) {
    try {
      // Verify invoice access
      const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, user.vendorId);
      if (!invoice) {
        results.push({ id: invoiceId, success: false, error: 'Invoice not found or access denied' });
        continue;
      }

      switch (action) {
        case 'approve':
        case 'reject':
        case 'close':
          // These actions don't apply to invoices directly
          results.push({ id: invoiceId, success: false, error: 'Action not applicable to invoices' });
          break;

        case 'export':
          // Export invoice data
          results.push({ id: invoiceId, success: true, data: invoice });
          break;

        default:
          results.push({ id: invoiceId, success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logError(error, { invoiceId, action, operation: 'executeBulkInvoiceAction' });
      results.push({ id: invoiceId, success: false, error: error.message });
    }
  }

  return results;
}

// Helper: Execute bulk payment actions
async function executeBulkPaymentAction(action, paymentIds, user) {
  const results = [];
  
  for (const paymentId of paymentIds) {
    try {
      // Verify payment access
      const payment = await vmpAdapter.getPaymentDetail(paymentId, user.vendorId);
      if (!payment) {
        results.push({ id: paymentId, success: false, error: 'Payment not found or access denied' });
        continue;
      }

      switch (action) {
        case 'approve':
        case 'reject':
        case 'close':
          // These actions don't apply to payments directly
          results.push({ id: paymentId, success: false, error: 'Action not applicable to payments' });
          break;

        case 'export':
          // Export payment data
          results.push({ id: paymentId, success: true, data: payment });
          break;

        default:
          results.push({ id: paymentId, success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logError(error, { paymentId, action, operation: 'executeBulkPaymentAction' });
      results.push({ id: paymentId, success: false, error: error.message });
    }
  }

  return results;
}

// ============================================================================
// SPRINT 12.3: PUSH NOTIFICATIONS API
// ============================================================================

// POST: Subscribe to Push Notifications
app.post('/api/push/subscribe', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        error: 'Invalid subscription',
        message: 'Subscription object with endpoint is required'
      });
    }

    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({
        error: 'Invalid subscription',
        message: 'Subscription must include p256dh and auth keys'
      });
    }

    // 3. Store subscription in database
    const userAgent = req.get('user-agent') || null;
    const storedSubscription = await vmpAdapter.storePushSubscription(
      req.user.id,
      req.user.vendorId,
      subscription,
      userAgent
    );

    if (!storedSubscription) {
      return res.status(500).json({
        error: 'Failed to store subscription',
        message: 'Could not save push subscription to database'
      });
    }
    
    // 4. Return success
    return res.json({
      success: true,
      message: 'Push subscription registered',
      subscription: {
        id: storedSubscription.id,
        endpoint: storedSubscription.endpoint
      }
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'pushSubscribe', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST: Unsubscribe from Push Notifications
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Subscription endpoint is required'
      });
    }

    // 3. Remove subscription from database
    const removed = await vmpAdapter.removePushSubscription(req.user.id, endpoint);
    
    if (!removed) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'No active subscription found for this endpoint'
      });
    }
    
    // 4. Return success
    return res.json({
      success: true,
      message: 'Push subscription removed'
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'pushUnsubscribe', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================================================
// SPRINT 13.2: AI DATA VALIDATION API
// ============================================================================

// GET: Validate Case Data
app.get('/api/cases/:id/validate', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res)) return;

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(500).json({
        error: 'Vendor ID not available'
      });
    }

    // Get case data
    const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
    if (!caseDetail) {
      return res.status(404).json({
        error: 'Case not found'
      });
    }

    // Verify access
    if (caseDetail.vendor_id !== vendorId && !req.user?.isInternal) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get checklist steps and evidence
    const checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
    const evidence = await vmpAdapter.getEvidence(caseId);

    // Run validation
    const validationResult = await validateCaseData(caseDetail, checklistSteps, evidence);

    // Generate response message
    const response = generateValidationResponse(validationResult, caseDetail);

    // 4. Return result
    return res.json({
      validation: validationResult,
      response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'validateCase', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST: Auto-respond to validation issues (AI-generated message)
app.post('/api/cases/:id/auto-respond', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res)) return;

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(500).json({
        error: 'Vendor ID not available'
      });
    }

    // Get case data
    const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
    if (!caseDetail) {
      return res.status(404).json({
        error: 'Case not found'
      });
    }

    // Verify access (internal only for auto-respond)
    if (!req.user?.isInternal) {
      return res.status(403).json({
        error: 'Access denied - internal users only'
      });
    }

    // Get validation result
    const checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
    const evidence = await vmpAdapter.getEvidence(caseId);
    const validationResult = await validateCaseData(caseDetail, checklistSteps, evidence);

    // Generate response
    const response = generateValidationResponse(validationResult, caseDetail);

    // Create AI message in case thread
    if (response.message && validationResult.missingRequired.length > 0) {
      await vmpAdapter.createMessage(
        caseId,
        response.message,
        'ai', // sender_type
        'portal', // channel_source
        null, // sender_user_id (AI)
        false // is_internal_note
      );
    }

    // 4. Return result
    return res.json({
      success: true,
      message: 'Auto-response sent',
      response,
      validation: validationResult
    });

  } catch (error) {
    logError(error, { path: req.path, operation: 'autoRespond', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

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
  const server = app.listen(PORT, () => {
    console.log(`NexusCanon VMP (Phase 0) running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Please stop the process using port ${PORT} or change PORT in .env`);
      console.error(`   To find the process: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

