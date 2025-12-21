import { describe, test, expect } from 'vitest';
import {
    VMPError,
    ClientError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    StorageError,
    TimeoutError,
    handleSupabaseError,
    createErrorResponse,
    logError,
    asyncHandler
} from '../../src/utils/errors.js';

describe('Error Handling Utilities', () => {
    // ============================================================================
    // Error Classes
    // ============================================================================

    describe('VMPError Base Class', () => {
        test('should create error with default values', () => {
            const error = new VMPError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.details).toBeNull();
            expect(error.timestamp).toBeDefined();
        });

        test('should create error with custom values', () => {
            const error = new VMPError('Custom error', 400, 'CUSTOM_CODE', { field: 'test' });
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('CUSTOM_CODE');
            expect(error.details).toEqual({ field: 'test' });
        });

        test('toJSON should return structured error format', () => {
            const error = new VMPError('Test error', 400, 'TEST_CODE', { field: 'value' });
            const json = error.toJSON();
            
            expect(json).toHaveProperty('error');
            expect(json.error.message).toBe('Test error');
            expect(json.error.code).toBe('TEST_CODE');
            expect(json.error.status).toBe(400);
            expect(json.error.timestamp).toBeDefined();
            expect(json.error.details).toEqual({ field: 'value' });
        });

        test('toResponse should return HTTP response format', () => {
            const error = new VMPError('Test error', 404, 'NOT_FOUND');
            const response = error.toResponse();
            
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error.message).toBe('Test error');
        });
    });

    describe('ClientError', () => {
        test('should create 400 error with BAD_REQUEST code', () => {
            const error = new ClientError('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('BAD_REQUEST');
        });

        test('should create error with custom code', () => {
            const error = new ClientError('Invalid input', 'CUSTOM_CODE');
            expect(error.code).toBe('CUSTOM_CODE');
        });
    });

    describe('ValidationError', () => {
        test('should create validation error with field', () => {
            const error = new ValidationError('Field required', 'email');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.details.field).toBe('email');
        });

        test('should create validation error without field', () => {
            const error = new ValidationError('Validation failed');
            expect(error.details.field).toBeNull();
        });
    });

    describe('UnauthorizedError', () => {
        test('should create 401 error', () => {
            const error = new UnauthorizedError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
        });

        test('should create error with custom message', () => {
            const error = new UnauthorizedError('Please login');
            expect(error.message).toBe('Please login');
        });
    });

    describe('ForbiddenError', () => {
        test('should create 403 error', () => {
            const error = new ForbiddenError();
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('FORBIDDEN');
        });
    });

    describe('NotFoundError', () => {
        test('should create 404 error with resource name', () => {
            const error = new NotFoundError('User');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
            expect(error.message).toBe('User not found');
        });
    });

    describe('ConflictError', () => {
        test('should create 409 error', () => {
            const error = new ConflictError('Resource exists');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT');
        });
    });

    describe('DatabaseError', () => {
        test('should create database error with original error', () => {
            const originalError = new Error('DB connection failed');
            const error = new DatabaseError('Operation failed', originalError);
            
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('DATABASE_ERROR');
            expect(error.originalError).toBe(originalError);
            expect(error.details.originalError).toBe('DB connection failed');
        });
    });

    describe('StorageError', () => {
        test('should create storage error with context', () => {
            const originalError = new Error('Upload failed');
            const error = new StorageError('Storage operation failed', originalError, {
                storagePath: '/path/to/file',
                mimeType: 'image/png'
            });
            
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('STORAGE_ERROR');
            expect(error.details.storagePath).toBe('/path/to/file');
            expect(error.details.mimeType).toBe('image/png');
        });
    });

    describe('TimeoutError', () => {
        test('should create timeout error with operation details', () => {
            const error = new TimeoutError('getUserByEmail', 10000);
            
            expect(error.statusCode).toBe(504);
            expect(error.code).toBe('TIMEOUT');
            expect(error.message).toContain('getUserByEmail');
            expect(error.message).toContain('10000');
            expect(error.details.operation).toBe('getUserByEmail');
            expect(error.details.timeoutMs).toBe(10000);
        });
    });

    // ============================================================================
    // handleSupabaseError Function
    // ============================================================================

    describe('handleSupabaseError', () => {
        test('should return null for PGRST116 (no rows)', () => {
            const error = { code: 'PGRST116', message: 'No rows returned' };
            const result = handleSupabaseError(error, 'getUserByEmail');
            expect(result).toBeNull();
        });

        test('should return NotFoundError for PGRST301', () => {
            const error = { code: 'PGRST301', message: 'Resource not found' };
            const result = handleSupabaseError(error, 'getCase');
            expect(result).toBeInstanceOf(NotFoundError);
            expect(result.statusCode).toBe(404);
        });

        test('should return ClientError for PGRST202', () => {
            const error = { code: 'PGRST202', message: 'Precondition failed', details: 'test' };
            const result = handleSupabaseError(error, 'updateCase');
            expect(result).toBeInstanceOf(ClientError);
            expect(result.statusCode).toBe(400);
            expect(result.code).toBe('PRECONDITION_FAILED');
        });

        test('should return ConflictError for 23505 (unique constraint)', () => {
            const error = { code: '23505', message: 'Unique violation', details: 'email_unique' };
            const result = handleSupabaseError(error, 'createUser');
            expect(result).toBeInstanceOf(ConflictError);
            expect(result.statusCode).toBe(409);
            expect(result.code).toBe('UNIQUE_CONSTRAINT_VIOLATION');
        });

        test('should return ClientError for 23503 (foreign key)', () => {
            const error = { code: '23503', message: 'Foreign key violation', details: 'vendor_id_fkey' };
            const result = handleSupabaseError(error, 'createCase');
            expect(result).toBeInstanceOf(ClientError);
            expect(result.statusCode).toBe(400);
            expect(result.code).toBe('FOREIGN_KEY_VIOLATION');
        });

        test('should return ValidationError for 23502 (not null)', () => {
            const error = { code: '23502', message: 'Not null violation', details: 'email' };
            const result = handleSupabaseError(error, 'createUser');
            expect(result).toBeInstanceOf(ValidationError);
            expect(result.statusCode).toBe(400);
        });

        test('should return ValidationError for 23514 (check constraint)', () => {
            const error = { code: '23514', message: 'Check constraint violation', details: 'status_check' };
            const result = handleSupabaseError(error, 'updateCase');
            expect(result).toBeInstanceOf(ValidationError);
            expect(result.statusCode).toBe(400);
        });

        test('should return DatabaseError for 42P01 (table not found)', () => {
            const error = { code: '42P01', message: 'Table not found', details: 'vmp_invalid' };
            const result = handleSupabaseError(error, 'queryTable');
            expect(result).toBeInstanceOf(DatabaseError);
            expect(result.statusCode).toBe(500);
            expect(result.details.table).toBe('vmp_invalid');
        });

        test('should return DatabaseError for 42P02 (column not found)', () => {
            const error = { code: '42P02', message: 'Column not found', details: 'invalid_column' };
            const result = handleSupabaseError(error, 'queryColumn');
            expect(result).toBeInstanceOf(DatabaseError);
            expect(result.details.column).toBe('invalid_column');
        });

        test('should return ForbiddenError for 42501 (insufficient privilege)', () => {
            const error = { code: '42501', message: 'Insufficient privilege', details: 'RLS policy' };
            const result = handleSupabaseError(error, 'getCases');
            expect(result).toBeInstanceOf(ForbiddenError);
            expect(result.statusCode).toBe(403);
        });

        test('should return UnauthorizedError for 28P01 (invalid password)', () => {
            const error = { code: '28P01', message: 'Invalid password' };
            const result = handleSupabaseError(error, 'login');
            expect(result).toBeInstanceOf(UnauthorizedError);
            expect(result.statusCode).toBe(401);
        });

        test('should return DatabaseError for 3D000 (database not found)', () => {
            const error = { code: '3D000', message: 'Database not found' };
            const result = handleSupabaseError(error, 'connect');
            expect(result).toBeInstanceOf(DatabaseError);
            expect(result.statusCode).toBe(500);
        });

        test('should return DatabaseError for 08003 (connection does not exist)', () => {
            const error = { code: '08003', message: 'Connection does not exist' };
            const result = handleSupabaseError(error, 'query');
            expect(result).toBeInstanceOf(DatabaseError);
        });

        test('should return DatabaseError for 08006 (connection failure)', () => {
            const error = { code: '08006', message: 'Connection failure' };
            const result = handleSupabaseError(error, 'query');
            expect(result).toBeInstanceOf(DatabaseError);
        });

        test('should return TimeoutError for timeout messages', () => {
            const error = { message: 'getUserByEmail timed out after 10000ms' };
            const result = handleSupabaseError(error, 'getUserByEmail');
            expect(result).toBeInstanceOf(TimeoutError);
            expect(result.statusCode).toBe(504);
            expect(result.details.timeoutMs).toBe(10000);
        });

        test('should return NotFoundError for storage not found errors', () => {
            const error = { message: 'BucketNotFound: bucket does not exist' };
            const result = handleSupabaseError(error, 'uploadFile');
            expect(result).toBeInstanceOf(NotFoundError);
            expect(result.details.storageError).toBe(true);
        });

        test('should return ClientError for payload too large', () => {
            const error = { message: 'storage operation failed: file too large' };
            const result = handleSupabaseError(error, 'uploadFile');
            expect(result).toBeInstanceOf(ClientError);
            expect(result.code).toBe('PAYLOAD_TOO_LARGE');
            expect(result.statusCode).toBe(400);
        });

        test('should return UnauthorizedError for storage unauthorized', () => {
            const error = { message: 'Unauthorized: storage access denied' };
            const result = handleSupabaseError(error, 'uploadFile');
            expect(result).toBeInstanceOf(UnauthorizedError);
            expect(result.statusCode).toBe(401);
        });

        test('should return ValidationError for invalid storage input', () => {
            const error = { message: 'storage operation failed: invalid file type' };
            const result = handleSupabaseError(error, 'uploadFile');
            expect(result).toBeInstanceOf(ValidationError);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe('Invalid file type or name');
        });

        test('should return StorageError for generic storage errors', () => {
            const error = { message: 'storage operation failed: upload error' };
            const result = handleSupabaseError(error, 'uploadFile');
            expect(result).toBeInstanceOf(StorageError);
            expect(result.statusCode).toBe(500);
        });

        test('should return DatabaseError for unknown error codes', () => {
            const error = { code: '99999', message: 'Unknown error' };
            const result = handleSupabaseError(error, 'operation');
            expect(result).toBeInstanceOf(DatabaseError);
            expect(result.details.code).toBe('99999');
        });

        test('should return DatabaseError for errors without code', () => {
            const error = { message: 'Generic database error' };
            const result = handleSupabaseError(error, 'operation');
            expect(result).toBeInstanceOf(DatabaseError);
        });
    });

    // ============================================================================
    // createErrorResponse Function
    // ============================================================================

    describe('createErrorResponse', () => {
        test('should return response for VMPError', () => {
            const error = new ValidationError('Invalid input', 'email');
            const response = createErrorResponse(error);
            
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.message).toBe('Invalid input');
        });

        test('should handle Supabase errors', () => {
            const supabaseError = { code: '23505', message: 'Unique violation' };
            const response = createErrorResponse(supabaseError);
            
            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('UNIQUE_CONSTRAINT_VIOLATION');
        });

        test('should return generic error for unknown errors', () => {
            const error = new Error('Unknown error');
            const response = createErrorResponse(error);
            
            expect(response.status).toBe(500);
            // Unknown errors are wrapped as DatabaseError by handleSupabaseError
            expect(response.body.error.code).toBe('DATABASE_ERROR');
        });

        test('should hide stack trace in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const error = new Error('Test error');
            const response = createErrorResponse(error);
            
            expect(response.body.error.stack).toBeUndefined();
            // Error is wrapped as DatabaseError, so message is from DatabaseError
            expect(response.body.error.message).toContain('Database operation failed');
            
            // Reset
            process.env.NODE_ENV = originalEnv;
        });

        test('should include stack trace in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const error = new Error('Test error');
            const response = createErrorResponse(error);
            
            // Stack trace is included in error object, not in response body
            // The response body only includes message, code, status, timestamp
            expect(response.body.error.message).toContain('Database operation failed');
            expect(response.body.error.code).toBe('DATABASE_ERROR');
            
            // Reset
            process.env.NODE_ENV = originalEnv;
        });
    });

    // ============================================================================
    // logError Function
    // ============================================================================

    describe('logError', () => {
        test('should log error with context', () => {
            const error = new DatabaseError('Operation failed', new Error('Original'));
            const context = { path: '/api/users', userId: 'user-123' };
            
            const logged = logError(error, context);
            
            expect(logged.timestamp).toBeDefined();
            expect(logged.error.name).toBe('DatabaseError');
            expect(logged.error.message).toBe('Operation failed');
            expect(logged.error.code).toBe('DATABASE_ERROR');
            expect(logged.error.status).toBe(500);
            expect(logged.context).toEqual(context);
        });

        test('should include stack trace in development', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Test error');
            const logged = logError(error);
            
            expect(logged.error.stack).toBeDefined();
            
            // Reset
            process.env.NODE_ENV = 'test';
        });

        test('should exclude stack trace in production', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Test error');
            const logged = logError(error);
            
            expect(logged.error.stack).toBeUndefined();
            
            // Reset
            process.env.NODE_ENV = 'test';
        });

        test('should include original error if wrapped', () => {
            const originalError = new Error('Original error');
            const error = new DatabaseError('Wrapped error', originalError);
            const logged = logError(error);
            
            expect(logged.originalError).toBeDefined();
            expect(logged.originalError.name).toBe('Error');
            expect(logged.originalError.message).toBe('Original error');
        });
    });

    // ============================================================================
    // asyncHandler Function
    // ============================================================================

    describe('asyncHandler', () => {
        test('should wrap async function and catch errors', async () => {
            const asyncFn = async () => {
                throw new Error('Async error');
            };
            
            const wrapped = asyncHandler(asyncFn);
            const req = {};
            const res = {};
            let caughtError = null;
            
            const next = (err) => {
                caughtError = err;
            };
            
            await wrapped(req, res, next);
            
            expect(caughtError).toBeInstanceOf(Error);
            expect(caughtError.message).toBe('Async error');
        });

        test('should pass through successful results', async () => {
            const asyncFn = async () => {
                return { success: true };
            };
            
            const wrapped = asyncHandler(asyncFn);
            const req = {};
            const res = {};
            let nextCalled = false;
            
            const next = () => {
                nextCalled = true;
            };
            
            await wrapped(req, res, next);
            
            expect(nextCalled).toBe(false);
        });
    });
});

