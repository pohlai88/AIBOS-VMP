/**
 * Authentication Helper for Tests
 * 
 * Provides utilities to mock authentication in tests
 */

import { vmpAdapter } from '../../src/adapters/supabase.js';

/**
 * Create a test user session and return session info
 * @param {string} userId - User ID
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<{sessionId: string, userId: string, vendorId: string}>}
 */
export async function createTestSession(userId, vendorId) {
  // Create session in database
  const session = await vmpAdapter.createSession(userId, {
    email: 'test@example.com',
    loginAt: new Date().toISOString()
  });

  // Return session info
  return {
    sessionId: session.sessionId,
    userId: userId,
    vendorId: vendorId
  };
}

/**
 * Get test headers for authenticated requests (uses test auth bypass)
 * @param {string} userId - User ID
 * @param {string} vendorId - Vendor ID
 * @returns {object} Headers object for supertest
 */
export function getTestAuthHeaders(userId, vendorId) {
  return {
    'x-test-auth': 'bypass',
    'x-test-user-id': userId,
    'x-test-vendor-id': vendorId
  };
}

