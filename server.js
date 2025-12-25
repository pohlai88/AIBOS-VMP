/// <reference path="./types/express.d.ts" />
// ============================================================================
// NEXUS PORTAL SERVER - Minimal Production Server
// ============================================================================
// Phase 13: Legacy VMP removed, Nexus-only architecture
// Date: 2025-12-27
// ============================================================================

import express from 'express';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { cleanEnv, str, url } from 'envalid';
import 'express-async-errors';
import path from 'path';
import { fileURLToPath } from 'url';

// Nexus Portal Routes
import nexusPortalRouter from './src/routes/nexus-portal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DevOps Utilities (structured logging, error handling, health checks)
import logger, { requestLogger, ErrorCodes, ErrorCategories } from './src/utils/nexus-logger.js';
import { NotFoundError, nexusErrorHandler } from './src/utils/nexus-errors.js';
import {
  healthEndpoint,
  livenessEndpoint,
  readinessEndpoint,
  registerHealthCheck,
  DependencySeverity,
} from './src/utils/nexus-health.js';

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

// Load .env.local first (for local Supabase), then .env (for production)
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

const env = cleanEnv(process.env, {
  SUPABASE_URL: url({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  SUPABASE_ANON_KEY: str({ default: '' }),
  SESSION_DB_URL: str(), // Required for session store
  SESSION_SECRET: str({ default: 'dev-secret-change-in-production' }),
  PORT: str({ default: '9000' }),
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  BASE_URL: str({ default: 'http://localhost:9000' }),
  BASE_PATH: str({ default: '' }),
  VAPID_PUBLIC_KEY: str({ default: '' }),
  VAPID_PRIVATE_KEY: str({ default: '' }),
});

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Auth client (for password reset emails)
const supabaseAuth = env.SUPABASE_ANON_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabaseAdmin;

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
const BASE_PATH = env.BASE_PATH || '';

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
          'https://esm.sh',
        ],
        scriptSrcAttr: ["'unsafe-hashes'"],
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
          env.SUPABASE_URL?.replace('https://', 'wss://'),
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
          'https://esm.sh',
        ].filter(Boolean),
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
});
app.use(limiter);

// Request timeout (30s)
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout' });
    }
  }, 30000);

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    clearTimeout(timeout);
    return originalEnd(...args);
  };
  next();
});

// Compression
app.use(compression());

// ============================================================================
// NUNJUCKS TEMPLATE ENGINE
// ============================================================================

const viewsPath = path.join(__dirname, 'src', 'views');
const nunjucksEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  express: app,
  watch: env.NODE_ENV === 'development',
});

// Global template variables
nunjucksEnv.addGlobal('vapid_public_key', env.VAPID_PUBLIC_KEY || '');
nunjucksEnv.addGlobal('supabase_url', env.SUPABASE_URL || '');
nunjucksEnv.addGlobal('supabase_anon_key', env.SUPABASE_ANON_KEY || '');
nunjucksEnv.addGlobal('base_path', env.BASE_PATH || '');
nunjucksEnv.addGlobal('url', (p = '') => {
  const base = (BASE_PATH || '').replace(/\/+$/, '');
  const pathStr = String(p || '');
  const norm = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  return `${base}${norm}` || norm;
});

// Filters
nunjucksEnv.addFilter('upper', str => (str ? String(str).toUpperCase() : ''));
nunjucksEnv.addFilter('tojson', obj => JSON.stringify(obj));

nunjucksEnv.addFilter('date', (date, format) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
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
      '%b %d': () => `${months[d.getMonth()]} ${d.getDate()}`,
      '%H:%M': () =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      '%Y-%m-%d': () =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
    return format && patterns[format] ? patterns[format]() : d.toLocaleDateString();
  } catch {
    return '';
  }
});

nunjucksEnv.addFilter('filesizeformat', bytes => {
  if (!bytes) return '0 B';
  const kb = 1024,
    mb = kb * 1024,
    gb = mb * 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(2)} MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(2)} KB`;
  return `${bytes} B`;
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Static files
if (env.BASE_PATH) {
  app.use(env.BASE_PATH, express.static('public'));
} else {
  app.use(express.static('public'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Base path for templates
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  next();
});

// PWA files
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

// ============================================================================
// SESSION STORE (PostgreSQL)
// ============================================================================

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

// ============================================================================
// HEALTH CHECKS (with dependency tracking)
// ============================================================================

// Register Supabase health check
registerHealthCheck(
  'supabase',
  async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('nexus_tenants')
        .select('tenant_id')
        .limit(1);
      return { healthy: !error, message: error?.message };
    } catch (err) {
      return { healthy: false, message: err.message };
    }
  },
  { severity: DependencySeverity.CRITICAL, timeoutMs: 3000 }
);

// Health endpoints
app.get('/health', healthEndpoint);
app.get('/health/live', livenessEndpoint);
app.get('/health/ready', readinessEndpoint);

// ============================================================================
// ROUTES: MARKETING PAGES (Standalone - No Auth)
// ============================================================================

// Landing Page
app.get('/', (req, res) => {
  // Check for password reset redirect from Supabase
  const type = req.query.type;
  const accessToken = req.query.access_token;
  const tokenHash = req.query.token_hash;

  if (type === 'recovery' && (accessToken || tokenHash)) {
    if (accessToken) {
      return res.redirect(
        `/nexus/reset-password?access_token=${encodeURIComponent(accessToken)}&type=recovery`
      );
    }
    if (tokenHash) {
      return res.redirect(
        `/nexus/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      );
    }
  }

  res.render('pages/landing.html');
});

// Manifesto Page
app.get('/manifesto', (req, res) => {
  res.render('pages/manifesto.html');
});

// Marketing Sign-Up (redirects to Nexus)
app.get('/sign-up', (req, res) => {
  res.redirect('/nexus/sign-up');
});

// Marketing Login (redirects to Nexus)
app.get('/login', (req, res) => {
  res.redirect('/nexus/login');
});

// Marketing Forgot Password (redirects to Nexus)
app.get('/forgot-password', (req, res) => {
  res.redirect('/nexus/forgot-password');
});

// Marketing Reset Password (redirects to Nexus)
app.get('/reset-password', (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  res.redirect(`/nexus/reset-password${query ? '?' + query : ''}`);
});

// ============================================================================
// ROUTES: NEXUS PORTAL (Main Application)
// ============================================================================

app.use('/nexus', nexusPortalRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 Handler
app.use((req, res) => {
  const notFoundError = new NotFoundError('Page');
  logger.warn('Page not found', {
    path: req.path,
    method: req.method,
    code: ErrorCodes.NOT_FOUND,
    category: ErrorCategories.CLIENT,
  });
  res.status(404).render('nexus/pages/error.html', {
    error: {
      status: 404,
      message: notFoundError.message,
      code: notFoundError.code,
    },
  });
});

// Global Error Handler (structured logging)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || ErrorCodes.INTERNAL_ERROR;
  const category = err.category || ErrorCategories.SERVER;

  logger.error(err.message || 'Unhandled error', {
    error: err,
    code: errorCode,
    category,
    correlationId: req.correlationId,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).render('nexus/pages/error.html', {
    error: {
      status: statusCode,
      message: err.message || 'An unexpected error occurred',
      code: errorCode,
    },
  });
});

// ============================================================================
// SERVER START
// ============================================================================

export default app;

if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
  const PORT = parseInt(env.PORT, 10);

  const server = app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: env.NODE_ENV,
      urls: {
        portal: `http://localhost:${PORT}/nexus/login`,
        landing: `http://localhost:${PORT}/`,
        health: `http://localhost:${PORT}/health`,
      },
    });
  });

  server.on('error', err => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
      logger.error('Port already in use', {
        port: PORT,
        code: ErrorCodes.INTERNAL_ERROR,
        category: ErrorCategories.SERVER,
      });
      process.exit(1);
    } else {
      logger.error('Server startup failed', {
        error: err,
        code: ErrorCodes.INTERNAL_ERROR,
        category: ErrorCategories.SERVER,
      });
      process.exit(1);
    }
  });

  // Graceful shutdown
  const shutdown = signal => {
    logger.info('Shutdown signal received', { signal });
    server.close(() => {
      logger.info('Server closed gracefully');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
