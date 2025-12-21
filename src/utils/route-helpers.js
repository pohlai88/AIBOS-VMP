/**
 * Route Helper Utilities
 * Standardized functions for route handlers per .cursorrules
 * 
 * These utilities ensure consistent:
 * - Authentication checks
 * - Authorization checks
 * - Input validation
 * - Error handling
 * - Response rendering
 */

import { logError, ValidationError, NotFoundError, ForbiddenError, UnauthorizedError } from './errors.js';

/**
 * Validates UUID format
 * @param {string} id - UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates required field
 * @param {any} field - Field to validate
 * @param {string} fieldName - Name of field for error message
 * @returns {boolean} - True if field is valid
 */
export function validateRequired(field, fieldName = 'Field') {
  return field !== null && field !== undefined && field !== '' && (typeof field !== 'string' || field.trim() !== '');
}

/**
 * Requires authentication - redirects to login if not authenticated
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {boolean} - True if authenticated, false if redirected
 */
export function requireAuth(req, res) {
  if (!req.user) {
    res.status(401).redirect('/login');
    return false;
  }
  return true;
}

/**
 * Requires internal user access - returns 403 if not internal
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {string} template - Template to render on error (default: 'pages/error.html')
 * @param {string} customMessage - Custom error message (optional)
 * @returns {boolean} - True if internal, false if access denied
 */
export function requireInternal(req, res, template = 'pages/error.html', customMessage = null) {
  if (!req.user) {
    res.status(401).redirect('/login');
    return false;
  }
  
  if (!req.user.isInternal) {
    const message = customMessage || 'Access denied. Internal users only.';
    
    // Partial templates expect error as a string, page templates expect an object
    const isPartial = template.startsWith('partials/');
    
    res.status(403).render(template, {
      error: isPartial ? message : {
        status: 403,
        message: message
      }
    });
    return false;
  }
  
  return true;
}

/**
 * Validates UUID parameter
 * @param {string} id - UUID to validate
 * @param {object} res - Express response object
 * @param {string} template - Template to render on error (default: 'pages/error.html')
 * @returns {boolean} - True if valid, false if error rendered
 */
export function validateUUIDParam(id, res, template = 'pages/error.html') {
  if (!isValidUUID(id)) {
    res.status(400).render(template, {
      error: {
        status: 400,
        message: 'Invalid ID format'
      }
    });
    return false;
  }
  return true;
}

/**
 * Validates required query parameter
 * @param {any} param - Parameter to validate
 * @param {string} paramName - Name of parameter for error message
 * @param {object} res - Express response object
 * @param {string} template - Template to render on error
 * @param {object} defaultData - Default data to pass to template
 * @returns {boolean} - True if valid, false if error rendered
 */
export function validateRequiredQuery(param, paramName, res, template, defaultData = {}) {
  if (!validateRequired(param, paramName)) {
    res.status(400).render(template, {
      ...defaultData,
      error: `${paramName} is required`
    });
    return false;
  }
  return true;
}

/**
 * Standardized route error handler
 * Logs error and renders error response
 * @param {Error} error - Error to handle
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {string} template - Template to render (default: 'pages/error.html')
 * @param {object} defaultData - Default data to pass to template
 */
export function handleRouteError(error, req, res, template = 'pages/error.html', defaultData = {}) {
  // Log error with context
  logError(error, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Determine status code
  let status = 500;
  let message = 'An error occurred';

  if (error instanceof ValidationError) {
    status = 400;
    message = error.message;
  } else if (error instanceof NotFoundError) {
    status = 404;
    message = error.message;
  } else if (error instanceof ForbiddenError) {
    status = 403;
    message = error.message;
  } else if (error instanceof UnauthorizedError) {
    status = 401;
    message = error.message;
  } else if (error.statusCode) {
    status = error.statusCode;
    message = error.message || message;
  } else if (error.message) {
    message = error.message;
  }

  // Render error response
  res.status(status).render(template, {
    ...defaultData,
    error: {
      status,
      message,
      code: error.code || 'INTERNAL_ERROR'
    }
  });
}

/**
 * Standardized partial error handler (for HTMX partials)
 * Returns 200 with error in template for graceful degradation, unless useStatusCodes is true
 * @param {Error} error - Error to handle
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {string} template - Template to render
 * @param {object} defaultData - Default data to pass to template
 * @param {boolean} useStatusCodes - If true, return proper HTTP status codes instead of 200
 */
export function handlePartialError(error, req, res, template, defaultData = {}, useStatusCodes = false) {
  // Log error with context
  logError(error, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Determine status code
  let status = 200;
  let message = error.message || 'An error occurred';

  if (useStatusCodes) {
    if (error instanceof ValidationError) {
      status = 400;
    } else if (error instanceof NotFoundError) {
      status = 404;
    } else if (error instanceof ForbiddenError) {
      status = 403;
    } else if (error instanceof UnauthorizedError) {
      status = 401;
    } else if (error.statusCode) {
      status = error.statusCode;
    } else {
      status = 500;
    }
  }

  // Render error response
  // Templates expect error as a string, so pass message directly
  // This ensures the error message appears in the rendered HTML for tests
  res.status(status).render(template, {
    ...defaultData,
    error: message
  });
}

/**
 * Standardized async route wrapper
 * Catches errors and handles them consistently
 * @param {Function} handler - Async route handler
 * @returns {Function} - Wrapped route handler
 */
export function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Determine if this is a partial route (HTMX component)
      const isPartial = req.path.startsWith('/partials/');
      
      if (isPartial) {
        handlePartialError(error, req, res, req.path.replace('/partials/', 'partials/').replace('.html', '.html'), {});
      } else {
        handleRouteError(error, req, res);
      }
    }
  };
}

