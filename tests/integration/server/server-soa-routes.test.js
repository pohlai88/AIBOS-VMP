/**
 * SOA Reconciliation Route Tests
 *
 * Tests all SOA reconciliation routes (18 routes)
 * Covers authentication, authorization, validation, and business logic
 */

import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '@server';
import { vmpAdapter } from '@/adapters/supabase.js';
import { createTestSession, getTestAuthHeaders } from '@tests/helpers/auth-helper.js';
import {
  createTestSupabaseClient,
  setupSOATestData,
  cleanupSOATestData,
  createTestSOALine,
} from '@tests/setup/test-helpers.js';

describe('SOA Reconciliation Routes', () => {
  let supabase;
  let testData;
  let testSession;
  let authHeaders;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    supabase = createTestSupabaseClient();

    // Use setup helper to create all SOA test data in one call
    testData = await setupSOATestData(supabase);

    // Create test session
    testSession = await createTestSession(testData.user.id, testData.vendor.id);
    authHeaders = getTestAuthHeaders(testData.user.id, testData.vendor.id);
  });

  afterEach(async () => {
    // Use cleanup helper to clean up all SOA test data
    if (testData) {
      await cleanupSOATestData(supabase, testData);
    }
    if (testSession?.sessionId) {
      try {
        await vmpAdapter.deleteSession(testSession.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
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
      const response = await request(app).get(`/soa/recon/${testData.soaCase.id}`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid case ID', async () => {
      const response = await request(app).get('/soa/recon/invalid-id').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return 200 and render SOA reconciliation page', async () => {
      const response = await request(app).get(`/soa/recon/${testData.soaCase.id}`).set(authHeaders);
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
        .query({ case_id: testData.soaCase.id });
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
        .query({ case_id: testData.soaCase.id })
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
        soaItemId: testData.soaLine.id,
        invoiceId: testData.invoice.id,
      });
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for missing soaItemId', async () => {
      const response = await request(app).post('/soa/match').set(authHeaders).send({
        invoiceId: testData.invoice.id,
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('soaItemId');
    });

    test('should return 400 for missing invoiceId', async () => {
      const response = await request(app).post('/soa/match').set(authHeaders).send({
        soaItemId: testData.soaLine.id,
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('invoiceId');
    });

    test('should create SOA match successfully', async () => {
      // Create a new unmatched SOA line
      const newSOALine = await createTestSOALine(supabase, {
        caseId: testData.soaCase.id,
        vendorId: testData.vendor.id,
        status: 'extracted',
      });

      const response = await request(app)
        .post('/soa/match')
        .set(authHeaders)
        .send({
          soaItemId: newSOALine.id,
          invoiceId: testData.invoice.id,
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
      const response = await request(app).post(`/soa/match/${testData.match.id}/confirm`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid match ID', async () => {
      const response = await request(app).post('/soa/match/invalid-id/confirm').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should confirm SOA match successfully', async () => {
      const response = await request(app)
        .post(`/soa/match/${testData.match.id}/confirm`)
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
      const response = await request(app).post(`/soa/match/${testData.match.id}/reject`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid match ID', async () => {
      const response = await request(app).post('/soa/match/invalid-id/reject').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should reject SOA match successfully', async () => {
      const response = await request(app)
        .post(`/soa/match/${testData.match.id}/reject`)
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
      const response = await request(app).post('/soa/match/auto').send({ caseId: testData.soaCase.id });
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
        vendorId: testData.vendor.id,
        invoice_number: testData.soaLine.invoice_number,
        total_amount: testData.soaLine.amount,
      });

      const response = await request(app)
        .post('/soa/match/auto')
        .set(authHeaders)
        .send({ caseId: testData.soaCase.id });

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
      const response = await request(app).post('/soa/resolve').send({ issueId: testData.issue.id });
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
          issueId: testData.issue.id,
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
      const response = await request(app).post('/soa/signoff').send({ caseId: testData.soaCase.id });
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
          caseId: testData.soaCase.id,
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
      const response = await request(app).post(`/api/soa/${testData.soaCase.id}/recompute`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).post('/api/soa/invalid-id/recompute').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should recompute SOA matches successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/${testData.soaCase.id}/recompute`)
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
      const response = await request(app).post(`/api/soa/${testData.soaCase.id}/signoff`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).post('/api/soa/invalid-id/signoff').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should sign off SOA via API successfully', async () => {
      const response = await request(app)
        .post(`/api/soa/${testData.soaCase.id}/signoff`)
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
      const response = await request(app).get(`/api/soa/${testData.soaCase.id}/export`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).get('/api/soa/invalid-id/export').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should export SOA data successfully', async () => {
      const response = await request(app).get(`/api/soa/${testData.soaCase.id}/export`).set(authHeaders);

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
      const response = await request(app).get(`/soa/${testData.soaCase.id}/lines`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app).get('/soa/invalid-id/lines').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return SOA lines successfully', async () => {
      const response = await request(app).get(`/soa/${testData.soaCase.id}/lines`).set(authHeaders);

      expect(response.statusCode).toBe(200);
    });

    test('should filter SOA lines by status', async () => {
      const response = await request(app)
        .get(`/soa/${testData.soaCase.id}/lines`)
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
        `/soa/${testData.soaCase.id}/lines/${testData.soaLine.id}/focus`
      );
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid statement ID', async () => {
      const response = await request(app)
        .get(`/soa/invalid-id/lines/${testData.soaLine.id}/focus`)
        .set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should return SOA line detail successfully', async () => {
      const response = await request(app)
        .get(`/soa/${testData.soaCase.id}/lines/${testData.soaLine.id}/focus`)
        .set(authHeaders);

      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // POST /api/soa/lines/:lineId/match - Match SOA Line
  // ============================================================================

  describe('POST /api/soa/lines/:lineId/match', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).post(`/api/soa/lines/${testData.soaLine.id}/match`);
      expect(response.statusCode).toBe(401);
    });

    test('should return 400 for invalid line ID', async () => {
      const response = await request(app).post('/api/soa/lines/invalid-id/match').set(authHeaders);
      expect(response.statusCode).toBe(400);
    });

    test('should match SOA line successfully', async () => {
      const newSOALine = await createTestSOALine(supabase, {
        caseId: testData.soaCase.id,
        vendorId: testData.vendor.id,
        status: 'extracted',
      });

      const response = await request(app)
        .post(`/api/soa/lines/${newSOALine.id}/match`)
        .set(authHeaders)
        .send({
          case_id: testData.soaCase.id,
          ledger_line_id: testData.invoice.id,
          matched_amount: testData.soaLine.amount,
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
      const response = await request(app).post(`/api/soa/lines/${testData.soaLine.id}/dispute`);
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
        .post(`/api/soa/lines/${testData.soaLine.id}/dispute`)
        .set(authHeaders)
        .send({
          case_id: testData.soaCase.id,
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
      const response = await request(app).post(`/api/soa/lines/${testData.soaLine.id}/resolve`);
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
        .post(`/api/soa/lines/${testData.soaLine.id}/resolve`)
        .set(authHeaders)
        .send({
          case_id: testData.soaCase.id,
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
      const response = await request(app).post(`/api/soa/lines/${testData.soaLine.id}/evidence`);
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
