/**
 * Standard Vendor Fixtures
 *
 * Centralized vendor objects for testing.
 * Use these instead of creating vendor objects inline.
 */

/**
 * Standard test vendor
 */
export const standardVendor = {
  name: 'Test Vendor',
  // Note: tenant_id is set at runtime
};

/**
 * Large vendor fixture (for testing scale)
 */
export const largeVendor = {
  ...standardVendor,
  name: 'Large Test Vendor',
};
