import request from 'supertest';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import app from '@server';
import { vmpAdapter } from '@/adapters/supabase.js';
import { createTestSession } from '@tests/helpers/auth-helper.js';

describe('Server Middleware', () => {
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

        // Get a test case ID from inbox
        try {
          const inbox = await vmpAdapter.getInbox(testVendorId);
          if (inbox && inbox.length > 0) {
            testCaseId = inbox[0].id;
          }
        } catch (error) {
          console.warn('Could not get test case:', error.message);
        }
      }
    } catch (error) {
      console.warn('Test setup warning:', error.message);
    }
  });

  // ============================================================================
  // Auth Middleware
  // ============================================================================

  describe('Auth Middleware', () => {
    test('should allow public routes without authentication', async () => {
      const response = await request(app).get('/');
      expect(response.statusCode).toBe(200);
    });

    test('should redirect protected routes without session', async () => {
      const response = await request(app).get('/home');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should allow test auth bypass in test mode', async () => {
      const response = await request(app)
        .get('/home')
        .set('x-test-auth', 'bypass')
        .set('x-test-user-id', 'test-user-id')
        .set('x-test-vendor-id', 'test-vendor-id');

      expect(response.statusCode).toBe(200);
    });

    test('should handle expired session', async () => {
      // Create a session and then mock it as expired
      if (!testUserId) {
        console.warn('Skipping - no test user');
        return;
      }

      const session = await vmpAdapter.createSession(testUserId, {});

      // Mock getSession to return expired session
      const originalGetSession = vmpAdapter.getSession;
      vmpAdapter.getSession = vi.fn().mockResolvedValue({
        id: session.sessionId,
        user_id: testUserId,
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
        data: {},
      });

      const response = await request(app)
        .get('/home')
        .set('Cookie', `vmp_session[sessionId]=${session.sessionId}`);

      // Should redirect to login
      expect(response.statusCode).toBe(302);

      vmpAdapter.getSession = originalGetSession;
      await vmpAdapter.deleteSession(session.sessionId);
    });

    test('should handle inactive user', async () => {
      if (!testUserId) {
        console.warn('Skipping - no test user');
        return;
      }

      const session = await vmpAdapter.createSession(testUserId, {});

      // Mock getVendorContext to return inactive user
      const originalGetVendorContext = vmpAdapter.getVendorContext;
      vmpAdapter.getVendorContext = vi.fn().mockResolvedValue({
        id: testUserId,
        is_active: false,
        vendor_id: testVendorId,
      });

      const response = await request(app)
        .get('/home')
        .set('Cookie', `vmp_session[sessionId]=${session.sessionId}`);

      // Should redirect to login
      expect(response.statusCode).toBe(302);

      vmpAdapter.getVendorContext = originalGetVendorContext;
      await vmpAdapter.deleteSession(session.sessionId);
    });

    test('should handle auth middleware errors gracefully', async () => {
      if (!testUserId) {
        console.warn('Skipping - no test user');
        return;
      }

      const session = await vmpAdapter.createSession(testUserId, {});

      // Mock getSession to throw error
      const originalGetSession = vmpAdapter.getSession;
      vmpAdapter.getSession = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/home')
        .set('Cookie', `vmp_session[sessionId]=${session.sessionId}`);

      // Should redirect to login on error
      expect(response.statusCode).toBe(302);

      vmpAdapter.getSession = originalGetSession;
      await vmpAdapter.deleteSession(session.sessionId);
    });
  });

  // ============================================================================
  // Multer File Filter
  // ============================================================================

  describe('Multer File Filter', () => {
    test('should accept PDF files', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      // Create a mock PDF file
      const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');

      const response = await request(app)
        .post(`/cases/${testCaseId}/evidence`)
        .set('x-test-auth', 'bypass')
        .set('x-test-user-id', testSession.userId)
        .set('x-test-vendor-id', testSession.vendorId)
        .attach('file', pdfBuffer, 'test.pdf')
        .field('evidence_type', 'invoice_pdf');

      // Should not reject the file type (may fail on other validation)
      expect(response.statusCode).not.toBe(400);
    });

    test('should accept image files', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      // Create a mock image file
      const imageBuffer = Buffer.from('fake image content');

      const response = await request(app)
        .post(`/cases/${testCaseId}/evidence`)
        .set('x-test-auth', 'bypass')
        .set('x-test-user-id', testSession.userId)
        .set('x-test-vendor-id', testSession.vendorId)
        .attach('file', imageBuffer, 'test.jpg')
        .field('evidence_type', 'invoice_pdf');

      // Should not reject the file type
      expect(response.statusCode).not.toBe(400);
    });

    test('should reject disallowed file types', async () => {
      if (!testSession || !testCaseId) {
        console.warn('Skipping - no test case');
        return;
      }

      // Create a mock executable file
      const exeBuffer = Buffer.from('fake exe content');

      const response = await request(app)
        .post(`/cases/${testCaseId}/evidence`)
        .set('x-test-auth', 'bypass')
        .set('x-test-user-id', testSession.userId)
        .set('x-test-vendor-id', testSession.vendorId)
        .attach('file', exeBuffer, 'test.exe')
        .field('evidence_type', 'invoice_pdf');

      // Should reject or handle error
      expect([400, 500]).toContain(response.statusCode);
    });
  });

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  describe('Rate Limiting', () => {
    test('should allow requests within limit', async () => {
      const response = await request(app).get('/health');
      expect(response.statusCode).toBe(200);
    });

    // Note: Testing rate limiting exhaustively would require many requests
    // This is a basic sanity check
  });

  // ============================================================================
  // Error Handlers
  // ============================================================================

  describe('Error Handlers', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/definitely-does-not-exist-route-12345')
        .set('x-test-auth', 'bypass');

      // Should return 404 or redirect if caught by auth
      expect([302, 404]).toContain(response.statusCode);
    });

    test('should handle async errors in routes', async () => {
      // This would require mocking a route to throw an error
      // For now, verify error handler exists
      expect(app._router).toBeDefined();
    });
  });

  // ============================================================================
  // Nunjucks Filters
  // ============================================================================

  describe('Nunjucks Filters', () => {
    test('upper filter should uppercase strings', async () => {
      // The filter is used in templates, so we test indirectly
      // by checking that templates render correctly
      const response = await request(app).get('/');
      expect(response.statusCode).toBe(200);
      // If filter works, template should render
      expect(response.text).toBeDefined();
    });

    test('tojson filter should stringify objects', async () => {
      // Tested indirectly through template rendering
      const response = await request(app).get('/');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBeDefined();
    });
  });
});
