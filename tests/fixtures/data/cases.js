/**
 * Standard Case Fixtures
 *
 * Centralized case objects for testing.
 * Use these instead of creating case objects inline.
 */

/**
 * Standard invoice case
 */
export const invoiceCase = {
  case_type: 'invoice',
  status: 'open',
  subject: 'Test Invoice Case',
  // Note: vendor_id, company_id, tenant_id are set at runtime
};

/**
 * Standard SOA case
 */
export const soaCase = {
  case_type: 'soa',
  status: 'open',
  subject: 'Test SOA Case',
  // Note: vendor_id, company_id, tenant_id are set at runtime
};

/**
 * Standard payment case
 */
export const paymentCase = {
  case_type: 'payment',
  status: 'open',
  subject: 'Test Payment Case',
  // Note: vendor_id, company_id, tenant_id are set at runtime
};

/**
 * Standard onboarding case
 */
export const onboardingCase = {
  case_type: 'onboarding',
  status: 'open',
  subject: 'Test Onboarding Case',
  // Note: vendor_id, company_id, tenant_id are set at runtime
};
