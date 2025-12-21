/**
 * Error Handling Utilities
 * Based on Supabase Edge Functions Error Handling Best Practices
 * @see https://supabase.com/docs/guides/functions/error-handling
 */

/**
 * Base error class for VMP application errors
 */
export class VMPError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        status: this.statusCode,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details })
      }
    };
  }

  /**
   * Convert error to HTTP response
   */
  toResponse() {
    return {
      status: this.statusCode,
      body: this.toJSON()
    };
  }
}

/**
 * Client Error (4xx) - Bad Request
 * Use for validation errors, missing required fields, etc.
 */
export class ClientError extends VMPError {
  constructor(message, code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details);
  }
}

/**
 * Unauthorized Error (401)
 * Use when authentication is required but missing or invalid
 */
export class UnauthorizedError extends VMPError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

/**
 * Forbidden Error (403)
 * Use when user is authenticated but lacks permission
 */
export class ForbiddenError extends VMPError {
  constructor(message = 'Access denied', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

/**
 * Not Found Error (404)
 * Use when resource doesn't exist
 */
export class NotFoundError extends VMPError {
  constructor(resource = 'Resource', details = null) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
  }
}

/**
 * Validation Error (400)
 * Use for input validation failures
 */
export class ValidationError extends ClientError {
  constructor(message, field = null, details = null) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
  }
}

/**
 * Conflict Error (409)
 * Use when resource already exists or state conflict
 */
export class ConflictError extends VMPError {
  constructor(message, code = 'CONFLICT', details = null) {
    super(message, 409, code, details);
  }
}

/**
 * Database Error (500)
 * Use for database/Supabase operation failures
 */
export class DatabaseError extends VMPError {
  constructor(message, originalError = null, details = null) {
    super(message, 500, 'DATABASE_ERROR', {
      ...details,
      ...(originalError && { originalError: originalError.message })
    });
    this.originalError = originalError;
  }
}

/**
 * Timeout Error (504)
 * Use when operation exceeds timeout
 */
export class TimeoutError extends VMPError {
  constructor(operation = 'Operation', timeoutMs = 0, details = null) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      504,
      'TIMEOUT',
      { operation, timeoutMs, ...details }
    );
  }
}

/**
 * Storage Error (500)
 * Use for Supabase Storage operation failures
 */
export class StorageError extends VMPError {
  constructor(message, originalError = null, details = null) {
    super(message, 500, 'STORAGE_ERROR', {
      ...details,
      ...(originalError && { originalError: originalError.message })
    });
    this.originalError = originalError;
  }
}

/**
 * Supabase Error Handler
 * Converts Supabase client errors to appropriate VMP errors
 */
export function handleSupabaseError(error, context = 'operation') {
  // Handle timeout errors
  if (error.message && error.message.includes('timed out')) {
    const timeoutMatch = error.message.match(/(\d+)ms/);
    const timeoutMs = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 0;
    return new TimeoutError(context, timeoutMs);
  }

  // Handle Supabase-specific error codes
  if (error.code) {
    switch (error.code) {
      // PostgREST Error Codes
      case 'PGRST116':
        // No rows returned (not necessarily an error)
        return null;
      
      case 'PGRST301':
        // Resource not found
        return new NotFoundError('Resource', { code: error.code });
      
      case 'PGRST202':
        // Precondition failed
        return new ClientError(
          'Precondition failed',
          'PRECONDITION_FAILED',
          { code: error.code, details: error.details }
        );
      
      // PostgreSQL Error Codes - Constraint Violations
      case '23505':
        // Unique constraint violation
        return new ConflictError(
          'Resource already exists',
          'UNIQUE_CONSTRAINT_VIOLATION',
          { constraint: error.details, code: error.code }
        );
      
      case '23503':
        // Foreign key violation
        return new ClientError(
          'Referenced resource does not exist',
          'FOREIGN_KEY_VIOLATION',
          { constraint: error.details, code: error.code }
        );
      
      case '23502':
        // Not null violation
        return new ValidationError(
          'Required field is missing',
          null,
          { constraint: error.details, code: error.code }
        );
      
      case '23514':
        // Check constraint violation
        return new ValidationError(
          'Check constraint violation',
          null,
          { constraint: error.details, code: error.code }
        );
      
      // PostgreSQL Error Codes - Database/Object Errors
      case '42P01':
        // Table does not exist
        return new DatabaseError(
          'Database table not found',
          error,
          { table: error.details, code: error.code }
        );
      
      case '42P02':
        // Column does not exist
        return new DatabaseError(
          'Database column not found',
          error,
          { column: error.details, code: error.code }
        );
      
      // PostgreSQL Error Codes - Authentication/Authorization
      case '42501':
        // Insufficient privilege (RLS blocking)
        return new ForbiddenError(
          'Insufficient privilege to access this resource',
          { code: error.code, details: error.details }
        );
      
      case '28P01':
        // Invalid password
        return new UnauthorizedError(
          'Invalid authentication credentials',
          { code: error.code }
        );
      
      // PostgreSQL Error Codes - Connection Errors
      case '3D000':
        // Database does not exist
        return new DatabaseError(
          'Database does not exist',
          error,
          { code: error.code, details: error.details }
        );
      
      case '08003':
        // Connection does not exist
        return new DatabaseError(
          'Database connection does not exist',
          error,
          { code: error.code }
        );
      
      case '08006':
        // Connection failure
        return new DatabaseError(
          'Database connection failure',
          error,
          { code: error.code }
        );
      
      default:
        return new DatabaseError(
          `Database operation failed: ${error.message}`,
          error,
          { code: error.code, details: error.details }
        );
    }
  }

  // Handle storage errors
  if (error.message && (error.message.includes('storage') || error.message.includes('bucket') || error.message.includes('object'))) {
    // Check for specific storage error types
    if (error.message.includes('not found') || error.message.includes('BucketNotFound') || error.message.includes('ObjectNotFound')) {
      return new NotFoundError('Storage resource', { 
        originalError: error.message,
        storageError: true 
      });
    }
    
    if (error.message.includes('too large') || error.message.includes('PayloadTooLarge')) {
      return new ClientError(
        'File size exceeds limit',
        'PAYLOAD_TOO_LARGE',
        { originalError: error.message, storageError: true }
      );
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
      return new UnauthorizedError('Storage access denied', {
        originalError: error.message,
        storageError: true
      });
    }
    
    if (error.message.includes('invalid') || error.message.includes('InvalidInput')) {
      return new ValidationError(
        'Invalid file type or name',
        null,
        { originalError: error.message, storageError: true }
      );
    }
    
    // Generic storage error
    return new StorageError(
      `Storage operation failed: ${error.message}`,
      error
    );
  }

  // Default: wrap as database error
  return new DatabaseError(
    `Database operation failed: ${error.message}`,
    error
  );
}

/**
 * Error Response Helper
 * Creates standardized error response for Express routes
 */
export function createErrorResponse(error, req = null) {
  // If already a VMPError, use it directly
  if (error instanceof VMPError) {
    return {
      status: error.statusCode,
      body: error.toJSON()
    };
  }

  // Handle Supabase errors
  const vmpError = handleSupabaseError(error);
  if (vmpError) {
    return {
      status: vmpError.statusCode,
      body: vmpError.toJSON()
    };
  }

  // Default: generic server error
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    status: 500,
    body: {
      error: {
        message: isProduction ? 'Internal server error' : error.message,
        code: 'INTERNAL_ERROR',
        status: 500,
        timestamp: new Date().toISOString(),
        ...(!isProduction && { stack: error.stack })
      }
    }
  };
}

/**
 * Error Logger
 * Structured error logging (can be extended with Winston, etc.)
 */
export function logError(error, context = {}) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code || 'UNKNOWN',
      status: error.statusCode || 500
    },
    context
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorInfo.error.stack = error.stack;
  }

  // Include original error if wrapped
  if (error.originalError) {
    errorInfo.originalError = {
      name: error.originalError.name,
      message: error.originalError.message
    };
  }

  console.error('VMP Error:', JSON.stringify(errorInfo, null, 2));
  
  return errorInfo;
}

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

