/**
 * Nexus Structured Logger
 *
 * Enterprise-grade logging with:
 * - JSON structured output for log aggregation
 * - Log levels: ERROR, WARN, INFO, DEBUG
 * - Request correlation IDs
 * - Automatic context enrichment
 * - Zero console.log - all output through this logger
 */

import { randomUUID } from 'crypto';
import { hostname } from 'os';

// ============================================================================
// HOSTNAME (cached for performance)
// ============================================================================

const HOSTNAME = hostname();

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

// Current log level from environment (default: INFO in prod, DEBUG in dev)
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()]
  ?? (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

// ============================================================================
// ERROR CODES / CATEGORIES
// ============================================================================

/**
 * Standardized error codes for consistent error identification.
 *
 * Naming Convention: ERR_<CATEGORY>_<SPECIFIC>
 * - CLIENT errors: User input or request issues (4xx)
 * - SERVER errors: Internal application failures (5xx)
 * - EXTERNAL errors: Third-party service failures
 * - BUSINESS errors: Domain rule violations
 *
 * Usage: throw new ValidationError('Invalid email', { field: 'email' });
 */
export const ErrorCodes = {
  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT ERRORS (4xx) - Problems with the request itself
  // ─────────────────────────────────────────────────────────────────────────
  /** 400 - Request validation failed (missing/invalid fields) */
  VALIDATION_ERROR: 'ERR_CLIENT_VALIDATION',
  /** 401 - No authentication provided */
  AUTH_REQUIRED: 'ERR_CLIENT_AUTH_REQUIRED',
  /** 401 - Authentication credentials invalid */
  AUTH_INVALID: 'ERR_CLIENT_AUTH_INVALID',
  /** 403 - Authenticated but lacks permission */
  PERMISSION_DENIED: 'ERR_CLIENT_PERMISSION_DENIED',
  /** 404 - Requested resource does not exist */
  NOT_FOUND: 'ERR_CLIENT_NOT_FOUND',
  /** 429 - Too many requests */
  RATE_LIMITED: 'ERR_CLIENT_RATE_LIMITED',

  // ─────────────────────────────────────────────────────────────────────────
  // SERVER ERRORS (5xx) - Internal application failures
  // ─────────────────────────────────────────────────────────────────────────
  /** 500 - Unexpected internal error */
  INTERNAL_ERROR: 'ERR_SERVER_INTERNAL',
  /** 500 - Generic database error */
  DB_ERROR: 'ERR_SERVER_DB',
  /** 500 - Database connection failed */
  DB_CONNECTION: 'ERR_SERVER_DB_CONNECTION',
  /** 500 - Database query failed */
  DB_QUERY: 'ERR_SERVER_DB_QUERY',
  /** 500 - Database query timed out */
  DB_TIMEOUT: 'ERR_SERVER_DB_TIMEOUT',

  // ─────────────────────────────────────────────────────────────────────────
  // EXTERNAL DEPENDENCY ERRORS - Third-party service failures
  // ─────────────────────────────────────────────────────────────────────────
  /** 502 - Generic external API failure */
  EXTERNAL_API: 'ERR_EXTERNAL_API',
  /** 502 - Supabase-specific failure */
  SUPABASE_ERROR: 'ERR_EXTERNAL_SUPABASE',
  /** 502 - Payment provider failure */
  PAYMENT_ERROR: 'ERR_EXTERNAL_PAYMENT',
  /** 502 - Email service failure */
  EMAIL_ERROR: 'ERR_EXTERNAL_EMAIL',
  /** 502 - Storage service failure */
  STORAGE_ERROR: 'ERR_EXTERNAL_STORAGE',
  /** 503 - Circuit breaker is open */
  CIRCUIT_OPEN: 'ERR_EXTERNAL_CIRCUIT_OPEN',
  /** 504 - External operation timed out */
  TIMEOUT: 'ERR_EXTERNAL_TIMEOUT',

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS LOGIC ERRORS - Domain rule violations
  // ─────────────────────────────────────────────────────────────────────────
  /** 422 - Business rule violation */
  BUSINESS_RULE: 'ERR_BUSINESS_RULE',
  /** 409 - Resource in invalid state for operation */
  INVALID_STATE: 'ERR_BUSINESS_INVALID_STATE',
  /** 409 - Duplicate resource conflict */
  DUPLICATE: 'ERR_BUSINESS_DUPLICATE',
  /** 422 - Workflow step cannot proceed */
  WORKFLOW_ERROR: 'ERR_BUSINESS_WORKFLOW',
  /** 402 - Payment required to proceed */
  PAYMENT_REQUIRED: 'ERR_BUSINESS_PAYMENT_REQUIRED'
};

/**
 * Error categories for filtering, monitoring, and alerting.
 *
 * Use these to:
 * - Filter logs (e.g., show only SERVER errors)
 * - Set up alerts (e.g., page on-call for DEPENDENCY errors)
 * - Generate metrics (e.g., CLIENT error rate)
 */
export const ErrorCategories = {
  /** User/request issue - typically not our fault */
  CLIENT: 'client',
  /** Internal application issue - our code/infra problem */
  SERVER: 'server',
  /** External service issue - third-party dependency down */
  DEPENDENCY: 'dependency',
  /** Business rule violation - domain logic constraint */
  BUSINESS: 'business'
};

// ============================================================================
// STRUCTURED LOG ENTRY
// ============================================================================

/**
 * Creates a structured log entry
 */
function createLogEntry(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: LEVEL_NAMES[level],
    service: 'nexus-portal',
    message,
    ...data
  };

  // Add environment context
  if (process.env.NODE_ENV) {
    entry.env = process.env.NODE_ENV;
  }

  // Add process/host info in production for multi-node debugging
  if (process.env.NODE_ENV === 'production') {
    entry.pid = process.pid;
    entry.hostname = HOSTNAME;
  }

  return entry;
}

/**
 * Writes log entry to stdout/stderr
 */
function writeLog(level, entry) {
  const output = JSON.stringify(entry);

  if (level <= LOG_LEVELS.ERROR) {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

// ============================================================================
// LOGGER API
// ============================================================================

const logger = {
  /**
   * Log an error with full context
   * @param {string} message - Error message
   * @param {Object} data - Additional context
   * @param {Error} [data.error] - Original error object
   * @param {string} [data.code] - Error code from ErrorCodes
   * @param {string} [data.category] - Error category from ErrorCategories
   * @param {string} [data.correlationId] - Request correlation ID
   */
  error(message, data = {}) {
    if (LOG_LEVELS.ERROR > currentLevel) return;

    // Extract error object before spreading to avoid [object Object] in logs
    const { error: errorObj, ...restData } = data;

    const entry = createLogEntry(LOG_LEVELS.ERROR, message, {
      ...restData,
      code: data.code || ErrorCodes.INTERNAL_ERROR,
      category: data.category || ErrorCategories.SERVER
    });

    // Add structured error details if Error object provided
    if (errorObj instanceof Error) {
      entry.errorDetails = {
        name: errorObj.name,
        message: errorObj.message,
        stack: process.env.NODE_ENV !== 'production' ? errorObj.stack : undefined
      };
    }

    writeLog(LOG_LEVELS.ERROR, entry);
  },

  /**
   * Log a warning
   * @param {string} message - Warning message
   * @param {Object} data - Additional context
   */
  warn(message, data = {}) {
    if (LOG_LEVELS.WARN > currentLevel) return;

    const entry = createLogEntry(LOG_LEVELS.WARN, message, data);
    writeLog(LOG_LEVELS.WARN, entry);
  },

  /**
   * Log informational message
   * @param {string} message - Info message
   * @param {Object} data - Additional context
   */
  info(message, data = {}) {
    if (LOG_LEVELS.INFO > currentLevel) return;

    const entry = createLogEntry(LOG_LEVELS.INFO, message, data);
    writeLog(LOG_LEVELS.INFO, entry);
  },

  /**
   * Log debug information
   * @param {string} message - Debug message
   * @param {Object} data - Additional context
   */
  debug(message, data = {}) {
    if (LOG_LEVELS.DEBUG > currentLevel) return;

    const entry = createLogEntry(LOG_LEVELS.DEBUG, message, data);
    writeLog(LOG_LEVELS.DEBUG, entry);
  },

  /**
   * Create a child logger with preset context
   * @param {Object} context - Context to include in all logs
   * @returns {Object} Child logger with same API
   */
  child(context) {
    return {
      error: (msg, data = {}) => logger.error(msg, { ...context, ...data }),
      warn: (msg, data = {}) => logger.warn(msg, { ...context, ...data }),
      info: (msg, data = {}) => logger.info(msg, { ...context, ...data }),
      debug: (msg, data = {}) => logger.debug(msg, { ...context, ...data }),
      child: (moreContext) => logger.child({ ...context, ...moreContext })
    };
  },

  /**
   * Generate a correlation ID for request tracing
   * @returns {string} UUID correlation ID
   */
  correlationId() {
    return randomUUID();
  }
};

// ============================================================================
// REQUEST LOGGING MIDDLEWARE
// ============================================================================

/**
 * Express middleware for request logging
 * Adds correlationId to req and logs request/response
 */
export function requestLogger(options = {}) {
  const excludePaths = options.excludePaths || ['/health', '/favicon.ico'];

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Add correlation ID
    req.correlationId = req.headers['x-correlation-id'] || logger.correlationId();
    res.setHeader('x-correlation-id', req.correlationId);

    const startTime = Date.now();

    // Log request
    logger.info('Request received', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress
    });

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      };

      if (res.statusCode >= 500) {
        logger.error('Request failed', { ...logData, category: ErrorCategories.SERVER });
      } else if (res.statusCode >= 400) {
        logger.warn('Request client error', { ...logData, category: ErrorCategories.CLIENT });
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default logger;
export { LOG_LEVELS, LEVEL_NAMES };
