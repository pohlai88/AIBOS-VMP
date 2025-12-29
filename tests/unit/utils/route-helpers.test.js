import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidUUID,
  validateRequired,
  requireAuth,
  requireInternal,
  validateUUIDParam,
  validateRequiredQuery,
  handleRouteError,
  handlePartialError,
  asyncRoute,
} from '@/utils/route-helpers.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '@/utils/errors.js';

describe('Route Helpers', () => {
  // ============================================================================
  // isValidUUID Tests
  // ============================================================================

  describe('isValidUUID', () => {
    test('should return true for valid UUID', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
      expect(isValidUUID('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    test('should return false for invalid UUID formats', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false);
    });

    test('should return false for null or undefined', () => {
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
    });

    test('should return false for non-string types', () => {
      expect(isValidUUID(123)).toBe(false);
      expect(isValidUUID({})).toBe(false);
      expect(isValidUUID([])).toBe(false);
      expect(isValidUUID(true)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    test('should be case-insensitive', () => {
      expect(isValidUUID('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
      expect(isValidUUID('123e4567-E89B-12d3-A456-426614174000')).toBe(true);
    });
  });

  // ============================================================================
  // validateRequired Tests
  // ============================================================================

  describe('validateRequired', () => {
    test('should return true for valid values', () => {
      expect(validateRequired('value')).toBe(true);
      expect(validateRequired('  value  ')).toBe(true);
      expect(validateRequired(0)).toBe(true);
      expect(validateRequired(false)).toBe(true);
      expect(validateRequired([])).toBe(true);
      expect(validateRequired({})).toBe(true);
    });

    test('should return false for null or undefined', () => {
      expect(validateRequired(null)).toBe(false);
      expect(validateRequired(undefined)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(validateRequired('')).toBe(false);
    });

    test('should return false for whitespace-only string', () => {
      expect(validateRequired('   ')).toBe(false);
      expect(validateRequired('\t\n')).toBe(false);
    });

    test('should return true for non-empty trimmed string', () => {
      expect(validateRequired('  value  ')).toBe(true);
    });
  });

  // ============================================================================
  // requireAuth Tests
  // ============================================================================

  describe('requireAuth', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        user: null,
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        redirect: vi.fn(),
      };
    });

    test('should return false and redirect when user is not authenticated', () => {
      const result = requireAuth(mockReq, mockRes);

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    });

    test('should return true when user is authenticated', () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };

      const result = requireAuth(mockReq, mockRes);

      expect(result).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    test('should handle user object with minimal properties', () => {
      mockReq.user = { id: 'user-123' };

      const result = requireAuth(mockReq, mockRes);

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // requireInternal Tests
  // ============================================================================

  describe('requireInternal', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        user: null,
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        redirect: vi.fn(),
        render: vi.fn(),
      };
    });

    test('should redirect to login when user is not authenticated', () => {
      const result = requireInternal(mockReq, mockRes);

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should return 403 when user is not internal', () => {
      mockReq.user = { id: 'user-123', isInternal: false };

      const result = requireInternal(mockReq, mockRes);

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied. Internal users only.',
        },
      });
    });

    test('should return true when user is internal', () => {
      mockReq.user = { id: 'user-123', isInternal: true };

      const result = requireInternal(mockReq, mockRes);

      expect(result).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should use custom template when provided', () => {
      mockReq.user = { id: 'user-123', isInternal: false };

      const result = requireInternal(mockReq, mockRes, 'partials/error.html');

      expect(result).toBe(false);
      // Partial templates receive error as a string
      expect(mockRes.render).toHaveBeenCalledWith('partials/error.html', {
        error: 'Access denied. Internal users only.',
      });
    });

    test('should use custom message when provided for partial template', () => {
      mockReq.user = { id: 'user-123', isInternal: false };

      const result = requireInternal(
        mockReq,
        mockRes,
        'partials/case_checklist.html',
        'Only internal staff can verify evidence'
      );

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      // Partial templates receive error as a string
      expect(mockRes.render).toHaveBeenCalledWith('partials/case_checklist.html', {
        error: 'Only internal staff can verify evidence',
      });
    });

    test('should handle user without isInternal property', () => {
      mockReq.user = { id: 'user-123' };

      const result = requireInternal(mockReq, mockRes);

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================================================
  // validateUUIDParam Tests
  // ============================================================================

  describe('validateUUIDParam', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn(),
      };
    });

    test('should return true for valid UUID', () => {
      const result = validateUUIDParam('123e4567-e89b-12d3-a456-426614174000', mockRes);

      expect(result).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should return false and render error for invalid UUID', () => {
      const result = validateUUIDParam('invalid-uuid', mockRes);

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid ID format',
        },
      });
    });

    test('should return false for null or undefined', () => {
      const result1 = validateUUIDParam(null, mockRes);
      const result2 = validateUUIDParam(undefined, mockRes);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should use custom template when provided', () => {
      const result = validateUUIDParam('invalid', mockRes, 'partials/error.html');

      expect(result).toBe(false);
      expect(mockRes.render).toHaveBeenCalledWith('partials/error.html', {
        error: {
          status: 400,
          message: 'Invalid ID format',
        },
      });
    });
  });

  // ============================================================================
  // validateRequiredQuery Tests
  // ============================================================================

  describe('validateRequiredQuery', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn(),
      };
    });

    test('should return true for valid parameter', () => {
      const result = validateRequiredQuery('value', 'param_name', mockRes, 'template.html', {});

      expect(result).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should return false and render error for missing parameter', () => {
      const result = validateRequiredQuery(null, 'case_id', mockRes, 'partials/template.html', {
        caseId: null,
      });

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('partials/template.html', {
        caseId: null,
        error: 'case_id is required',
      });
    });

    test('should return false for empty string', () => {
      const result = validateRequiredQuery('', 'param_name', mockRes, 'template.html', {});

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should return false for whitespace-only string', () => {
      const result = validateRequiredQuery('   ', 'param_name', mockRes, 'template.html', {});

      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should include defaultData in error response', () => {
      const defaultData = { caseId: null, messages: [] };
      const result = validateRequiredQuery(
        null,
        'case_id',
        mockRes,
        'partials/template.html',
        defaultData
      );

      expect(result).toBe(false);
      expect(mockRes.render).toHaveBeenCalledWith('partials/template.html', {
        caseId: null,
        messages: [],
        error: 'case_id is required',
      });
    });
  });

  // ============================================================================
  // handleRouteError Tests
  // ============================================================================

  describe('handleRouteError', () => {
    let mockReq, mockRes;
    let consoleErrorSpy;

    beforeEach(() => {
      mockReq = {
        path: '/test/path',
        method: 'GET',
        user: { id: 'user-123' },
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn(),
      };

      // Mock logError (it uses console.error internally)
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should handle ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input', 'field');
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 400,
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
        },
      });
    });

    test('should handle NotFoundError with 404 status', () => {
      const error = new NotFoundError('Resource');
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 404,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
      });
    });

    test('should handle ForbiddenError with 403 status', () => {
      const error = new ForbiddenError();
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 403,
          message: 'Access denied',
          code: 'FORBIDDEN',
        },
      });
    });

    test('should handle UnauthorizedError with 401 status', () => {
      const error = new UnauthorizedError();
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 401,
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
    });

    test('should handle error with statusCode property', () => {
      const error = new Error('Custom error');
      error.statusCode = 418;
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(418);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 418,
          message: 'Custom error',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    test('should handle generic Error with 500 status', () => {
      const error = new Error('Generic error');
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 500,
          message: 'Generic error',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    test('should use custom template when provided', () => {
      const error = new Error('Test error');
      handleRouteError(error, mockReq, mockRes, 'partials/error.html');

      expect(mockRes.render).toHaveBeenCalledWith('partials/error.html', {
        error: {
          status: 500,
          message: 'Test error',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    test('should include defaultData in error response', () => {
      const error = new Error('Test error');
      const defaultData = { caseId: '123', messages: [] };
      handleRouteError(error, mockReq, mockRes, 'pages/error.html', defaultData);

      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        caseId: '123',
        messages: [],
        error: {
          status: 500,
          message: 'Test error',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    test('should handle error without message', () => {
      const error = new Error();
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 500,
          message: 'An error occurred',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    test('should handle error with code property', () => {
      const error = new Error('Test error');
      error.code = 'CUSTOM_CODE';
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.render).toHaveBeenCalledWith('pages/error.html', {
        error: {
          status: 500,
          message: 'Test error',
          code: 'CUSTOM_CODE',
        },
      });
    });

    test('should handle request without user', () => {
      mockReq.user = null;
      const error = new Error('Test error');
      handleRouteError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // handlePartialError Tests
  // ============================================================================

  describe('handlePartialError', () => {
    let mockReq, mockRes;
    let consoleErrorSpy;

    beforeEach(() => {
      mockReq = {
        path: '/partials/test.html',
        method: 'GET',
        user: { id: 'user-123' },
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn(),
      };

      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should return 200 status for graceful degradation', () => {
      const error = new Error('Test error');
      handlePartialError(error, mockReq, mockRes, 'partials/template.html', {});

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.render).toHaveBeenCalledWith('partials/template.html', {
        error: 'Test error',
      });
    });

    test('should include defaultData in error response', () => {
      const error = new Error('Test error');
      const defaultData = { caseId: '123', messages: [] };
      handlePartialError(error, mockReq, mockRes, 'partials/template.html', defaultData);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.render).toHaveBeenCalledWith('partials/template.html', {
        caseId: '123',
        messages: [],
        error: 'Test error',
      });
    });

    test('should handle error without message', () => {
      const error = new Error();
      handlePartialError(error, mockReq, mockRes, 'partials/template.html', {});

      expect(mockRes.render).toHaveBeenCalledWith('partials/template.html', {
        error: 'An error occurred',
      });
    });

    test('should handle request without user', () => {
      mockReq.user = null;
      const error = new Error('Test error');
      handlePartialError(error, mockReq, mockRes, 'partials/template.html', {});

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should log error with context', () => {
      const error = new Error('Test error');
      handlePartialError(error, mockReq, mockRes, 'partials/template.html', {});

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // asyncRoute Tests
  // ============================================================================

  describe('asyncRoute', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        path: '/test',
        method: 'GET',
        user: { id: 'user-123' },
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn(),
      };
      mockNext = vi.fn();
    });

    test('should execute handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = asyncRoute(handler);

      await wrapped(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle errors in partial routes', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = asyncRoute(handler);

      mockReq.path = '/partials/test.html';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await wrapped(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.render).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should handle errors in page routes', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = asyncRoute(handler);

      mockReq.path = '/pages/test';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await wrapped(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should handle errors in non-partial routes', async () => {
      const error = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = asyncRoute(handler);

      mockReq.path = '/api/test';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await wrapped(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);

      consoleErrorSpy.mockRestore();
    });
  });
});
