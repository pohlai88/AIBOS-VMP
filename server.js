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
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { applyDecision } from './src/services/decisions/applyDecision.js';
import vendorRouter from './src/routes/vendor.js';
import clientRouter from './src/routes/client.js';
import { attachSupabaseClient } from './src/middleware/supabase-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { vmpAdapter } from './src/adapters/supabase.js';
import {
  createErrorResponse,
  logError,
  NotFoundError,
  ValidationError,
  VMPError,
  DatabaseError,
} from './src/utils/errors.js';
import {
  requireAuth,
  requireInternal,
  validateUUIDParam,
  validateRequired,
  validateRequiredQuery,
  handleRouteError,
  handlePartialError,
} from './src/utils/route-helpers.js';
import {
  parseEmailWebhook,
  extractCaseReference,
  extractVendorIdentifier,
} from './src/utils/email-parser.js';
import {
  parseWhatsAppWebhook,
  extractCaseReferenceFromWhatsApp,
  extractVendorIdentifierFromWhatsApp,
} from './src/utils/whatsapp-parser.js';
import {
  classifyMessageIntent,
  extractStructuredData,
  findBestMatchingCase,
} from './src/utils/ai-message-parser.js';
import { validateCaseData, generateValidationResponse } from './src/utils/ai-data-validation.js';
import { parseSearchIntent, generateSearchSuggestions } from './src/utils/ai-search.js';
import { checkAndSendSLAReminders, getSLAReminderStats } from './src/utils/sla-reminders.js';
// Export utilities removed (not currently used in server routes)
import { sendInviteEmail } from './src/utils/notifications.js';
import {
  detectPeriodFromFilename,
  formatUserFriendlyError,
  getPeriodSuggestions,
} from './src/utils/soa-upload-helpers.js';

// Timeout wrapper for async operations (local helper)
const withTimeout = async (promise, timeoutMs = 10000, operationName = 'operation') => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    logError(error, { operation: operationName, timeoutMs });
    throw error;
  }
};

// Helper to safely extract string from query/param (handles string | string[])
const getStringParam = value => {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
};

// Environment validation
dotenv.config();
const env = cleanEnv(process.env, {
  SUPABASE_URL: url({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  SUPABASE_ANON_KEY: str({ default: '' }), // For Supabase Auth client operations
  SESSION_DB_URL: str(), // PostgreSQL connection string for session store (required)
  DEMO_VENDOR_ID: str({ default: '' }),
  SESSION_SECRET: str({ default: 'dev-secret-change-in-production' }),
  PORT: str({ default: '9000' }),
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  BASE_URL: str({ default: 'http://localhost:9000' }), // For password reset redirects
  BASE_PATH: str({ default: '' }), // Base path for sub-directory deployment (e.g., /VMP)
  // Rollback switch for home page (allows quick rollback without code changes)
  // Note: Login route is LOCKED to login3.html (no rollback switch)
  VMP_HOME_PAGE: str({ default: 'home' }),
  // VAPID keys for push notifications (optional)
  VAPID_PUBLIC_KEY: str({ default: '' }),
  VAPID_PRIVATE_KEY: str({ default: '' }),
});

// Create Supabase ADMIN client (service_role - BYPASSES RLS)
// ONLY use for:
// - Admin operations (user creation, bulk imports)
// - Internal cron jobs
// - Legacy vmpAdapter methods (until refactored)
// For user requests, use req.supabase (RLS-enforced)
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Alias for backward compatibility with existing code
// TODO: Remove this after migrating all routes to req.supabase
const supabase = supabaseAdmin;

// Create Supabase client for Auth operations (uses anon key for client-side auth)
// Falls back to service role if anon key not provided (for admin auth operations)
const supabaseAuth = env.SUPABASE_ANON_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase; // Fallback to service role client if anon key not set

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Multer FileFilterCallback accepts Error | null as first parameter
      // @ts-expect-error - Multer types are correctly defined but TypeScript inference is incorrect
      cb(
        new Error(
          `File type ${file.mimetype} not allowed. Allowed types: PDF, images, Word, Excel`
        ),
        false
      );
    }
  },
});

// --- SECURITY MIDDLEWARE ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://fonts.googleapis.com',
        ],
        styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://unpkg.com',
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net',
        ],
        scriptSrcAttr: ["'unsafe-hashes'"], // Allow inline event handlers (onclick, etc.)
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://cdn.jsdelivr.net',
          'https://raw.githubusercontent.com',
          'https://fonts.googleapis.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          env.SUPABASE_URL,
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
      },
    },
  })
);

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

// Base path helper (subdirectory deployments)
const BASE_PATH = env.BASE_PATH || '';
// Optional feature flag to enable decision engine path (defaults to off to avoid behavior change)
const USE_DECISION_ENGINE = process.env.USE_DECISION_ENGINE === 'true';

// --- CONFIG ---
const nunjucksEnv = nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  watch: env.NODE_ENV === 'development',
});

// Add global variables for templates
nunjucksEnv.addGlobal('vapid_public_key', env.VAPID_PUBLIC_KEY || '');
nunjucksEnv.addGlobal('supabase_url', env.SUPABASE_URL || '');
nunjucksEnv.addGlobal('supabase_anon_key', env.SUPABASE_ANON_KEY || '');
nunjucksEnv.addGlobal('base_path', env.BASE_PATH || ''); // Base path for sub-directory deployment
nunjucksEnv.addGlobal('url', (p = '') => {
  const base = (BASE_PATH || '').replace(/\/+$/, '');
  const path = String(p || '');
  const norm = path.startsWith('/') ? path : `/${path}`;
  return `${base}${norm}` || norm;
});

// Add custom filters
nunjucksEnv.addFilter('upper', str => {
  return str ? String(str).toUpperCase() : '';
});

nunjucksEnv.addFilter('tojson', obj => {
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
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const patterns = {
      '%b %d': () => {
        return `${months[d.getMonth()]} ${d.getDate()}`;
      },
      '%H:%M': () => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      },
      '%b %d %H:%M': () => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${months[d.getMonth()]} ${d.getDate()} ${hours}:${minutes}`;
      },
      '%Y-%m-%d': () => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
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

// File size formatting filter (human-readable bytes)
nunjucksEnv.addFilter('filesizeformat', bytes => {
  if (!bytes || bytes === 0) return '0 B';

  try {
    const kb = 1024;
    const mb = kb * 1024;
    const gb = mb * 1024;

    if (bytes >= gb) {
      return `${(bytes / gb).toFixed(2)} GB`;
    } else if (bytes >= mb) {
      return `${(bytes / mb).toFixed(2)} MB`;
    } else if (bytes >= kb) {
      return `${(bytes / kb).toFixed(2)} KB`;
    } else {
      return `${bytes} B`;
    }
  } catch (error) {
    logError(error, { operation: 'filesizeformatFilter', input: bytes });
    return String(bytes);
  }
});

// Format filter (Python-style string formatting)
nunjucksEnv.addFilter('format', (value, formatStr) => {
  if (value === null || value === undefined) return '';

  try {
    // Handle %.2f pattern (decimal formatting)
    if (formatStr === '%.2f' || formatStr === '%0.2f') {
      const num = parseFloat(value);
      if (isNaN(num)) return '0.00';
      return num.toFixed(2);
    }

    // Handle %d pattern (integer formatting)
    if (formatStr === '%d' || formatStr === '%i') {
      const num = parseInt(value, 10);
      if (isNaN(num)) return '0';
      return String(num);
    }

    // Default: return value as string
    return String(value);
  } catch (error) {
    logError(error, { operation: 'formatFilter', input: value, format: formatStr });
    return String(value);
  }
});

// Serve static files with base path support
if (env.BASE_PATH) {
  app.use(env.BASE_PATH, express.static('public'));
} else {
  app.use(express.static('public'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Expose basePath to all templates and handlers
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  next();
});

// PWA Manifest and Service Worker (Sprint 12.2)
// Support base path for sub-directory deployment
const manifestPath = env.BASE_PATH ? `${env.BASE_PATH}/manifest.json` : '/manifest.json';
const swPath = env.BASE_PATH ? `${env.BASE_PATH}/sw.js` : '/sw.js';
const offlinePath = env.BASE_PATH ? `${env.BASE_PATH}/offline.html` : '/offline.html';

app.get(manifestPath, (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get(swPath, (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', env.BASE_PATH || '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get(offlinePath, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'offline.html'));
});

// PostgreSQL Session Store (Production-Ready)
// Uses Supabase PostgreSQL connection via connect-pg-simple
// SESSION_DB_URL is validated by envalid above - will fail fast if missing
const PgSession = connectPgSimple(session);

const sessionStore = new PgSession({
  conString: env.SESSION_DB_URL,
  tableName: 'session',
  createTableIfMissing: true,
});

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
    },
  })
);

// --- MIDDLEWARE: RLS-Enforced Supabase Client ---
// Attach user-scoped Supabase client to req.supabase
// Uses anon key + user JWT so RLS policies are enforced
// CRITICAL: This ensures "Tenant Isolation Is Absolute" at database level
app.use(attachSupabaseClient);

// --- MIDDLEWARE: Supabase Auth (Session Lookup) ---
app.use(async (req, res, next) => {
  // Skip auth for public routes
  const publicRoutes = [
    '/login',
    '/',
    '/health',
    '/manifesto',
    '/accept',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
  ];
  if (publicRoutes.includes(req.path) || req.path.startsWith('/partials/login-')) {
    return next();
  }

  // Test mode: Allow bypass with test header (for automated testing)
  if (env.NODE_ENV === 'test' && req.headers['x-test-auth'] === 'bypass') {
    const testUserId = req.headers['x-test-user-id'] || 'test-user-id';
    const testVendorId = req.headers['x-test-vendor-id'] || env.DEMO_VENDOR_ID;
    const testTenantId = req.headers['x-test-tenant-id'] || null;
    const isInternal = req.headers['x-test-is-internal'] === 'true';

    // Ensure testUserId and testVendorId are strings (not string[])
    const userId = Array.isArray(testUserId) ? testUserId[0] : testUserId;
    const vendorId = Array.isArray(testVendorId) ? testVendorId[0] : testVendorId;
    const tenantId = Array.isArray(testTenantId) ? testTenantId[0] : testTenantId;

    req.user = {
      id: userId,
      email: 'test@example.com',
      displayName: 'Test User',
      vendorId: vendorId,
      vendor: { id: vendorId, name: 'Test Vendor', tenant_id: tenantId || '' },
      isInternal: isInternal || false,
    };
    return next();
  }

  // Check if user is stored in session FIRST (before dev mode bypass)
  // This ensures logged-in users use their actual session, not dev mode
  if (!req.session.userId || !req.session.authToken) {
    // Only apply dev mode bypass when there's NO session
    // Development mode: Auto-bypass authentication (for development when password is not configured)
    if (env.NODE_ENV === 'development') {
      const devVendorId = env.DEMO_VENDOR_ID;

      // Try to get vendor from database if DEMO_VENDOR_ID is set
      let vendor = null;
      if (devVendorId) {
        try {
          vendor = await vmpAdapter.getVendorById(devVendorId);
        } catch (error) {
          // If vendor lookup fails, use fallback
          logError(error, { operation: 'devBypass', vendorId: devVendorId });
        }
      }

      // Use vendor from DB or create fallback
      if (!vendor) {
        vendor = {
          id: devVendorId || 'dev-vendor-id',
          name: 'Development Vendor',
        };
      }

      // Use a well-known dev UUID for authId (required for getVendorContext calls)
      // This UUID is reserved for development mode and will be handled specially
      const DEV_AUTH_UUID = '00000000-0000-0000-0000-000000000000';

      req.user = {
        id: 'dev-user-id', // vendor_user ID (for database operations)
        authId: DEV_AUTH_UUID, // Supabase Auth UUID (for getVendorContext calls)
        email: 'dev@example.com',
        displayName: 'Development User',
        vendorId: vendor.id,
        vendor: vendor,
        isInternal: false,
        user_tier: 'institutional',
        is_active: true,
      };
      return next();
    }

    // No session and not in dev mode - redirect to login
    return res.redirect('/login');
  }

  try {
    // Verify session token with Supabase Auth
    // Use supabaseAuth (anon key) to verify tokens created during login
    // Implement automatic token refresh before expiration
    let user = null;
    let error = null;
    let sessionSet = false;
    let refreshedSession = false;

    // Try setSession if we have a refresh token
    if (req.session.refreshToken) {
      const { data: sessionData, error: sessionError } = await supabaseAuth.auth.setSession({
        access_token: req.session.authToken,
        refresh_token: req.session.refreshToken,
      });

      if (!sessionError && sessionData?.session) {
        // Session set successfully, get user from session
        sessionSet = true;
        const getUserResult = await supabaseAuth.auth.getUser();
        user = getUserResult.data?.user || null;
        error = getUserResult.error || null;

        // If session was refreshed, update stored tokens
        if (sessionData.session.access_token !== req.session.authToken) {
          refreshedSession = true;
          req.session.authToken = sessionData.session.access_token;
          if (sessionData.session.refresh_token) {
            req.session.refreshToken = sessionData.session.refresh_token;
          }
          // Save updated session
          req.session.save(err => {
            if (err)
              logError(err, { operation: 'authMiddleware-saveRefreshedSession', path: req.path });
          });
        }
      } else {
        // setSession failed, try to refresh token if error indicates expiration
        if (
          sessionError?.message?.includes('expired') ||
          sessionError?.message?.includes('invalid')
        ) {
          // Try to refresh using refresh token
          const { data: refreshData, error: refreshError } = await supabaseAuth.auth.refreshSession(
            {
              refresh_token: req.session.refreshToken,
            }
          );

          if (!refreshError && refreshData?.session) {
            // Token refreshed successfully
            refreshedSession = true;
            req.session.authToken = refreshData.session.access_token;
            if (refreshData.session.refresh_token) {
              req.session.refreshToken = refreshData.session.refresh_token;
            }
            req.session.save(err => {
              if (err)
                logError(err, { operation: 'authMiddleware-saveRefreshedSession', path: req.path });
            });

            // Set the new session and get user
            const { data: newSessionData, error: newSessionError } =
              await supabaseAuth.auth.setSession({
                access_token: refreshData.session.access_token,
                refresh_token: refreshData.session.refresh_token,
              });

            if (!newSessionError && newSessionData?.session) {
              sessionSet = true;
              const getUserResult = await supabaseAuth.auth.getUser();
              user = getUserResult.data?.user || null;
              error = getUserResult.error || null;
            }
          } else {
            // Refresh failed, fall through to getUser(token) fallback
            logError(refreshError || new Error('Token refresh failed'), {
              operation: 'authMiddleware-refreshToken',
              path: req.path,
              willTryFallback: true,
            });
          }
        } else {
          // setSession failed for other reasons, fall through to getUser(token) fallback
          logError(sessionError || new Error('setSession failed'), {
            operation: 'authMiddleware-setSession',
            path: req.path,
            willTryFallback: true,
          });
        }
      }
    }

    // Fallback: Use getUser(token) directly if setSession failed or no refresh token
    if (!user) {
      const getUserResult = await supabaseAuth.auth.getUser(req.session.authToken);
      user = getUserResult.data?.user || null;
      error = getUserResult.error || null;

      // If token is expired and we have refresh token, try to refresh
      if (error && error.message?.includes('expired') && req.session.refreshToken) {
        const { data: refreshData, error: refreshError } = await supabaseAuth.auth.refreshSession({
          refresh_token: req.session.refreshToken,
        });

        if (!refreshError && refreshData?.session) {
          // Token refreshed, update session and retry
          refreshedSession = true;
          req.session.authToken = refreshData.session.access_token;
          if (refreshData.session.refresh_token) {
            req.session.refreshToken = refreshData.session.refresh_token;
          }
          req.session.save(err => {
            if (err)
              logError(err, { operation: 'authMiddleware-saveRefreshedSession', path: req.path });
          });

          // Retry getUser with new token
          const retryResult = await supabaseAuth.auth.getUser(refreshData.session.access_token);
          user = retryResult.data?.user || null;
          error = retryResult.error || null;
        }
      }
    }

    if (error || !user) {
      // Invalid token - destroy session
      logError(error || new Error('User not found from token'), {
        operation: 'authMiddleware-getUser',
        path: req.path,
        hasToken: !!req.session.authToken,
        hasRefreshToken: !!req.session.refreshToken,
        sessionSet: sessionSet,
        refreshedSession: refreshedSession,
      });
      req.session.destroy(err => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
      return res.redirect('/login');
    }

    // Validate user.id is a valid UUID (required for getVendorContext)
    if (!user.id || typeof user.id !== 'string') {
      logError(new Error('Invalid user.id from Supabase Auth'), {
        userId: user.id,
        path: req.path,
        userEmail: user.email,
      });
      req.session.destroy(err => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
      return res.redirect('/login');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      logError(new Error('user.id is not a valid UUID format'), {
        userId: user.id,
        path: req.path,
        userEmail: user.email,
      });
      req.session.destroy(err => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
      return res.redirect('/login');
    }

    // Check if user is active (stored in user_metadata)
    const isActive = user.user_metadata?.is_active !== false;
    if (!isActive) {
      req.session.destroy(err => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
      return res.redirect('/login');
    }

    // Get user context (handles both institutional and independent users)
    // Skip getVendorContext for dev mode placeholder UUID (handled by getVendorContext internally)
    let userContext;
    try {
      userContext = await vmpAdapter.getVendorContext(user.id);
    } catch (contextError) {
      // Check if this is a dev mode UUID that should be handled gracefully
      const DEV_AUTH_UUID = '00000000-0000-0000-0000-000000000000';
      if (user.id === DEV_AUTH_UUID && env.NODE_ENV === 'development') {
        // Dev mode - getVendorContext should handle this, but if it fails, use fallback
        userContext = {
          id: 'dev-user-id',
          email: 'dev@example.com',
          display_name: 'Development User',
          vendor_id: env.DEMO_VENDOR_ID || null,
          tenant_id: null,
          vmp_vendors: null,
          user_tier: 'institutional',
          is_internal: false,
          is_active: true,
        };
      } else {
        logError(contextError, {
          operation: 'authMiddleware-getVendorContext',
          userId: user.id,
          userEmail: user.email,
          path: req.path,
        });
        req.session.destroy(err => {
          if (err) logError(err, { operation: 'authMiddleware', path: req.path });
        });
        return res.redirect('/login');
      }
    }

    if (!userContext) {
      logError(new Error('User context not found'), {
        userId: user.id,
        userEmail: user.email,
        path: req.path,
      });
      req.session.destroy(err => {
        if (err) logError(err, { operation: 'authMiddleware', path: req.path });
      });
      return res.redirect('/login');
    }

    // Set user on request (includes user_tier for independent users)
    // IMPORTANT: Store both authUserId (Supabase Auth UUID) and vendorUserId (vmp_vendor_users ID)
    // Use authUserId when calling getVendorContext, use vendorUserId for other operations
    const isInternal = userContext.is_internal === true || false;
    req.user = {
      id: userContext.id, // vendor_user ID (for database operations)
      authId: user.id, // Supabase Auth UUID (for getVendorContext calls)
      email: userContext.email,
      displayName: userContext.display_name || userContext.email,
      vendorId: userContext.vendor_id || null,
      vendor: userContext.vmp_vendors || null,
      user_tier: userContext.user_tier === 'independent' ? 'independent' : 'institutional',
      isInternal: isInternal,
      role: isInternal ? 'admin' : 'operator', // For UI display (ADMIN/OPERATOR badge)
      is_active: userContext.is_active !== false,
    };

    next();
  } catch (error) {
    logError(error, { operation: 'authMiddleware', path: req.path });
    req.session.destroy(err => {
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
  // Check if this is a password reset redirect from Supabase
  // Supabase may redirect to Site URL with token in hash or query
  const accessToken = getStringParam(req.query.access_token);
  const tokenHash = getStringParam(req.query.token_hash);
  const type = getStringParam(req.query.type);
  const hash = req.url.split('#')[1] || '';

  // If recovery token is present, redirect to reset-password page
  if (
    type === 'recovery' &&
    (accessToken || tokenHash || hash.includes('access_token') || hash.includes('token_hash'))
  ) {
    // Preserve the token in the redirect
    if (accessToken) {
      return res.redirect(
        `/reset-password?access_token=${encodeURIComponent(accessToken)}&type=recovery`
      );
    }
    if (tokenHash) {
      return res.redirect(
        `/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      );
    }
    // If token is in hash, redirect with hash preserved
    if (hash) {
      return res.redirect(`/reset-password#${hash}`);
    }
  }

  // Redirect authenticated internal users to dashboard, otherwise show landing
  if (req.user && req.user.isInternal) {
    return res.redirect('/ops/dashboard');
  }
  res.render('pages/landing.html');
});

// ==========================================
// 📄 PUBLIC PAGES
// ==========================================

// Manifesto Page (Public)
app.get('/manifesto', (req, res) => {
  res.render('pages/manifesto.html');
});

// GET: Sign-Up Page (Public Route - No Auth Required)
app.get('/sign-up', (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.userId) {
    return res.redirect('/home');
  }
  res.render('pages/sign_up.html', { error: null, success: null });
});

// GET: Forgot Password (Public Route - No Auth Required)
app.get('/forgot-password', (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.userId) {
    return res.redirect('/home');
  }
  res.render('pages/forgot_password.html', { error: null, success: null });
});

// POST: Forgot Password - Request Password Reset (Supabase Auth)
// Rate limit: 60 seconds between requests (following Supabase best practices)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 1, // 1 request per window
  message: 'Please wait 60 seconds before requesting another password reset.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    // If already logged in, redirect to home
    if (req.session?.userId) {
      return res.redirect('/home');
    }

    const { email } = req.body;

    // Input validation
    if (!validateRequired(email, 'email')) {
      return res.render('pages/forgot_password.html', {
        error: 'Email is required',
        success: null,
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('pages/forgot_password.html', {
        error: 'Please enter a valid email address',
        success: null,
      });
    }

    // Use Supabase Auth password reset (handles email sending automatically)
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${env.BASE_URL}${env.BASE_PATH || ''}/reset-password`,
    });

    // Always show success (security best practice - don't reveal if email exists)
    // Supabase Auth handles email sending automatically via configured SMTP
    res.render('pages/forgot_password.html', {
      error: null,
      success:
        'If an account with that email exists, a password reset link has been sent. Please check your email.',
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'forgot-password' });
    res.render('pages/forgot_password.html', {
      error: 'An error occurred. Please try again later.',
      success: null,
    });
  }
});

// GET: Reset Password (Supabase Auth)
// Note: Supabase Auth sends token_hash and type in URL hash (#), not query params (?)
// Hash fragments are NOT sent to the server - they're client-side only
// Client-side JavaScript will extract the token_hash from the hash and display the form
// For PKCE flow, we need to verify token_hash with verifyOtp to get a session
app.get('/reset-password', async (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.userId) {
    return res.redirect('/home');
  }

  // Check if access_token is in query params (Supabase sometimes sends it this way)
  const { access_token, token_hash, type } = req.query;

  // If access_token is in query params (implicit flow), use it directly
  if (type === 'recovery' && access_token) {
    return res.render('pages/reset_password.html', {
      error: null,
      success: null,
      token: access_token,
      supabase_url: env.SUPABASE_URL,
      supabase_anon_key: env.SUPABASE_ANON_KEY,
    });
  }

  // Check if token_hash is in query params (for server-side verification)
  // Supabase may redirect with token_hash in query after /verify endpoint

  // If token_hash is in query params, verify it server-side and exchange for session
  if (type === 'recovery' && token_hash) {
    try {
      // Verify the token_hash to get a session
      // Ensure token_hash is a string (not string[])
      let tokenHash = '';
      if (Array.isArray(token_hash)) {
        tokenHash = String(token_hash[0] || '');
      } else if (typeof token_hash === 'string') {
        tokenHash = token_hash;
      } else {
        tokenHash = String(token_hash || '');
      }

      if (!tokenHash) {
        return res.status(400).render('pages/reset_password.html', {
          error: 'Invalid or missing reset token',
          token: null,
          supabase_url: env.SUPABASE_URL,
          supabase_anon_key: env.SUPABASE_ANON_KEY,
        });
      }

      const {
        data: { session },
        error: verifyError,
      } = await supabaseAuth.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });

      if (verifyError || !session) {
        logError(verifyError || new Error('No session returned'), {
          path: req.path,
          operation: 'reset-password-get',
          errorMessage: verifyError?.message,
          errorStatus: verifyError?.status,
        });

        // Provide more specific error messages
        let errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
        if (verifyError?.message) {
          if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
            errorMessage =
              'This reset link has expired or is invalid. Please request a new password reset.';
          } else if (verifyError.message.includes('token')) {
            errorMessage = 'Invalid reset token. Please request a new password reset.';
          }
        }

        return res.render('pages/reset_password.html', {
          error: errorMessage,
          success: null,
          token: null,
          supabase_url: env.SUPABASE_URL,
          supabase_anon_key: env.SUPABASE_ANON_KEY,
        });
      }

      // Session obtained - use access_token for password update
      // Token is valid - show reset form with access_token
      return res.render('pages/reset_password.html', {
        error: null,
        success: null,
        token: session.access_token,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    } catch (error) {
      logError(error, { path: req.path, operation: 'reset-password-get' });
      return res.render('pages/reset_password.html', {
        error: 'An error occurred while verifying the reset token.',
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }
  }

  // No token in query params - this is normal for Supabase Auth
  // Supabase redirects through /verify endpoint which then redirects here with hash fragment
  // Client-side JavaScript will extract access_token or token_hash from hash
  // Format: #access_token=...&type=recovery (implicit flow)
  // or: #token_hash=...&type=recovery (PKCE flow)
  // Don't show error initially - let JavaScript check the hash first
  res.render('pages/reset_password.html', {
    error: null, // No error initially - JavaScript will check hash
    success: null,
    token: null, // Will be extracted from hash by client-side JS
    supabase_url: env.SUPABASE_URL,
    supabase_anon_key: env.SUPABASE_ANON_KEY,
  });
});

// POST: Reset Password - Update Password (Public Route - No Auth Required)
app.post('/reset-password', async (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.userId) {
    return res.redirect('/home');
  }

  try {
    const { token, password, password_confirm } = req.body;

    // Input validation
    if (!validateRequired(token, 'token')) {
      return res.render('pages/reset_password.html', {
        error: 'Reset token is required',
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    if (!validateRequired(password, 'password')) {
      return res.render('pages/reset_password.html', {
        error: 'Password is required',
        success: null,
        token: token,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    if (password.length < 8) {
      return res.render('pages/reset_password.html', {
        error: 'Password must be at least 8 characters long',
        success: null,
        token: token,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    if (password !== password_confirm) {
      return res.render('pages/reset_password.html', {
        error: 'Passwords do not match',
        success: null,
        token: token,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    // Update password using Supabase Auth
    // For password reset, we need to set the session first using the access_token
    // Then update the password
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.setSession({
      access_token: token,
      refresh_token: '', // Not needed for password reset
    });

    if (sessionError || !session) {
      logError(sessionError || new Error('No session created'), {
        path: req.path,
        operation: 'reset-password-session',
        errorMessage: sessionError?.message,
        errorStatus: sessionError?.status,
      });

      return res.render('pages/reset_password.html', {
        error: 'Invalid or expired reset link. Please request a new password reset.',
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    // Now update the password with the active session
    const { data, error } = await supabaseAuth.auth.updateUser({
      password: password,
    });

    if (error) {
      logError(error, {
        path: req.path,
        operation: 'reset-password-update',
        errorMessage: error.message,
        errorStatus: error.status,
      });

      // Provide more specific error messages
      let errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
      if (error.message) {
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          errorMessage =
            'This reset link has expired or is invalid. Please request a new password reset.';
        } else if (error.message.includes('token')) {
          errorMessage = 'Invalid reset token. Please request a new password reset.';
        } else {
          errorMessage = `Unable to reset password: ${error.message}`;
        }
      }

      return res.render('pages/reset_password.html', {
        error: errorMessage,
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    // Verify the update was successful
    if (!data || !data.user) {
      logError(new Error('Password update returned no user data'), {
        path: req.path,
        operation: 'reset-password-update',
      });
      return res.render('pages/reset_password.html', {
        error:
          'Password update completed but verification failed. Please try logging in or request a new reset.',
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    // Success - show success message on reset page, then redirect to login
    res.render('pages/reset_password.html', {
      error: null,
      success: 'Password reset successful! Redirecting to login...',
      token: null,
      supabase_url: env.SUPABASE_URL,
      supabase_anon_key: env.SUPABASE_ANON_KEY,
    });

    // Redirect after showing success message (client-side will handle this)
    // Set a meta refresh or use JavaScript to redirect after 2 seconds
  } catch (error) {
    logError(error, { path: req.path, operation: 'reset-password-post' });

    // Check if it's a validation error (invalid token)
    if (error instanceof ValidationError) {
      return res.render('pages/reset_password.html', {
        error:
          error.message || 'Invalid or expired reset token. Please request a new password reset.',
        success: null,
        token: null,
        supabase_url: env.SUPABASE_URL,
        supabase_anon_key: env.SUPABASE_ANON_KEY,
      });
    }

    res.render('pages/reset_password.html', {
      error: 'An error occurred while resetting your password. Please try again.',
      success: null,
      token: req.body.token || null,
      supabase_url: env.SUPABASE_URL,
      supabase_anon_key: env.SUPABASE_ANON_KEY,
    });
  }
});

// POST: Sign-Up Request (Public Route - No Auth Required)
// NOTE: Public routes do not require ownership checks; access is unrestricted by design.
app.post('/sign-up', async (req, res) => {
  try {
    const {
      email,
      company,
      name,
      customer_company,
      message,
      user_tier = 'institutional', // Default to institutional
    } = req.body;

    // Validate tier
    if (!['institutional', 'independent'].includes(user_tier)) {
      return res.render('pages/sign_up.html', {
        error: 'Invalid access tier selected',
        success: null,
      });
    }

    // Input validation
    if (!validateRequired(email, 'email')) {
      return res.render('pages/sign_up.html', {
        error: 'Email is required',
        success: null,
      });
    }

    if (!validateRequired(name, 'name')) {
      return res.render('pages/sign_up.html', {
        error: 'Your name is required',
        success: null,
      });
    }

    // Conditional validation based on tier
    if (user_tier === 'institutional') {
      if (!validateRequired(company, 'company')) {
        return res.render('pages/sign_up.html', {
          error: 'Organization name is required for Institutional Nodes',
          success: null,
        });
      }
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('pages/sign_up.html', {
        error: 'Please enter a valid email address',
        success: null,
      });
    }

    // Handle Independent Investigator track
    if (user_tier === 'independent') {
      try {
        // Create Supabase Auth user with admin client (service role key)
        // Generate a temporary secure password for immediate access
        const tempPassword = randomUUID().replace(/-/g, '').substring(0, 16) + 'A1!';

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email.toLowerCase().trim(),
          email_confirm: true,
          password: tempPassword,
          user_metadata: {
            display_name: name.trim(),
            user_tier: 'independent',
            is_active: true,
          },
        });

        if (authError || !authData.user) {
          // Check if it's a permissions error
          if (authError?.message?.includes('permission') || authError?.message?.includes('admin')) {
            logError(authError, {
              path: req.path,
              operation: 'create-independent-user',
              error_type: 'permissions',
              hint: 'Check SUPABASE_SERVICE_ROLE_KEY configuration',
            });
            return res.render('pages/sign_up.html', {
              error: 'System configuration error. Please contact support.',
              success: null,
            });
          }

          logError(authError, { path: req.path, operation: 'create-independent-user' });
          return res.render('pages/sign_up.html', {
            error: 'Failed to create account. Please try again.',
            success: null,
          });
        }

        // Create vendor_user record (without vendor_id)
        const vendorUser = await vmpAdapter.createIndependentUser(
          authData.user.id,
          email.toLowerCase().trim(),
          name.trim()
        );

        // Sign in the user to get a session
        const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword(
          {
            email: email.toLowerCase().trim(),
            password: tempPassword,
          }
        );

        if (signInError || !signInData.session) {
          logError(signInError, { path: req.path, operation: 'sign-in-independent' });
          // Clean up Supabase Auth user if sign-in fails
          await supabase.auth.admin.deleteUser(authData.user.id).catch(cleanupError => {
            logError(cleanupError, { path: req.path, operation: 'cleanup-auth-user' });
          });
          return res.render('pages/sign_up.html', {
            error: 'Account created but failed to log in. Please try logging in.',
            success: null,
          });
        }

        // Create session and log user in immediately
        req.session.userId = vendorUser.id;
        req.session.authToken = signInData.session.access_token;
        if (signInData.session.refresh_token) {
          req.session.refreshToken = signInData.session.refresh_token;
        }

        req.session.save(err => {
          if (err) {
            logError(err, { path: req.path, operation: 'createSession-independent' });
            return res.render('pages/sign_up.html', {
              error: 'Account created but failed to log in. Please try logging in.',
              success: null,
            });
          }
          // Redirect to home immediately
          res.redirect('/home?welcome=independent');
        });
        return;
      } catch (error) {
        logError(error, { path: req.path, operation: 'independent-sign-up' });
        return res.render('pages/sign_up.html', {
          error: 'An error occurred while creating your account. Please try again.',
          success: null,
        });
      }
    }

    // Institutional track (existing flow)
    // Store access request
    try {
      const { error: insertError } = await supabase.from('vmp_access_requests').insert({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        company: company.trim(),
        customer_company: customer_company?.trim() || null,
        message: message?.trim() || null,
        status: 'pending',
        user_tier: 'institutional',
      });

      if (insertError) {
        logError(insertError, { path: req.path, operation: 'store-access-request' });
      }
    } catch (dbError) {
      logError(dbError, { path: req.path, operation: 'store-access-request' });
    }

    // Render success message
    res.render('pages/sign_up.html', {
      error: null,
      success:
        'Your access request has been submitted. An administrator will review your request and send an invitation email if approved.',
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'sign-up' });
    res.render('pages/sign_up.html', {
      error: 'An error occurred. Please try again later.',
      success: null,
    });
  }
});

// ==========================================
// 🔒 LOCKED PRODUCTION ROUTES
// ==========================================

// 2. Home (Production - Unified Console v7)
// LOCKED to home.html - No rollback switches
async function renderHomePage(req, res) {
  try {
    // Handle independent users (no vendor context needed)
    if (req.user?.user_tier === 'independent') {
      return res.render('pages/home.html', {
        user: req.user,
        actionCount: 0,
        openCount: 0,
        soaCount: 0,
        paidCount: 0,
        welcomeMessage:
          req.query.welcome === 'independent'
            ? 'Welcome! Your Independent Investigator account is ready.'
            : null,
        isIndependent: true,
      });
    }

    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    let actionCount = 0;
    let openCount = 0;
    let soaCount = 0;
    let paidCount = 0;
    let soaNetVariance = 0;

    if (VENDOR_ID_HARDCODED) {
      try {
        const rawCases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);

        // Calculate metrics
        actionCount = rawCases.filter(
          c => c.status === 'blocked' || c.status === 'waiting_supplier'
        ).length;
        openCount = rawCases.filter(c => c.status === 'open').length;
        const soaCases = rawCases.filter(c => c.case_type === 'soa');
        soaCount = soaCases.length;
        paidCount = rawCases.filter(c => c.status === 'resolved' || c.status === 'paid').length;

        // Calculate SOA net variance (sum of all SOA case variances)
        for (const soaCase of soaCases) {
          try {
            const summary = await vmpAdapter.getSOASummary(soaCase.id, VENDOR_ID_HARDCODED);
            soaNetVariance += summary.net_variance || 0;
          } catch (error) {
            // Skip if summary calculation fails (case might not have SOA items yet)
            logError(error, {
              path: '/home',
              operation: 'calculateSOAVariance',
              caseId: soaCase.id,
            });
          }
        }
      } catch (error) {
        logError(error, { path: '/home', operation: 'loadMetrics' });
      }
    }

    res.render('pages/home.html', {
      user: req.user,
      actionCount: actionCount,
      openCount: openCount,
      soaCount: soaCount,
      soaNetVariance: soaNetVariance,
      paidCount: paidCount,
      isIndependent: false,
    });
  } catch (error) {
    logError(error, { path: '/home', operation: 'renderHomePage' });
    res.status(500).render('pages/home.html', {
      user: req.user,
      actionCount: 0,
      openCount: 0,
      soaCount: 0,
      paidCount: 0,
      error: error.message,
      isIndependent: req.user?.user_tier === 'independent',
    });
  }
}

app.get('/home', renderHomePage);

// ==========================================
// 📄 CASE DASHBOARD PAGE
// ==========================================

// Case Dashboard Page
app.get('/case-dashboard', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const posture = getStringParam(req.query.posture);
    const validPostures = ['action', 'open', 'soa', 'paid'];
    const selectedPosture = posture && validPostures.includes(posture) ? posture : 'action';

    // 3. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(500).render('pages/error.html', {
        error: {
          status: 500,
          message:
            'Vendor ID not available. Please ensure you are logged in or DEMO_VENDOR_ID is configured.',
        },
      });
    }

    // 4. Render response
    res.render('pages/case_dashboard.html', {
      title: 'Case Dashboard',
      user: req.user,
      posture: selectedPosture,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// ==========================================
// 📄 NEW CASE PAGE
// ==========================================

// New Case Page (Modal/Form)
app.get('/new-case', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render response (new_case.html is a modal component)
    res.render('pages/new_case.html', {
      user: req.user,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// ==========================================
// 📄 SCANNER/LIVE FEED PAGE
// ==========================================

// Scanner/Live Feed Page
app.get('/scanner', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Fetch recent activity/events
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    let activities = [];

    if (vendorId) {
      try {
        // Fetch recent case activities, payments, invoices
        const cases = await vmpAdapter.getInbox(vendorId);
        const recentCases = cases.slice(0, 10).map(c => ({
          type: 'case',
          id: c.id,
          title: `Case ${c.case_number}`,
          status: c.status,
          timestamp: c.updated_at || c.created_at,
        }));
        activities = [...recentCases];
      } catch (error) {
        logError(error, { path: '/scanner', operation: 'loadActivities' });
      }
    }

    // 3. Render response
    res.render('pages/scanner.html', {
      title: 'Live Feed',
      user: req.user,
      activities: activities,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// ==========================================
// 📄 HELP/SUPPORT PAGE
// ==========================================

// Help/Support Page
app.get('/help', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render response
    res.render('pages/help.html', {
      title: 'Help & Support',
      user: req.user,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

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
          message:
            'Vendor ID not available. Please ensure you are logged in or DEMO_VENDOR_ID is configured.',
        },
      });
    }

    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);

      // Verify vendor has access to this case
      if (caseDetail && caseDetail.vendor_id !== vendorId && !req.user?.isInternal) {
        return res.status(404).render('pages/error.html', {
          error: {
            status: 404,
            message: 'Case not found',
          },
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
      validationResult,
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

const caseInboxPartial = async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new Error(
          'Vendor ID not available. Please ensure you are logged in or DEMO_VENDOR_ID is configured.'
        ),
        req,
        res,
        'partials/case_inbox.html',
        { cases: [] }
      );
    }

    const cases = await vmpAdapter.getInbox(vendorId);

    // Calculate SLA status for each case
    const now = new Date();
    const casesWithSLA = (cases || []).map(c => {
      if (!c.sla_due_at) {
        return { ...c, hours_remaining: null, is_overdue: false, sla_status: null };
      }

      const dueAt = new Date(c.sla_due_at);
      const hoursRemaining = Math.round((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      const isOverdue = hoursRemaining < 0;

      // Determine SLA status: 'overdue', 'urgent' (<24h), 'warning' (<48h), 'ok'
      let slaStatus = 'ok';
      if (isOverdue) {
        slaStatus = 'overdue';
      } else if (hoursRemaining <= 24) {
        slaStatus = 'urgent';
      } else if (hoursRemaining <= 48) {
        slaStatus = 'warning';
      }

      return {
        ...c,
        hours_remaining: hoursRemaining,
        is_overdue: isOverdue,
        sla_status: slaStatus,
      };
    });

    // 3. Render response
    res.render('partials/case_inbox.html', { cases: casesWithSLA });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_inbox.html', { cases: [] });
  }
};

// Legacy path
app.get('/partials/case-inbox.html', caseInboxPartial);
// Vendor namespaced path (BASE_PATH-aware)
app.get(`${BASE_PATH}/vendor/partials/case-inbox.html`, caseInboxPartial);

const caseDetailPartial = async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
    };

    if (!caseId) {
      return res.render('partials/case_detail.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_detail.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_detail.html',
        defaultData
      );
    }

    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_detail.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_detail.html', defaultData);
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
      validationResult,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_detail.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
    });
  }
};

app.get('/partials/case-detail.html', caseDetailPartial);
app.get(`${BASE_PATH}/vendor/partials/case-detail.html`, caseDetailPartial);

// Case Thread Partial
const caseThreadPartial = async (req, res) => {
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
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_thread.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_thread.html',
        defaultData
      );
    }

    // Verify case belongs to vendor before loading messages
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_thread.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_thread.html', defaultData);
    }

    // Load messages after scope check
    let messages = [];
    try {
      messages = await vmpAdapter.getMessages(caseId);
    } catch (adapterError) {
      // Return with error message for graceful degradation (HTMX partial)
      return handlePartialError(adapterError, req, res, 'partials/case_thread.html', {
        caseId,
        messages: [],
      });
    }

    // 4. Render response
    res.render('partials/case_thread.html', { caseId, messages });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_thread.html', {
      caseId: req.query.case_id || null,
      messages: [],
    });
  }
};

app.get('/partials/case-thread.html', caseThreadPartial);
app.get(`${BASE_PATH}/vendor/partials/case-thread.html`, caseThreadPartial);

// Case Activity Feed Partial (Sprint 8.1)
const caseActivityPartial = async (req, res) => {
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
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_activity.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_activity.html',
        defaultData
      );
    }

    // Verify case belongs to vendor before loading activity
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_activity.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_activity.html', defaultData);
    }

    // Load activity after scope check
    let activities = [];
    try {
      activities = await vmpAdapter.getCaseActivity(caseId);
    } catch (adapterError) {
      return res.render('partials/case_activity.html', {
        activities: [],
        error: adapterError.message || 'Failed to load activity feed',
      });
    }

    // 4. Render response
    res.render('partials/case_activity.html', { activities, error: null });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_activity.html', {
      activities: [],
      error: error.message || 'Failed to load activity',
    });
  }
};

app.get('/partials/case-activity.html', caseActivityPartial);
app.get(`${BASE_PATH}/vendor/partials/case-activity.html`, caseActivityPartial);

const supplierCaseListPartial = async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;

    if (!req.user.vendorId) {
      return handlePartialError(
        new ValidationError('Supplier case list is only available to vendors'),
        req,
        res,
        'partials/supplier_case_list.html',
        { cases: [] }
      );
    }

    const { status } = req.query;
    let cases = [];

    try {
      cases = await vmpAdapter.getInbox(req.user.vendorId);

      if (status) {
        if (status === 'action_required') {
          cases = cases.filter(c => c.status === 'blocked' || c.status === 'waiting_supplier');
        } else {
          cases = cases.filter(c => c.status === status);
        }
      }
    } catch (adapterError) {
      logError(adapterError, { path: req.path, userId: req.user?.id, vendorId: req.user.vendorId });
    }

    res.render('partials/supplier_case_list.html', {
      cases,
      status: status || null,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/supplier_case_list.html', {
      cases: [],
      status: req.query?.status || null,
    });
  }
};

// Legacy partial
app.get('/partials/supplier-case-list.html', supplierCaseListPartial);

// Vendor portal namespaced partial (BASE_PATH-aware)
app.get(`${BASE_PATH}/vendor/partials/supplier-case-list.html`, supplierCaseListPartial);

// Case Checklist Partial (GET)
const caseChecklistPartial = async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
    };

    if (!caseId) {
      return res.render('partials/case_checklist.html', defaultData);
    }

    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_checklist.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_checklist.html',
        defaultData
      );
    }

    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_checklist.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(
        adapterError,
        req,
        res,
        'partials/case_checklist.html',
        defaultData
      );
    }

    // Load checklist steps
    let checklistSteps = [];
    try {
      checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
    } catch (adapterError) {
      logError(adapterError, { path: req.path, caseId, operation: 'getChecklistSteps' });
    }

    // 4. Render response
    res.render('partials/case_checklist.html', {
      caseId,
      checklistSteps,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_checklist.html', {
      caseId: req.query.case_id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
    });
  }
};

app.get('/partials/case-checklist.html', caseChecklistPartial);
app.get(`${BASE_PATH}/vendor/partials/case-checklist.html`, caseChecklistPartial);

// Case Evidence Partial
const caseEvidencePartial = async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = { caseId: null, documents: [] };

    if (!caseId) {
      return res.render('partials/case_evidence.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_evidence.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_evidence.html',
        defaultData
      );
    }

    // Verify case belongs to vendor before fetching evidence
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_evidence.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_evidence.html', defaultData);
    }

    let evidence = [];
    try {
      evidence = await vmpAdapter.getEvidence(caseId);

      // Generate signed URLs for each evidence file (in parallel with timeout protection)
      // Use Promise.allSettled to ensure all promises complete even if some fail
      const urlPromises = evidence.map(async ev => {
        // Add timeout wrapper to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Signed URL generation timeout')), 3000); // 3 second timeout per URL
        });

        try {
          const signedUrlPromise = vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600); // 1 hour expiry
          ev.download_url = await Promise.race([signedUrlPromise, timeoutPromise]);
        } catch (urlError) {
          logError(urlError, {
            path: req.path,
            caseId,
            storagePath: ev.storage_path,
            operation: 'getEvidenceSignedUrl',
          });
          ev.download_url = '#'; // Fallback
        }
      });
      // Use allSettled to continue even if some URLs fail to generate
      await Promise.allSettled(urlPromises);
    } catch (adapterError) {
      // Continue with empty evidence array
      logError(adapterError, { path: req.path, caseId, operation: 'getEvidence' });
    }

    // 4. Map evidence to documents format for the new UI
    const documents = evidence.map(ev => ({
      id: ev.id,
      original_name: ev.original_filename || 'Unknown',
      mime_type: ev.mime_type || 'application/octet-stream',
      size: ev.size_bytes || 0,
      created_at: ev.created_at,
      url: ev.download_url || '#',
    }));

    // 5. Render response
    res.render('partials/case_evidence.html', { caseId, documents });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_evidence.html', {
      caseId: req.query.case_id || null,
      documents: [],
    });
  }
};

app.get('/partials/case-evidence.html', caseEvidencePartial);
app.get(`${BASE_PATH}/vendor/partials/case-evidence.html`, caseEvidencePartial);

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
          message: 'Invalid template type',
        },
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
        message: 'Failed to download template',
      },
    });
  }
});

// Escalation Partial
const escalationPartial = async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const caseId = req.query.case_id;
    const defaultData = {
      caseId: null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null,
    };

    if (!caseId) {
      return res.render('partials/escalation.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/escalation.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/escalation.html',
        defaultData
      );
    }

    let caseDetail = null;
    let directorInfo = null;

    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/escalation.html',
          defaultData
        );
      }

      // If Level 3 escalation, fetch Director info
      if (caseDetail.escalation_level >= 3) {
        const groupId =
          caseDetail.group_id ||
          (caseDetail.vmp_companies && caseDetail.vmp_companies.group_id) ||
          null;
        try {
          directorInfo = await vmpAdapter.getGroupDirectorInfo(groupId);
        } catch (directorError) {
          logError(directorError, {
            path: req.path,
            caseId,
            groupId,
            operation: 'getGroupDirectorInfo',
          });
        }
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/escalation.html', defaultData);
    }

    // 4. Render response
    res.render('partials/escalation.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false,
      directorInfo: directorInfo || null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/escalation.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null,
    });
  }
};

app.get('/partials/escalation.html', escalationPartial);
app.get(`${BASE_PATH}/vendor/partials/escalation.html`, escalationPartial);

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
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_row.html')) return;

    // 3. Business logic with scope verification
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_row.html',
        defaultData
      );
    }

    let caseData = null;
    try {
      caseData = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseData || caseData.vendor_id !== vendorId) {
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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_row.html', { case: null });
  }
});

// Vendor namespaced path (BASE_PATH-aware)
app.get(`${BASE_PATH}/vendor/partials/case-row.html`, async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;

    const caseId = req.query.case_id;
    const defaultData = { case: null };
    if (!validateRequiredQuery(caseId, 'case_id', res, 'partials/case_row.html', defaultData)) {
      return;
    }
    if (!validateUUIDParam(getStringParam(caseId), res, 'partials/case_row.html')) return;

    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_row.html',
        defaultData
      );
    }

    let caseData = null;
    try {
      caseData = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseData || caseData.vendor_id !== vendorId) {
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

    res.render('partials/case_row.html', { case: caseData, error: null });
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

    // 3. Scope verification for vendor access
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return handlePartialError(
        new ValidationError('Vendor ID not available'),
        req,
        res,
        'partials/case_thread.html',
        defaultData
      );
    }

    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return handlePartialError(
          new NotFoundError('Case'),
          req,
          res,
          'partials/case_thread.html',
          defaultData
        );
      }
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/case_thread.html', defaultData);
    }

    if (!body || !body.trim()) {
      // Return refreshed thread without error (just ignore empty message)
      try {
        const messages = await vmpAdapter.getMessages(caseId);
        return res.render('partials/case_thread.html', { caseId, messages });
      } catch (error) {
        return handlePartialError(error, req, res, 'partials/case_thread.html', defaultData);
      }
    }

    // 4. Determine sender type
    const senderType = req.user.isInternal ? 'internal' : 'vendor';
    const senderUserId = req.user.id;

    // 5. Business logic - Create the human/vendor message
    let messageCreated = false;
    try {
      await vmpAdapter.createMessage(
        caseId,
        body.trim(),
        senderType,
        'portal',
        senderUserId,
        false
      );
      messageCreated = true;
    } catch (createError) {
      // Still try to return refreshed thread (graceful degradation)
      logError(createError, {
        path: req.path,
        caseId,
        userId: req.user.id,
        operation: 'createMessage',
      });
    }

    // 6. AI AP ENFORCER - Trigger AI analysis for vendor messages
    if (senderType === 'vendor' && messageCreated) {
      try {
        // Classify message intent
        const intentAnalysis = await classifyMessageIntent(body.trim(), 'portal');

        // Extract structured data
        const extractedData = await extractStructuredData(body.trim(), '');

        // AI Enforcer Logic: Detect data-poor requests and inject system guidance
        const needsInvoiceNumber =
          (intentAnalysis.intent === 'payment_inquiry' ||
            intentAnalysis.intent === 'invoice_inquiry' ||
            intentAnalysis.intent === 'general_inquiry') &&
          (!extractedData.invoiceNumbers || extractedData.invoiceNumbers.length === 0);

        const needsPONumber =
          intentAnalysis.intent === 'invoice_inquiry' &&
          (!extractedData.poNumbers || extractedData.poNumbers.length === 0) &&
          (!extractedData.invoiceNumbers || extractedData.invoiceNumbers.length === 0);

        // Inject AI system message if data is missing
        if (needsInvoiceNumber) {
          try {
            await vmpAdapter.createMessage(
              caseId,
              "AI_ENFORCER: I noticed you're asking about a payment or invoice but haven't provided an Invoice Number. Please provide the Invoice # to speed up resolution.",
              'ai', // sender_type
              'portal', // channel_source
              null, // sender_user_id (system message)
              false // is_internal_note
            );
          } catch (aiMessageError) {
            // Log but don't fail the request if AI message creation fails
            logError(aiMessageError, { path: req.path, caseId, operation: 'aiEnforcerMessage' });
          }
        } else if (needsPONumber) {
          try {
            await vmpAdapter.createMessage(
              caseId,
              'AI_ENFORCER: To help resolve this inquiry, please provide either an Invoice Number or PO Number for reference.',
              'ai',
              'portal',
              null,
              false
            );
          } catch (aiMessageError) {
            logError(aiMessageError, { path: req.path, caseId, operation: 'aiEnforcerMessage' });
          }
        }
      } catch (aiError) {
        // Don't fail the request if AI analysis fails - graceful degradation
        logError(aiError, { path: req.path, caseId, operation: 'aiEnforcerAnalysis' });
      }
    }

    // 7. Return refreshed thread with new message(s)
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
      messages: [],
    });
  }
});

// POST: Upload Evidence
app.post('/cases/:id/evidence', upload.single('file'), async (req, res) => {
  try {
    const caseId = req.params.id;
    const { evidence_type, checklist_step_id } = req.body;
    const file = req.file;

    // 0. Authentication
    if (!requireAuth(req, res)) return;

    // Validate file is present
    if (!file) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'File is required',
      });
    }

    if (!caseId) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId: null,
        evidence: [],
        error: 'Case ID is required',
      });
    }

    if (!file) {
      // File is required for evidence upload
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'File is required',
      });
    }

    if (!evidence_type) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence type is required',
      });
    }

    // Get user context (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Authentication required',
      });
    }

    // Verify case belongs to vendor (security check) using vendorId
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(403).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Vendor context required',
      });
    }
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return res.status(404).render('partials/case_evidence.html', {
          caseId,
          evidence: [],
          error: 'Case not found or access denied',
        });
      }
    } catch (checkError) {
      return res.status(404).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Case not found',
      });
    }

    // Upload evidence
    try {
      await vmpAdapter.uploadEvidence(
        caseId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        evidence_type,
        checklist_step_id || null,
        'vendor',
        user.id
      );
    } catch (uploadError) {
      logError(uploadError, {
        path: req.path,
        userId: req.user?.id,
        caseId,
        operation: 'uploadEvidence',
      });
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: `Failed to upload evidence: ${uploadError.message}`,
      });
    }

    // Return refreshed evidence and checklist
    try {
      // Get updated evidence
      const evidence = await vmpAdapter.getEvidence(caseId);
      // Generate signed URLs in parallel with timeout protection
      const urlPromises = evidence.map(async ev => {
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
      logError(error, {
        path: req.path,
        userId: req.user?.id,
        caseId,
        operation: 'refreshEvidenceAfterUpload',
      });
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence uploaded but failed to refresh view',
      });
    }
  } catch (error) {
    logError(error, {
      path: req.path,
      userId: req.user?.id,
      caseId: req.params.id,
      operation: 'postEvidence',
    });
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.params.id || null,
      evidence: [],
      error: error.message,
    });
  }
});

// POST: Upload Document (Simplified - for Evidence Locker)
app.post('/cases/:id/documents', upload.single('document'), async (req, res) => {
  try {
    const caseId = req.params.id;
    const file = req.file;

    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    if (!caseId) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId: null,
        documents: [],
        error: 'Case ID is required',
      });
    }

    if (!validateUUIDParam(caseId, res, 'partials/case_evidence.html')) return;

    if (!file) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: 'File is required',
      });
    }

    // 3. Verify case access (security check)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: 'Authentication required',
      });
    }

    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    if (!vendorId) {
      return res.status(403).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: 'Vendor context required',
      });
    }
    try {
      const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      if (!caseDetail || caseDetail.vendor_id !== vendorId) {
        return res.status(404).render('partials/case_evidence.html', {
          caseId,
          documents: [],
          error: 'Case not found or access denied',
        });
      }
    } catch (checkError) {
      return res.status(404).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: 'Case not found',
      });
    }

    // 4. Upload document (use 'general' as default evidence_type for simple document uploads)
    try {
      await vmpAdapter.uploadEvidence(
        caseId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        'general', // Default evidence type for simple document uploads
        null, // No checklist step required
        'vendor',
        user.id
      );
    } catch (uploadError) {
      logError(uploadError, {
        path: req.path,
        userId: req.user?.id,
        caseId,
        operation: 'uploadDocument',
      });
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: `Failed to upload document: ${uploadError.message}`,
      });
    }

    // 5. Return refreshed evidence list
    try {
      let evidence = await vmpAdapter.getEvidence(caseId);

      // Generate signed URLs for each evidence file
      const urlPromises = evidence.map(async ev => {
        try {
          ev.download_url = await vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600);
        } catch (urlError) {
          logError(urlError, {
            path: req.path,
            caseId,
            storagePath: ev.storage_path,
            operation: 'getEvidenceSignedUrl',
          });
          ev.download_url = '#';
        }
      });
      await Promise.allSettled(urlPromises);

      // Map evidence to documents format
      const documents = evidence.map(ev => ({
        id: ev.id,
        original_name: ev.original_filename || 'Unknown',
        mime_type: ev.mime_type || 'application/octet-stream',
        size: ev.size_bytes || 0,
        created_at: ev.created_at,
        url: ev.download_url || '#',
      }));

      return res.render('partials/case_evidence.html', { caseId, documents });
    } catch (refreshError) {
      logError(refreshError, {
        path: req.path,
        userId: req.user?.id,
        caseId,
        operation: 'refreshDocumentsAfterUpload',
      });
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        documents: [],
        error: 'Document uploaded but failed to refresh list',
      });
    }
  } catch (error) {
    logError(error, {
      path: req.path,
      userId: req.user?.id,
      caseId: req.params.id,
      operation: 'postDocument',
    });
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.params.id || null,
      documents: [],
      error: error.message,
    });
  }
});

// Day 9: Internal Ops - Verify Evidence
app.post('/cases/:id/verify-evidence', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (
      !requireInternal(
        req,
        res,
        'partials/case_checklist.html',
        'Only internal staff can verify evidence'
      )
    )
      return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_checklist.html')) return;

    const { checklist_step_id } = req.body;
    const defaultData = {
      caseId,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
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
          req.user.displayName || req.user.email,
          `Verified evidence for: ${step?.label || 'checklist step'}`,
          'Evidence meets requirements and has been approved'
        );
      } catch (logError) {
        // Don't fail verification if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-verify' });
      }
    } catch (verifyError) {
      // Use VMPError for proper statusCode support
      const wrappedError =
        verifyError instanceof VMPError
          ? verifyError
          : new DatabaseError('Failed to verify evidence', verifyError, { caseId });
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true
      );
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

      return res.render('partials/case_checklist.html', {
        caseId,
        checklistSteps,
        isInternal: req.user.isInternal,
      });
    } catch (error) {
      const wrappedError = new DatabaseError(
        'Evidence verified but failed to refresh checklist',
        error,
        { caseId }
      );
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true
      );
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
    });
  }
});

// Day 9: Internal Ops - Reject Evidence
app.post('/cases/:id/reject-evidence', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (
      !requireInternal(
        req,
        res,
        'partials/case_checklist.html',
        'Only internal staff can reject evidence'
      )
    )
      return;

    // 2. Input validation
    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_checklist.html')) return;

    const { checklist_step_id, reason } = req.body;
    const defaultData = {
      caseId,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
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
          req.user.displayName || req.user.email,
          `Rejected evidence for: ${step?.label || 'checklist step'}`,
          reason.trim()
        );
      } catch (logError) {
        // Don't fail rejection if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-reject' });
      }
    } catch (rejectError) {
      const wrappedError =
        rejectError instanceof VMPError
          ? rejectError
          : new DatabaseError('Failed to reject evidence', rejectError, { caseId });
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true
      );
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

      return res.render('partials/case_checklist.html', {
        caseId,
        checklistSteps,
        isInternal: req.user.isInternal,
      });
    } catch (error) {
      const wrappedError = new DatabaseError(
        'Evidence rejected but failed to refresh checklist',
        error,
        { caseId }
      );
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_checklist.html',
        defaultData,
        true
      );
    }
  } catch (error) {
    handlePartialError(
      error,
      req,
      res,
      'partials/case_checklist.html',
      {
        caseId: req.params.id || null,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false,
      },
      true
    );
  }
});

// Day 9: Internal Ops - Reassign Case
app.post('/cases/:id/reassign', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (
      !requireInternal(
        req,
        res,
        'partials/case_detail.html',
        'Only internal staff can reassign cases'
      )
    )
      return;

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
          req.user.displayName || req.user.email,
          `Reassigned case to ${owner_team} team`,
          `Case ownership transferred to ${owner_team} team`
        );
      } catch (logError) {
        // Don't fail reassignment if logging fails
        logError(logError, { path: req.path, caseId, operation: 'logDecision-reassign' });
      }
    } catch (reassignError) {
      const wrappedError =
        reassignError instanceof VMPError
          ? reassignError
          : new DatabaseError('Failed to reassign case', reassignError, { caseId });
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true
      );
    }

    // 4. Return refreshed case detail
    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (vendorId) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      }

      return res.render('partials/case_detail.html', {
        caseId,
        caseDetail,
        isInternal: req.user.isInternal,
      });
    } catch (error) {
      const wrappedError = new DatabaseError(
        'Case reassigned but failed to refresh detail',
        error,
        { caseId }
      );
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true
      );
    }
  } catch (error) {
    handlePartialError(
      error,
      req,
      res,
      'partials/case_detail.html',
      {
        caseId: req.params.id || null,
        caseDetail: null,
      },
      true
    );
  }
});

// Internal Ops - Update Case Status (legacy + canonical alias)
const updateCaseStatusHandler = async (req, res) => {
  try {
    if (
      !requireInternal(
        req,
        res,
        'partials/case_detail.html',
        'Only internal staff can update case status'
      )
    )
      return;

    const caseId = req.params.id;
    if (!validateUUIDParam(caseId, res, 'partials/case_detail.html')) return;

    // Support legacy payload ({status}) and forward compatibility ({action})
    const { status, action, note, reason } = req.body;
    const nextStatus = status || action; // future mapping to applyDecision will replace this
    const defaultData = { caseId, caseDetail: null };

    if (
      !nextStatus ||
      !['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'].includes(nextStatus)
    ) {
      return handlePartialError(
        new ValidationError(
          'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'
        ),
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true
      );
    }

    try {
      if (USE_DECISION_ENGINE && action) {
        await applyDecision({
          entity: 'case',
          id: caseId,
          action,
          channel: 'resolution',
          actorId: req.user.id,
          tenantId: req.user.vendor?.tenant_id || null,
          vendorId: req.user.vendorId || null,
          note,
          reason,
        });
      } else {
        await vmpAdapter.updateCaseStatus(caseId, nextStatus, req.user.id, { note, reason });
      }
    } catch (updateError) {
      const wrappedError =
        updateError instanceof VMPError
          ? updateError
          : new DatabaseError('Failed to update case status', updateError, { caseId });
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true
      );
    }

    try {
      const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (vendorId) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
      }

      return res.render('partials/case_detail.html', {
        caseId,
        caseDetail,
        isInternal: req.user.isInternal,
      });
    } catch (error) {
      const wrappedError = new DatabaseError(
        'Case status updated but failed to refresh detail',
        error,
        { caseId }
      );
      return handlePartialError(
        wrappedError,
        req,
        res,
        'partials/case_detail.html',
        defaultData,
        true
      );
    }
  } catch (error) {
    handlePartialError(
      error,
      req,
      res,
      'partials/case_detail.html',
      {
        caseId: req.params.id || null,
        caseDetail: null,
      },
      true
    );
  }
};

// Legacy endpoint (kept for compatibility during migration)
app.post('/cases/:id/update-status', updateCaseStatusHandler);

// Canonical decision endpoint (maps to legacy handler until applyDecision is introduced)
app.post('/cases/:id/update', updateCaseStatusHandler);

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
      directorInfo: null,
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
        logError(directorError, {
          path: req.path,
          caseId,
          groupId,
          operation: 'getGroupDirectorInfo',
        });
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
      await vmpAdapter.escalateCase(caseId, escalationLevel, req.user.id, reason || null);

      // Log decision
      try {
        await vmpAdapter.logDecision(
          caseId,
          'case_escalated',
          req.user.displayName || req.user.email,
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
          logError(directorError, {
            path: req.path,
            caseId,
            groupId,
            operation: 'getGroupDirectorInfo',
          });
        }
      }

      // 6. Re-render escalation partial with updated data
      return res.render('partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        directorInfo: directorInfo || null,
      });
    } catch (escalateError) {
      return handlePartialError(escalateError, req, res, 'partials/escalation.html', {
        caseId,
        caseDetail,
        isInternal: req.user?.isInternal || false,
        directorInfo: null,
      });
    }
  } catch (error) {
    handlePartialError(error, req, res, 'partials/escalation.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      directorInfo: null,
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
      isInternal: true,
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
        error: 'CSV file is required',
      });
    }

    // Validate file type
    if (
      req.file.mimetype !== 'text/csv' &&
      req.file.mimetype !== 'application/vnd.ms-excel' &&
      !req.file.originalname.endsWith('.csv')
    ) {
      return res.status(400).json({
        error: 'File must be a CSV file',
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required',
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
      failures: result.failures,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest invoices',
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
        error: 'CSV file is required',
      });
    }

    // Validate file type
    if (
      req.file.mimetype !== 'text/csv' &&
      req.file.mimetype !== 'application/vnd.ms-excel' &&
      !req.file.originalname.endsWith('.csv')
    ) {
      return res.status(400).json({
        error: 'File must be a CSV file',
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required',
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
      failures: result.failures,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest payments',
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
        error: 'At least one PDF file is required',
      });
    }

    // Validate all files are PDFs
    const filesArray = Array.isArray(req.files)
      ? req.files
      : req.files
        ? Object.values(req.files).flat()
        : [];
    const invalidFiles = filesArray.filter(
      file => file.mimetype !== 'application/pdf' && !file.originalname.endsWith('.pdf')
    );

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'All files must be PDF format',
        invalidFiles: invalidFiles.map(f => f.originalname),
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        error: 'company_id is required',
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
      errors: result.errors,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to ingest remittances',
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
      isInternal: req.user?.isInternal || false,
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

    const payments = await vmpAdapter.getPayments(req.user.vendorId, company_id || null, filters);

    // 3. Render response
    res.render('partials/payment_list.html', {
      payments: payments || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/payment_list.html', {
      payments: [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
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
        return res.status(404).render('pages/error.html', {
          error: {
            status: 404,
            message: 'Payment not found',
          },
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
      // If payment not found, return 404 (anti-enumeration)
      if (adapterError.code === 'NOT_FOUND' || adapterError.message?.includes('not found')) {
        return res.status(404).render('pages/error.html', {
          error: {
            status: 404,
            message: 'Payment not found',
          },
        });
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
      user: req.user,
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
      isInternal: req.user?.isInternal || false,
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
    const {
      payment_ref,
      invoice_num,
      date_from,
      date_to,
      company_id,
      amount_min,
      amount_max,
      status,
    } = req.query;
    const filters = {};
    if (payment_ref) filters.payment_ref = payment_ref;
    if (invoice_num) filters.invoice_num = invoice_num;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (amount_min) filters.amount_min = amount_min;
    if (amount_max) filters.amount_max = amount_max;
    if (status) filters.status = status;

    const payments = await vmpAdapter.getPayments(req.user.vendorId, company_id || null, filters);

    // Sort chronologically (oldest first for timeline)
    const sortedPayments = (payments || []).sort((a, b) => {
      const dateA = new Date(a.payment_date || a.created_at);
      const dateB = new Date(b.payment_date || b.created_at);
      return dateA.getTime() - dateB.getTime(); // Ascending order (oldest first)
    });

    // 3. Render response
    res.render('partials/payment_history.html', {
      payments: sortedPayments,
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.render('partials/payment_history.html', {
      payments: [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: error.message || 'Failed to load payment history',
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
          message: 'Payment not found or access denied',
        },
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
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payment-receipt-${payment.payment_ref}.txt"`
      );
      res.send(receiptText);
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, paymentId: req.params.id });
    res.status(500).render('pages/error.html', {
      error: {
        status: 500,
        message: error.message || 'Failed to download receipt',
      },
    });
  }
});

// GET: Payment History CSV Export (Sprint 7.3)
app.get('/payments/history/export', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Business logic - Apply same filters as history view
    const {
      payment_ref,
      invoice_num,
      date_from,
      date_to,
      company_id,
      amount_min,
      amount_max,
      status,
    } = req.query;
    const filters = {};
    if (payment_ref) filters.payment_ref = payment_ref;
    if (invoice_num) filters.invoice_num = invoice_num;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (amount_min) filters.amount_min = amount_min;
    if (amount_max) filters.amount_max = amount_max;
    if (status) filters.status = status;

    const payments = await vmpAdapter.getPayments(req.user.vendorId, company_id || null, filters);

    // 3. Generate CSV
    const csvRows = [];

    // CSV Header
    csvRows.push(
      [
        'Payment Date',
        'Payment Reference',
        'Amount',
        'Currency',
        'Company',
        'Invoice Number',
        'Remittance Available',
        'Source System',
        'Description',
      ].join(',')
    );

    // CSV Data Rows
    for (const payment of payments || []) {
      csvRows.push(
        [
          payment.payment_date || '',
          payment.payment_ref || '',
          payment.amount || '0.00',
          payment.currency_code || 'USD',
          payment.vmp_companies?.name || '',
          payment.vmp_invoices?.invoice_num || payment.invoice_num || '',
          payment.remittance_url ? 'Yes' : 'No',
          payment.source_system || 'manual',
          (payment.description || '').replace(/"/g, '""'), // Escape quotes in CSV
        ]
          .map(field => `"${field}"`)
          .join(',')
      );
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
      error: error.message || 'Failed to export payment history',
    });
  }
});

// ============================================================================
// SPRINT 5: Supplier Profile & Compliance (VMP-02)
// ============================================================================

// GET: Profile Page
app.get('/settings', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Render settings page
    res.render('pages/settings.html', {
      title: 'Settings & Configuration',
      user: req.user,
      isInternal: req.user?.isInternal || false,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

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
            message: 'Vendor profile not found',
          },
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
      isInternal: req.user?.isInternal || false,
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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/profile_form.html', {
      vendorProfile: null,
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
        new ValidationError(
          'At least one contact field (address, phone, website) must be provided'
        ),
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
      website: website || null,
    });

    // 4. Fetch updated profile to render
    const vendorProfile = await vmpAdapter.getVendorProfile(req.user.vendorId);

    // 5. Render response (refresh the form with updated data)
    res.render('partials/profile_form.html', {
      vendorProfile,
      error: null,
      success: 'Contact information updated successfully',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    handlePartialError(error, req, res, 'partials/profile_form.html', {
      vendorProfile: null,
    });
  }
});

// POST: Bank Details Change Request (Creates Change Request Case)
app.post('/profile/bank-details', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { account_name, account_number, bank_name, swift_code, branch_address, currency } =
      req.body;

    // Validate required fields using validateRequired helper
    if (!validateRequired(account_name, 'account_name')) {
      return res.status(400).json({
        error: 'account_name is required',
      });
    }
    if (!validateRequired(account_number, 'account_number')) {
      return res.status(400).json({
        error: 'account_number is required',
      });
    }
    if (!validateRequired(bank_name, 'bank_name')) {
      return res.status(400).json({
        error: 'bank_name is required',
      });
    }
    if (!validateRequired(swift_code, 'swift_code')) {
      return res.status(400).json({
        error: 'swift_code is required',
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
        currency: currency?.trim() || null,
      },
      req.user.id
    );

    // 4. Redirect to case detail page (user can upload Bank Letter there)
    res.redirect(`/cases/${newCase.id}`);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to request bank details change',
    });
  }
});

const supplierDashboardHandler = async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;

    if (!req.user.vendorId) {
      return res.status(403).render('pages/403.html', {
        title: 'Access Denied',
        user: req.user,
        error: {
          status: 403,
          message: 'Supplier dashboard is only available to vendors',
        },
      });
    }

    let cases = [];
    let readyCount = 0;
    let actionCount = 0;
    let blockedCount = 0;
    let openCount = 0;
    let payments = [];
    let recentPayment = null;
    let pendingPayments = [];

    try {
      cases = await vmpAdapter.getInbox(req.user.vendorId);
      readyCount = cases.filter(c => c.status === 'resolved').length;
      actionCount = cases.filter(c => c.status === 'waiting_supplier').length;
      blockedCount = cases.filter(c => c.status === 'blocked').length;
      openCount = cases.filter(c => c.status === 'open').length;
    } catch (adapterError) {
      logError(adapterError, { path: req.path, userId: req.user?.id, vendorId: req.user.vendorId });
    }

    try {
      payments = await vmpAdapter.getPayments(req.user.vendorId);
      if (payments && payments.length > 0) {
        recentPayment = payments[0] || null;
        pendingPayments = payments.slice(1, 6);
      }
    } catch (paymentError) {
      logError(paymentError, {
        path: req.path,
        userId: req.user?.id,
        vendorId: req.user.vendorId,
        operation: 'getPayments',
      });
    }

    res.render('pages/supplier_dashboard.html', {
      title: 'Supplier Dashboard',
      user: req.user,
      readyCount,
      actionCount,
      blockedCount,
      openCount,
      cases,
      recent_payment: recentPayment,
      pending_payments: pendingPayments,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
};

// Existing supplier route (legacy URL)
app.get('/supplier/dashboard', supplierDashboardHandler);

// Vendor canonical route under BASE_PATH
app.get(`${BASE_PATH}/vendor/dashboard`, supplierDashboardHandler);

// GET: Supplier Case List Partial
app.get('/partials/supplier-case-list.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Authorization - Only vendors can access
    if (!req.user.vendorId) {
      return handlePartialError(
        new ValidationError('Supplier case list is only available to vendors'),
        req,
        res,
        'partials/supplier_case_list.html',
        { cases: [] }
      );
    }

    // 3. Business logic - Fetch cases
    const { status } = req.query;
    let cases = [];

    try {
      cases = await vmpAdapter.getInbox(req.user.vendorId);

      // Filter by status if provided
      if (status) {
        if (status === 'action_required') {
          cases = cases.filter(c => c.status === 'blocked' || c.status === 'waiting_supplier');
        } else {
          cases = cases.filter(c => c.status === status);
        }
      }
    } catch (adapterError) {
      logError(adapterError, { path: req.path, userId: req.user?.id, vendorId: req.user.vendorId });
      // Continue with empty array
    }

    // 4. Render response
    res.render('partials/supplier_case_list.html', {
      cases,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/supplier_case_list.html', {
      cases: [],
    });
  }
});

// GET: Supplier Financial Radar Partial
app.get('/supplier/radar', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Authorization - Only vendors can access
    if (!req.user.vendorId) {
      return handlePartialError(
        new ValidationError('Supplier financial radar is only available to vendors'),
        req,
        res,
        'partials/supplier_financial_radar.html',
        { last_payment: null, pending_invoices: [] }
      );
    }

    // 3. Business logic - Fetch payment and invoice data
    let lastPayment = null;
    let pendingInvoices = [];

    try {
      // Get the most recent payment
      const payments = await vmpAdapter.getPayments(req.user.vendorId, null, {});
      if (payments && payments.length > 0) {
        lastPayment = payments[0]; // Already sorted by payment_date descending
      }

      // Get pending invoices (not paid, not cancelled)
      const allInvoices = await vmpAdapter.getInvoices(req.user.vendorId, null, {});
      pendingInvoices = (allInvoices || [])
        .filter(inv => {
          const status = inv.status?.toLowerCase() || '';
          return status !== 'paid' && status !== 'cancelled' && status !== 'void';
        })
        .slice(0, 5); // Limit to 5 most recent
    } catch (adapterError) {
      logError(adapterError, { path: req.path, userId: req.user?.id, vendorId: req.user.vendorId });
      // Continue with empty data
    }

    // 4. Render response
    res.render('partials/supplier_financial_radar.html', {
      last_payment: lastPayment,
      pending_invoices: pendingInvoices,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/supplier_financial_radar.html', {
      last_payment: null,
      pending_invoices: [],
    });
  }
});

// ============================================================================
// SPRINT 6: Command Center (Internal Ops + Org Tree)
// ============================================================================

// === HELPER: BUILD ORG TREE ===
async function getOrgTopology(tenantId) {
  try {
    // 1. Fetch the Tenant Details (with timeout protection)
    const tenantQuery = supabase.from('vmp_tenants').select('id, name').eq('id', tenantId).single();

    const { data: tenant, error: tenantError } = await withTimeout(
      tenantQuery,
      10000,
      `getOrgTopology-tenant(${tenantId})`
    );

    if (tenantError || !tenant) {
      logError(tenantError || new Error('Tenant not found'), {
        tenantId,
        operation: 'getOrgTopology',
      });
      return null;
    }

    // 2. Fetch All Groups (with timeout protection)
    const groupsQuery = supabase
      .from('vmp_groups')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    const { data: groups, error: groupsError } = await withTimeout(
      groupsQuery,
      10000,
      `getOrgTopology-groups(${tenantId})`
    );

    if (groupsError) {
      logError(groupsError, { tenantId, operation: 'getOrgTopology-groups' });
    }

    // 3. Fetch All Companies (include code if it exists in the schema) (with timeout protection)
    const companiesQuery = supabase
      .from('vmp_companies')
      .select('id, group_id, name, legal_name, country_code, currency_code')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    const { data: companies, error: companiesError } = await withTimeout(
      companiesQuery,
      10000,
      `getOrgTopology-companies(${tenantId})`
    );

    // Add code field for display (use country_code as fallback)
    const companiesWithCode = (companies || []).map(company => ({
      ...company,
      code: company.country_code || 'ENT', // Use country_code as display code
    }));

    if (companiesError) {
      logError(companiesError, { tenantId, operation: 'getOrgTopology-companies' });
    }

    // 4. Stitch the Tree
    // Map companies to their groups
    const groupsWithCompanies = (groups || []).map(group => {
      return {
        ...group,
        companies: companiesWithCode.filter(c => c.group_id === group.id),
      };
    });

    // Find "Orphan" companies (Ungrouped)
    const knownGroupIds = new Set((groups || []).map(g => g.id));
    const ungroupedCompanies = companiesWithCode.filter(
      c => !c.group_id || !knownGroupIds.has(c.group_id)
    );

    return {
      tenant: tenant || { name: 'NexusCanon Global' },
      groups: groupsWithCompanies,
      ungroupedCompanies: ungroupedCompanies,
    };
  } catch (err) {
    logError(err, { tenantId, operation: 'getOrgTopology' });
    return null; // Return null to trigger the "No Topology" state
  }
}

// GET: Command Center Home (Internal Only)
app.get('/ops', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Render response
    res.render('pages/ops_command_center.html', {
      title: 'Command Center',
      user: req.user,
      isInternal: true,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: Org Tree Sidebar Partial
app.get('/partials/org-tree-sidebar.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization (HTMX-friendly: return error in template, not redirect)
    if (!req.user) {
      return res.status(200).render('partials/org_tree_sidebar.html', {
        orgTree: null,
        error: 'Authentication required. Please log in.',
        user: null,
        currentScope: { type: null, id: null },
      });
    }

    // 2. Get tenant ID from user context (also used for debug if not internal)
    // Use authId (Supabase Auth UUID) not id (vendor_user ID)
    const authUserId = req.user.authId || req.user.id;
    const userContext = await vmpAdapter.getVendorContext(authUserId);

    if (!req.user.isInternal) {
      // Debug: Log user context to help diagnose the issue
      logError(new Error('User is not marked as internal'), {
        userId: req.user.id,
        userEmail: req.user.email,
        vendorId: req.user.vendorId,
        isInternal: req.user.isInternal,
        userContextIsInternal: userContext?.is_internal,
        path: req.path,
      });

      return res.status(200).render('partials/org_tree_sidebar.html', {
        orgTree: null,
        error: `Access denied. Internal users only. (User: ${req.user.email}, isInternal: ${req.user.isInternal})`,
        user: req.user,
        currentScope: { type: null, id: null },
      });
    }
    const tenantId = userContext.vmp_vendors?.tenant_id || '00000000-0000-0000-0000-000000000001'; // Fallback to seed tenant

    // 3. Fetch the Tree using the helper function
    const orgTree = await getOrgTopology(tenantId);

    // 4. Determine current scope from query params
    const scopeId = req.query.scope_id;
    let currentScope = { type: null, id: null };

    if (scopeId && orgTree) {
      // Check if ID belongs to a Group or Company
      const isGroup = orgTree.groups?.some(g => g.id === scopeId);
      const isCompany =
        orgTree.groups?.some(g => g.companies?.some(c => c.id === scopeId)) ||
        orgTree.ungroupedCompanies?.some(c => c.id === scopeId);

      if (isGroup) {
        currentScope = { type: 'group', id: scopeId };
      } else if (isCompany) {
        currentScope = { type: 'company', id: scopeId };
      }
    }

    // 5. Render response
    res.render('partials/org_tree_sidebar.html', {
      orgTree,
      error: null,
      user: req.user,
      currentScope,
    });
  } catch (error) {
    // Enhanced error logging
    logError(error, {
      operation: 'getOrgTree',
      userId: req.user?.id,
      userEmail: req.user?.email,
      path: req.path,
    });

    handlePartialError(error, req, res, 'partials/org_tree_sidebar.html', {
      orgTree: null,
      user: req.user || null,
      currentScope: {
        type: req.query.scope_type || null,
        id: req.query.scope_id || null,
      },
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
        error: { status: 400, message: 'User must be associated with a tenant' },
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
      isInternal: true,
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
        error: 'scope_type and scope_id are required',
      });
    }

    // 3. Business logic
    const dashboard = await vmpAdapter.getScopedDashboard(scope_type, scope_id, req.user.id);

    // 4. Render response
    res.render('partials/scoped_dashboard.html', {
      dashboard,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/scoped_dashboard.html', {
      dashboard: null,
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
      isInternal: true,
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

    if (
      !validateRequiredQuery(
        scope_type,
        'scope_type',
        res,
        'partials/ops_case_queue.html',
        defaultData
      )
    ) {
      return;
    }

    if (
      !validateRequiredQuery(scope_id, 'scope_id', res, 'partials/ops_case_queue.html', defaultData)
    ) {
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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/ops_case_queue.html', {
      cases: [],
      scopeType: req.query.scope_type || null,
      scopeId: req.query.scope_id || null,
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
      isInternal: true,
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
    if (!validateUUIDParam(getStringParam(case_id), res, 'partials/decision_log.html')) return;

    // 3. Business logic
    let decisions = [];
    try {
      decisions = await vmpAdapter.getDecisionLog(case_id);
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/decision_log.html', {
        caseId: case_id,
        decisions: [],
      });
    }

    // 4. Render response
    res.render('partials/decision_log.html', {
      caseId: case_id,
      decisions,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/decision_log.html', {
      caseId: req.query.case_id || null,
      decisions: [],
    });
  }
});

// GET: Timeline Partial (Audit Rail)
app.get('/partials/timeline.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const { case_id } = req.query;
    const defaultData = { caseId: null, timelineItems: [] };

    if (!case_id) {
      return res.render('partials/timeline.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(getStringParam(case_id), res, 'partials/timeline.html')) return;

    // 3. Business logic - Get case messages and activity
    let timelineItems = [];
    try {
      const vendorId = req.user.vendorId || req.user.vendor_id;
      if (!vendorId) {
        return res.render('partials/timeline.html', defaultData);
      }

      // Get case messages for timeline
      const messages = await vmpAdapter.getCaseMessages(case_id, vendorId);

      // Transform messages into timeline items
      timelineItems = (messages || []).map(msg => ({
        date: msg.created_at,
        title: msg.message_type === 'internal' ? 'Internal Note' : 'Message',
        description: msg.content,
        status: msg.message_type === 'internal' ? 'internal' : 'default',
        meta: {
          from: msg.sender_name || 'System',
          type: msg.message_type || 'message',
        },
      }));
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/timeline.html', {
        caseId: case_id,
        timelineItems: [],
      });
    }

    // 4. Render response
    res.render('partials/timeline.html', {
      caseId: case_id,
      timelineItems,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/timeline.html', {
      caseId: req.query.case_id || null,
      timelineItems: [],
    });
  }
});

// GET: Truth Panel Partial (Audit Rail)
app.get('/partials/truth-panel.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation (case_id is optional for partials - can render empty state)
    const { case_id } = req.query;
    const defaultData = {
      caseId: null,
      invoice: null,
      purchaseOrder: null,
      grn: null,
      payment: null,
      linkedCases: [],
      linkedPayments: [],
      evidenceCount: 0,
    };

    if (!case_id) {
      return res.render('partials/truth_panel.html', defaultData);
    }

    // Validate UUID if provided
    if (!validateUUIDParam(getStringParam(case_id), res, 'partials/truth_panel.html')) return;

    // 3. Business logic - Get linked transactions
    let invoice = null;
    let purchaseOrder = null;
    let grn = null;
    let payment = null;
    let linkedCases = [];
    let linkedPayments = [];
    let evidenceCount = 0;

    try {
      const vendorId = req.user.vendorId || req.user.vendor_id;
      if (!vendorId) {
        return res.render('partials/truth_panel.html', defaultData);
      }

      // Get case detail to find linked invoice_id
      const caseDetail = await vmpAdapter.getCaseDetail(case_id, vendorId);

      if (caseDetail && caseDetail.invoice_id) {
        // Get invoice
        invoice = await vmpAdapter.getInvoice(caseDetail.invoice_id, vendorId);

        // Get linked cases for this invoice
        if (invoice) {
          const allCases = await vmpAdapter.getInbox(vendorId);
          linkedCases = (allCases || []).filter(c => c.invoice_id === invoice.id);
        }
      }

      // Get evidence count
      const evidence = await vmpAdapter.getCaseEvidence(case_id, vendorId);
      evidenceCount = (evidence || []).length;
    } catch (adapterError) {
      return handlePartialError(adapterError, req, res, 'partials/truth_panel.html', defaultData);
    }

    // 4. Render response
    res.render('partials/truth_panel.html', {
      caseId: case_id,
      invoice,
      purchaseOrder,
      grn,
      payment,
      linkedCases,
      linkedPayments,
      evidenceCount,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/truth_panel.html', {
      caseId: req.query.case_id || null,
      invoice: null,
      purchaseOrder: null,
      grn: null,
      payment: null,
      linkedCases: [],
      linkedPayments: [],
      evidenceCount: 0,
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
      scopeId: null,
    };

    if (!scope_type || !scope_id) {
      return res.status(400).render('partials/vendor_directory.html', {
        ...defaultData,
        error: 'scope_type and scope_id are required',
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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/vendor_directory.html', {
      vendors: [],
      filters: { status: req.query.status || null },
      scopeType: req.query.scope_type || null,
      scopeId: req.query.scope_id || null,
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
            message: 'Case not found',
          },
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
      user: req.user,
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
      overdueCheckHours: 0,
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

// ============================================================================
// SPRINT: RECOMMENDATIONS - SLA ANALYTICS DASHBOARD
// ============================================================================

// GET: SLA Analytics Dashboard (Internal Only)
app.get('/ops/sla-analytics', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Get user context to determine tenant and default scope
    const userContext = await vmpAdapter.getVendorContext(req.user.id);
    const tenantId = userContext.vmp_vendors?.tenant_id;
    if (!tenantId) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'User must be associated with a tenant' },
      });
    }

    // 3. Business logic - Determine scope from query params or user context
    const { scope_type, scope_id, start_date, end_date } = req.query;
    let userScope = null;

    if (scope_id) {
      userScope = scope_id;
    } else {
      if (userContext.scope_group_id) {
        userScope = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        userScope = userContext.scope_company_id;
      }
    }

    // 4. Fetch SLA metrics
    const dateRange = {
      startDate: start_date || null,
      endDate: end_date || null,
    };

    // Get pagination options from query params
    const paginationOptions = {
      limit: req.query.limit ? parseInt(getStringParam(req.query.limit)) : undefined,
      offset: req.query.offset ? parseInt(getStringParam(req.query.offset)) : undefined,
      forceRefresh: req.query.refresh === 'true',
    };

    const slaMetrics = await vmpAdapter.getSLAMetrics(
      tenantId,
      userScope,
      dateRange,
      paginationOptions
    );

    // 5. Determine scope type for UI display
    let finalScopeType = slaMetrics.scope.type || 'tenant';
    let finalScopeId = slaMetrics.scope.id || null;

    // 6. Render response
    res.render('pages/sla_analytics.html', {
      title: 'SLA Analytics',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      slaMetrics,
      dateRange: slaMetrics.dateRange,
      user: req.user,
      isInternal: true,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: SLA Analytics Partial (Internal Only)
app.get('/partials/sla-analytics.html', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Get user context
    const userContext = await vmpAdapter.getVendorContext(req.user.id);
    const tenantId = userContext.vmp_vendors?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({
        error: 'User must be associated with a tenant',
      });
    }

    // 3. Business logic
    const { scope_type, scope_id, start_date, end_date } = req.query;
    let userScope = null;

    if (scope_id) {
      userScope = scope_id;
    } else {
      if (userContext.scope_group_id) {
        userScope = userContext.scope_group_id;
      } else if (userContext.scope_company_id) {
        userScope = userContext.scope_company_id;
      }
    }

    const dateRange = {
      startDate: start_date || null,
      endDate: end_date || null,
    };

    // Get pagination options from query params
    const paginationOptions = {
      limit: req.query.limit ? parseInt(getStringParam(req.query.limit)) : undefined,
      offset: req.query.offset ? parseInt(getStringParam(req.query.offset)) : undefined,
      forceRefresh: req.query.refresh === 'true',
    };

    const slaMetrics = await vmpAdapter.getSLAMetrics(
      tenantId,
      userScope,
      dateRange,
      paginationOptions
    );

    // 4. Render response
    res.render('partials/sla_analytics.html', {
      slaMetrics,
      dateRange: slaMetrics.dateRange,
      scopeType: slaMetrics.scope.type || 'tenant',
      scopeId: slaMetrics.scope.id || null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    return res.status(500).json({
      error: 'Failed to load SLA analytics',
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
        error: 'Authentication required',
      });
    }

    // Fetch compliance documents from adapter
    let complianceDocs = [];
    try {
      complianceDocs = await vmpAdapter.getComplianceDocuments(req.user.vendorId);
    } catch (adapterError) {
      logError(adapterError, {
        path: req.path,
        userId: req.user?.id,
        operation: 'loadComplianceDocuments',
      });
      return res.render('partials/compliance_docs.html', {
        complianceDocs: [],
        error: 'Failed to load compliance documents',
      });
    }

    res.render('partials/compliance_docs.html', {
      complianceDocs,
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/compliance_docs.html', {
      complianceDocs: [],
      error: error.message || 'Failed to load compliance documents',
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
        contracts: [],
      });
    }

    // 3. Render response
    res.render('partials/contract_library.html', {
      contracts,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/contract_library.html', {
      contracts: [],
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
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.render('partials/notification_badge.html', {
      unreadCount: 0,
      error: null,
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
      unreadCount: (notifications || []).filter(n => !n.is_read).length,
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
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    const { data, error } = await withTimeout(updateQuery, 5000, 'markNotificationRead');

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to mark notification as read',
      });
    }

    // 4. Return success (redirect back to notifications page if from page, else JSON)
    if (req.headers['hx-request']) {
      // HTMX request - return updated notification badge
      const unreadNotifications = await vmpAdapter.getUserNotifications(req.user.id, 50, true);
      const unreadCount = unreadNotifications ? unreadNotifications.length : 0;
      res.render('partials/notification_badge.html', {
        unreadCount,
        error: null,
      });
    } else {
      res.redirect('/notifications');
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, notificationId: req.params.id });
    res.status(500).json({
      error: error.message || 'Failed to mark notification as read',
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
        read_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    const { error } = await withTimeout(updateQuery, 5000, 'markAllNotificationsRead');

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to mark all notifications as read',
      });
    }

    // 3. Redirect back to notifications page
    res.redirect('/notifications');
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to mark all notifications as read',
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
      emailData = parseEmailWebhook(req.body, getStringParam(provider));
    } catch (parseError) {
      logError(parseError, { path: req.path, provider, operation: 'parseEmailWebhook' });
      return res.status(400).json({
        error: 'Failed to parse email webhook',
        message: parseError.message,
      });
    }

    // 4. Extract vendor identifier from sender email
    const senderEmail = extractVendorIdentifier(emailData);
    if (!senderEmail) {
      return res.status(400).json({
        error: 'Could not extract sender email from webhook',
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
        message: vendorError.message,
      });
    }

    if (!vendorInfo) {
      // Vendor not found - could create case manually or return error
      return res.status(404).json({
        error: 'Vendor not found',
        message: `No vendor found for email: ${senderEmail}. Please ensure the sender is registered.`,
      });
    }

    // 6. Extract case reference from email (if replying to existing case)
    const caseReference = extractCaseReference(emailData);

    // 7. AI Analysis (Sprint 13.1) - Extract intent and structured data
    // Prepare message body for AI analysis
    const messageBody = emailData.text || emailData.html || emailData.subject || 'Email received';

    let aiAnalysis = null;
    let extractedData = null;
    let matchedCase = null;

    try {
      // Classify message intent
      aiAnalysis = await classifyMessageIntent(messageBody, 'email');

      // Extract structured data (invoice numbers, PO numbers, etc.)
      extractedData = await extractStructuredData(messageBody, emailData.subject || '');

      // Find best matching case if we have case candidates
      // Note: getCasesByReference may not exist - skip if not available
      if (caseReference && typeof vmpAdapter.getCasesByReference === 'function') {
        try {
          const candidateCases = await vmpAdapter.getCasesByReference(caseReference);
          if (candidateCases && candidateCases.length > 0) {
            matchedCase = await findBestMatchingCase(emailData, candidateCases, extractedData);
          }
        } catch (matchError) {
          // Ignore case matching errors
          logError(matchError, { path: req.path, operation: 'findBestMatchingCase' });
        }
      }
    } catch (aiError) {
      // Don't fail webhook processing if AI analysis fails
      logError(aiError, { path: req.path, operation: 'aiAnalysis', emailFrom: emailData.from });
    }

    // 8. Find or create case
    let caseId;
    try {
      caseId = await vmpAdapter.findOrCreateCaseFromEmail(emailData, vendorInfo, caseReference);
    } catch (caseError) {
      logError(caseError, {
        path: req.path,
        vendorInfo,
        caseReference,
        operation: 'findOrCreateCaseFromEmail',
      });
      return res.status(500).json({
        error: 'Failed to find or create case',
        message: caseError.message,
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
        matchedCase: matchedCase?.caseNum || null,
        caseId: caseId,
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Failed to log port activity:', logError);
    }

    // 10. Create message from email (with AI-extracted metadata)
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
      matchedCaseConfidence: matchedCase?.confidence || null,
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
        vendorId: vendorInfo.vendorId,
      });
    } catch (messageError) {
      logError(messageError, { path: req.path, caseId, operation: 'createMessage' });

      // Log error activity
      try {
        await vmpAdapter.logPortActivity('email', 'error', 'error', {
          messageId: emailData.messageId,
          caseId: caseId,
          errorMessage: messageError.message,
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
          vendorId: vendorInfo.vendorId,
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
        attachmentNames: emailData.attachments.map(att => att.filename).join(', '),
      });
    }

    // 10. Return success response
    return res.status(200).json({
      success: true,
      caseId,
      message: 'Email processed successfully',
      caseCreated: !caseReference,
      attachmentsCount: emailData.attachments?.length || 0,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'emailWebhook' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
      whatsappData = parseWhatsAppWebhook(req.body, getStringParam(provider));
    } catch (parseError) {
      logError(parseError, { path: req.path, provider, operation: 'parseWhatsAppWebhook' });
      return res.status(400).json({
        error: 'Failed to parse WhatsApp webhook',
        message: parseError.message,
      });
    }

    // 4. Skip status updates (only process actual messages)
    if (whatsappData.messageType === 'status') {
      return res.status(200).json({
        success: true,
        message: 'Status update received',
        skipped: true,
      });
    }

    // 5. Extract vendor identifier from phone number
    const phoneNumber = extractVendorIdentifierFromWhatsApp(whatsappData);
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Could not extract phone number from webhook',
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
        message: vendorError.message,
      });
    }

    if (!vendorInfo) {
      return res.status(404).json({
        error: 'Vendor not found',
        message: `No vendor found for phone number: ${phoneNumber}. Please ensure the phone number is registered with a vendor account.`,
      });
    }

    // 7. Extract case reference from message (if replying to existing case)
    const caseReference = extractCaseReferenceFromWhatsApp(whatsappData);

    // 8. Find or create case
    // Convert WhatsApp data to email-like format for reuse
    const emailLikeData = {
      from: whatsappData.fromName
        ? `${whatsappData.fromName} <${whatsappData.from}@whatsapp>`
        : `${whatsappData.from}@whatsapp`,
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
        mediaId: media.id,
      })),
      headers: {},
      messageId: whatsappData.messageId,
      timestamp: whatsappData.timestamp,
    };

    let caseId;
    try {
      caseId = await vmpAdapter.findOrCreateCaseFromEmail(emailLikeData, vendorInfo, caseReference);
    } catch (caseError) {
      logError(caseError, {
        path: req.path,
        vendorInfo,
        caseReference,
        operation: 'findOrCreateCaseFromWhatsApp',
      });
      return res.status(500).json({
        error: 'Failed to find or create case',
        message: caseError.message,
      });
    }

    // 9. Log webhook received activity
    try {
      await vmpAdapter.logPortActivity('whatsapp', 'webhook_received', 'success', {
        messageId: whatsappData.messageId,
        from: whatsappData.from,
        provider: whatsappData.provider,
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Failed to log port activity:', logError);
    }

    // 10. Create message from WhatsApp
    const messageBody =
      whatsappData.text || `WhatsApp message from ${whatsappData.fromName || whatsappData.from}`;
    const whatsappMetadata = {
      from: whatsappData.from,
      fromName: whatsappData.fromName,
      to: whatsappData.to,
      messageId: whatsappData.messageId,
      messageType: whatsappData.messageType,
      provider: whatsappData.provider,
      media: whatsappData.media,
      metadata: whatsappData.metadata,
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
        vendorId: vendorInfo.vendorId,
      });
    } catch (messageError) {
      logError(messageError, { path: req.path, caseId, operation: 'createMessage' });

      // Log error activity
      try {
        await vmpAdapter.logPortActivity('whatsapp', 'error', 'error', {
          messageId: whatsappData.messageId,
          caseId: caseId,
          errorMessage: messageError.message,
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
          vendorId: vendorInfo.vendorId,
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
        filename: media.filename,
      }));

      logError(null, {
        path: req.path,
        caseId,
        operation: 'whatsappMediaReceived',
        mediaCount: whatsappData.media.length,
        media: mediaInfo,
      });
    }

    // 13. Return success response
    return res.status(200).json({
      success: true,
      caseId,
      message: 'WhatsApp message processed successfully',
      caseCreated: !caseReference,
      mediaCount: whatsappData.media?.length || 0,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'whatsappWebhook' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
      isInternal: true,
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
      ports: ports || [],
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
        message: `Port type must be one of: ${validPortTypes.join(', ')}`,
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
        updates.configuration =
          typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      } catch (parseError) {
        return res.status(400).json({
          error: 'Invalid configuration JSON',
          message: parseError.message,
        });
      }
    }

    // 4. Business logic - Update port configuration
    const updatedPort = await vmpAdapter.updatePortConfiguration(portType, updates);

    // 5. Return success response
    return res.status(200).json({
      success: true,
      port: updatedPort,
      message: 'Port configuration updated successfully',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, portType: req.params.portType });
    return res.status(500).json({
      error: 'Failed to update port configuration',
      message: error.message,
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
    const limit = parseInt(getStringParam(req.query.limit) || '100', 10);

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
      portType: portType || 'all',
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/port_activity_log.html', {
      activities: [],
      portType: null,
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

    if (
      !validateRequiredQuery(
        payment_id,
        'payment_id',
        res,
        'partials/remittance_viewer.html',
        defaultData
      )
    ) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(getStringParam(payment_id), res, 'partials/remittance_viewer.html'))
      return;

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
        error: 'No remittance document available for this payment',
      });
    }

    // 4. Render response
    res.render('partials/remittance_viewer.html', {
      remittanceUrl: payment.remittance_url,
      payment: payment,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/remittance_viewer.html', {
      remittanceUrl: null,
      payment: null,
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
      isInternal: req.user?.isInternal || false,
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

    const invoices = await vmpAdapter.getInvoices(req.user.vendorId, company_id || null, filters);

    // 3. Render response
    res.render('partials/invoice_list.html', {
      invoices: invoices || [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_list.html', {
      invoices: [],
      isInternal: req.user?.isInternal || false,
      query: req.query,
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
    const pageNum = parseInt(getStringParam(page), 10) || 1;
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
      request: req,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_card_feed.html', {
      invoices: [],
      current_page: 1,
      next_page: null,
      has_more: false,
      isInternal: req.user?.isInternal || false,
      query: req.query,
      request: req,
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
          message: 'Invoice not found or access denied',
        },
      });
    }

    // 4. Render response
    res.render('pages/invoice_detail.html', {
      title: `Invoice ${invoice.invoice_num}`,
      invoiceId,
      invoice,
      user: req.user,
      isInternal: req.user?.isInternal || false,
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
      isInternal: req.user?.isInternal || false,
    };

    if (
      !validateRequiredQuery(
        invoiceId,
        'invoice_id',
        res,
        'partials/invoice_detail.html',
        defaultData
      )
    ) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(getStringParam(invoiceId), res, 'partials/invoice_detail.html')) return;

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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invoice_detail.html', {
      invoice: null,
      isInternal: req.user?.isInternal || false,
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

    if (
      !validateRequiredQuery(
        invoiceId,
        'invoice_id',
        res,
        'partials/matching_status.html',
        defaultData
      )
    ) {
      return;
    }

    // Validate UUID format
    if (!validateUUIDParam(getStringParam(invoiceId), res, 'partials/matching_status.html')) return;

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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/matching_status.html', {
      matchingStatus: null,
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
        error: 'Invoice not found or access denied',
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
      error: error.message || 'Failed to create case from invoice',
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
        error: 'Invoice not found or access denied',
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
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to request GRN',
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
        error: 'Invoice not found or access denied',
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
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to dispute amount',
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
        error: 'Exception type is required',
      });
    }

    // Validate exception type
    const validExceptionTypes = [
      'missing_grn',
      'amount_mismatch',
      'date_mismatch',
      'missing_po',
      'po_status',
      'grn_status',
    ];
    if (!validExceptionTypes.includes(exception_type)) {
      return res.status(400).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invalid exception type',
      });
    }

    // 3. Business logic - Verify invoice access
    const invoice = await vmpAdapter.getInvoiceDetail(invoiceId, req.user.vendorId);
    if (!invoice) {
      return res.status(404).render('partials/matching_status.html', {
        matchingStatus: null,
        error: 'Invoice not found or access denied',
      });
    }

    // Build subject with exception details
    const exceptionLabels = {
      missing_grn: 'Missing GRN',
      amount_mismatch: 'Amount Mismatch',
      date_mismatch: 'Date Mismatch',
      missing_po: 'Missing PO',
      po_status: 'PO Status Issue',
      grn_status: 'GRN Status Issue',
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
      error: null,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id, invoiceId: req.params.id });
    res.status(500).render('partials/matching_status.html', {
      matchingStatus: null,
      error: error.message || 'Failed to report exception',
    });
  }
});

// ============================================================================
// ============================================================================
// SOA RECONCILIATION ROUTES
// ============================================================================

// GET: SOA Reconciliation Workspace
app.get('/soa/recon/:caseId', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = getStringParam(req.params.caseId);
    if (!caseId || !isValidUUID(caseId)) {
      return res.status(400).render('pages/error.html', {
        error: { status: 400, message: 'Invalid case ID' },
        user: req.user,
      });
    }

    // 3. Business logic
    const soaLines = await vmpAdapter.getSOALines(caseId, req.user.vendorId);
    const summary = await vmpAdapter.getSOASummary(caseId, req.user.vendorId);
    const issues = await vmpAdapter.getSOAIssues(caseId);

    // 4. Render response
    res.render('pages/soa_recon.html', {
      title: 'SOA Reconciliation',
      user: req.user,
      caseId: caseId,
      soaLines: soaLines || [],
      summary: summary,
      issues: issues || [],
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// GET: SOA Reconciliation Partial (3-column workspace)
app.get('/partials/soa-recon-workspace.html', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const caseId = getStringParam(req.query.case_id);
    if (!caseId || !isValidUUID(caseId)) {
      return res.status(400).render('partials/error_message.html', {
        error: { message: 'Invalid case ID' },
      });
    }

    // 3. Business logic
    const soaLines = await vmpAdapter.getSOALines(caseId, req.user.vendorId);
    const summary = await vmpAdapter.getSOASummary(caseId, req.user.vendorId);
    const issues = await vmpAdapter.getSOAIssues(caseId);

    // 4. Render response
    res.render('partials/soa_recon_workspace.html', {
      caseId: caseId,
      soaLines: soaLines || [],
      summary: summary,
      issues: issues || [],
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/soa_recon_workspace.html', {
      caseId: req.query.case_id,
      soaLines: [],
      summary: null,
      issues: [],
    });
  }
});

// POST: Match SOA Line to Invoice
app.post('/soa/match', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { soaItemId, invoiceId, matchData } = req.body;
    if (!soaItemId || !invoiceId) {
      return res.status(400).json({
        error: 'soaItemId and invoiceId are required',
      });
    }

    // 3. Business logic
    const match = await vmpAdapter.createSOAMatch(soaItemId, invoiceId, matchData || {});

    // 4. Render response
    res.json({
      success: true,
      match: match,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to create SOA match',
      message: error.message,
    });
  }
});

// POST: Confirm SOA Match
app.post('/soa/match/:matchId/confirm', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const matchId = getStringParam(req.params.matchId);
    if (!matchId || !isValidUUID(matchId)) {
      return res.status(400).json({
        error: 'Invalid match ID',
      });
    }

    // 3. Business logic
    const match = await vmpAdapter.confirmSOAMatch(matchId, req.user.id);

    // 4. Render response
    res.json({
      success: true,
      match: match,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to confirm SOA match',
      message: error.message,
    });
  }
});

// POST: Reject SOA Match
app.post('/soa/match/:matchId/reject', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const matchId = getStringParam(req.params.matchId);
    if (!matchId || !isValidUUID(matchId)) {
      return res.status(400).json({
        error: 'Invalid match ID',
      });
    }

    const { reason } = req.body;

    // 3. Business logic
    const match = await vmpAdapter.rejectSOAMatch(matchId, req.user.id, reason);

    // 4. Render response
    res.json({
      success: true,
      match: match,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to reject SOA match',
      message: error.message,
    });
  }
});

// POST: Run Autonomous Matching
app.post('/soa/match/auto', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { caseId } = req.body;
    if (!caseId || !isValidUUID(caseId)) {
      return res.status(400).json({
        error: 'Invalid case ID',
      });
    }

    // 3. Business logic
    const soaLines = await vmpAdapter.getSOALines(caseId, req.user.vendorId, 'extracted');
    const { batchMatchSOALines } = await import('../utils/soa-matching-engine.js');

    const matchResults = await batchMatchSOALines(
      soaLines,
      req.user.vendorId,
      req.user.companyId || null
    );

    // Create matches for successful matches
    const createdMatches = [];
    for (const result of matchResults) {
      if (result.match && result.soaLine) {
        const matchData = {
          matchType: result.match.matchType,
          isExactMatch: result.match.isExactMatch,
          confidence: result.match.confidence,
          matchScore: result.match.matchScore,
          matchCriteria: result.match.matchCriteria,
          soaAmount: result.soaLine.amount,
          invoiceAmount: result.match.invoice.total_amount,
          soaDate: result.soaLine.invoice_date,
          invoiceDate: result.match.invoice.invoice_date,
          matchedBy: 'system',
          metadata: { pass: result.pass },
        };

        const match = await vmpAdapter.createSOAMatch(
          result.soaLineId,
          result.match.invoice.id,
          matchData
        );
        createdMatches.push(match);
      }
    }

    // 4. Render response
    res.json({
      success: true,
      matchesCreated: createdMatches.length,
      totalLines: soaLines.length,
      results: matchResults,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to run autonomous matching',
      message: error.message,
    });
  }
});

// POST: Resolve SOA Issue
app.post('/soa/resolve', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { issueId, resolutionData } = req.body;
    if (!issueId || !isValidUUID(issueId)) {
      return res.status(400).json({
        error: 'Invalid issue ID',
      });
    }

    // 3. Business logic
    const issue = await vmpAdapter.resolveSOAIssue(issueId, req.user.id, resolutionData || {});

    // 4. Render response
    res.json({
      success: true,
      issue: issue,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to resolve SOA issue',
      message: error.message,
    });
  }
});

// POST: Sign Off SOA Reconciliation
app.post('/soa/signoff', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { caseId, acknowledgementData } = req.body;
    if (!caseId || !isValidUUID(caseId)) {
      return res.status(400).json({
        error: 'Invalid case ID',
      });
    }

    // 3. Business logic
    const acknowledgement = await vmpAdapter.signOffSOA(
      caseId,
      req.user.vendorId,
      req.user.id,
      acknowledgementData || {}
    );

    // 4. Render response
    res.json({
      success: true,
      acknowledgement: acknowledgement,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to sign off SOA',
      message: error.message,
    });
  }
});

// ============================================================================
// SOA API ENDPOINTS (HTMX-Compatible)
// ============================================================================

// GET: SOA Template Download (P1: Template Download)
app.get('/api/soa/template', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Generate CSV template
    const csvContent = `Invoice #,Date,Amount,Currency,Type,Description
INV-001,2024-01-15,1000.00,USD,INV,Sample invoice
INV-002,2024-01-20,2500.50,USD,INV,Another invoice
CN-001,2024-01-25,100.00,USD,CN,Credit note`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="soa-template.csv"');
    res.send(csvContent);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to generate template',
      message: error.message,
      userFriendly: true,
    });
  }
});

// POST: SOA Preview (P0: Preview before upload)
app.post('/api/soa/preview', upload.single('file'), async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    if (!req.file) {
      return res.status(400).json({
        error: 'File is required for preview',
        userFriendly: true,
      });
    }

    // Detect file type
    const isCSV =
      req.file.mimetype === 'text/csv' ||
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.originalname.toLowerCase().endsWith('.csv');

    const isPDF =
      req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');

    const isExcel =
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.originalname.toLowerCase().endsWith('.xlsx') ||
      req.file.originalname.toLowerCase().endsWith('.xls');

    if (!isCSV && !isPDF && !isExcel) {
      return res.status(400).json({
        error: 'File must be a CSV, PDF, or Excel file',
        userFriendly: true,
      });
    }

    // 3. Extract preview (first 5 lines)
    let preview = {
      filename: req.file.originalname,
      fileType: isCSV ? 'csv' : isPDF ? 'pdf' : 'excel',
      lines: [],
      detectedPeriod: null,
      errors: [],
    };

    // Detect period from filename
    preview.detectedPeriod = detectPeriodFromFilename(req.file.originalname);

    try {
      if (isCSV) {
        const { parse } = await import('csv-parse/sync');
        const records = parse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          cast: false,
        });
        preview.lines = records.slice(0, 5).map((r, i) => ({
          lineNumber: i + 2,
          data: r,
        }));
      } else if (isExcel) {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        if (worksheet) {
          for (let i = 1; i <= Math.min(6, worksheet.rowCount); i++) {
            const row = worksheet.getRow(i);
            const rowData = {};
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              rowData[colNumber] = cell.value;
            });
            preview.lines.push({
              lineNumber: i,
              data: rowData,
            });
          }
        }
      } else if (isPDF) {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(req.file.buffer);
        if (pdfData && pdfData.text) {
          const lines = pdfData.text.split('\n').slice(0, 10);
          preview.lines = lines.map((line, i) => ({
            lineNumber: i + 1,
            data: { text: line.trim() },
          }));
        }
      }
    } catch (parseError) {
      preview.errors.push(`Could not parse file: ${parseError.message}`);
    }

    // 4. Return preview
    res.json({
      success: true,
      preview: preview,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message,
      userFriendly: true,
    });
  }
});

// POST: SOA Ingest (Upload SOA file)
app.post('/api/soa/ingest', upload.single('file'), async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    if (!req.file) {
      return res.status(400).json({
        error: 'File is required',
      });
    }

    // Detect file type (CSV, PDF, or Excel)
    const isCSV =
      req.file.mimetype === 'text/csv' ||
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.originalname.toLowerCase().endsWith('.csv');

    const isPDF =
      req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');

    const isExcel =
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.originalname.toLowerCase().endsWith('.xlsx') ||
      req.file.originalname.toLowerCase().endsWith('.xls');

    if (!isCSV && !isPDF && !isExcel) {
      return res.status(400).json({
        error: 'File must be a CSV, PDF, or Excel file (.xlsx, .xls)',
        userFriendly: true,
        supportedFormats: ['CSV', 'PDF', 'Excel (.xlsx, .xls)'],
      });
    }

    // P0 Improvement: Auto-detect vendor_id from logged-in user
    const vendorId = req.user.vendorId;
    if (!vendorId && !req.user.isInternal) {
      return res.status(400).json({
        error:
          'You must be associated with a vendor to upload SOA statements. Please contact support if you believe this is an error.',
        userFriendly: true,
      });
    }

    // P0 Improvement: Auto-default tenant_id from logged-in user (always set from user)
    let tenantId = req.user.vendor?.tenant_id || null;

    // P0 Improvement: Get companies for vendor and auto-select if only one
    let finalCompanyId = req.body.company_id || req.user.companyId;
    if (!finalCompanyId && vendorId) {
      try {
        const vendorCompanies = await vmpAdapter.getVendorCompanies(vendorId);
        if (vendorCompanies.length === 0) {
          return res.status(400).json({
            error:
              'No companies are linked to your vendor account. Please contact support to link a company.',
            userFriendly: true,
          });
        } else if (vendorCompanies.length === 1) {
          // Auto-select if only one company
          finalCompanyId = vendorCompanies[0].id;
        } else {
          // Multiple companies - return list for user to select
          return res.status(400).json({
            error: 'Please select a company',
            userFriendly: true,
            requiresCompanySelection: true,
            companies: vendorCompanies.map(c => ({
              id: c.id,
              name: c.name,
              legal_name: c.legal_name,
            })),
          });
        }
      } catch (companyError) {
        logError(companyError, { operation: 'getVendorCompanies', vendorId });
        return res.status(500).json({
          error: 'Failed to retrieve company information. Please try again or contact support.',
          userFriendly: true,
        });
      }
    }

    // Validate company_id if provided
    if (finalCompanyId && !validateUUIDParam(finalCompanyId, res)) return;

    // P0 Improvement: If tenant_id not set from user, get it from company (fallback)
    if (!tenantId && finalCompanyId) {
      try {
        const { data: company, error: companyError } = await supabase
          .from('vmp_companies')
          .select('tenant_id')
          .eq('id', finalCompanyId)
          .single();

        if (!companyError && company?.tenant_id) {
          tenantId = company.tenant_id;
        }
      } catch (tenantError) {
        logError(tenantError, { operation: 'getCompanyTenantId', companyId: finalCompanyId });
        // Continue without tenant_id if we can't get it from company
      }
    }

    // P1 Improvement: Smart period detection from filename
    let periodStart = req.body.period_start;
    let periodEnd = req.body.period_end;

    if (!periodStart || !periodEnd) {
      // Try to detect from filename
      const detectedPeriod = detectPeriodFromFilename(req.file.originalname);
      if (detectedPeriod) {
        periodStart = periodStart || detectedPeriod.period_start;
        periodEnd = periodEnd || detectedPeriod.period_end;
      }
    }

    // Validate dates (required)
    if (!periodStart || !periodEnd) {
      const suggestions = getPeriodSuggestions();
      return res.status(400).json({
        error: 'Please specify the statement period (start and end dates)',
        userFriendly: true,
        requiresPeriodSelection: true,
        suggestions: suggestions,
      });
    }

    // Validate dates with user-friendly messages
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: `Date format is incorrect. Found start: "${periodStart}", end: "${periodEnd}". Please use format: YYYY-MM-DD (e.g., 2024-01-15)`,
        userFriendly: true,
        field: 'date',
        expectedFormat: 'YYYY-MM-DD',
      });
    }
    if (startDate > endDate) {
      return res.status(400).json({
        error: `The start date (${periodStart}) must be before the end date (${periodEnd}). Please check and correct the dates.`,
        userFriendly: true,
      });
    }

    // 3. Business logic - Ingest SOA from CSV, PDF, or Excel
    // tenantId is now auto-defaulted from user (or company fallback) above
    let result;

    if (isCSV) {
      result = await vmpAdapter.ingestSOAFromCSV(
        req.file.buffer,
        vendorId,
        finalCompanyId,
        periodStart,
        periodEnd,
        tenantId
      );
    } else if (isPDF) {
      result = await vmpAdapter.ingestSOAFromPDF(
        req.file.buffer,
        vendorId,
        finalCompanyId,
        periodStart,
        periodEnd,
        tenantId
      );
    } else if (isExcel) {
      result = await vmpAdapter.ingestSOAFromExcel(
        req.file.buffer,
        vendorId,
        finalCompanyId,
        periodStart,
        periodEnd,
        tenantId
      );
    } else {
      return res.status(400).json({
        error: 'Unsupported file type. Please use CSV, PDF, or Excel (.xlsx, .xls)',
        userFriendly: true,
        supportedFormats: ['CSV', 'PDF', 'Excel (.xlsx, .xls)'],
      });
    }

    // 4. Trigger automatic matching (per PRD: matching protocol runs after upload)
    try {
      const { batchMatchSOALines } = await import('./src/utils/soa-matching-engine.js');
      const matchResults = await batchMatchSOALines(
        result.soaLines || [],
        vendorId,
        finalCompanyId
      );

      // Create matches for successful matches
      let matchesCreated = 0;
      for (const matchResult of matchResults) {
        if (matchResult.match && matchResult.soaLine) {
          try {
            const matchData = {
              matchType: matchResult.match.matchType,
              isExactMatch: matchResult.match.isExactMatch,
              confidence: matchResult.match.confidence,
              matchScore: matchResult.match.matchScore,
              matchCriteria: matchResult.match.matchCriteria,
              soaAmount: matchResult.soaLine.amount,
              invoiceAmount: matchResult.match.invoice.total_amount,
              soaDate: matchResult.soaLine.invoice_date,
              invoiceDate: matchResult.match.invoice.invoice_date,
              matchedBy: 'system',
              metadata: { pass: matchResult.pass },
            };

            await vmpAdapter.createSOAMatch(
              matchResult.soaLineId,
              matchResult.match.invoice.id,
              matchData
            );
            matchesCreated++;
          } catch (matchError) {
            logError(matchError, {
              operation: 'autoMatchSOA',
              soaLineId: matchResult.soaLineId,
            });
          }
        }
      }

      // Update case status based on matching results
      const summary = await vmpAdapter.getSOASummary(result.caseId, vendorId);
      let caseStatus = 'open';
      if (summary.net_variance === 0 && summary.unmatched_lines === 0) {
        caseStatus = 'resolved'; // CLEAN per PRD
      } else if (summary.unmatched_lines > 0 || summary.discrepancy_lines > 0) {
        caseStatus = 'open'; // ACTION_REQUIRED per PRD
      }

      await supabase.from('vmp_cases').update({ status: caseStatus }).eq('id', result.caseId);

      // 5. Return response
      res.json({
        success: true,
        case_id: result.caseId,
        statement_id: result.caseId,
        total_lines: result.total,
        inserted_lines: result.inserted,
        matched_lines: matchesCreated,
        unmatched_lines: result.inserted - matchesCreated,
        errors: result.errors,
        extraction_method: result.extractionMethod || (isCSV ? 'csv' : isPDF ? 'pdf' : 'excel'),
        confidence: result.confidence || (isCSV ? 1.0 : isPDF ? 0.85 : 0.9),
        message: `SOA ingested from ${isCSV ? 'CSV' : isPDF ? 'PDF' : 'Excel'}: ${result.inserted} lines, ${matchesCreated} auto-matched`,
      });
    } catch (matchError) {
      // Log matching error but don't fail the ingestion
      logError(matchError, {
        operation: 'autoMatchAfterIngest',
        caseId: result.caseId,
      });

      res.json({
        success: true,
        case_id: result.caseId,
        statement_id: result.caseId,
        total_lines: result.total,
        inserted_lines: result.inserted,
        matched_lines: 0,
        unmatched_lines: result.inserted,
        errors: result.errors,
        extraction_method: result.extractionMethod || (isCSV ? 'csv' : isPDF ? 'pdf' : 'excel'),
        confidence: result.confidence || (isCSV ? 1.0 : isPDF ? 0.85 : 0.9),
        warning: 'SOA ingested but automatic matching failed. Please run manual matching.',
        message: `SOA ingested from ${isCSV ? 'CSV' : isPDF ? 'PDF' : 'Excel'}: ${result.inserted} lines (matching will be done manually)`,
      });
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });

    // P0 Improvement: User-friendly error messages
    const userFriendlyError = formatUserFriendlyError(error.message, {
      row: error.row,
      field: error.field,
      value: error.value,
      expectedFormat: error.expectedFormat,
    });

    res.status(500).json({
      error:
        userFriendlyError ||
        'Failed to process SOA file. Please check the file format and try again.',
      message: error.message, // Keep technical message for debugging
      userFriendly: true,
    });
  }
});

// POST: SOA Recompute
app.post('/api/soa/:statementId/recompute', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const statementId = getStringParam(req.params.statementId);
    if (!statementId || !isValidUUID(statementId)) {
      return res.status(400).json({
        error: 'Invalid statement ID',
      });
    }

    // 3. Business logic - Run matching and update summary
    const soaLines = await vmpAdapter.getSOALines(statementId, req.user.vendorId);
    const { batchMatchSOALines } = await import('../utils/soa-matching-engine.js');

    const matchResults = await batchMatchSOALines(
      soaLines.filter(l => l.status === 'extracted'),
      req.user.vendorId,
      req.user.companyId || null
    );

    // Create matches for successful matches
    for (const result of matchResults) {
      if (result.match && result.soaLine) {
        const matchData = {
          matchType: result.match.matchType,
          isExactMatch: result.match.isExactMatch,
          confidence: result.match.confidence,
          matchScore: result.match.matchScore,
          matchCriteria: result.match.matchCriteria,
          soaAmount: result.soaLine.amount,
          invoiceAmount: result.match.invoice.total_amount,
          soaDate: result.soaLine.invoice_date,
          invoiceDate: result.match.invoice.invoice_date,
          matchedBy: 'system',
          metadata: { pass: result.pass },
        };

        await vmpAdapter.createSOAMatch(result.soaLineId, result.match.invoice.id, matchData);
      }
    }

    const summary = await vmpAdapter.getSOASummary(statementId, req.user.vendorId);

    // 4. Render response (HTMX toast)
    res.render('partials/toast_message.html', {
      message: `Recomputed: ${matchResults.filter(r => r.match).length} matches created`,
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to recompute: ' + error.message,
      type: 'error',
    });
  }
});

// POST: SOA Sign-off (API endpoint)
app.post('/api/soa/:statementId/signoff', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const statementId = getStringParam(req.params.statementId);
    if (!statementId || !isValidUUID(statementId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid statement ID',
        type: 'error',
      });
    }

    // 3. Check sign-off readiness
    const summary = await vmpAdapter.getSOASummary(statementId, req.user.vendorId);
    if (summary.net_variance != 0 || summary.unmatched_lines > 0) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Cannot sign off: variances must be resolved',
        type: 'error',
      });
    }

    // 4. Business logic
    const acknowledgement = await vmpAdapter.signOffSOA(
      statementId,
      req.user.vendorId,
      req.user.id,
      { type: 'full', notes: 'Digital sign-off' }
    );

    // 5. Render response (HTMX toast)
    res.render('partials/toast_message.html', {
      message: 'SOA reconciliation signed off successfully',
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to sign off: ' + error.message,
      type: 'error',
    });
  }
});

// GET: SOA Export
app.get('/api/soa/:statementId/export', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const statementId = getStringParam(req.params.statementId);
    if (!statementId || !isValidUUID(statementId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid statement ID',
        type: 'error',
      });
    }

    // 3. Business logic - Generate export pack
    const soaLines = await vmpAdapter.getSOALines(statementId, req.user.vendorId);
    const summary = await vmpAdapter.getSOASummary(statementId, req.user.vendorId);
    const issues = await vmpAdapter.getSOAIssues(statementId);

    // TODO: Generate CSV/PDF export
    // For now, return JSON
    res.json({
      success: true,
      statement_id: statementId,
      summary: summary,
      lines: soaLines,
      issues: issues,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to export: ' + error.message,
      type: 'error',
    });
  }
});

// GET: SOA Lines (with filters)
app.get('/soa/:statementId/lines', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const statementId = getStringParam(req.params.statementId);
    if (!statementId || !isValidUUID(statementId)) {
      return res.status(400).render('partials/error_message.html', {
        error: { message: 'Invalid statement ID' },
      });
    }

    // 3. Business logic
    const { q, status } = req.query;
    let soaLines = await vmpAdapter.getSOALines(statementId, req.user.vendorId, status || null);

    // Filter by search query
    if (q) {
      const query = q.toLowerCase();
      soaLines = soaLines.filter(
        line =>
          (line.invoice_number && line.invoice_number.toLowerCase().includes(query)) ||
          (line.description && line.description.toLowerCase().includes(query))
      );
    }

    // 4. Render response
    res.render('partials/soa_lines_list.html', {
      soaLines: soaLines || [],
      caseId: statementId,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/soa_lines_list.html', {
      soaLines: [],
      caseId: req.params.statementId,
    });
  }
});

// GET: SOA Line Focus (detail view)
app.get('/soa/:statementId/lines/:lineId/focus', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const statementId = getStringParam(req.params.statementId);
    const lineId = getStringParam(req.params.lineId);
    if (!statementId || !isValidUUID(statementId) || !lineId || !isValidUUID(lineId)) {
      return res.status(400).render('partials/error_message.html', {
        error: { message: 'Invalid statement or line ID' },
      });
    }

    // 3. Business logic
    const soaLines = await vmpAdapter.getSOALines(statementId, req.user.vendorId);
    const line = soaLines.find(l => l.id === lineId);

    if (!line) {
      return res.status(404).render('partials/error_message.html', {
        error: { message: 'SOA line not found' },
      });
    }

    // Get suggested matches (invoices that could match)
    const invoices = await vmpAdapter.getInvoices(req.user.vendorId, req.user.companyId || null, {
      status: ['pending', 'approved', 'paid'],
    });

    // Simple matching suggestions (can be enhanced with matching engine)
    const suggestions = invoices
      .filter(inv => {
        const soaDoc = (line.invoice_number || '').toLowerCase().replace(/[\s\-_.,]/g, '');
        const invDoc = (inv.invoice_number || '').toLowerCase().replace(/[\s\-_.,]/g, '');
        return (
          soaDoc &&
          invDoc &&
          (soaDoc === invDoc || soaDoc.includes(invDoc) || invDoc.includes(soaDoc))
        );
      })
      .slice(0, 5)
      .map(inv => ({
        id: inv.id,
        doc_no: inv.invoice_number,
        doc_type: 'INV',
        posting_date: inv.invoice_date,
        amount_open: inv.total_amount,
        confidence: 0.85,
        match_type: 'PROBABILISTIC',
      }));

    // Get evidence for this line (from case evidence)
    const evidence = []; // TODO: Get evidence linked to this SOA line

    // 4. Render response
    res.render('partials/soa_line_focus.html', {
      line: line,
      suggestions: suggestions,
      evidence: evidence,
      statement: { id: statementId, vendor_id: req.user.vendorId },
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/soa_line_focus.html', {
      line: null,
      suggestions: [],
      evidence: [],
    });
  }
});

// POST: SOA Line Match
app.post('/api/soa/lines/:lineId/match', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const lineId = getStringParam(req.params.lineId);
    if (!lineId || !isValidUUID(lineId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid line ID',
        type: 'error',
      });
    }

    const { ledger_line_id, matched_amount, match_type } = req.body;
    if (!ledger_line_id) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'ledger_line_id is required',
        type: 'error',
      });
    }

    // 3. Business logic
    // Get SOA line
    const soaLines = await vmpAdapter.getSOALines(req.body.case_id || '', req.user.vendorId);
    const soaLine = soaLines.find(l => l.id === lineId);
    if (!soaLine) {
      return res.status(404).render('partials/toast_message.html', {
        message: 'SOA line not found',
        type: 'error',
      });
    }

    // Get invoice
    const invoice = await vmpAdapter.getInvoiceDetail(ledger_line_id, req.user.vendorId);
    if (!invoice) {
      return res.status(404).render('partials/toast_message.html', {
        message: 'Invoice not found',
        type: 'error',
      });
    }

    // Create match
    const matchData = {
      matchType: match_type === 'EXACT' ? 'deterministic' : 'probabilistic',
      isExactMatch: match_type === 'EXACT',
      confidence: match_type === 'EXACT' ? 1.0 : 0.85,
      matchScore: match_type === 'EXACT' ? 100 : 85,
      matchCriteria: {
        invoice_number: true,
        amount: true,
        currency: true,
      },
      soaAmount: parseFloat(matched_amount || soaLine.amount),
      invoiceAmount: parseFloat(invoice.total_amount),
      soaDate: soaLine.invoice_date,
      invoiceDate: invoice.invoice_date,
      matchedBy: 'manual',
    };

    const match = await vmpAdapter.createSOAMatch(lineId, ledger_line_id, matchData);
    const summary = await vmpAdapter.getSOASummary(soaLine.case_id, req.user.vendorId);

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: `Match created. Net variance: ${summary.net_variance.toFixed(2)}`,
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to create match: ' + error.message,
      type: 'error',
    });
  }
});

// POST: SOA Line Dispute
app.post('/api/soa/lines/:lineId/dispute', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const lineId = getStringParam(req.params.lineId);
    if (!lineId || !isValidUUID(lineId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid line ID',
        type: 'error',
      });
    }

    const { reason, amount_delta } = req.body;

    // 3. Business logic
    // Get SOA line to find case_id
    const soaLines = await vmpAdapter.getSOALines(req.body.case_id || '', req.user.vendorId);
    const soaLine = soaLines.find(l => l.id === lineId);
    if (!soaLine) {
      return res.status(404).render('partials/toast_message.html', {
        message: 'SOA line not found',
        type: 'error',
      });
    }

    // Create issue
    const issue = await vmpAdapter.createSOAIssue(soaLine.case_id, {
      soaItemId: lineId,
      issueType: 'amount_mismatch',
      severity: 'medium',
      description: reason || 'Line disputed',
      amountDelta: parseFloat(amount_delta || 0),
      detectedBy: 'manual',
      expectedValue: null,
      actualValue: null,
    });

    // Update line status
    await supabase.from('vmp_soa_items').update({ status: 'discrepancy' }).eq('id', lineId);

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: 'Line marked as disputed',
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to dispute line: ' + error.message,
      type: 'error',
    });
  }
});

// POST: SOA Line Resolve
app.post('/api/soa/lines/:lineId/resolve', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const lineId = getStringParam(req.params.lineId);
    if (!lineId || !isValidUUID(lineId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid line ID',
        type: 'error',
      });
    }

    const { resolution } = req.body;

    // 3. Business logic
    // Get SOA line to find case_id and issues
    const soaLines = await vmpAdapter.getSOALines(req.body.case_id || '', req.user.vendorId);
    const soaLine = soaLines.find(l => l.id === lineId);
    if (!soaLine) {
      return res.status(404).render('partials/toast_message.html', {
        message: 'SOA line not found',
        type: 'error',
      });
    }

    // Resolve all issues for this line
    const issues = await vmpAdapter.getSOAIssues(soaLine.case_id);
    const lineIssues = issues.filter(i => i.soa_item_id === lineId && i.status === 'open');

    for (const issue of lineIssues) {
      await vmpAdapter.resolveSOAIssue(issue.id, req.user.id, {
        action: 'corrected',
        notes: resolution || 'Line resolved',
      });
    }

    // Update line status
    await supabase.from('vmp_soa_items').update({ status: 'resolved' }).eq('id', lineId);

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: 'Line resolved',
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to resolve line: ' + error.message,
      type: 'error',
    });
  }
});

// POST: SOA Line Evidence Upload
app.post('/api/soa/lines/:lineId/evidence', upload.single('file'), async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const lineId = getStringParam(req.params.lineId);
    if (!lineId || !isValidUUID(lineId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid line ID',
        type: 'error',
      });
    }

    if (!req.file) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'File is required',
        type: 'error',
      });
    }

    // 3. Business logic
    // Get SOA line to find case_id
    const soaLines = await vmpAdapter.getSOALines(req.body.case_id || '', req.user.vendorId);
    const soaLine = soaLines.find(l => l.id === lineId);
    if (!soaLine) {
      return res.status(404).render('partials/toast_message.html', {
        message: 'SOA line not found',
        type: 'error',
      });
    }

    // Upload evidence to case
    const evidence = await vmpAdapter.uploadEvidence(
      soaLine.case_id,
      req.file,
      'soa_line_evidence',
      null, // checklistStepId
      'vendor', // uploaderType
      req.user.id // uploaderUserId
    );

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: 'Evidence uploaded successfully',
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to upload evidence: ' + error.message,
      type: 'error',
    });
  }
});

// ============================================================================
// DEBIT NOTE (DN) API ENDPOINTS
// ============================================================================

// POST: Propose Debit Note
app.post('/api/dn/propose', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    // 2. Input validation
    const { soa_statement_id, soa_issue_id, vendor_id, reason_code, amount, note } = req.body;
    if (!soa_statement_id || !vendor_id || !reason_code || !amount) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Missing required fields',
        type: 'error',
      });
    }

    // 3. Business logic
    const dn = await vmpAdapter.proposeDebitNote({
      soaStatementId: soa_statement_id,
      soaIssueId: soa_issue_id || null,
      vendorId: vendor_id,
      companyId: req.user.companyId || null,
      amount: parseFloat(amount),
      reasonCode: reason_code,
      notes: note || null,
      userId: req.user.id,
    });

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: `Debit Note ${dn.dn_no} created (DRAFT)`,
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to propose DN: ' + error.message,
      type: 'error',
    });
  }
});

// POST: Approve Debit Note
app.post('/api/dn/:dnId/approve', async (req, res) => {
  try {
    // 1. Authentication & Authorization (Finance role)
    if (!requireAuth(req, res)) return;
    if (!req.user.isInternal) {
      return res.status(403).render('partials/toast_message.html', {
        message: 'Only finance users can approve debit notes',
        type: 'error',
      });
    }

    // 2. Input validation
    const dnId = getStringParam(req.params.dnId);
    if (!dnId || !isValidUUID(dnId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid DN ID',
        type: 'error',
      });
    }

    // 3. Business logic
    const dn = await vmpAdapter.approveDebitNote(dnId, req.user.id);

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: `Debit Note ${dn.dn_no} approved`,
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to approve DN: ' + error.message,
      type: 'error',
    });
  }
});

// POST: Post Debit Note
app.post('/api/dn/:dnId/post', async (req, res) => {
  try {
    // 1. Authentication & Authorization (Finance role)
    if (!requireAuth(req, res)) return;
    if (!req.user.isInternal) {
      return res.status(403).render('partials/toast_message.html', {
        message: 'Only finance users can post debit notes',
        type: 'error',
      });
    }

    // 2. Input validation
    const dnId = getStringParam(req.params.dnId);
    if (!dnId || !isValidUUID(dnId)) {
      return res.status(400).render('partials/toast_message.html', {
        message: 'Invalid DN ID',
        type: 'error',
      });
    }

    // 3. Business logic
    const { ledger_entry_id } = req.body;
    const dn = await vmpAdapter.postDebitNote(dnId, req.user.id, ledger_entry_id || null);

    // Recompute SOA if linked
    if (dn.soa_statement_id) {
      // Trigger recompute (async)
      const summary = await vmpAdapter.getSOASummary(dn.soa_statement_id, req.user.vendorId);
    }

    // 4. Render response
    res.render('partials/toast_message.html', {
      message: `Debit Note ${dn.dn_no} posted to ledger`,
      type: 'success',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).render('partials/toast_message.html', {
      message: 'Failed to post DN: ' + error.message,
      type: 'error',
    });
  }
});

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
      isInternal: true,
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
      error: null,
    });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/invite_form.html', {
      orgTree: null,
    });
  }
});

// GET: Access Requests (Internal Only)
app.get('/ops/access-requests', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Get filter status from query
    const statusParam = getStringParam(req.query.status);
    const statusFilter =
      statusParam && ['pending', 'approved', 'rejected', 'invited'].includes(statusParam)
        ? statusParam
        : null;

    // 3. Business logic - Get access requests
    const requests = await vmpAdapter.getAccessRequests(statusFilter, 100);

    // 4. Render response
    res.render('pages/ops_access_requests.html', {
      title: 'Access Requests',
      requests,
      statusFilter,
      user: req.user,
      isInternal: true,
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// POST: Update Access Request Status (Internal Only)
app.post('/ops/access-requests/:id/status', async (req, res) => {
  try {
    // 1. Authentication & Authorization
    if (!requireInternal(req, res)) return;

    // 2. Input validation
    const requestId = req.params.id;
    const { status, review_notes, create_invite } = req.body;

    if (!validateUUIDParam(requestId, res, 'pages/ops_access_requests.html')) return;

    if (!status || !['approved', 'rejected', 'invited'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: approved, rejected, or invited',
      });
    }

    // 3. Business logic - Update status
    const updatedRequest = await vmpAdapter.updateAccessRequestStatus(
      requestId,
      status,
      req.user.id,
      review_notes?.trim() || null
    );

    // 4. If approved and create_invite is true, automatically create invite
    if (status === 'approved' && create_invite === 'true') {
      // Get tenant from user context
      const userContext = await vmpAdapter.getVendorContext(req.user.id);
      const tenantId = userContext.vmp_vendors?.tenant_id;

      if (tenantId) {
        try {
          // Create or get vendor
          let vendorId;
          const existingVendorQuery = supabase
            .from('vmp_vendors')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('name', updatedRequest.company.trim())
            .single();

          const { data: existingVendor } = await withTimeout(
            existingVendorQuery,
            5000,
            'checkExistingVendor'
          );

          if (existingVendor) {
            vendorId = existingVendor.id;
          } else {
            const newVendorQuery = supabase
              .from('vmp_vendors')
              .insert({
                tenant_id: tenantId,
                name: updatedRequest.company.trim(),
                status: 'invited',
              })
              .select('id')
              .single();

            const { data: newVendor, error: vendorError } = await withTimeout(
              newVendorQuery,
              5000,
              'createVendor'
            );
            if (vendorError || !newVendor) {
              throw new Error('Failed to create vendor');
            }
            vendorId = newVendor.id;
          }

          // Create invite
          const invite = await vmpAdapter.createInvite(
            vendorId,
            updatedRequest.email,
            [],
            req.user.id
          );

          // Update request status to 'invited'
          await vmpAdapter.updateAccessRequestStatus(
            requestId,
            'invited',
            req.user.id,
            `Invite created: ${invite.invite_url}`
          );

          // Send invite email
          try {
            const inviteUrl = `${req.protocol}://${req.get('host')}${invite.invite_url}`;
            const vendorName = updatedRequest.company.trim();
            const tenantName = userContext.vmp_vendors?.vmp_tenants?.name || 'Organization';
            await sendInviteEmail(updatedRequest.email, inviteUrl, vendorName, tenantName);
          } catch (emailError) {
            logError(emailError, { path: req.path, operation: 'sendInviteEmail' });
            // Don't fail - invite is created
          }

          return res.json({
            success: true,
            message: 'Access request approved and invite sent',
            invite_url: invite.invite_url,
          });
        } catch (inviteError) {
          logError(inviteError, { path: req.path, operation: 'auto-create-invite' });
          // Still return success for status update
        }
      }
    }

    // 5. Return success
    res.json({
      success: true,
      message: `Access request ${status}`,
      request: updatedRequest,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to update access request status',
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
        error: 'vendor_name is required',
      });
    }

    if (!validateRequired(email, 'email')) {
      return res.status(400).json({
        error: 'email is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // 3. Business logic - Get user context to determine tenant
    const userContext = await vmpAdapter.getVendorContext(req.user.id);
    if (!userContext.vmp_vendors?.tenant_id) {
      return res.status(400).json({
        error: 'User must be associated with a tenant',
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

      const { data: existingVendor } = await withTimeout(
        existingVendorQuery,
        5000,
        'checkExistingVendor'
      );

      if (existingVendor) {
        vendorId = existingVendor.id;
      } else {
        // Create new vendor
        const newVendorQuery = supabase
          .from('vmp_vendors')
          .insert({
            tenant_id: tenantId,
            name: vendor_name.trim(),
            status: 'invited',
          })
          .select('id')
          .single();

        const { data: newVendor, error: vendorError } = await withTimeout(
          newVendorQuery,
          5000,
          'createVendor'
        );
        if (vendorError || !newVendor) {
          throw new Error('Failed to create vendor');
        }
        vendorId = newVendor.id;
      }
    } catch (vendorError) {
      logError(vendorError, {
        path: req.path,
        userId: req.user?.id,
        operation: 'createOrGetVendor',
      });
      return res.status(500).json({
        error: 'Failed to create or find vendor',
      });
    }

    // Parse company_ids (can be array or comma-separated string)
    let companyIdsArray = [];
    if (company_ids) {
      if (Array.isArray(company_ids)) {
        companyIdsArray = company_ids;
      } else if (typeof company_ids === 'string') {
        companyIdsArray = company_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id);
      }
    }

    // Create invite
    const invite = await vmpAdapter.createInvite(vendorId, email, companyIdsArray, req.user.id);

    const inviteUrl = `${req.protocol}://${req.get('host')}${invite.invite_url}`;

    // Send invite email
    let emailSent = false;
    let emailError = null;
    try {
      const vendorName = vendor_name.trim();
      const tenantName = userContext.vmp_vendors?.vmp_tenants?.name || 'Organization';
      await sendInviteEmail(invite.email, inviteUrl, vendorName, tenantName);
      emailSent = true;
    } catch (emailErr) {
      logError(emailErr, { path: req.path, operation: 'sendInviteEmail', inviteId: invite.id });
      emailError = emailErr.message;
      // Don't fail invite creation if email fails - invite link is still valid
    }

    // 4. Return JSON response with invite link (for copy-paste)
    res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        expires_at: invite.expires_at,
        link: inviteUrl,
        invite_url: invite.invite_url, // Relative URL path
      },
      vendor: {
        id: vendorId,
        name: vendor_name.trim(),
      },
      companies: companyIdsArray.length > 0 ? companyIdsArray : null,
      email: {
        sent: emailSent,
        error: emailError || null,
      },
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to create invite',
    });
  }
});

// GET: Supabase Invite Handler (Public Route - No Auth Required)
// Handles Supabase Auth invite links with tokens in URL hash
// Hash fragments are client-side only, so we need a page that extracts them
//
// IMPORTANT: Supabase Dashboard must be configured with correct redirect URLs:
// - Site URL: http://localhost:9000 (or your BASE_URL)
// - Redirect URLs: http://localhost:9000/supabase-invite, http://localhost:9000/accept
// See: docs/development/SUPABASE_MPC_INVITATION_FIX.md
app.get('/supabase-invite', async (req, res) => {
  // This page will use client-side JavaScript to extract tokens from hash
  // and redirect to /accept with tokens in query params
  res.render('pages/supabase_invite_handler.html', {
    supabase_url: env.SUPABASE_URL,
    supabase_anon_key: env.SUPABASE_ANON_KEY,
  });
});

// GET: Accept Invite Page (Public Route - No Auth Required)
// Handles both custom invites (token query param) and Supabase Auth invites (access_token in query)
app.get('/accept', async (req, res) => {
  try {
    // Check if this is a Supabase Auth invite (has access_token in query or hash)
    const { access_token, refresh_token, type } = req.query;

    // If Supabase invite link (type=invite with access_token)
    if (type === 'invite' && access_token) {
      try {
        // Get user info from Supabase Auth using access_token
        const accessTokenStr = getStringParam(access_token);
        const {
          data: { user },
          error: userError,
        } = await supabaseAuth.auth.getUser(accessTokenStr);

        if (userError || !user) {
          logError(userError || new Error('No user returned'), {
            path: req.path,
            operation: 'supabase-invite-get-user',
          });
          return res.render('pages/accept.html', {
            error: 'Invalid or expired invite link. Please request a new invite.',
            invite: null,
            companies: [],
            token: null,
            vendorName: null,
            tenantName: null,
            supabaseInvite: false,
          });
        }

        // Validate user.id is a valid UUID
        if (!user.id || typeof user.id !== 'string') {
          logError(new Error('Invalid user.id from Supabase Auth'), {
            userId: user.id,
            path: req.path,
            userEmail: user.email,
          });
          return res.render('pages/accept.html', {
            error: 'Invalid user data. Please contact support.',
            invite: null,
            companies: [],
            token: null,
            vendorName: null,
            tenantName: null,
            supabaseInvite: false,
          });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(user.id)) {
          logError(new Error('user.id is not a valid UUID format'), {
            userId: user.id,
            path: req.path,
            userEmail: user.email,
          });
          return res.render('pages/accept.html', {
            error: 'Invalid user data. Please contact support.',
            invite: null,
            companies: [],
            token: null,
            vendorName: null,
            tenantName: null,
            supabaseInvite: false,
          });
        }

        // Check if user already exists in our system
        const existingUser = await vmpAdapter.getUserByEmail(user.email);

        if (existingUser) {
          // User already exists - log them in
          req.session.userId = existingUser.id;
          req.session.authToken = getStringParam(access_token);
          const refreshTokenStr = getStringParam(refresh_token);
          if (refreshTokenStr) {
            req.session.refreshToken = refreshTokenStr;
          }
          req.session.save(err => {
            if (err) {
              logError(err, { path: req.path, operation: 'createSession' });
            }
            return res.redirect('/home');
          });
          return;
        }

        // New user - render sign-up form with Supabase invite info
        // Note: We need to find which vendor/tenant this invite is for
        // This requires matching the email to an invite in vmp_invites
        const invite = await vmpAdapter.getInviteByEmail(user.email);

        if (!invite) {
          return res.render('pages/accept.html', {
            error: 'No invite found for this email. Please contact your administrator.',
            invite: null,
            companies: [],
            token: null,
            vendorName: null,
            tenantName: null,
            supabaseInvite: true,
            supabaseUser: {
              email: user.email,
              access_token: getStringParam(access_token),
              refresh_token: getStringParam(refresh_token),
            },
          });
        }

        // Extract companies and vendor info
        const companies =
          invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
        const vendorName = invite.vmp_vendors?.name || 'Vendor';
        const tenantName = invite.vmp_vendors?.vmp_tenants?.name || 'Organization';

        return res.render('pages/accept.html', {
          error: null,
          invite: {
            id: invite.id,
            email: invite.email,
            vendor: invite.vmp_vendors,
            companies: companies,
          },
          token: null, // No custom token for Supabase invites
          vendorName: vendorName,
          tenantName: tenantName,
          supabaseInvite: true,
          supabaseUser: {
            email: user.email,
            access_token: access_token,
            refresh_token: refresh_token,
          },
        });
      } catch (error) {
        logError(error, { path: req.path, operation: 'supabase-invite-handler' });
        return res.render('pages/accept.html', {
          error: 'An error occurred while processing the invite. Please try again.',
          invite: null,
          companies: [],
          token: null,
          vendorName: null,
          tenantName: null,
          supabaseInvite: false,
        });
      }
    }

    // Custom invite flow (existing implementation)
    // 1. Input validation - token is required for this route
    const { token } = req.query;
    const defaultData = {
      error: null,
      invite: null,
      companies: [],
      token: null,
      vendorName: null,
      tenantName: null,
      supabaseInvite: false,
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
        error: 'Invalid or expired invite token',
      });
    }

    if (invite.expired) {
      return res.render('pages/accept.html', {
        ...defaultData,
        error: 'This invite has expired. Please request a new invite.',
      });
    }

    if (invite.used) {
      return res.render('pages/accept.html', {
        ...defaultData,
        error: 'This invite has already been used.',
      });
    }

    // Extract companies from vendor-company links
    const companies =
      invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];

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
        companies: companies,
      },
      token: token,
      vendorName: vendorName,
      tenantName: tenantName,
    });
  } catch (error) {
    logError(error, { path: req.path });
    res.status(500).render('pages/accept.html', {
      error: error.message || 'Failed to load invite',
      invite: null,
      companies: [],
      token: req.query.token || null,
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
      tenantName: null,
    };

    // Handle Supabase Auth invite (user already has access_token from Supabase)
    const supabaseAccessToken = getStringParam(req.body.supabase_access_token);
    const supabaseRefreshToken = getStringParam(req.body.supabase_refresh_token);

    if (supabaseAccessToken) {
      try {
        // Get user info from Supabase
        const {
          data: { user },
          error: userError,
        } = await supabaseAuth.auth.getUser(supabaseAccessToken);

        if (userError || !user) {
          logError(userError || new Error('No user returned'), {
            path: req.path,
            operation: 'supabase-invite-post',
          });
          return res.status(400).render('pages/accept.html', {
            ...defaultData,
            error: 'Invalid or expired invite link. Please request a new invite.',
          });
        }

        // Validate user.id is a valid UUID
        if (!user.id || typeof user.id !== 'string') {
          logError(new Error('Invalid user.id from Supabase Auth'), {
            userId: user.id,
            path: req.path,
            userEmail: user.email,
          });
          return res.status(400).render('pages/accept.html', {
            ...defaultData,
            error: 'Invalid user data. Please contact support.',
          });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(user.id)) {
          logError(new Error('user.id is not a valid UUID format'), {
            userId: user.id,
            path: req.path,
            userEmail: user.email,
          });
          return res.status(400).render('pages/accept.html', {
            ...defaultData,
            error: 'Invalid user data. Please contact support.',
          });
        }

        // Find invite by email
        const invite = await vmpAdapter.getInviteByEmail(user.email);

        if (!invite) {
          return res.status(400).render('pages/accept.html', {
            ...defaultData,
            error: 'No invite found for this email. Please contact your administrator.',
          });
        }

        // Validate password if provided
        if (password) {
          if (password.length < 8) {
            const companies =
              invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
            return res.status(400).render('pages/accept.html', {
              error: 'Password must be at least 8 characters long',
              invite: { id: invite.id, email: invite.email, vendor: invite.vmp_vendors, companies },
              token: null,
              vendorName: invite.vmp_vendors?.name || 'Vendor',
              tenantName: invite.vmp_vendors?.vmp_tenants?.name || 'Organization',
              supabaseInvite: true,
              supabaseUser: {
                email: user.email,
                access_token: supabaseAccessToken,
                refresh_token: supabaseRefreshToken,
              },
            });
          }

          if (password !== password_confirm) {
            const companies =
              invite.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
            return res.status(400).render('pages/accept.html', {
              error: 'Passwords do not match',
              invite: { id: invite.id, email: invite.email, vendor: invite.vmp_vendors, companies },
              token: null,
              vendorName: invite.vmp_vendors?.name || 'Vendor',
              tenantName: invite.vmp_vendors?.vmp_tenants?.name || 'Organization',
              supabaseInvite: true,
              supabaseUser: {
                email: user.email,
                access_token: supabaseAccessToken,
                refresh_token: supabaseRefreshToken,
              },
            });
          }

          // Update password in Supabase Auth
          const { error: updateError } = await supabaseAuth.auth.updateUser({
            password: password,
          });

          if (updateError) {
            logError(updateError, { path: req.path, operation: 'supabase-update-password' });
            return res.status(400).render('pages/accept.html', {
              ...defaultData,
              error: 'Failed to set password. Please try again.',
            });
          }
        }

        // Create user in our system (link Supabase Auth user to vendor user)
        const vendorUser = await vmpAdapter.createVendorUserFromSupabase(
          invite.vendor_id,
          user.id, // Supabase Auth user ID
          user.email,
          display_name || user.user_metadata?.display_name || null
        );

        // Mark invite as used
        await vmpAdapter.markInviteAsUsed(invite.id, vendorUser.id);

        // Create onboarding case
        const companyId = invite.vmp_vendor_company_links?.[0]?.company_id || null;
        const onboardingCase = await vmpAdapter.createOnboardingCase(invite.vendor_id, companyId);

        // Create session
        req.session.userId = vendorUser.id;
        req.session.authToken = supabaseAccessToken;
        if (supabaseRefreshToken) {
          req.session.refreshToken = supabaseRefreshToken;
        }
        req.session.save(err => {
          if (err) {
            logError(err, { path: req.path, operation: 'createSession' });
            return res.status(500).render('pages/error.html', {
              error: { status: 500, message: 'Failed to create session' },
            });
          }
          res.redirect(`/cases/${onboardingCase.id}`);
        });
        return;
      } catch (error) {
        logError(error, { path: req.path, operation: 'supabase-invite-accept' });
        return res.status(500).render('pages/accept.html', {
          ...defaultData,
          error: 'An error occurred while accepting the invite. Please try again.',
        });
      }
    }

    // Custom invite flow (existing implementation)
    // Use validateRequired helper for standardization
    if (!validateRequired(token, 'token')) {
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Invite token is required',
      });
    }

    if (!validateRequired(password, 'password')) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies =
        invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Password is required',
        invite: invite,
        token: token,
        companies: companies,
      });
    }

    if (password.length < 8) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies =
        invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Password must be at least 8 characters long',
        invite: invite,
        token: token,
        companies: companies,
      });
    }

    if (password !== password_confirm) {
      const invite = await vmpAdapter.getInviteByToken(token).catch(() => null);
      const companies =
        invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [];
      return res.status(400).render('pages/accept.html', {
        ...defaultData,
        error: 'Passwords do not match',
        invite: invite,
        token: token,
        companies: companies,
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
    const onboardingCase = await vmpAdapter.createOnboardingCase(invite.vendor_id, companyId);

    // 4. Create session and log user in (express-session stores userId in session)
    req.session.userId = user.id;
    req.session.save(err => {
      if (err) {
        logError(err, { path: req.path, operation: 'createSession' });
        return res.status(500).render('pages/error.html', {
          error: { status: 500, message: 'Failed to create session' },
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
      companies:
        invite?.vmp_vendor_company_links?.map(link => link.vmp_companies).filter(c => c) || [],
      token: req.body.token || null,
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
        user: req.user,
      });
    } catch (refreshError) {
      logError(refreshError, {
        path: req.path,
        userId: req.user?.id,
        operation: 'refreshCaseDetailAfterApproval',
      });
      // Return JSON fallback if refresh fails
      res.json({
        success: true,
        message: 'Onboarding approved successfully. Vendor account activated.',
        caseId: updatedCase.id,
      });
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({
      error: error.message || 'Failed to approve onboarding',
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

  // Check for password reset success message
  const passwordReset = req.query.password_reset === 'success' ? 'success' : null;

  res.render('pages/login.html', {
    error: null,
    password_reset: passwordReset,
  });
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

// 3a. Login POST Handler (Supabase Auth)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('pages/login.html', {
        error: 'Email and password are required',
        password_reset: null,
      });
    }

    // Use Supabase Auth for authentication
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password,
    });

    if (authError || !authData.user) {
      // Provide more specific error messages
      let errorMessage = 'Invalid email or password';
      if (authError) {
        if (
          authError.message?.includes('Invalid login credentials') ||
          authError.message?.includes('Email not confirmed')
        ) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (authError.message?.includes('Email rate limit')) {
          errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
        } else if (authError.message?.includes('User not found')) {
          errorMessage = 'No account found with this email address.';
        } else {
          // Log unexpected errors for debugging
          logError(authError, {
            path: req.path,
            operation: 'login',
            email: email.toLowerCase().trim(),
          });
        }
      }

      return res.render('pages/login.html', {
        error: errorMessage,
        password_reset: null,
      });
    }

    // Check if user is active (stored in user_metadata)
    const isActive = authData.user.user_metadata?.is_active !== false;
    if (!isActive) {
      return res.render('pages/login.html', {
        error: 'Account is inactive. Please contact support.',
        password_reset: null,
      });
    }

    // Store auth session token in express-session
    req.session.userId = authData.user.id;
    req.session.authToken = authData.session.access_token;
    req.session.refreshToken = authData.session.refresh_token;

    req.session.save(err => {
      if (err) {
        logError(err, { path: req.path, operation: 'createSession' });
        return res.status(500).render('pages/error.html', {
          error: { status: 500, message: 'Failed to create session' },
        });
      }
      // Redirect to home
      res.redirect('/home');
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'login' });
    res.render('pages/login.html', {
      error: 'An error occurred during login. Please try again.',
      password_reset: null,
    });
  }
});

// 3b. Login Route Consistency
// Production: /login → login3.html (LOCKED)
// Legacy redirects: /login2, /login4 → /login (backward compatibility)

// 3c. Logout Handler
app.post('/logout', async (req, res) => {
  // Destroy session (express-session handles cleanup in PostgreSQL)
  req.session.destroy(err => {
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
    multiple: false,
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
    const query = getStringParam(req.query.q) || '';
    if (!query || query.length < 2) {
      // Return suggestions for empty/short queries
      const suggestions = await generateSearchSuggestions(query, [], {
        vendorId: req.user.vendorId,
        isInternal: req.user.isInternal,
      });
      return res.json({
        results: [],
        suggestions,
        intent: { type: 'general', confidence: 0 },
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
      const allCases = await vmpAdapter.getInbox(vendorId);
      let filteredCases = allCases.filter(caseItem => {
        const subject = (caseItem.subject || '').toLowerCase();
        const caseNum = (caseItem.case_num || '').toLowerCase();
        const id = (caseItem.id || '').toLowerCase();
        return (
          subject.includes(searchTerm) || caseNum.includes(searchTerm) || id.includes(searchTerm)
        );
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
          timestamp: caseItem.created_at,
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
        filteredInvoices = filteredInvoices.filter(
          i => Math.abs(i.amount - intent.filters.amount) < 100
        );
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
          timestamp: invoice.created_at,
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
        filteredPayments = filteredPayments.filter(
          p => Math.abs(p.amount - intent.filters.amount) < 100
        );
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
        filteredPayments = filteredPayments.filter(
          p => new Date(p.payment_date || p.created_at) >= rangeStart
        );
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
          timestamp: payment.payment_date || payment.created_at,
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
        shortcut: '⌘N',
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
        icon: '📋',
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
        icon: '💰',
      });
    }

    // 8. Enhance results with AI (Sprint 13.3)
    const { enhanceSearchResults } = await import('./src/utils/ai-search.js');
    const enhancedResults = await enhanceSearchResults(results, intent, {
      vendorId: req.user.vendorId,
      isInternal: req.user.isInternal,
    });

    // Generate suggestions
    const suggestions = await generateSearchSuggestions(query, [], {
      vendorId: req.user.vendorId,
      isInternal: req.user.isInternal,
    });

    // 9. Return enhanced results
    return res.json({
      results: enhancedResults,
      intent,
      suggestions,
      totalResults: enhancedResults.length,
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
        message: 'Please select at least one item to perform the action',
      });
    }

    // Validate UUIDs
    for (const id of ids) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(id)) {
        return res.status(400).json({
          error: 'Invalid ID format',
          message: `Invalid ID: ${id}`,
        });
      }
    }

    const validListTypes = ['cases', 'invoices', 'payments'];
    const validActions = ['approve', 'reject', 'export', 'close'];

    if (!validListTypes.includes(listType)) {
      return res.status(400).json({
        error: 'Invalid list type',
        message: `List type must be one of: ${validListTypes.join(', ')}`,
      });
    }

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        message: `Action must be one of: ${validActions.join(', ')}`,
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
        message: actionError.message,
      });
    }

    // 4. Return success response
    return res.status(200).json({
      success: true,
      action,
      listType,
      processed: results.length,
      results,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'bulkAction' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
        results.push({
          id: invoiceId,
          success: false,
          error: 'Invoice not found or access denied',
        });
        continue;
      }

      switch (action) {
        case 'approve':
        case 'reject':
        case 'close':
          // These actions don't apply to invoices directly
          results.push({
            id: invoiceId,
            success: false,
            error: 'Action not applicable to invoices',
          });
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
        results.push({
          id: paymentId,
          success: false,
          error: 'Payment not found or access denied',
        });
        continue;
      }

      switch (action) {
        case 'approve':
        case 'reject':
        case 'close':
          // These actions don't apply to payments directly
          results.push({
            id: paymentId,
            success: false,
            error: 'Action not applicable to payments',
          });
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
        message: 'Subscription object with endpoint is required',
      });
    }

    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({
        error: 'Invalid subscription',
        message: 'Subscription must include p256dh and auth keys',
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
        message: 'Could not save push subscription to database',
      });
    }

    // 4. Return success
    return res.json({
      success: true,
      message: 'Push subscription registered',
      subscription: {
        id: storedSubscription.id,
        endpoint: storedSubscription.endpoint,
      },
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'pushSubscribe', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
        message: 'Subscription endpoint is required',
      });
    }

    // 3. Remove subscription from database
    const removed = await vmpAdapter.removePushSubscription(req.user.id, endpoint);

    if (!removed) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'No active subscription found for this endpoint',
      });
    }

    // 4. Return success
    return res.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'pushUnsubscribe', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
        error: 'Vendor ID not available',
      });
    }

    // Get case data
    const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
    if (!caseDetail) {
      return res.status(404).json({
        error: 'Case not found',
      });
    }

    // Verify access: return 404 to prevent enumeration when vendor mismatch
    if (caseDetail.vendor_id !== vendorId && !req.user?.isInternal) {
      return res.status(404).json({
        error: 'Case not found',
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'validateCase', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
        error: 'Vendor ID not available',
      });
    }

    // Get case data
    const caseDetail = await vmpAdapter.getCaseDetail(caseId, vendorId);
    if (!caseDetail) {
      return res.status(404).json({
        error: 'Case not found',
      });
    }

    // Verify access (internal only for auto-respond)
    if (!req.user?.isInternal) {
      return res.status(403).json({
        error: 'Access denied - internal users only',
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
      validation: validationResult,
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'autoRespond', userId: req.user?.id });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// ============================================================================
// DEMO MODE API ROUTES (Flight Simulator)
// ============================================================================

// GET /api/demo/status - Check if user has demo data
app.get('/api/demo/status', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.json({ hasDemoData: false });
    }

    // 2. Check if this vendor has any demo-tagged cases using Supabase client
    const { data, error } = await supabase
      .from('vmp_cases')
      .select('id')
      .eq('vendor_id', vendorId)
      .contains('tags', ['demo_data'])
      .limit(1);

    if (error) {
      logError(error, { path: req.path, userId: req.user?.id });
      return res.status(500).json({ error: 'Failed to check demo status' });
    }

    // 3. Return result
    res.json({
      hasDemoData: data && data.length > 0,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to check demo status' });
  }
});

// POST /api/demo/seed - Generate user-specific demo data
app.post('/api/demo/seed', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    const vendorId = req.user.vendorId;
    const tenantId = req.user.vendor?.tenant_id;

    if (!vendorId || !tenantId) {
      return res.status(400).json({ error: 'Vendor ID and Tenant ID required' });
    }

    // 2. Generate dynamic UUIDs for this user's demo data
    const demoCaseId = randomUUID();
    const demoInvoiceId = randomUUID();
    const demoMessageId = randomUUID();
    const bankChangeCaseId = randomUUID();

    // 3. Get user's first company using Supabase client
    const { data: company, error: companyError } = await supabase
      .from('vmp_companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    if (companyError || !company) {
      return res.status(400).json({ error: 'No company found for tenant' });
    }

    const companyId = company.id;

    // 4. Create demo data (sequential operations with error handling)
    try {
      // 4.1 Create Emergency Override test case
      const { error: caseError } = await supabase.from('vmp_cases').insert({
        id: demoCaseId,
        tenant_id: tenantId,
        company_id: companyId,
        vendor_id: vendorId,
        case_type: 'invoice',
        status: 'blocked',
        subject: 'SIMULATION: URGENT - Stopped Shipment',
        owner_team: 'ap',
        sla_due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        escalation_level: 3,
        tags: ['demo_data'],
      });

      if (caseError) throw caseError;

      // 4.2 Create linked invoice
      const { error: invoiceError } = await supabase.from('vmp_invoices').insert({
        id: demoInvoiceId,
        vendor_id: vendorId,
        company_id: companyId,
        invoice_num: 'SIM-INV-999',
        invoice_date: new Date().toISOString().split('T')[0],
        amount: 5000.0,
        currency_code: 'USD',
        status: 'disputed',
        source_system: 'simulation',
        description: 'Demo invoice for Emergency Override testing',
      });

      if (invoiceError) throw invoiceError;

      // 4.3 Link case to invoice
      const { error: linkError } = await supabase
        .from('vmp_cases')
        .update({ linked_invoice_id: demoInvoiceId })
        .eq('id', demoCaseId);

      if (linkError) throw linkError;

      // 4.4 Create welcome message using adapter method
      await vmpAdapter.createMessage(
        demoCaseId,
        'Welcome to Simulation Mode! This case is for testing Emergency Override functionality.',
        'ai',
        'portal',
        null,
        false,
        { demo_mode: true }
      );

      // 4.5 Create Bank Change test case
      const { error: bankCaseError } = await supabase.from('vmp_cases').insert({
        id: bankChangeCaseId,
        tenant_id: tenantId,
        company_id: companyId,
        vendor_id: vendorId,
        case_type: 'general',
        status: 'waiting_internal',
        subject: 'SIMULATION: Request to Update Bank Details',
        owner_team: 'finance',
        sla_due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        escalation_level: 0,
        tags: ['demo_data'],
      });

      if (bankCaseError) throw bankCaseError;

      // 4.6 Create additional demo cases for variety
      const demoCases = [
        {
          type: 'onboarding',
          status: 'waiting_supplier',
          subject: 'SIMULATION: New Vendor Onboarding',
          team: 'procurement',
        },
        {
          type: 'invoice',
          status: 'waiting_supplier',
          subject: 'SIMULATION: Missing GRN for Invoice',
          team: 'ap',
        },
        {
          type: 'payment',
          status: 'open',
          subject: 'SIMULATION: Payment Status Inquiry',
          team: 'ap',
        },
      ];

      for (const demoCase of demoCases) {
        const { error: additionalCaseError } = await supabase.from('vmp_cases').insert({
          tenant_id: tenantId,
          company_id: companyId,
          vendor_id: vendorId,
          case_type: demoCase.type,
          status: demoCase.status,
          subject: demoCase.subject,
          owner_team: demoCase.team,
          sla_due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
          escalation_level: 0,
          tags: ['demo_data'],
        });

        if (additionalCaseError) {
          console.warn('Failed to create additional demo case:', additionalCaseError);
          // Continue with other cases even if one fails
        }
      }

      // 5. Return success
      res.json({
        success: true,
        message: 'Demo data seeded successfully',
        caseId: demoCaseId,
      });
    } catch (dbError) {
      // If any operation fails, attempt cleanup
      // Attempt cleanup - wrap in try-catch since Supabase queries return promises
      try {
        await supabase.from('vmp_cases').delete().eq('id', demoCaseId);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      try {
        await supabase.from('vmp_invoices').delete().eq('id', demoInvoiceId);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw dbError;
    }
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to seed demo data: ' + error.message });
  }
});

// POST /api/demo/reset - Clear and re-seed demo data
app.post('/api/demo/reset', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID required' });
    }

    // 2. Get all demo case IDs for this vendor
    const { data: demoCases, error: casesError } = await supabase
      .from('vmp_cases')
      .select('id')
      .eq('vendor_id', vendorId)
      .contains('tags', ['demo_data']);

    if (casesError) throw casesError;

    const caseIds = demoCases?.map(c => c.id) || [];

    // 3. Delete existing demo data (respecting foreign key constraints)
    if (caseIds.length > 0) {
      // 3.1 Delete messages
      await supabase.from('vmp_messages').delete().in('case_id', caseIds);

      // 3.2 Delete checklist steps
      await supabase.from('vmp_checklist_steps').delete().in('case_id', caseIds);

      // 3.3 Delete evidence
      await supabase.from('vmp_evidence').delete().in('case_id', caseIds);

      // 3.4 Delete cases
      await supabase.from('vmp_cases').delete().in('id', caseIds);
    }

    // 3.5 Delete demo invoices
    await supabase
      .from('vmp_invoices')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('source_system', 'simulation');

    // 3.6 Delete demo payments
    await supabase
      .from('vmp_payments')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('source_system', 'simulation');

    // 4. Re-seed by calling seed endpoint logic
    // Note: For simplicity, we return a message asking user to seed again
    // In production, you could extract seed logic to a shared function
    res.json({
      success: true,
      message: 'Demo data cleared. Please click "Launch Simulator" again to re-seed.',
      note: 'For full reset, clear first then seed separately',
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to reset demo data: ' + error.message });
  }
});

// DELETE /api/demo/clear - Remove all demo data
app.delete('/api/demo/clear', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;

    const vendorId = req.user.vendorId;
    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID required' });
    }

    // 2. Get all demo case IDs for this vendor
    const { data: demoCases, error: casesError } = await supabase
      .from('vmp_cases')
      .select('id')
      .eq('vendor_id', vendorId)
      .contains('tags', ['demo_data']);

    if (casesError) throw casesError;

    const caseIds = demoCases?.map(c => c.id) || [];

    // 3. Delete related data first (respecting foreign key constraints)
    if (caseIds.length > 0) {
      // 3.1 Delete messages
      const { error: msgError } = await supabase
        .from('vmp_messages')
        .delete()
        .in('case_id', caseIds);

      if (msgError) console.warn('Error deleting messages:', msgError);

      // 3.2 Delete checklist steps
      const { error: stepError } = await supabase
        .from('vmp_checklist_steps')
        .delete()
        .in('case_id', caseIds);

      if (stepError) console.warn('Error deleting checklist steps:', stepError);

      // 3.3 Delete evidence
      const { error: evidenceError } = await supabase
        .from('vmp_evidence')
        .delete()
        .in('case_id', caseIds);

      if (evidenceError) console.warn('Error deleting evidence:', evidenceError);

      // 3.4 Delete cases
      const { error: caseDeleteError } = await supabase
        .from('vmp_cases')
        .delete()
        .in('id', caseIds);

      if (caseDeleteError) throw caseDeleteError;
    }

    // 3.5 Delete demo invoices
    const { error: invoiceError } = await supabase
      .from('vmp_invoices')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('source_system', 'simulation');

    if (invoiceError) console.warn('Error deleting invoices:', invoiceError);

    // 3.6 Delete demo payments
    const { error: paymentError } = await supabase
      .from('vmp_payments')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('source_system', 'simulation');

    if (paymentError) console.warn('Error deleting payments:', paymentError);

    // 4. Return success
    res.json({
      success: true,
      message: 'Demo data cleared successfully',
      deletedCases: caseIds.length,
    });
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to clear demo data: ' + error.message });
  }
});

// Mount portal routers (currently stubbed; safe to keep alongside existing routes during migration)
app.use(`${BASE_PATH}/vendor`, vendorRouter);
app.use(`${BASE_PATH}/client`, clientRouter);

app.use((err, req, res, next) => {
  // Log error with context
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  // Create standardized error response
  const errorResponse = createErrorResponse(err, req);

  // Render error page with proper status code
  res.status(errorResponse.status).render('pages/error.html', {
    error: {
      status: errorResponse.status,
      message: errorResponse.body.error.message,
      code: errorResponse.body.error.code,
      ...(env.NODE_ENV !== 'production' &&
      'details' in errorResponse.body.error &&
      errorResponse.body.error.details
        ? { details: errorResponse.body.error.details }
        : {}),
    },
  });
});

// --- START ---
// Export app for Vercel
export default app;

// Keep listen for local development (skip in test environment)
if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
  const PORT = parseInt(env.PORT, 10);
  const BASE_URL_PORT = env.BASE_URL ? new URL(env.BASE_URL).port : null;

  // Warn if BASE_URL port doesn't match server port
  if (BASE_URL_PORT && BASE_URL_PORT !== PORT.toString()) {
    console.warn(
      `\n⚠️  WARNING: BASE_URL port (${BASE_URL_PORT}) doesn't match server port (${PORT})`
    );
    console.warn(`   This may cause Supabase Auth redirects to fail.`);
    console.warn(`   Update BASE_URL in .env to: http://localhost:${PORT}\n`);
  }

  const server = app.listen(PORT, () => {
    console.log(`NexusCanon VMP (Phase 0) running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    if (env.BASE_URL) {
      console.log(`BASE_URL: ${env.BASE_URL}`);
    }
  });

  server.on('error', err => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Please stop the process using port ${PORT} or change PORT in .env`);
      console.error(
        `   To find the process: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess\n`
      );
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}
