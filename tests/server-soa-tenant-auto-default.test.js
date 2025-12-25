/**
 * SOA Upload Tenant Auto-Default Smoke Test
 *
 * Tests the tenant_id auto-defaulting functionality when uploading SOA files.
 * Verifies:
 * 1. Tenant ID is automatically defaulted from logged-in user
 * 2. Company is auto-selected if only one exists
 * 3. Company selection is required if multiple companies exist
 * 4. Fallback tenant_id retrieval from company if not available from user
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
  createTestTenant,
  createTestCompany,
  cleanupTestData,
} from './setup/test-helpers.js';

describe('SOA Upload - Tenant Auto-Default Smoke Test', () => {
  let supabase;
  let testTenant;
  let testVendor;
  let testUser;
  let testCompany1;
  let testCompany2;
  let testSession;
  let authHeaders;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    supabase = createTestSupabaseClient();

    // Create test tenant
    testTenant = await createTestTenant(supabase, {
      name: `Test Tenant ${Date.now()}`,
    });

    // Create test vendor with tenant_id
    testVendor = await createTestVendor(supabase, {
      tenant_id: testTenant.id,
      name: `Test Vendor ${Date.now()}`,
    });

    // Create test user
    testUser = await createTestUser(supabase, {
      vendor_id: testVendor.id,
    });

    // Create test companies
    testCompany1 = await createTestCompany(supabase, {
      tenant_id: testTenant.id,
      name: `Test Company 1 ${Date.now()}`,
    });

    testCompany2 = await createTestCompany(supabase, {
      tenant_id: testTenant.id,
      name: `Test Company 2 ${Date.now()}`,
    });

    // Link vendor to companies
    await supabase.from('vmp_vendor_company_links').insert([
      {
        vendor_id: testVendor.id,
        company_id: testCompany1.id,
        status: 'active',
      },
      {
        vendor_id: testVendor.id,
        company_id: testCompany2.id,
        status: 'active',
      },
    ]);

    // Create test session
    testSession = await createTestSession(testUser.id, testVendor.id);
    authHeaders = getTestAuthHeaders(testUser.id, testVendor.id, testTenant.id);
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData(supabase, 'vmp_vendor_company_links', { vendor_id: testVendor?.id });
    if (testCompany2) await cleanupTestData(supabase, 'vmp_companies', { id: testCompany2.id });
    if (testCompany1) await cleanupTestData(supabase, 'vmp_companies', { id: testCompany1.id });
    if (testUser) await cleanupTestData(supabase, 'vmp_vendor_users', { id: testUser.id });
    if (testVendor) await cleanupTestData(supabase, 'vmp_vendors', { id: testVendor.id });
    if (testTenant) await cleanupTestData(supabase, 'vmp_tenants', { id: testTenant.id });
    if (testSession?.sessionId) {
      try {
        await vmpAdapter.deleteSession(testSession.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // Test 1: Tenant ID Auto-Defaulted from User
  // ============================================================================

  test('should auto-default tenant_id from logged-in user vendor', async () => {
    // Create a minimal CSV file
    const csvContent = `Invoice #,Date,Amount,Currency,Type
INV-001,2024-01-15,1000.00,USD,INV
INV-002,2024-01-16,2000.00,USD,INV`;

    // Mock the adapter to capture tenant_id
    const originalIngest = vmpAdapter.ingestSOAFromCSV;
    let capturedTenantId = null;

    vmpAdapter.ingestSOAFromCSV = vi.fn(async (...args) => {
      capturedTenantId = args[5]; // tenantId is the 6th parameter
      return originalIngest.apply(vmpAdapter, args);
    });

    // Remove one company link so only one company exists (auto-select)
    await supabase.from('vmp_vendor_company_links').delete().eq('company_id', testCompany2.id);

    const response = await request(app)
      .post('/api/soa/ingest')
      .set(authHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'test-soa.csv',
        contentType: 'text/csv',
      })
      .field('period_start', '2024-01-01')
      .field('period_end', '2024-01-31');

    // Verify tenant_id was captured from user
    expect(capturedTenantId).toBe(testTenant.id);

    // Restore original method
    vmpAdapter.ingestSOAFromCSV = originalIngest;
  });

  // ============================================================================
  // Test 2: Auto-Select Company if Only One
  // ============================================================================

  test('should auto-select company if vendor has only one company', async () => {
    // Remove one company link so only one company exists
    await supabase.from('vmp_vendor_company_links').delete().eq('company_id', testCompany2.id);

    const csvContent = `Invoice #,Date,Amount,Currency,Type
INV-001,2024-01-15,1000.00,USD,INV`;

    // Mock the adapter to capture company_id
    const originalIngest = vmpAdapter.ingestSOAFromCSV;
    let capturedCompanyId = null;

    vmpAdapter.ingestSOAFromCSV = vi.fn(async (...args) => {
      capturedCompanyId = args[2]; // companyId is the 3rd parameter
      return originalIngest.apply(vmpAdapter, args);
    });

    const response = await request(app)
      .post('/api/soa/ingest')
      .set(authHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'test-soa.csv',
        contentType: 'text/csv',
      })
      .field('period_start', '2024-01-01')
      .field('period_end', '2024-01-31');

    // Should not require company selection
    expect(response.statusCode).not.toBe(400);
    expect(response.body).not.toHaveProperty('requiresCompanySelection');

    // Verify company was auto-selected
    expect(capturedCompanyId).toBe(testCompany1.id);

    // Restore original method
    vmpAdapter.ingestSOAFromCSV = originalIngest;
  });

  // ============================================================================
  // Test 3: Require Company Selection if Multiple Companies
  // ============================================================================

  test('should require company selection if vendor has multiple companies', async () => {
    // Ensure both companies are linked
    const csvContent = `Invoice #,Date,Amount,Currency,Type
INV-001,2024-01-15,1000.00,USD,INV`;

    const response = await request(app)
      .post('/api/soa/ingest')
      .set(authHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'test-soa.csv',
        contentType: 'text/csv',
      })
      .field('period_start', '2024-01-01')
      .field('period_end', '2024-01-31');

    // Should require company selection
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('requiresCompanySelection', true);
    expect(response.body).toHaveProperty('companies');
    expect(Array.isArray(response.body.companies)).toBe(true);
    expect(response.body.companies.length).toBe(2);

    // Verify companies list includes both companies
    const companyIds = response.body.companies.map(c => c.id);
    expect(companyIds).toContain(testCompany1.id);
    expect(companyIds).toContain(testCompany2.id);
  });

  // ============================================================================
  // Test 4: Accept Company Selection if Provided
  // ============================================================================

  test('should accept company_id if provided when multiple companies exist', async () => {
    const csvContent = `Invoice #,Date,Amount,Currency,Type
INV-001,2024-01-15,1000.00,USD,INV`;

    // Mock the adapter to capture company_id
    const originalIngest = vmpAdapter.ingestSOAFromCSV;
    let capturedCompanyId = null;

    vmpAdapter.ingestSOAFromCSV = vi.fn(async (...args) => {
      capturedCompanyId = args[2]; // companyId is the 3rd parameter
      return originalIngest.apply(vmpAdapter, args);
    });

    const response = await request(app)
      .post('/api/soa/ingest')
      .set(authHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'test-soa.csv',
        contentType: 'text/csv',
      })
      .field('period_start', '2024-01-01')
      .field('period_end', '2024-01-31')
      .field('company_id', testCompany2.id);

    // Should not require company selection
    expect(response.statusCode).not.toBe(400);
    expect(response.body).not.toHaveProperty('requiresCompanySelection');

    // Verify provided company was used
    expect(capturedCompanyId).toBe(testCompany2.id);

    // Restore original method
    vmpAdapter.ingestSOAFromCSV = originalIngest;
  });

  // ============================================================================
  // Test 5: Fallback Tenant ID from Company
  // ============================================================================

  test('should fallback to company tenant_id if not available from user', async () => {
    // Create vendor without tenant_id
    const vendorWithoutTenant = await createTestVendor(supabase, {
      name: `Test Vendor No Tenant ${Date.now()}`,
      // No tenant_id set
    });

    // Create user for this vendor
    const userWithoutTenant = await createTestUser(supabase, {
      vendor_id: vendorWithoutTenant.id,
    });

    // Create session for this user
    const sessionWithoutTenant = await createTestSession(
      userWithoutTenant.id,
      vendorWithoutTenant.id
    );
    // Don't pass tenant_id in headers to test fallback
    const headersWithoutTenant = getTestAuthHeaders(userWithoutTenant.id, vendorWithoutTenant.id);

    // Link vendor to company (company has tenant_id)
    await supabase.from('vmp_vendor_company_links').insert({
      vendor_id: vendorWithoutTenant.id,
      company_id: testCompany1.id,
      status: 'active',
    });

    const csvContent = `Invoice #,Date,Amount,Currency,Type
INV-001,2024-01-15,1000.00,USD,INV`;

    // Mock the adapter to capture tenant_id
    const originalIngest = vmpAdapter.ingestSOAFromCSV;
    let capturedTenantId = null;

    vmpAdapter.ingestSOAFromCSV = vi.fn(async (...args) => {
      capturedTenantId = args[5]; // tenantId is the 6th parameter
      return originalIngest.apply(vmpAdapter, args);
    });

    const response = await request(app)
      .post('/api/soa/ingest')
      .set(headersWithoutTenant)
      .attach('file', Buffer.from(csvContent), {
        filename: 'test-soa.csv',
        contentType: 'text/csv',
      })
      .field('period_start', '2024-01-01')
      .field('period_end', '2024-01-31');

    // Verify tenant_id was retrieved from company (fallback)
    expect(capturedTenantId).toBe(testTenant.id);

    // Cleanup
    await cleanupTestData(supabase, 'vmp_vendor_company_links', {
      vendor_id: vendorWithoutTenant.id,
    });
    await cleanupTestData(supabase, 'vmp_vendor_users', { id: userWithoutTenant.id });
    await cleanupTestData(supabase, 'vmp_vendors', { id: vendorWithoutTenant.id });
    if (sessionWithoutTenant?.sessionId) {
      try {
        await vmpAdapter.deleteSession(sessionWithoutTenant.sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Restore original method
    vmpAdapter.ingestSOAFromCSV = originalIngest;
  });
});
