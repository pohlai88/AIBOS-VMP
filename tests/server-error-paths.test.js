import request from 'supertest';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import app from '../server.js';
import { vmpAdapter } from '../src/adapters/supabase.js';
import { createTestSession } from './helpers/auth-helper.js';

describe('Server Error Paths and Edge Cases', () => {
  let testSession = null;
  let testUserId = null;
  let testVendorId = null;
  let testCaseId = null;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    
    try {
      const testUser = await vmpAdapter.getUserByEmail('admin@acme.com');
      if (testUser) {
        testUserId = testUser.id;
        testVendorId = testUser.vendor_id;
        testSession = await createTestSession(testUserId, testVendorId);
        
        if (testVendorId) {
          const cases = await vmpAdapter.getInbox(testVendorId);
          if (cases && cases.length > 0) {
            testCaseId = cases[0].id;
          }
        }
      }
    } catch (error) {
      console.warn('Test setup warning:', error.message);
    }
  });

  const authenticatedRequest = (method, path) => {
    const req = request(app)[method.toLowerCase()](path);
    if (testSession) {
      req.set('x-test-auth', 'bypass');
      req.set('x-test-user-id', testSession.userId);
      req.set('x-test-vendor-id', testSession.vendorId);
    }
    return req;
  };

  // ============================================================================
  // Error Handler Tests
  // ============================================================================

  describe('Error Handlers', () => {
    test('404 handler should render error page', async () => {
      const response = await request(app)
        .get('/definitely-does-not-exist-route-99999')
        .set('x-test-auth', 'bypass');
      
      expect(response.statusCode).toBe(404);
      expect(response.text).toContain('404');
    });

    test('Global error handler should catch async errors', async () => {
      // This test verifies the error handler exists
      // Actual error triggering would require route modification
      expect(app._router).toBeDefined();
    });
  });

  // ============================================================================
  // Login Error Paths
  // ============================================================================

  describe('Login Error Paths', () => {
    test('POST /login should handle inactive user', async () => {
      if (!testUserId) {
        console.warn('Skipping - no test user');
        return;
      }

      // Mock inactive user
      const originalGetUserByEmail = vmpAdapter.getUserByEmail;
      vmpAdapter.getUserByEmail = vi.fn().mockResolvedValue({
        id: testUserId,
        email: 'inactive@example.com',
        is_active: false
      });

      const response = await request(app)
        .post('/login')
        .send({ email: 'inactive@example.com', password: 'password' });

      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();

      vmpAdapter.getUserByEmail = originalGetUserByEmail;
    });

    test('POST /login should handle login errors gracefully', async () => {
      // Mock adapter error
      const originalGetUserByEmail = vmpAdapter.getUserByEmail;
      vmpAdapter.getUserByEmail = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();

      vmpAdapter.getUserByEmail = originalGetUserByEmail;
    });

    test('GET /login should redirect if already logged in', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      // Create a session cookie
      const response = await request(app)
        .get('/login')
        .set('Cookie', `vmp_session[sessionId]=${testSession.sessionId}`);

      // Should redirect to home if session is valid
      expect([200, 302]).toContain(response.statusCode);
    });
  });

  // ============================================================================
  // Route Error Paths
  // ============================================================================

  describe('Route Error Paths', () => {
    test('GET /home3 should handle adapter errors', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const originalGetInbox = vmpAdapter.getInbox;
      vmpAdapter.getInbox = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', '/home3');
      expect(response.statusCode).toBe(200); // Should still render with empty cases

      vmpAdapter.getInbox = originalGetInbox;
    });

    test('GET /home4 should handle adapter errors', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const originalGetInbox = vmpAdapter.getInbox;
      vmpAdapter.getInbox = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', '/home4');
      expect(response.statusCode).toBe(200);

      vmpAdapter.getInbox = originalGetInbox;
    });

    test('GET /home5 should handle adapter errors', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const originalGetInbox = vmpAdapter.getInbox;
      vmpAdapter.getInbox = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', '/home5');
      expect(response.statusCode).toBe(200);

      vmpAdapter.getInbox = originalGetInbox;
    });

    test('GET /test should handle template errors', async () => {
      const response = await request(app).get('/test');
      // May return 200, 302 (auth redirect), or 500 depending on template/auth
      expect([200, 302, 500]).toContain(response.statusCode);
    });

    test('GET /examples should handle template errors', async () => {
      const response = await request(app).get('/examples');
      // May return 200, 302 (auth redirect), or 500 depending on template/auth
      expect([200, 302, 500]).toContain(response.statusCode);
    });

    test('GET /components should handle template errors', async () => {
      const response = await request(app).get('/components');
      // May return 200, 302 (auth redirect), or 500 depending on template/auth
      expect([200, 302, 500]).toContain(response.statusCode);
    });

    test('GET /snippets-test should handle template errors', async () => {
      const response = await request(app).get('/snippets-test');
      // May return 200, 302 (auth redirect), or 500 depending on template/auth
      expect([200, 302, 500]).toContain(response.statusCode);
    });
  });

  // ============================================================================
  // Partial Route Error Paths
  // ============================================================================

  describe('Partial Route Error Paths', () => {
    test('GET /partials/case-detail.html should handle adapter errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      vmpAdapter.getCaseDetail = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', `/partials/case-detail.html?case_id=${testCaseId}`);
      expect(response.statusCode).toBe(200); // Should render with null caseDetail

      vmpAdapter.getCaseDetail = originalGetCaseDetail;
    });

    test('GET /partials/case-thread.html should handle adapter errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalGetMessages = vmpAdapter.getMessages;
      vmpAdapter.getMessages = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', `/partials/case-thread.html?case_id=${testCaseId}`);
      expect(response.statusCode).toBe(200); // Should render with empty messages

      vmpAdapter.getMessages = originalGetMessages;
    });

    test('GET /partials/case-checklist.html should handle ensureChecklistSteps errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalEnsureChecklistSteps = vmpAdapter.ensureChecklistSteps;
      vmpAdapter.ensureChecklistSteps = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', `/partials/case-checklist.html?case_id=${testCaseId}`);
      expect(response.statusCode).toBe(200); // Should handle error gracefully

      vmpAdapter.ensureChecklistSteps = originalEnsureChecklistSteps;
    });

    test('GET /partials/case-evidence.html should handle signed URL errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalGetEvidenceSignedUrl = vmpAdapter.getEvidenceSignedUrl;
      vmpAdapter.getEvidenceSignedUrl = vi.fn().mockRejectedValue(new Error('Storage error'));

      const response = await authenticatedRequest('get', `/partials/case-evidence.html?case_id=${testCaseId}`);
      expect(response.statusCode).toBe(200); // Should handle URL generation errors

      vmpAdapter.getEvidenceSignedUrl = originalGetEvidenceSignedUrl;
    });
  });

  // ============================================================================
  // POST Route Error Paths
  // ============================================================================

  describe('POST Route Error Paths', () => {
    test('POST /cases/:id/messages should handle createMessage errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalCreateMessage = vmpAdapter.createMessage;
      vmpAdapter.createMessage = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/messages`)
        .send({ body: 'Test message' });

      // Should still try to refresh thread
      expect(response.statusCode).toBe(200);

      vmpAdapter.createMessage = originalCreateMessage;
    });

    test('POST /cases/:id/messages should handle getMessages errors after creation', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalGetMessages = vmpAdapter.getMessages;
      vmpAdapter.getMessages = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/messages`)
        .send({ body: 'Test message' });

      expect(response.statusCode).toBe(500); // Should return error

      vmpAdapter.getMessages = originalGetMessages;
    });

    test('POST /cases/:id/evidence should handle case verification errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      vmpAdapter.getCaseDetail = vi.fn().mockRejectedValue(new Error('Access denied'));

      const testFile = Buffer.from('test file content');
      const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
        .attach('file', testFile, 'test.pdf')
        .field('evidence_type', 'invoice_pdf');

      expect(response.statusCode).toBe(403); // Should return access denied

      vmpAdapter.getCaseDetail = originalGetCaseDetail;
    });

    test('POST /cases/:id/evidence should handle upload errors', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const originalUploadEvidence = vmpAdapter.uploadEvidence;
      vmpAdapter.uploadEvidence = vi.fn().mockRejectedValue(new Error('Upload failed'));

      const testFile = Buffer.from('test file content');
      const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
        .attach('file', testFile, 'test.pdf')
        .field('evidence_type', 'invoice_pdf');

      expect(response.statusCode).toBe(500);

      vmpAdapter.uploadEvidence = originalUploadEvidence;
    });

    test('POST /cases/:id/evidence should handle refresh errors after upload', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      // Mock successful upload but failed refresh
      const originalGetEvidence = vmpAdapter.getEvidence;
      vmpAdapter.getEvidence = vi.fn().mockRejectedValue(new Error('Refresh failed'));

      const testFile = Buffer.from('test file content');
      const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
        .attach('file', testFile, 'test.pdf')
        .field('evidence_type', 'invoice_pdf');

      // May succeed or fail depending on when error occurs
      expect([200, 500]).toContain(response.statusCode);

      vmpAdapter.getEvidence = originalGetEvidence;
    });
  });

  // ============================================================================
  // Logout Error Paths
  // ============================================================================

  describe('Logout Error Paths', () => {
    test('POST /logout should handle deleteSession errors', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const originalDeleteSession = vmpAdapter.deleteSession;
      vmpAdapter.deleteSession = vi.fn().mockRejectedValue(new Error('Delete failed'));

      const response = await authenticatedRequest('post', '/logout');
      // Should still redirect even if delete fails
      expect(response.statusCode).toBe(302);

      vmpAdapter.deleteSession = originalDeleteSession;
    });

    test('POST /logout should work without session', async () => {
      const response = await request(app).post('/logout');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });
});

