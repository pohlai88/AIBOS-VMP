/**
 * Nexus Error Classes
 *
 * Structured error handling with:
 * - Error categorization (client/server/dependency)
 * - Error codes for tracking
 * - HTTP status code mapping
 * - Serialization for API responses
 */

import { ErrorCodes, ErrorCategories } from './nexus-logger.js';

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class NexusError extends Error {
  /**
   * Create a NexusError
   * @param {string} message - Human readable error message
   * @param {Object} options - Error options
   * @param {string} options.code - Error code from ErrorCodes
   * @param {string} options.category - Category from ErrorCategories
   * @param {number} options.statusCode - HTTP status code
   * @param {Object} options.details - Additional error details
   * @param {Error} options.cause - Original error that caused this
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'NexusError';
    this.code = options.code || ErrorCodes.INTERNAL_ERROR;
    this.category = options.category || ErrorCategories.SERVER;
    this.statusCode = options.statusCode || 500;
    this.details = options.details || {};
    this.cause = options.cause;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      category: this.category,
      details: Object.keys(this.details).length > 0 ? this.details : undefined,
      timestamp: this.timestamp
    };
  }

  /**
   * Convert to log-friendly format
   */
  toLog() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      statusCode: this.statusCode,
      details: this.details,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message
      } : undefined,
      stack: this.stack
    };
  }
}

// ============================================================================
// CLIENT ERRORS (4xx)
// ============================================================================

export class ValidationError extends NexusError {
  constructor(message, details = {}) {
    super(message, {
      code: ErrorCodes.VALIDATION_ERROR,
      category: ErrorCategories.CLIENT,
      statusCode: 400,
      details
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends NexusError {
  constructor(message = 'Authentication required') {
    super(message, {
      code: ErrorCodes.AUTH_REQUIRED,
      category: ErrorCategories.CLIENT,
      statusCode: 401
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends NexusError {
  constructor(message = 'Permission denied') {
    super(message, {
      code: ErrorCodes.PERMISSION_DENIED,
      category: ErrorCategories.CLIENT,
      statusCode: 403
    });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends NexusError {
  constructor(resource = 'Resource', id) {
    super(`${resource} not found${id ? `: ${id}` : ''}`, {
      code: ErrorCodes.NOT_FOUND,
      category: ErrorCategories.CLIENT,
      statusCode: 404,
      details: { resource, id }
    });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends NexusError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', {
      code: ErrorCodes.RATE_LIMITED,
      category: ErrorCategories.CLIENT,
      statusCode: 429,
      details: { retryAfter }
    });
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// SERVER ERRORS (5xx)
// ============================================================================

export class DatabaseError extends NexusError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCodes.DB_ERROR,
      category: ErrorCategories.SERVER,
      statusCode: 500,
      details: options.details,
      cause: options.cause
    });
    this.name = 'DatabaseError';
  }
}

export class InternalError extends NexusError {
  constructor(message = 'Internal server error', cause) {
    super(message, {
      code: ErrorCodes.INTERNAL_ERROR,
      category: ErrorCategories.SERVER,
      statusCode: 500,
      cause
    });
    this.name = 'InternalError';
  }
}

// ============================================================================
// DEPENDENCY ERRORS
// ============================================================================

export class ExternalServiceError extends NexusError {
  constructor(service, message, cause) {
    super(`External service error (${service}): ${message}`, {
      code: ErrorCodes.EXTERNAL_API,
      category: ErrorCategories.DEPENDENCY,
      statusCode: 502,
      details: { service },
      cause
    });
    this.name = 'ExternalServiceError';
  }
}

export class SupabaseError extends NexusError {
  /**
   * Create a Supabase-specific error
   * @param {string} message - Human readable error message
   * @param {Object} supabaseError - Original Supabase error object
   * @param {string} [supabaseError.code] - Supabase error code
   * @param {string} [supabaseError.message] - Supabase error message
   * @param {string} [supabaseError.details] - Additional error details
   * @param {string} [supabaseError.hint] - Suggestion for fixing the error
   */
  constructor(message, supabaseError) {
    super(message, {
      code: ErrorCodes.SUPABASE_ERROR,
      category: ErrorCategories.DEPENDENCY,
      statusCode: 502,
      details: {
        supabaseCode: supabaseError?.code,
        supabaseMessage: supabaseError?.message,
        supabaseDetails: supabaseError?.details,
        supabaseHint: supabaseError?.hint,
        // Include table/column info if available (common in RLS errors)
        table: supabaseError?.table,
        column: supabaseError?.column
      },
      cause: supabaseError
    });
    this.name = 'SupabaseError';
  }
}

export class TimeoutError extends NexusError {
  /**
   * Create a timeout error
   * @param {string} operation - Name of the operation that timed out
   * @param {number} timeoutMs - Timeout duration in milliseconds
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.retryable=true] - Whether operation can be retried
   * @param {number} [options.suggestedRetryMs] - Suggested retry delay
   * @param {string} [options.service] - Name of the service that timed out
   */
  constructor(operation, timeoutMs, options = {}) {
    super(`Operation timed out: ${operation} (${timeoutMs}ms)`, {
      code: ErrorCodes.TIMEOUT,
      category: ErrorCategories.DEPENDENCY,
      statusCode: 504,
      details: {
        operation,
        timeoutMs,
        retryable: options.retryable !== false, // Default true
        suggestedRetryMs: options.suggestedRetryMs || Math.min(timeoutMs * 2, 30000),
        service: options.service
      }
    });
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// BUSINESS LOGIC ERRORS
// ============================================================================

export class BusinessRuleError extends NexusError {
  constructor(message, rule) {
    super(message, {
      code: ErrorCodes.BUSINESS_RULE,
      category: ErrorCategories.BUSINESS,
      statusCode: 422,
      details: { rule }
    });
    this.name = 'BusinessRuleError';
  }
}

export class InvalidStateError extends NexusError {
  /**
   * Create an invalid state error
   * @param {string} message - Human readable error message
   * @param {string} currentState - Current state of the resource
   * @param {string} expectedState - Expected/required state for the operation
   * @param {Object} [options] - Additional options
   * @param {string} [options.action] - The action that was attempted
   * @param {string} [options.resource] - The resource type (e.g., 'Invoice', 'Case')
   * @param {string} [options.resourceId] - The resource identifier
   * @param {string[]} [options.allowedTransitions] - Valid state transitions from current state
   */
  constructor(message, currentState, expectedState, options = {}) {
    super(message, {
      code: ErrorCodes.INVALID_STATE,
      category: ErrorCategories.BUSINESS,
      statusCode: 409,
      details: {
        currentState,
        expectedState,
        action: options.action,
        resource: options.resource,
        resourceId: options.resourceId,
        allowedTransitions: options.allowedTransitions
      }
    });
    this.name = 'InvalidStateError';
  }
}

export class DuplicateError extends NexusError {
  /**
   * Create a duplicate resource error
   * @param {string} resource - The resource type (e.g., 'User', 'Tenant')
   * @param {string} field - The field that has the duplicate value
   * @param {string} value - The duplicate value (will be sanitized in logs)
   * @param {Object} [options] - Additional options
   * @param {string} [options.existingId] - ID of the existing resource (if known)
   * @param {string} [options.suggestion] - Suggestion for resolving the conflict
   */
  constructor(resource, field, value, options = {}) {
    super(`${resource} already exists with ${field}: ${value}`, {
      code: ErrorCodes.DUPLICATE,
      category: ErrorCategories.BUSINESS,
      statusCode: 409,
      details: {
        resource,
        field,
        value, // Include value for full context
        existingId: options.existingId,
        suggestion: options.suggestion || `Use a different ${field} or update the existing ${resource}`
      }
    });
    this.name = 'DuplicateError';
  }
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

/**
 * Express error handling middleware
 * Converts errors to appropriate responses
 */
export function nexusErrorHandler(options = {}) {
  const { logger: log, showStackInDev = true } = options;

  return (err, req, res, next) => {
    // Already sent response
    if (res.headersSent) {
      return next(err);
    }

    // Convert to NexusError if not already
    let nexusError;
    if (err instanceof NexusError) {
      nexusError = err;
    } else {
      nexusError = new InternalError(
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
        err
      );
    }

    // Log the error
    if (log) {
      log.error(nexusError.message, {
        ...nexusError.toLog(),
        correlationId: req.correlationId,
        path: req.path,
        method: req.method
      });
    }

    // Build response
    const response = nexusError.toJSON();

    // Add correlation ID for tracking
    if (req.correlationId) {
      response.correlationId = req.correlationId;
    }

    // Add stack in development
    if (showStackInDev && process.env.NODE_ENV !== 'production') {
      response.stack = nexusError.stack;
    }

    // Check Accept header for JSON vs HTML
    const wantsJson = req.accepts('json', 'html') === 'json';

    if (wantsJson || req.path.startsWith('/api')) {
      res.status(nexusError.statusCode).json(response);
    } else {
      // Render error page for browser requests
      res.status(nexusError.statusCode).render('nexus/pages/error.html', {
        error: nexusError.message,
        code: nexusError.code,
        statusCode: nexusError.statusCode,
        correlationId: req.correlationId
      });
    }
  };
}

// ============================================================================
// ASYNC HANDLER WRAPPER
// ============================================================================

/**
 * Wrap async route handlers to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
