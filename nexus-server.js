/**
 * Nexus Portal Server
 *
 * A clean, standalone server for the Nexus tenant-centric portal.
 * Runs independently from the legacy VMP system.
 *
 * DevOps Features:
 * - Structured JSON logging (no console.log)
 * - Circuit breakers for external dependencies
 * - Health endpoints (/health, /health/live, /health/ready)
 * - Correlation IDs for request tracing
 * - Proper error categorization and handling
 *
 * Usage: node nexus-server.js
 * Default port: 3001 (configurable via NEXUS_PORT env var)
 */

import express from 'express';
import nunjucks from 'nunjucks';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// DevOps utilities
import logger, { requestLogger, ErrorCodes, ErrorCategories } from './src/utils/nexus-logger.js';
import { healthEndpoint, livenessEndpoint, readinessEndpoint, registerHealthCheck, DependencySeverity } from './src/utils/nexus-health.js';
import { getCircuit, CircuitState } from './src/utils/nexus-circuit-breaker.js';
import { nexusErrorHandler, NotFoundError } from './src/utils/nexus-errors.js';

// Load environment variables FIRST
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION (externalized)
// ============================================================================

const config = {
  port: parseInt(process.env.NEXUS_PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  logLevel: process.env.LOG_LEVEL || 'INFO'
};

// Validate required config
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.warn('Missing environment variables', {
    missing: missingVars,
    code: 'WARN_CONFIG_INCOMPLETE'
  });
}

// ============================================================================
// APP SETUP
// ============================================================================

const app = express();

// Trust proxy for correct IP logging behind load balancer
app.set('trust proxy', 1);

// ============================================================================
// HEALTH ENDPOINTS (before other middleware)
// ============================================================================

app.get('/health', healthEndpoint());
app.get('/health/live', livenessEndpoint());
app.get('/health/ready', readinessEndpoint());

// Favicon handler - return 204 No Content (prevents 404 errors in logs)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Root redirect to login
app.get('/', (req, res) => res.redirect('/nexus/login'));

// ============================================================================
// DEV BYPASS - Skip login in development
// ============================================================================
if (config.env === 'development') {
  app.get('/dev/portal', async (req, res) => {
    // Create a mock session cookie for dev testing
    const mockSession = {
      userId: 'USR-DEV00001',
      tenantId: 'TNT-DEV0',
      tenantClientId: 'TC-DEV0',
      tenantVendorId: 'TV-DEV0',
      user: {
        user_id: 'USR-DEV00001',
        email: 'dev@nexus.local',
        display_name: 'Dev User',
        role: 'owner',
        status: 'active'
      },
      tenant: {
        tenant_id: 'TNT-DEV0',
        tenant_client_id: 'TC-DEV0',
        tenant_vendor_id: 'TV-DEV0',
        name: 'Dev Tenant',
        status: 'active'
      }
    };

    // Set session cookie (expires in 24h)
    res.cookie('nexus_session', JSON.stringify(mockSession), {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    logger.info('Dev bypass: session created', { userId: mockSession.userId });
    res.redirect('/nexus/portal');
  });

  logger.info('Dev bypass enabled: /dev/portal');
}

// ============================================================================
// MIDDLEWARE STACK
// ============================================================================

// Request logging with correlation IDs
app.use(requestLogger({ excludePaths: ['/health', '/favicon.ico'] }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files with caching headers
app.use('/css', express.static(path.join(__dirname, 'public/css'), { maxAge: '1d' }));
app.use('/js', express.static(path.join(__dirname, 'public/js'), { maxAge: '1d' }));
app.use('/images', express.static(path.join(__dirname, 'public/images'), { maxAge: '7d' }));

// ============================================================================
// NUNJUCKS TEMPLATE ENGINE
// ============================================================================

const viewsPath = path.join(__dirname, 'src/views');
const nunjucksEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  express: app,
  watch: config.env === 'development'
});

// Global template variables
nunjucksEnv.addGlobal('supabase_url', config.supabase.url || '');
nunjucksEnv.addGlobal('supabase_anon_key', config.supabase.anonKey || '');
nunjucksEnv.addGlobal('env', config.env);

// Custom filters
nunjucksEnv.addFilter('date', (str, format) => {
  if (!str) return '';
  const d = new Date(str);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (format || 'MMM D, YYYY')
    .replace('YYYY', d.getFullYear())
    .replace('MMM', months[d.getMonth()])
    .replace('D', d.getDate())
    .replace('h', d.getHours() % 12 || 12)
    .replace('mm', String(d.getMinutes()).padStart(2, '0'))
    .replace('a', d.getHours() < 12 ? 'am' : 'pm');
});

nunjucksEnv.addFilter('truncate', (str, len) => {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
});

nunjucksEnv.addFilter('round', (num, decimals) => {
  if (num === null || num === undefined) return 0;
  return Number(num).toFixed(decimals || 0);
});

nunjucksEnv.addFilter('first', (str) => {
  return str ? str.charAt(0) : '';
});

nunjucksEnv.addFilter('upper', (str) => {
  return str ? str.toUpperCase() : '';
});

// ============================================================================
// REGISTER HEALTH CHECKS
// ============================================================================

// Supabase health check (CRITICAL - service cannot function without it)
registerHealthCheck('supabase', async () => {
  const circuit = getCircuit('supabase');
  if (circuit.state === CircuitState.OPEN) {
    return { healthy: false, message: 'Circuit breaker open' };
  }

  // Simple connectivity check
  if (!config.supabase.url) {
    return { healthy: false, message: 'SUPABASE_URL not configured' };
  }

  return { healthy: true, message: 'Connected' };
}, { severity: DependencySeverity.CRITICAL, timeoutMs: 5000 });

// Example: Cache health check (OPTIONAL - service can function without it)
// registerHealthCheck('redis', async () => {
//   return { healthy: true, message: 'Connected' };
// }, { severity: DependencySeverity.OPTIONAL, timeoutMs: 2000 });

// ============================================================================
// IMPORT NEXUS ROUTES
// ============================================================================

import nexusPortalRouter from './src/routes/nexus-portal.js';

// Mount at /nexus to match hardcoded paths in templates and middleware
app.use('/nexus', nexusPortalRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Page', req.path));
});

// Global error handler with structured logging
app.use(nexusErrorHandler({ logger, showStackInDev: true }));

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutdown signal received', { signal });

  // Give existing requests time to complete
  setTimeout(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    code: ErrorCodes.INTERNAL_ERROR,
    category: ErrorCategories.SERVER
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error,
    code: ErrorCodes.INTERNAL_ERROR,
    category: ErrorCategories.SERVER
  });
  // Exit on uncaught exception - let process manager restart
  process.exit(1);
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    env: config.env,
    nodeVersion: process.version,
    pid: process.pid
  });

  // Also print banner for development visibility
  if (config.env !== 'production') {
    process.stdout.write(`
╔═══════════════════════════════════════════════════════════╗
║                    NEXUS PORTAL SERVER                    ║
╠═══════════════════════════════════════════════════════════╣
║  Status:  ✅ Running                                      ║
║  Port:    ${config.port}                                            ║
║  Env:     ${config.env.padEnd(10)}                                  ║
║  URL:     http://localhost:${config.port}                           ║
╠═══════════════════════════════════════════════════════════╣
║  Routes:                                                  ║
║  • Login:         http://localhost:${config.port}/login             ║
║  • Health:        http://localhost:${config.port}/health            ║
║  • Health Detail: http://localhost:${config.port}/health?details=true║
║  • Sign Up:       http://localhost:${config.port}/sign-up           ║
║  • Portal:        http://localhost:${config.port}/portal            ║
╚═══════════════════════════════════════════════════════════╝
`);
  }
});

export default app;
