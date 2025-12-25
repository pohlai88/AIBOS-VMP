import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../server.js';
import { vmpAdapter } from '../src/adapters/supabase.js';
import { createTestSession, getTestAuthHeaders } from './helpers/auth-helper.js';

describe('Server Internal Ops Routes - Comprehensive Coverage', () => {
  let testSession = null;
  let testUserId = null;
  let testVendorId = null;
  let testCaseId = null;
  let testChecklistStepId = null;
  let internalUserSession = null;
  let internalUserId = null;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    try {
      // Get regular test user
      const testUser = await vmpAdapter.getUserByEmail('admin@acme.com');
      if (testUser) {
        testUserId = testUser.id;
        testVendorId = testUser.vendor_id;
        testSession = await createTestSession(testUserId, testVendorId);

        // Get a test case
        if (testVendorId) {
          const cases = await vmpAdapter.getInbox(testVendorId);
          if (cases && cases.length > 0) {
            testCaseId = cases[0].id;

            // Get a checklist step for this case
            const steps = await vmpAdapter.getChecklistSteps(testCaseId);
            if (steps && steps.length > 0) {
              testChecklistStepId = steps[0].id;
            }
          }
        }
      }

      // Try to find an internal user (users with is_internal = true)
      // For testing, we'll mock this in the auth middleware
      // In real tests, you'd need an actual internal user in the database
    } catch (error) {
      console.warn('Test data not available:', error.message);
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
    if (internalUserSession?.sessionId) {
      try {
        await vmpAdapter.deleteSession(internalUserSession.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // Helper to get headers for internal user (mocked)
  const getInternalAuthHeaders = (userId = 'internal-user-id') => {
    return {
      'x-test-auth': 'bypass',
      'x-test-user-id': userId,
      'x-test-vendor-id': null,
      'x-test-is-internal': 'true',
    };
  };

  // Helper to get headers for regular user
  const getRegularAuthHeaders = () => {
    if (!testSession) return {};
    return getTestAuthHeaders(testSession.userId, testSession.vendorId);
  };

  describe('POST /cases/:id/verify-evidence', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/cases/${testCaseId || 'test-case-id'}/verify-evidence`)
        .send({ checklist_step_id: 'test-step-id' });

      // Auth middleware redirects to /login (302) instead of 401
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should require internal user (RBAC)', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response = await request(app)
        .post(`/cases/${testCaseId}/verify-evidence`)
        .set(getRegularAuthHeaders())
        .send({ checklist_step_id: testChecklistStepId });

      expect(response.status).toBe(403);
      expect(response.text).toContain('Only internal staff can verify evidence');
    });

    test('should require checklist_step_id', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response = await request(app)
        .post(`/cases/${testCaseId}/verify-evidence`)
        .set(getInternalAuthHeaders())
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toContain('checklist_step_id is required');
    });

    test('should verify evidence successfully', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      // Mock the verifyEvidence method
      const originalVerify = vmpAdapter.verifyEvidence;
      const mockVerify = vi.fn().mockResolvedValue({ id: testChecklistStepId, status: 'verified' });
      vmpAdapter.verifyEvidence = mockVerify;

      // Mock getCaseDetail and ensureChecklistSteps
      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      const originalEnsureSteps = vmpAdapter.ensureChecklistSteps;
      vmpAdapter.getCaseDetail = vi
        .fn()
        .mockResolvedValue({ id: testCaseId, case_type: 'invoice' });
      vmpAdapter.ensureChecklistSteps = vi
        .fn()
        .mockResolvedValue([{ id: testChecklistStepId, status: 'verified' }]);

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/verify-evidence`)
          .set(getInternalAuthHeaders())
          .send({ checklist_step_id: testChecklistStepId });

        expect(response.status).toBe(200);
        expect(mockVerify).toHaveBeenCalledWith(testChecklistStepId, expect.any(String), null);
      } finally {
        vmpAdapter.verifyEvidence = originalVerify;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
        vmpAdapter.ensureChecklistSteps = originalEnsureSteps;
      }
    });

    test('should handle verifyEvidence errors', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalVerify = vmpAdapter.verifyEvidence;
      vmpAdapter.verifyEvidence = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/verify-evidence`)
          .set(getInternalAuthHeaders())
          .send({ checklist_step_id: testChecklistStepId });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Failed to verify evidence');
      } finally {
        vmpAdapter.verifyEvidence = originalVerify;
      }
    });

    test('should handle refresh checklist errors', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalVerify = vmpAdapter.verifyEvidence;
      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      const originalGetSteps = vmpAdapter.getChecklistSteps;

      vmpAdapter.verifyEvidence = vi.fn().mockResolvedValue({ id: testChecklistStepId });
      vmpAdapter.getCaseDetail = vi.fn().mockRejectedValue(new Error('Database error'));
      vmpAdapter.getChecklistSteps = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/verify-evidence`)
          .set(getInternalAuthHeaders())
          .send({ checklist_step_id: testChecklistStepId });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Evidence verified but failed to refresh checklist');
      } finally {
        vmpAdapter.verifyEvidence = originalVerify;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
        vmpAdapter.getChecklistSteps = originalGetSteps;
      }
    });
  });

  describe('POST /cases/:id/reject-evidence', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/cases/${testCaseId || 'test-case-id'}/reject-evidence`)
        .send({ checklist_step_id: 'test-step-id', reason: 'Test reason' });

      // Auth middleware redirects to /login (302) instead of 401
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should require internal user (RBAC)', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response = await request(app)
        .post(`/cases/${testCaseId}/reject-evidence`)
        .set(getRegularAuthHeaders())
        .send({ checklist_step_id: testChecklistStepId, reason: 'Test reason' });

      expect(response.status).toBe(403);
      expect(response.text).toContain('Only internal staff can reject evidence');
    });

    test('should require checklist_step_id and reason', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response1 = await request(app)
        .post(`/cases/${testCaseId}/reject-evidence`)
        .set(getInternalAuthHeaders())
        .send({ reason: 'Test reason' });

      expect(response1.status).toBe(400);
      expect(response1.text).toContain('checklist_step_id and reason are required');

      const response2 = await request(app)
        .post(`/cases/${testCaseId}/reject-evidence`)
        .set(getInternalAuthHeaders())
        .send({ checklist_step_id: testChecklistStepId });

      expect(response2.status).toBe(400);
      expect(response2.text).toContain('checklist_step_id and reason are required');
    });

    test('should reject evidence successfully', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalReject = vmpAdapter.rejectEvidence;
      const mockReject = vi.fn().mockResolvedValue({ id: testChecklistStepId, status: 'rejected' });
      vmpAdapter.rejectEvidence = mockReject;

      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      const originalEnsureSteps = vmpAdapter.ensureChecklistSteps;
      vmpAdapter.getCaseDetail = vi
        .fn()
        .mockResolvedValue({ id: testCaseId, case_type: 'invoice' });
      vmpAdapter.ensureChecklistSteps = vi
        .fn()
        .mockResolvedValue([{ id: testChecklistStepId, status: 'rejected' }]);

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/reject-evidence`)
          .set(getInternalAuthHeaders())
          .send({ checklist_step_id: testChecklistStepId, reason: 'Incomplete documentation' });

        expect(response.status).toBe(200);
        expect(mockReject).toHaveBeenCalledWith(
          testChecklistStepId,
          expect.any(String),
          'Incomplete documentation'
        );
      } finally {
        vmpAdapter.rejectEvidence = originalReject;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
        vmpAdapter.ensureChecklistSteps = originalEnsureSteps;
      }
    });

    test('should handle rejectEvidence errors', async () => {
      if (!testCaseId || !testChecklistStepId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalReject = vmpAdapter.rejectEvidence;
      vmpAdapter.rejectEvidence = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/reject-evidence`)
          .set(getInternalAuthHeaders())
          .send({ checklist_step_id: testChecklistStepId, reason: 'Test reason' });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Failed to reject evidence');
      } finally {
        vmpAdapter.rejectEvidence = originalReject;
      }
    });
  });

  describe('POST /cases/:id/reassign', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/cases/${testCaseId || 'test-case-id'}/reassign`)
        .send({ owner_team: 'ap' });

      // Auth middleware redirects to /login (302) instead of 401
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should require internal user (RBAC)', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response = await request(app)
        .post(`/cases/${testCaseId}/reassign`)
        .set(getRegularAuthHeaders())
        .send({ owner_team: 'ap' });

      expect(response.status).toBe(403);
      expect(response.text).toContain('Only internal staff can reassign cases');
    });

    test('should require valid owner_team', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response1 = await request(app)
        .post(`/cases/${testCaseId}/reassign`)
        .set(getInternalAuthHeaders())
        .send({});

      expect(response1.status).toBe(400);
      expect(response1.text).toContain('owner_team must be one of: procurement, ap, finance');

      const response2 = await request(app)
        .post(`/cases/${testCaseId}/reassign`)
        .set(getInternalAuthHeaders())
        .send({ owner_team: 'invalid' });

      expect(response2.status).toBe(400);
      expect(response2.text).toContain('owner_team must be one of: procurement, ap, finance');
    });

    test('should reassign case successfully', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalReassign = vmpAdapter.reassignCase;
      const mockReassign = vi.fn().mockResolvedValue({ id: testCaseId, owner_team: 'ap' });
      vmpAdapter.reassignCase = mockReassign;

      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      vmpAdapter.getCaseDetail = vi.fn().mockResolvedValue({ id: testCaseId, owner_team: 'ap' });

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/reassign`)
          .set(getInternalAuthHeaders())
          .send({ owner_team: 'ap' });

        expect(response.status).toBe(200);
        expect(mockReassign).toHaveBeenCalledWith(testCaseId, 'ap', expect.any(String));
      } finally {
        vmpAdapter.reassignCase = originalReassign;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
      }
    });

    test('should handle reassignCase errors', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalReassign = vmpAdapter.reassignCase;
      vmpAdapter.reassignCase = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/reassign`)
          .set(getInternalAuthHeaders())
          .send({ owner_team: 'ap' });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Failed to reassign case');
      } finally {
        vmpAdapter.reassignCase = originalReassign;
      }
    });

    test('should handle refresh case detail errors after reassign', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalReassign = vmpAdapter.reassignCase;
      const originalGetCaseDetail = vmpAdapter.getCaseDetail;

      vmpAdapter.reassignCase = vi.fn().mockResolvedValue({ id: testCaseId });
      vmpAdapter.getCaseDetail = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/reassign`)
          .set(getInternalAuthHeaders())
          .send({ owner_team: 'ap' });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Case reassigned but failed to refresh detail');
      } finally {
        vmpAdapter.reassignCase = originalReassign;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
      }
    });
  });

  describe('POST /cases/:id/update-status', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/cases/${testCaseId || 'test-case-id'}/update-status`)
        .send({ status: 'resolved' });

      // Auth middleware redirects to /login (302) instead of 401
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should require internal user (RBAC)', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response = await request(app)
        .post(`/cases/${testCaseId}/update-status`)
        .set(getRegularAuthHeaders())
        .send({ status: 'resolved' });

      expect(response.status).toBe(403);
      expect(response.text).toContain('Only internal staff can update case status');
    });

    test('should require valid status', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const response1 = await request(app)
        .post(`/cases/${testCaseId}/update-status`)
        .set(getInternalAuthHeaders())
        .send({});

      expect(response1.status).toBe(400);
      expect(response1.text).toContain(
        'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'
      );

      const response2 = await request(app)
        .post(`/cases/${testCaseId}/update-status`)
        .set(getInternalAuthHeaders())
        .send({ status: 'invalid' });

      expect(response2.status).toBe(400);
      expect(response2.text).toContain(
        'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'
      );
    });

    test('should update case status successfully', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalUpdate = vmpAdapter.updateCaseStatus;
      const mockUpdate = vi.fn().mockResolvedValue({ id: testCaseId, status: 'resolved' });
      vmpAdapter.updateCaseStatus = mockUpdate;

      const originalGetCaseDetail = vmpAdapter.getCaseDetail;
      vmpAdapter.getCaseDetail = vi.fn().mockResolvedValue({ id: testCaseId, status: 'resolved' });

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/update-status`)
          .set(getInternalAuthHeaders())
          .send({ status: 'resolved' });

        expect(response.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith(testCaseId, 'resolved', expect.any(String));
      } finally {
        vmpAdapter.updateCaseStatus = originalUpdate;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
      }
    });

    test('should handle updateCaseStatus errors', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalUpdate = vmpAdapter.updateCaseStatus;
      vmpAdapter.updateCaseStatus = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/update-status`)
          .set(getInternalAuthHeaders())
          .send({ status: 'resolved' });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Failed to update case status');
      } finally {
        vmpAdapter.updateCaseStatus = originalUpdate;
      }
    });

    test('should handle refresh case detail errors after status update', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const originalUpdate = vmpAdapter.updateCaseStatus;
      const originalGetCaseDetail = vmpAdapter.getCaseDetail;

      vmpAdapter.updateCaseStatus = vi.fn().mockResolvedValue({ id: testCaseId });
      vmpAdapter.getCaseDetail = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        const response = await request(app)
          .post(`/cases/${testCaseId}/update-status`)
          .set(getInternalAuthHeaders())
          .send({ status: 'resolved' });

        expect(response.status).toBe(500);
        expect(response.text).toContain('Case status updated but failed to refresh detail');
      } finally {
        vmpAdapter.updateCaseStatus = originalUpdate;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
      }
    });

    test('should accept all valid status values', async () => {
      if (!testCaseId) {
        console.warn('Skipping test - missing test data');
        return;
      }

      const validStatuses = ['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'];
      const originalUpdate = vmpAdapter.updateCaseStatus;
      const originalGetCaseDetail = vmpAdapter.getCaseDetail;

      vmpAdapter.updateCaseStatus = vi.fn().mockResolvedValue({ id: testCaseId });
      vmpAdapter.getCaseDetail = vi.fn().mockResolvedValue({ id: testCaseId });

      try {
        for (const status of validStatuses) {
          const response = await request(app)
            .post(`/cases/${testCaseId}/update-status`)
            .set(getInternalAuthHeaders())
            .send({ status });

          expect(response.status).toBe(200);
        }
      } finally {
        vmpAdapter.updateCaseStatus = originalUpdate;
        vmpAdapter.getCaseDetail = originalGetCaseDetail;
      }
    });
  });
});
