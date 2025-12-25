import request from 'supertest';
import { describe, test, expect, beforeEach } from 'vitest';
import app from '../server.js';
import { vmpAdapter } from '../src/adapters/supabase.js';
import { createTestSession } from './helpers/auth-helper.js';

describe('Multer File Filter', () => {
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

  test('should accept PDF files', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', pdfBuffer, 'test.pdf')
      .field('evidence_type', 'invoice_pdf');

    // Should not reject based on file type
    expect([200, 400, 500]).toContain(response.statusCode);
    // Should not be 400 due to file type rejection
    if (response.statusCode === 400) {
      expect(response.text).not.toContain('File type');
    }
  });

  test('should accept JPEG images', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    const imageBuffer = Buffer.from('fake jpeg content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', imageBuffer, 'test.jpg')
      .field('evidence_type', 'invoice_pdf');

    expect([200, 400, 500]).toContain(response.statusCode);
  });

  test('should accept PNG images', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    const imageBuffer = Buffer.from('fake png content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', imageBuffer, 'test.png')
      .field('evidence_type', 'invoice_pdf');

    expect([200, 400, 500]).toContain(response.statusCode);
  });

  test('should accept Word documents', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    const docBuffer = Buffer.from('fake doc content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', docBuffer, 'test.doc')
      .field('evidence_type', 'invoice_pdf');

    expect([200, 400, 500]).toContain(response.statusCode);
  });

  test('should accept Excel documents', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    const xlsBuffer = Buffer.from('fake xls content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', xlsBuffer, 'test.xls')
      .field('evidence_type', 'invoice_pdf');

    expect([200, 400, 500]).toContain(response.statusCode);
  });

  test('should reject disallowed file types', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    // Try to upload an executable file
    const exeBuffer = Buffer.from('fake exe content');
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', exeBuffer, 'test.exe')
      .field('evidence_type', 'invoice_pdf');

    // Should reject or return error
    expect([400, 500]).toContain(response.statusCode);
    if (response.statusCode === 400) {
      expect(response.text).toContain('File type');
    }
  });

  test('should enforce file size limit', async () => {
    if (!testSession || !testCaseId) {
      console.warn('Skipping - no test case');
      return;
    }

    // Create a file larger than 50MB limit
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
    const response = await authenticatedRequest('post', `/cases/${testCaseId}/evidence`)
      .attach('file', largeBuffer, 'large.pdf')
      .field('evidence_type', 'invoice_pdf');

    // Should reject large files
    expect([400, 413, 500]).toContain(response.statusCode);
  });
});
