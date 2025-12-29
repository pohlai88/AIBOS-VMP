/**
 * Test Helpers
 *
 * Shared utilities for Vitest and Playwright tests
 */

import { createClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create Supabase test client
 */
export function createTestSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Clean up test data
 */
export async function cleanupTestData(supabase, table, condition = {}) {
  if (Object.keys(condition).length === 0) {
    // Delete all test data (use with caution)
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } else {
    // Delete specific test data
    let query = supabase.from(table).delete();
    for (const [key, value] of Object.entries(condition)) {
      query = query.eq(key, value);
    }
    await query;
  }
}

/**
 * Create test user
 */
export async function createTestUser(supabase, userData = {}) {
  // Extract camelCase keys first
  const { vendorId, ...cleanUserData } = userData;

  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    vendor_id: vendorId || cleanUserData.vendor_id || null,
    is_active: true,
    ...cleanUserData,
  };

  // Remove password_hash if it doesn't exist in schema (Supabase Auth handles passwords)
  // Only include it if explicitly provided
  if (!cleanUserData.password_hash && !('password_hash' in cleanUserData)) {
    delete defaultUser.password_hash;
  }

  const { data, error } = await supabase
    .from('vmp_vendor_users')
    .insert(defaultUser)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create test tenant
 */
export async function createTestTenant(supabase, tenantData = {}) {
  const defaultTenant = {
    name: `Test Tenant ${Date.now()}`,
    ...tenantData,
  };

  const { data, error } = await supabase
    .from('vmp_tenants')
    .insert(defaultTenant)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create test company
 */
export async function createTestCompany(supabase, companyData = {}) {
  // Auto-create tenant if not provided
  let tenantId = companyData.tenantId || companyData.tenant_id;
  if (!tenantId) {
    const tenant = await createTestTenant(supabase);
    tenantId = tenant.id;
  }

  const companyName = companyData.name || `Test Company ${Date.now()}`;

  // Remove tenantId (camelCase) from companyData to avoid conflicts
  const { tenantId: _, tenant_id: __, ...cleanCompanyData } = companyData;

  const defaultCompany = {
    name: companyName,
    legal_name: cleanCompanyData.legal_name || companyName, // legal_name is required
    tenant_id: tenantId, // Always use snake_case
    ...cleanCompanyData,
  };

  const { data, error } = await supabase
    .from('vmp_companies')
    .insert(defaultCompany)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create test vendor
 */
export async function createTestVendor(supabase, vendorData = {}) {
  // Auto-create tenant if not provided
  let tenantId = vendorData.tenantId || vendorData.tenant_id;
  if (!tenantId) {
    const tenant = await createTestTenant(supabase);
    tenantId = tenant.id;
  }

  // Remove tenantId (camelCase) from vendorData to avoid conflicts
  const { tenantId: _, tenant_id: __, ...cleanVendorData } = vendorData;

  const defaultVendor = {
    name: `Test Vendor ${Date.now()}`,
    tenant_id: tenantId, // Always use snake_case
    ...cleanVendorData,
  };

  const { data, error } = await supabase
    .from('vmp_vendors')
    .insert(defaultVendor)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create test case
 */
export async function createTestCase(supabase, caseData = {}) {
  // Extract camelCase keys first
  const { vendorId, companyId, ...cleanCaseData } = caseData;

  const vendorIdValue = vendorId || cleanCaseData.vendor_id;
  let companyIdValue = companyId || cleanCaseData.company_id;
  let tenantId = null;

  // Get tenant_id from vendor or company
  if (vendorIdValue) {
    const { data: vendorData } = await supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorIdValue)
      .single();
    if (vendorData?.tenant_id) {
      tenantId = vendorData.tenant_id;
    }
  }

  if (!tenantId && companyIdValue) {
    const { data: companyData } = await supabase
      .from('vmp_companies')
      .select('tenant_id')
      .eq('id', companyIdValue)
      .single();
    if (companyData?.tenant_id) {
      tenantId = companyData.tenant_id;
    }
  }

  // If still no tenant_id, create one
  if (!tenantId) {
    const tenant = await createTestTenant(supabase);
    tenantId = tenant.id;
  }

  // Ensure company exists when not provided (schema requires company_id on cases)
  if (!companyIdValue) {
    const company = await createTestCompany(supabase, { tenant_id: tenantId });
    companyIdValue = company.id;
  }

  const defaultCase = {
    case_type: 'invoice',
    status: 'open',
    subject: `Test Case ${Date.now()}`,
    tenant_id: tenantId, // Required by schema
    vendor_id: vendorIdValue || null,
    company_id: companyIdValue, // Required by schema
    ...cleanCaseData,
  };

  const { data, error } = await supabase.from('vmp_cases').insert(defaultCase).select().single();

  if (error) throw error;
  return data;
}

/**
 * Wait for async operation
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test UUID
 */
export function generateTestUUID() {
  return '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');
}

/**
 * Mock request object for route testing
 */
export function createMockRequest(options = {}) {
  return {
    user: options.user || null,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    file: options.file || null,
    files: options.files || [],
    session: options.session || {},
    headers: options.headers || {},
    ...options,
  };
}

/**
 * Mock response object for route testing
 */
export function createMockResponse() {
  const statusFn = vi.fn().mockReturnThis();
  const jsonFn = vi.fn().mockReturnThis();
  const renderFn = vi.fn().mockReturnThis();
  const redirectFn = vi.fn().mockReturnThis();
  const sendFn = vi.fn().mockReturnThis();
  const setHeaderFn = vi.fn().mockReturnThis();

  const res = {
    status: statusFn,
    json: jsonFn,
    render: renderFn,
    redirect: redirectFn,
    send: sendFn,
    setHeader: setHeaderFn,
    headers: {},
    locals: {},
  };

  // Chain status().render() pattern
  statusFn.mockReturnValue(res);

  return res;
}

/**
 * Create SOA case (SOA reconciliation case)
 */
export async function createTestSOACase(supabase, caseData = {}) {
  // Extract camelCase keys first
  const { vendorId, companyId: caseCompanyId, ...cleanCaseData } = caseData;

  // Auto-create company if not provided and vendor exists
  let companyId = caseCompanyId || caseData.company_id;
  const vendorIdValue = vendorId || caseData.vendor_id;
  let tenantId = null;

  if (!companyId && vendorIdValue) {
    const { data: vendorData } = await supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorIdValue)
      .single();
    if (vendorData?.tenant_id) {
      const company = await createTestCompany(supabase, { tenant_id: vendorData.tenant_id });
      companyId = company.id;
      tenantId = vendorData.tenant_id;
    }
  }
  if (!companyId) {
    // Last resort: create tenant and company
    const company = await createTestCompany(supabase);
    companyId = company.id;
    tenantId = company.tenant_id;
  } else {
    // Get tenant_id from company
    const { data: companyData } = await supabase
      .from('vmp_companies')
      .select('tenant_id')
      .eq('id', companyId)
      .single();
    if (companyData?.tenant_id) {
      tenantId = companyData.tenant_id;
    }
  }

  // If vendor exists, get tenant_id from vendor (vendor takes precedence)
  if (vendorIdValue && !tenantId) {
    const { data: vendorData } = await supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorIdValue)
      .single();
    if (vendorData?.tenant_id) {
      tenantId = vendorData.tenant_id;
    }
  }

  // If still no tenant_id, create one
  if (!tenantId) {
    const tenant = await createTestTenant(supabase);
    tenantId = tenant.id;
  }

  const defaultCase = {
    case_type: 'soa',
    status: 'open',
    subject: `SOA Reconciliation ${Date.now()}`,
    tenant_id: tenantId, // Required by schema
    vendor_id: vendorIdValue || null,
    company_id: companyId, // Always use snake_case
    ...cleanCaseData,
  };

  const { data, error } = await supabase.from('vmp_cases').insert(defaultCase).select().single();

  if (error) throw error;
  return data;
}

/**
 * Create SOA line (SOA item)
 */
export async function createTestSOALine(supabase, lineData = {}) {
  // Extract camelCase keys first
  const { caseId, vendorId, companyId: lineCompanyId, lineNumber, ...cleanLineData } = lineData;

  // Auto-create company if not provided (required by schema)
  let companyId = lineCompanyId || lineData.company_id;
  const caseIdValue = caseId || lineData.case_id;
  const vendorIdValue = vendorId || lineData.vendor_id;

  if (!companyId && caseIdValue) {
    // Try to get company_id from case
    const { data: caseData } = await supabase
      .from('vmp_cases')
      .select('company_id')
      .eq('id', caseIdValue)
      .single();
    if (caseData?.company_id) {
      companyId = caseData.company_id;
    }
  }
  if (!companyId && vendorIdValue) {
    // Create company for vendor's tenant
    const { data: vendorData } = await supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorIdValue)
      .single();
    if (vendorData?.tenant_id) {
      const company = await createTestCompany(supabase, { tenant_id: vendorData.tenant_id });
      companyId = company.id;
    }
  }
  if (!companyId) {
    // Last resort: create tenant and company
    const company = await createTestCompany(supabase);
    companyId = company.id;
  }

  const defaultLine = {
    case_id: caseIdValue || null,
    vendor_id: vendorIdValue || null,
    company_id: companyId, // Always use snake_case
    invoice_number: `INV-${Date.now()}`,
    invoice_date: new Date().toISOString().split('T')[0],
    amount: 1000.0,
    currency_code: 'USD',
    status: 'extracted',
    line_number: lineNumber || 1,
    ...cleanLineData,
  };

  const { data, error } = await supabase
    .from('vmp_soa_items')
    .insert(defaultLine)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create test invoice for SOA matching
 */
export async function createTestInvoice(supabase, invoiceData = {}) {
  // Extract camelCase keys first
  const { vendorId, ...cleanInvoiceData } = invoiceData;

  const defaultInvoice = {
    vendor_id: vendorId || invoiceData.vendor_id || null,
    invoice_number: `INV-${Date.now()}`,
    invoice_date: new Date().toISOString().split('T')[0],
    total_amount: 1000.0,
    currency_code: 'USD',
    status: 'pending',
    ...cleanInvoiceData,
  };

  const { data, error } = await supabase
    .from('vmp_invoices')
    .insert(defaultInvoice)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create SOA match
 */
export async function createTestSOAMatch(supabase, matchData = {}) {
  // Extract camelCase keys first
  const { soaItemId, invoiceId, ...cleanMatchData } = matchData;

  const defaultMatch = {
    soa_item_id: soaItemId || matchData.soa_item_id || null,
    invoice_id: invoiceId || matchData.invoice_id || null,
    match_type: 'deterministic',
    is_exact_match: true,
    match_confidence: 1.0,
    match_score: 100,
    status: 'pending',
    matched_by: 'system',
    ...cleanMatchData,
  };

  const { data, error } = await supabase
    .from('vmp_soa_matches')
    .insert(defaultMatch)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Valid discrepancy types per migration 031_vmp_soa_tables.sql
 */
export const DISCREPANCY_TYPES = {
  AMOUNT_MISMATCH: 'amount_mismatch',
  DATE_MISMATCH: 'date_mismatch',
  INVOICE_NOT_FOUND: 'invoice_not_found',
  DUPLICATE_INVOICE: 'duplicate_invoice',
  MISSING_SOA_ITEM: 'missing_soa_item',
  CURRENCY_MISMATCH: 'currency_mismatch',
  OTHER: 'other',
};

/**
 * Valid discrepancy severities
 */
export const DISCREPANCY_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Create SOA issue (discrepancy)
 */
export async function createTestSOAIssue(supabase, issueData = {}) {
  // Extract camelCase keys first
  const { caseId, soaItemId, ...cleanIssueData } = issueData;

  const defaultIssue = {
    case_id: caseId || issueData.case_id || null,
    soa_item_id: soaItemId || issueData.soa_item_id || null,
    discrepancy_type: DISCREPANCY_TYPES.AMOUNT_MISMATCH,
    severity: DISCREPANCY_SEVERITIES.MEDIUM,
    description: 'Test discrepancy',
    status: 'open',
    ...cleanIssueData,
  };

  const { data, error } = await supabase
    .from('vmp_soa_discrepancies')
    .insert(defaultIssue)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Setup SOA test data (reduces "Setup Wall" pattern)
 * 
 * Creates all common SOA test data in one call:
 * - Vendor
 * - User
 * - SOA Case
 * - SOA Line
 * - Invoice
 * - Match
 * - Issue
 * 
 * @param {object} supabase - Supabase client
 * @param {object} options - Optional overrides
 * @returns {Promise<object>} Test data object
 */
export async function setupSOATestData(supabase, options = {}) {
  const vendor = await createTestVendor(supabase, options.vendorData);
  const user = await createTestUser(supabase, {
    vendor_id: vendor.id,
    ...options.userData,
  });
  const soaCase = await createTestSOACase(supabase, {
    vendorId: vendor.id,
    ...options.caseData,
  });
  const soaLine = await createTestSOALine(supabase, {
    caseId: soaCase.id,
    vendorId: vendor.id,
    ...options.lineData,
  });
  const invoice = await createTestInvoice(supabase, {
    vendorId: vendor.id,
    ...options.invoiceData,
  });
  const match = await createTestSOAMatch(supabase, {
    soaItemId: soaLine.id,
    invoiceId: invoice.id,
    ...options.matchData,
  });
  const issue = await createTestSOAIssue(supabase, {
    caseId: soaCase.id,
    soaItemId: soaLine.id,
    ...options.issueData,
  });

  return {
    vendor,
    user,
    soaCase,
    soaLine,
    invoice,
    match,
    issue,
  };
}

/**
 * Setup basic server test data (reduces "Setup Wall" pattern)
 * 
 * Creates common server test data:
 * - Vendor
 * - User
 * - Case
 * 
 * @param {object} supabase - Supabase client
 * @param {object} options - Optional overrides
 * @returns {Promise<object>} Test data object
 */
export async function setupServerTestData(supabase, options = {}) {
  const vendor = await createTestVendor(supabase, options.vendorData);
  const user = await createTestUser(supabase, {
    vendor_id: vendor.id,
    ...options.userData,
  });
  const testCase = await createTestCase(supabase, {
    vendor_id: vendor.id,
    ...options.caseData,
  });

  return {
    vendor,
    user,
    case: testCase,
  };
}

/**
 * Cleanup SOA test data
 * 
 * Cleans up all SOA-related test data in correct order
 * 
 * @param {object} supabase - Supabase client
 * @param {object} data - Test data object from setupSOATestData
 */
export async function cleanupSOATestData(supabase, data) {
  if (data.issue) {
    await cleanupTestData(supabase, 'vmp_soa_discrepancies', { id: data.issue.id });
  }
  if (data.match) {
    await cleanupTestData(supabase, 'vmp_soa_matches', { id: data.match.id });
  }
  if (data.soaLine) {
    await cleanupTestData(supabase, 'vmp_soa_items', { id: data.soaLine.id });
  }
  if (data.invoice) {
    await cleanupTestData(supabase, 'vmp_invoices', { id: data.invoice.id });
  }
  if (data.soaCase) {
    await cleanupTestData(supabase, 'vmp_cases', { id: data.soaCase.id });
  }
  if (data.user) {
    await cleanupTestData(supabase, 'vmp_vendor_users', { id: data.user.id });
  }
  if (data.vendor) {
    await cleanupTestData(supabase, 'vmp_vendors', { id: data.vendor.id });
  }
}

/**
 * Cleanup server test data
 * 
 * Cleans up basic server test data
 * 
 * @param {object} supabase - Supabase client
 * @param {object} data - Test data object from setupServerTestData
 */
export async function cleanupServerTestData(supabase, data) {
  if (data.case) {
    await cleanupTestData(supabase, 'vmp_cases', { id: data.case.id });
  }
  if (data.user) {
    await cleanupTestData(supabase, 'vmp_vendor_users', { id: data.user.id });
  }
  if (data.vendor) {
    await cleanupTestData(supabase, 'vmp_vendors', { id: data.vendor.id });
  }
}
