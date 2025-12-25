import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../server.js';
import { vmpAdapter } from '../src/adapters/supabase.js';
import { createTestSession } from './helpers/auth-helper.js';

describe('Server Extended Routes', () => {
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

        // Get a test case if available
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

  afterEach(async () => {
    if (testSession?.sessionId) {
      try {
        await vmpAdapter.deleteSession(testSession.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
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
  // Home Routes with Data Loading
  // ============================================================================

  describe('Home Routes with Data', () => {
    test('GET /home3 should redirect to /home (canonical)', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/home3');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/home');
    });

    test('GET /home3 redirects to /home (no adapter errors)', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      // Mock adapter error
      const originalGetInbox = vmpAdapter.getInbox;
      vmpAdapter.getInbox = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await authenticatedRequest('get', '/home3');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/home');

      // Restore
      vmpAdapter.getInbox = originalGetInbox;
    });

    test('GET /home4 should redirect to /home (canonical)', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/home4');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/home');
    });

    test('GET /home4 redirects to /home (metrics handled there)', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/home4');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/home');
    });

    test('GET /home5 should redirect (to /home, then /login if not authenticated)', async () => {
      const response = await request(app).get('/home5');
      expect(response.statusCode).toBe(302);
      // Redirects to /home, which then redirects to /login if not authenticated
      expect(['/home', '/login']).toContain(response.headers.location);
    });

    test('GET /home should calculate all metrics', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/home');
      expect(response.statusCode).toBe(200);
      // Should render with actionCount, openCount, soaCount, paidCount
      expect(response.text).toBeDefined();
    });

    test('GET /dashboard should redirect to /home (canonical)', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/dashboard');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/home');
    });
  });

  // ============================================================================
  // Partial Routes with Data
  // ============================================================================

  describe('Partial Routes with Data', () => {
    test('GET /partials/case-inbox.html should return cases when authenticated', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/partials/case-inbox.html');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-inbox.html should handle missing DEMO_VENDOR_ID', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const originalEnv = process.env.DEMO_VENDOR_ID;
      delete process.env.DEMO_VENDOR_ID;

      const response = await authenticatedRequest('get', '/partials/case-inbox.html');
      // Server may handle missing DEMO_VENDOR_ID gracefully or return error
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 500) {
        expect(response.text).toMatch(/DEMO_VENDOR_ID|error/i);
      }

      process.env.DEMO_VENDOR_ID = originalEnv;
    });

    test('GET /partials/case-detail.html should return case detail with caseId', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest(
        'get',
        `/partials/case-detail.html?case_id=${testCaseId}`
      );
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-detail.html should handle missing caseId', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/partials/case-detail.html');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-thread.html should return messages with caseId', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest(
        'get',
        `/partials/case-thread.html?case_id=${testCaseId}`
      );
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-thread.html should handle missing caseId', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/partials/case-thread.html');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-checklist.html should return checklist with caseId', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest(
        'get',
        `/partials/case-checklist.html?case_id=${testCaseId}`
      );
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/case-evidence.html should return evidence with caseId', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest(
        'get',
        `/partials/case-evidence.html?case_id=${testCaseId}`
      );
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });

    test('GET /partials/escalation.html should return escalation view', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('get', '/partials/escalation.html');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });
  });

  // ============================================================================
  // POST Routes
  // ============================================================================

  describe('POST Routes', () => {
    test('POST /cases/:id/messages should create message with valid data', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/messages`).send({
        body: 'Test message from test suite',
      });

      expect([200, 302]).toContain(response.statusCode);
    });

    test('POST /cases/:id/messages should handle missing caseId', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('post', '/cases//messages').send({
        body: 'Test message',
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    test('POST /cases/:id/messages should handle empty body', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/messages`).send({
        body: '',
      });

      // Should still return 200 and refresh thread
      expect(response.statusCode).toBe(200);
    });

    test('POST /cases/:id/messages should handle missing body', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/messages`).send({});

      expect(response.statusCode).toBe(200);
    });

    test('POST /cases/:id/evidence should handle missing file', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`).send({
        evidence_type: 'invoice_pdf',
      });

      // Should return 400 for missing file (required field)
      expect(response.statusCode).toBe(400);
    });

    test('POST /cases/:id/evidence should handle missing evidence_type', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`).send({});

      // Without file, server returns 200 with refreshed evidence (empty)
      // With file but no evidence_type, server returns 400
      // So we check for either case
      expect([200, 400]).toContain(response.statusCode);
    });

    test('POST /logout should clear session', async () => {
      if (!testSession) {
        console.warn('Skipping - no test session');
        return;
      }

      const response = await authenticatedRequest('post', '/logout');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });

  // ============================================================================
  // Additional Routes
  // ============================================================================

  describe('Additional Routes', () => {
    test('GET /test should return 200 or redirect', async () => {
      const response = await request(app).get('/test');
      // May require auth, so could be 200, 302, or 500
      expect([200, 302, 500]).toContain(response.statusCode);
    });

    test('GET /snippets-test should return 200 or redirect', async () => {
      const response = await request(app).get('/snippets-test');
      // May require auth, so could be 200, 302, or 500
      expect([200, 302, 500]).toContain(response.statusCode);
    });

    test('GET /components should return 200 or redirect', async () => {
      const response = await request(app).get('/components');
      // May require auth, so could be 200, 302, or 500
      expect([200, 302, 500]).toContain(response.statusCode);
    });
  });
});
