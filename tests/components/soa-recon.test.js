/**
 * SOA Reconciliation Component Tests
 *
 * Tests all SOA reconciliation components, paths, and workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestSupabaseClient,
  createTestUser,
  createTestVendor,
  createTestCase,
  cleanupTestData,
} from '../setup/test-helpers.js';

describe('SOA Reconciliation Components', () => {
  let supabase;
  let testVendor;
  let testUser;
  let testCase;

  beforeEach(async () => {
    supabase = createTestSupabaseClient();

    // Create test data
    testVendor = await createTestVendor(supabase);
    testUser = await createTestUser(supabase, { vendor_id: testVendor.id });
    testCase = await createTestCase(supabase, {
      vendor_id: testVendor.id,
      case_type: 'soa',
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData(supabase, 'vmp_soa_items', { case_id: testCase.id });
    await cleanupTestData(supabase, 'vmp_soa_matches', {});
    await cleanupTestData(supabase, 'vmp_soa_discrepancies', { case_id: testCase.id });
    await cleanupTestData(supabase, 'vmp_cases', { id: testCase.id });
    await cleanupTestData(supabase, 'vmp_vendor_users', { id: testUser.id });
    await cleanupTestData(supabase, 'vmp_vendors', { id: testVendor.id });
  });

  describe('SOA Items', () => {
    it('should create SOA item', async () => {
      const { data, error } = await supabase
        .from('vmp_soa_items')
        .insert({
          case_id: testCase.id,
          vendor_id: testVendor.id,
          company_id: testCase.company_id,
          invoice_number: 'INV-001',
          invoice_date: '2025-01-01',
          amount: 1000.0,
          currency_code: 'USD',
          status: 'extracted',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.invoice_number).toBe('INV-001');
      expect(data.amount).toBe(1000.0);
    });

    it('should update SOA item status', async () => {
      // Create item
      const { data: item } = await supabase
        .from('vmp_soa_items')
        .insert({
          case_id: testCase.id,
          vendor_id: testVendor.id,
          company_id: testCase.company_id,
          invoice_number: 'INV-002',
          amount: 2000.0,
          status: 'extracted',
        })
        .select()
        .single();

      // Update status
      const { data, error } = await supabase
        .from('vmp_soa_items')
        .update({ status: 'matched' })
        .eq('id', item.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('matched');
    });
  });

  describe('SOA Matches', () => {
    it('should create SOA match', async () => {
      // Create SOA item
      const { data: soaItem } = await supabase
        .from('vmp_soa_items')
        .insert({
          case_id: testCase.id,
          vendor_id: testVendor.id,
          company_id: testCase.company_id,
          invoice_number: 'INV-003',
          amount: 3000.0,
          status: 'extracted',
        })
        .select()
        .single();

      // Create invoice (shadow ledger)
      const { data: invoice } = await supabase
        .from('vmp_invoices')
        .insert({
          vendor_id: testVendor.id,
          invoice_number: 'INV-003',
          total_amount: 3000.0,
          company_id: testCase.company_id,
          currency_code: 'USD',
          invoice_date: '2025-01-01',
          status: 'pending',
        })
        .select()
        .single();

      // Create match
      const { data, error } = await supabase
        .from('vmp_soa_matches')
        .insert({
          soa_item_id: soaItem.id,
          invoice_id: invoice.id,
          match_type: 'deterministic',
          is_exact_match: true,
          match_confidence: 1.0,
          status: 'confirmed',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.is_exact_match).toBe(true);
      expect(data.match_confidence).toBe(1.0);
    });
  });

  describe('SOA Discrepancies', () => {
    it('should create SOA discrepancy', async () => {
      // Create SOA item
      const { data: soaItem } = await supabase
        .from('vmp_soa_items')
        .insert({
          case_id: testCase.id,
          vendor_id: testVendor.id,
          company_id: testCase.company_id,
          invoice_number: 'INV-004',
          amount: 4000.0,
          status: 'extracted',
        })
        .select()
        .single();

      // Create discrepancy
      const { data, error } = await supabase
        .from('vmp_soa_discrepancies')
        .insert({
          case_id: testCase.id,
          soa_item_id: soaItem.id,
          discrepancy_type: 'amount_mismatch',
          severity: 'high',
          description: 'Amount mismatch detected',
          difference_amount: 500.0,
          status: 'open',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.discrepancy_type).toBe('amount_mismatch');
      expect(data.status).toBe('open');
    });

    it('should resolve SOA discrepancy', async () => {
      // Create discrepancy
      const { data: discrepancy } = await supabase
        .from('vmp_soa_discrepancies')
        .insert({
          case_id: testCase.id,
          discrepancy_type: 'amount_mismatch',
          status: 'open',
          severity: 'medium',
          description: 'Amount mismatch to resolve',
        })
        .select()
        .single();

      // Resolve discrepancy
      const { data, error } = await supabase
        .from('vmp_soa_discrepancies')
        .update({
          status: 'resolved',
          resolution_action: 'corrected',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', discrepancy.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('resolved');
      expect(data.resolution_action).toBe('corrected');
    });
  });

  describe('Debit Notes', () => {
    it('should create debit note proposal', async () => {
      // Create discrepancy
      const { data: discrepancy } = await supabase
        .from('vmp_soa_discrepancies')
        .insert({
          case_id: testCase.id,
          discrepancy_type: 'amount_mismatch',
          status: 'open',
          severity: 'medium',
          description: 'Overpayment discrepancy',
        })
        .select()
        .single();

      // Create DN proposal
      const { data, error } = await supabase
        .from('vmp_debit_notes')
        .insert({
          vendor_id: testVendor.id,
          soa_statement_id: testCase.id,
          soa_issue_id: discrepancy.id,
          dn_no: 'DN-2025-001',
          amount: 500.0,
          reason_code: 'OVERPAYMENT',
          status: 'DRAFT',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.status).toBe('DRAFT');
      expect(data.reason_code).toBe('OVERPAYMENT');
    });

    it('should approve debit note', async () => {
      // Create DN
      const { data: dn } = await supabase
        .from('vmp_debit_notes')
        .insert({
          vendor_id: testVendor.id,
          soa_statement_id: testCase.id,
          dn_no: 'DN-2025-002',
          amount: 600.0,
          reason_code: 'PRICE_VARIANCE',
          status: 'DRAFT',
        })
        .select()
        .single();

      // Approve DN
      const { data, error } = await supabase
        .from('vmp_debit_notes')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
        })
        .eq('id', dn.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('APPROVED');
    });

    it('should post debit note to ledger', async () => {
      // Create and approve DN
      const { data: dn } = await supabase
        .from('vmp_debit_notes')
        .insert({
          vendor_id: testVendor.id,
          soa_statement_id: testCase.id,
          dn_no: 'DN-2025-003',
          amount: 700.0,
          reason_code: 'WHT',
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Post DN
      const { data, error } = await supabase
        .from('vmp_debit_notes')
        .update({
          status: 'POSTED',
          posted_at: new Date().toISOString(),
          ledger_posted_at: new Date().toISOString(),
        })
        .eq('id', dn.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('POSTED');
      expect(data.posted_at).toBeDefined();
    });
  });
});
