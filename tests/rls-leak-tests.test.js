/**
 * RLS Leak Test Suite
 * 
 * Tests that Row-Level Security (RLS) policies enforce:
 * 1. Vendor Isolation: Vendor A cannot access Vendor B data
 * 2. Tenant Isolation: Tenant A cannot access Tenant B data
 * 3. Cascade Security: Messages/evidence inherit case access control
 * 4. Anti-Enumeration: Guessed UUIDs return empty results (not 403)
 * 
 * These tests validate "Tenant Isolation Is Absolute" principle.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Test fixtures (replace with actual test data)
const VENDOR_A_USER_EMAIL = 'vendor-a@test.com';
const VENDOR_A_USER_PASSWORD = 'test-password-a';
const VENDOR_B_USER_EMAIL = 'vendor-b@test.com';
const VENDOR_B_USER_PASSWORD = 'test-password-b';

let vendorAClient;
let vendorBClient;
let vendorACaseId;
let vendorBCaseId;

/**
 * Helper: Create authenticated Supabase client for a user
 */
async function createAuthenticatedClient(email, password) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(`Failed to authenticate ${email}: ${error.message}`);
  }

  return supabase;
}

beforeAll(async () => {
  // Setup: Authenticate test users
  vendorAClient = await createAuthenticatedClient(VENDOR_A_USER_EMAIL, VENDOR_A_USER_PASSWORD);
  vendorBClient = await createAuthenticatedClient(VENDOR_B_USER_EMAIL, VENDOR_B_USER_PASSWORD);

  // Get a case ID for each vendor
  const { data: vendorACases } = await vendorAClient.from('vmp_cases').select('id').limit(1);
  const { data: vendorBCases } = await vendorBClient.from('vmp_cases').select('id').limit(1);

  vendorACaseId = vendorACases?.[0]?.id;
  vendorBCaseId = vendorBCases?.[0]?.id;

  if (!vendorACaseId || !vendorBCaseId) {
    throw new Error('Test setup failed: Need at least one case per vendor');
  }
});

afterAll(async () => {
  // Cleanup: Sign out
  await vendorAClient.auth.signOut();
  await vendorBClient.auth.signOut();
});

// =============================================================================
// TEST SUITE 1: VENDOR ISOLATION
// =============================================================================

describe('RLS: Vendor Isolation', () => {
  it('prevents vendor A from reading vendor B cases', async () => {
    const { data, error } = await vendorAClient
      .from('vmp_cases')
      .select('*')
      .eq('id', vendorBCaseId)
      .single();

    // RLS should return null (not found), NOT an error
    expect(data).toBeNull();
    expect(error).toBeTruthy(); // Supabase returns error for empty .single()
  });

  it('prevents vendor A from reading vendor B messages', async () => {
    const { data } = await vendorAClient
      .from('vmp_messages')
      .select('*')
      .eq('case_id', vendorBCaseId);

    // RLS should return empty array
    expect(data).toEqual([]);
  });

  it('prevents vendor A from reading vendor B evidence', async () => {
    const { data } = await vendorAClient
      .from('vmp_evidence')
      .select('*')
      .eq('case_id', vendorBCaseId);

    expect(data).toEqual([]);
  });

  it('prevents vendor A from updating vendor B cases', async () => {
    const { data, error } = await vendorAClient
      .from('vmp_cases')
      .update({ status: 'hijacked' })
      .eq('id', vendorBCaseId)
      .select();

    // RLS should block update
    expect(data).toEqual([]);
  });

  it('prevents vendor A from inserting messages to vendor B cases', async () => {
    const { data, error } = await vendorAClient
      .from('vmp_messages')
      .insert({
        case_id: vendorBCaseId,
        sender_type: 'vendor',
        body: 'Unauthorized message',
        channel_source: 'web'
      })
      .select();

    // RLS should block insert
    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });
});

// =============================================================================
// TEST SUITE 2: TENANT ISOLATION
// =============================================================================

describe('RLS: Tenant Isolation', () => {
  it('prevents reading companies from other tenants', async () => {
    // Get vendor A's tenant_id
    const { data: vendorAData } = await vendorAClient
      .from('vmp_vendors')
      .select('tenant_id')
      .limit(1)
      .single();

    const vendorATenantId = vendorAData?.tenant_id;

    // Try to read ALL companies (should only see own tenant)
    const { data: companies } = await vendorAClient
      .from('vmp_companies')
      .select('tenant_id');

    // All returned companies should be in vendor A's tenant
    const otherTenantCompanies = companies.filter(c => c.tenant_id !== vendorATenantId);
    expect(otherTenantCompanies).toEqual([]);
  });

  it('prevents reading vendors from other tenants', async () => {
    const { data: vendorAData } = await vendorAClient
      .from('vmp_vendors')
      .select('tenant_id')
      .limit(1)
      .single();

    const vendorATenantId = vendorAData?.tenant_id;

    // Try to read ALL vendors
    const { data: vendors } = await vendorAClient
      .from('vmp_vendors')
      .select('tenant_id');

    // All returned vendors should be in vendor A's tenant
    const otherTenantVendors = vendors.filter(v => v.tenant_id !== vendorATenantId);
    expect(otherTenantVendors).toEqual([]);
  });
});

// =============================================================================
// TEST SUITE 3: CASCADE SECURITY (Messages/Evidence inherit case access)
// =============================================================================

describe('RLS: Cascade Security', () => {
  it('allows reading messages for accessible cases', async () => {
    const { data } = await vendorAClient
      .from('vmp_messages')
      .select('*')
      .eq('case_id', vendorACaseId);

    // Should be able to read own messages
    expect(data).toBeDefined();
  });

  it('blocks reading messages for inaccessible cases', async () => {
    const { data } = await vendorAClient
      .from('vmp_messages')
      .select('*')
      .eq('case_id', vendorBCaseId);

    // Should NOT be able to read vendor B's messages
    expect(data).toEqual([]);
  });

  it('allows uploading evidence for accessible cases', async () => {
    const { data, error } = await vendorAClient
      .from('vmp_evidence')
      .insert({
        case_id: vendorACaseId,
        file_name: 'test-evidence.pdf',
        storage_path: '/test/path.pdf',
        uploaded_by_user_id: vendorACaseId // Use any UUID for test
      })
      .select();

    // Should succeed
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // Cleanup
    if (data?.[0]?.id) {
      await vendorAClient.from('vmp_evidence').delete().eq('id', data[0].id);
    }
  });

  it('blocks uploading evidence for inaccessible cases', async () => {
    const { data, error } = await vendorAClient
      .from('vmp_evidence')
      .insert({
        case_id: vendorBCaseId,
        file_name: 'unauthorized.pdf',
        storage_path: '/test/path.pdf',
        uploaded_by_user_id: vendorACaseId
      })
      .select();

    // Should fail
    expect(error).toBeTruthy();
  });
});

// =============================================================================
// TEST SUITE 4: ANTI-ENUMERATION (No 403 leaks)
// =============================================================================

describe('RLS: Anti-Enumeration', () => {
  it('returns empty result for unknown case IDs (not 403)', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await vendorAClient
      .from('vmp_cases')
      .select('*')
      .eq('id', fakeUuid)
      .single();

    // Should return null (not found), not permission error
    expect(data).toBeNull();
    // Error code should be PGRST116 (not found), not 403
    expect(error?.code).not.toBe('403');
  });

  it('returns empty array for unauthorized filters', async () => {
    const { data } = await vendorAClient
      .from('vmp_cases')
      .select('*')
      .eq('vendor_id', '00000000-0000-0000-0000-000000000000');

    // Should return empty array, not error
    expect(data).toEqual([]);
  });
});

// =============================================================================
// TEST SUITE 5: HELPER FUNCTION CORRECTNESS
// =============================================================================

describe('RLS: Helper Functions', () => {
  it('get_user_vendor_id returns correct vendor_id', async () => {
    const { data } = await vendorAClient
      .rpc('get_user_vendor_id');

    expect(data).toBeTruthy();
    expect(typeof data).toBe('string'); // UUID
  });

  it('get_user_company_ids returns array of company UUIDs', async () => {
    const { data } = await vendorAClient
      .rpc('get_user_company_ids');

    expect(Array.isArray(data)).toBe(true);
    // Should have at least one company
    expect(data.length).toBeGreaterThan(0);
  });

  it('can_access_case returns true for own cases', async () => {
    const { data } = await vendorAClient
      .rpc('can_access_case', { p_case_id: vendorACaseId });

    expect(data).toBe(true);
  });

  it('can_access_case returns false for other vendor cases', async () => {
    const { data } = await vendorAClient
      .rpc('can_access_case', { p_case_id: vendorBCaseId });

    expect(data).toBe(false);
  });
});
