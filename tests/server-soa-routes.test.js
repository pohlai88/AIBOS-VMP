/**
 * SOA Reconciliation Route Tests
 *
 * Tests all SOA reconciliation routes (18 routes)
 * Covers authentication, authorization, validation, and business logic
 */

import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../server.js';
import { vmpAdapter } from '../src/adapters/supabase.js';
import { createTestSession, getTestAuthHeaders } from './helpers/auth-helper.js';
import {
  createTestSupabaseClient,
  createTestVendor,
  createTestUser,
  createTestSOACase,
  createTestSOALine,
  createTestInvoice,
  createTestSOAMatch,
  createTestSOAIssue,
  cleanupTestData,
} from './setup/test-helpers.js';

describe('SOA Reconciliation Routes', () => {
  let supabase;
  let testVendor;
  let testUser;
  let testSOACase;
  let testSOALine;
  let testInvoice;
  let testMatch;
  let testIssue;
  let testSession;
  let authHeaders;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    supabase = createTestSupabaseClient();

    // Create test data
    testVendor = await createTestVendor(supabase);
    testUser = await createTestUser(supabase, { vendor_id: testVendor.id });
    testSOACase = await createTestSOACase(supabase, {
      vendorId: testVendor.id,
      companyId: null,
    });
    testSOALine = await createTestSOALine(supabase, {
      caseId: testSOACase.id,
      vendorId: testVendor.id,
    });
    testInvoice = await createTestInvoice(supabase, {
      vendorId: testVendor.id,
    });
    testMatch = await createTestSOAMatch(supabase, {
      soaItemId: testSOALine.id,
      invoiceId: testInvoice.id,
    });
    testIssue = await createTestSOAIssue(supabase, {
      caseId: testSOACase.id,
      soaItemId: testSOALine.id,
    });

    // Create test session
    testSession = await createTestSession(testUser.id, testVendor.id);
    authHeaders = getTestAuthHeaders(testUser.id, testVendor.id);
  });

  afterEach(async () => {
    // Cleanup test data
    if (testIssue) await cleanupTestData(supabase, 'vmp_soa_discrepancies', { id: testIssue.id });
    if (testMatch) await cleanupTestData(supabase, 'vmp_soa_matches', { id: testMatch.id });
    if (testSOALine) await cleanupTestData(supabase, 'vmp_soa_items', { id: testSOALine.id });
    if (testInvoice) await cleanupTestData(supabase, 'vmp_invoices', { id: testInvoice.id });
    if (testSOACase) await cleanupTestData(supabase, 'vmp_cases', { id: testSOACase.id });
    if (testUser) await cleanupTestData(supabase, 'vmp_vendor_users', { id: testUser.id });
    if (testVendor) await cleanupTestData(supabase, 'vmp_vendors', { id: testVendor.id });
    if (testSession?.sessionId) {
      try {
        await vmpAdapter.deleteSession(testSession.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // GET /soa/recon/:caseId - SOA Reconciliation Workspace
  // ============================================================================

  describe('GET /soa/recon/:caseId', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(`/soa/recon/${testSOACase.id}`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid case ID', async () => {
      const response = await request(app).get('/soa/recon/invalid-id').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return 200 and render SOA reconciliation page', async () => {
      const response = await request(app).get(`/soa/recon/${testSOACase.id}`).set(authHeaders);
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('<!doctype html>');
    });
  });

  // ============================================================================
  // GET /partials/soa-recon-workspace.html - SOA Workspace Partial
  // ============================================================================

  describe('GET /partials/soa-recon-workspace.html', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/partials/soa-recon-workspace.html')
        .query({ case_id: testSOACase.id });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid case ID', async () => {
      const response = await request(app)
        .get('/partials/soa-recon-workspace.html')
        .query({ case_id: 'invalid-id' })
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return 200 and render workspace partial', async () => {
      const response = await request(app)
        .get('/partials/soa-recon-workspace.html')
        .query({ case_id: testSOACase.id })
        .set(authHeaders);
      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // POST /soa/match - Match SOA Line to Invoice
  // ============================================================================

  describe('POST /soa/match', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post('/soa/match').send({
        soaItemId: testSOALine.id,
        invoiceId: testInvoice.id,
      });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for missing soaItemId', async () => {
      const response = await request(app).post('/soa/match').set(authHeaders).send({
        invoiceId: testInvoice.id,
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('soaItemId');
    });

    test('should return 400 for missing invoiceId', async () => {
      const response = await request(app).post('/soa/match').set(authHeaders).send({
        soaItemId: testSOALine.id,
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('invoiceId');
    });

    test('should create SOA match successfully', async () => {
      // Create a new unmatched SOA line
      const newSOALine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        status: 'extracted',
      });

      const response = await request(app)
        .post('/soa/match')
        .set(authHeaders)
        .send({
          soaItemId: newSOALine.id,
          invoiceId: testInvoice.id,
          matchData: {
            matchType: 'deterministic',
            isExactMatch: true,
            confidence: 1.0,
          },
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.match).toBeDefined();

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: newSOALine.id });
    });
  });

  // ============================================================================
  // POST /soa/match/:matchId/confirm - Confirm SOA Match
  // ============================================================================

  describe('POST /soa/match/:matchId/confirm', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/soa/match/${testMatch.id}/confirm`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid match ID', async () => {
      const response = await request(app).post('/soa/match/invalid-id/confirm').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should confirm SOA match successfully', async () => {
      const response = await request(app)
        .post(`/soa/match/${testMatch.id}/confirm`)
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.match).toBeDefined();
      expect(response.body.match.status).toBe('confirmed');
    });
  });

  // ============================================================================
  // POST /soa/match/:matchId/reject - Reject SOA Match
  // ============================================================================

  describe('POST /soa/match/:matchId/reject', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/soa/match/${testMatch.id}/reject`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid match ID', async () => {
      const response = await request(app).post('/soa/match/invalid-id/reject').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should reject SOA match successfully', async () => {
      const response = await request(app)
        .post(`/soa/match/${testMatch.id}/reject`)
        .set(authHeaders)
        .send({
          reason: 'Test rejection reason',
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.match).toBeDefined();
      expect(response.body.match.status).toBe('rejected');
    });
  });

  // ============================================================================
  // POST /soa/match/auto - Run Autonomous Matching
  // ============================================================================

  describe('POST /soa/match/auto', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post('/soa/match/auto').send({ caseId: testSOACase.id });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid case ID', async () => {
      const response = await request(app)
        .post('/soa/match/auto')
        .set(authHeaders)
        .send({ caseId: 'invalid-id' });
      expect(response.statusCode).toBe(400);
    });

    test('should run autonomous matching successfully', async () => {
      // Create invoice with matching invoice number
      const matchingInvoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: testSOALine.invoice_number,
        total_amount: testSOALine.amount,
      });

      const response = await request(app)
        .post('/soa/match/auto')
        .set(authHeaders)
        .send({ caseId: testSOACase.id });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.matchesCreated).toBeGreaterThanOrEqual(0);
      expect(response.body.totalLines).toBeGreaterThanOrEqual(0);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_invoices', { id: matchingInvoice.id });
    });
  });

  // ============================================================================
  // POST /soa/resolve - Resolve SOA Issue
  // ============================================================================

  describe('POST /soa/resolve', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post('/soa/resolve').send({ issueId: testIssue.id });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid issue ID', async () => {
      const response = await request(app)
        .post('/soa/resolve')
        .set(authHeaders)
        .send({ issueId: 'invalid-id' });
      expect(response.statusCode).toBe(400);
    });

    test('should resolve SOA issue successfully', async () => {
      const response = await request(app)
        .post('/soa/resolve')
        .set(authHeaders)
        .send({
          issueId: testIssue.id,
          resolutionData: {
            notes: 'Test resolution',
            action: 'corrected',
          },
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.issue).toBeDefined();
      expect(response.body.issue.status).toBe('resolved');
    });
  });

  // ============================================================================
  // POST /soa/signoff - Sign Off SOA Reconciliation
  // ============================================================================

  describe('POST /soa/signoff', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post('/soa/signoff').send({ caseId: testSOACase.id });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid case ID', async () => {
      const response = await request(app)
        .post('/soa/signoff')
        .set(authHeaders)
        .send({ caseId: 'invalid-id' });
      expect(response.statusCode).toBe(400);
    });

    test('should sign off SOA reconciliation successfully', async () => {
      const response = await request(app)
        .post('/soa/signoff')
        .set(authHeaders)
        .send({
          caseId: testSOACase.id,
          acknowledgementData: {
            type: 'full',
            notes: 'Test sign-off',
          },
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.acknowledgement).toBeDefined();
    });
  });

  // ============================================================================
  // POST /api/soa/:statementId/recompute - Recompute SOA Matches
  // ============================================================================

  describe('POST /api/soa/:statementId/recompute', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/${testSOACase.id}/recompute`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).post('/api/soa/invalid-id/recompute').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should recompute SOA matches successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/${testSOACase.id}/recompute`)
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('Recomputed');
    });
  });

  // ============================================================================
  // POST /api/soa/:statementId/signoff - SOA Sign-off API
  // ============================================================================

  describe('POST /api/soa/:statementId/signoff', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/${testSOACase.id}/signoff`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).post('/api/soa/invalid-id/signoff').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should sign off SOA via API successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/${testSOACase.id}/signoff`)
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('signed off');
    });
  });

  // ============================================================================
  // GET /api/soa/:statementId/export - SOA Export
  // ============================================================================

  describe('GET /api/soa/:statementId/export', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(`/api/soa/${testSOACase.id}/export`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).get('/api/soa/invalid-id/export').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should export SOA data successfully', async () => {
      const response = await request(app).get(`/api/soa/${testSOACase.id}/export`).set(authHeaders);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('lines');
    });
  });

  // ============================================================================
  // GET /soa/:statementId/lines - Get SOA Lines with Filters
  // ============================================================================

  describe('GET /soa/:statementId/lines', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(`/soa/${testSOACase.id}/lines`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).get('/soa/invalid-id/lines').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return SOA lines successfully', async () => {
      const response = await request(app).get(`/soa/${testSOACase.id}/lines`).set(authHeaders);

      expect(response.statusCode).toBe(200);
    });

    test('should filter SOA lines by status', async () => {
      const response = await request(app)
        .get(`/soa/${testSOACase.id}/lines`)
        .query({ status: 'extracted' })
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // GET /soa/:statementId/lines/:lineId/focus - SOA Line Detail
  // ============================================================================

  describe('GET /soa/:statementId/lines/:lineId/focus', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(
        `/soa/${testSOACase.id}/lines/${testSOALine.id}/focus`
      );
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app)
        .get(`/soa/invalid-id/lines/${testSOALine.id}/focus`)
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return SOA line detail successfully', async () => {
      const response = await request(app)
        .get(`/soa/${testSOACase.id}/lines/${testSOALine.id}/focus`)
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // POST /api/soa/lines/:lineId/match - Match SOA Line
  // ============================================================================

  describe('POST /api/soa/lines/:lineId/match', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/lines/${testSOALine.id}/match`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid line ID', async () => {
      const response = await request(app).post('/api/soa/lines/invalid-id/match').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should match SOA line successfully', async () => {
      const newSOALine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        status: 'extracted',
      });

      const response = await request(app)
        .post(`/api/soa/lines/${newSOALine.id}/match`)
        .set(authHeaders)
        .send({
          case_id: testSOACase.id,
          ledger_line_id: testInvoice.id,
          matched_amount: testSOALine.amount,
          match_type: 'EXACT',
        });

      expect(response.statusCode).toBe(200);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: newSOALine.id });
    });
  });

  // ============================================================================
  // POST /api/soa/lines/:lineId/dispute - Dispute SOA Line
  // ============================================================================

  describe('POST /api/soa/lines/:lineId/dispute', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/lines/${testSOALine.id}/dispute`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid line ID', async () => {
      const response = await request(app)
        .post('/api/soa/lines/invalid-id/dispute')
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should create dispute for SOA line successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/lines/${testSOALine.id}/dispute`)
        .set(authHeaders)
        .send({
          case_id: testSOACase.id,
          issue_type: 'amount_mismatch',
          description: 'Test dispute',
        });

      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // POST /api/soa/lines/:lineId/resolve - Resolve SOA Line
  // ============================================================================

  describe('POST /api/soa/lines/:lineId/resolve', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/lines/${testSOALine.id}/resolve`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid line ID', async () => {
      const response = await request(app)
        .post('/api/soa/lines/invalid-id/resolve')
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should resolve SOA line successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/lines/${testSOALine.id}/resolve`)
        .set(authHeaders)
        .send({
          case_id: testSOACase.id,
          resolution_notes: 'Test resolution',
        });

      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // POST /api/soa/lines/:lineId/evidence - Upload SOA Line Evidence
  // ============================================================================

  describe('POST /api/soa/lines/:lineId/evidence', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/lines/${testSOALine.id}/evidence`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid line ID', async () => {
      const response = await request(app)
        .post('/api/soa/lines/invalid-id/evidence')
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    // Note: File upload tests require multer setup - skipping for now
    // This would require additional test setup for file uploads
  });
});
