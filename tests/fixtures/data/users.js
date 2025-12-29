/**
 * Standard User Fixtures
 * 
 * Centralized user objects for testing.
 * Use these instead of creating user objects inline.
 * 
 * Example:
 *   import { standardUser, adminUser } from '@tests/fixtures/data/users';
 *   const user = { ...standardUser, role: 'guest' };
 */

/**
 * Standard test user (vendor user)
 */
export const standardUser = {
  email: 'test@example.com',
  name: 'Test User',
  is_active: true,
  // Note: vendor_id, tenant_id, etc. are set at runtime
};

/**
 * Admin user fixture
 */
export const adminUser = {
  ...standardUser,
  email: 'admin@example.com',
  name: 'Admin User',
  is_internal: true,
};

/**
 * Vendor user fixture
 */
export const vendorUser = {
  ...standardUser,
  email: 'vendor@example.com',
  name: 'Vendor User',
  is_internal: false,
};

/**
 * Inactive user fixture
 */
export const inactiveUser = {
  ...standardUser,
  email: 'inactive@example.com',
  name: 'Inactive User',
  is_active: false,
};

