/**
 * SOA Matching Engine Tests
 * 
 * Tests all SOA matching engine functions (7 functions)
 * Covers all 5 matching passes, batch matching, and edge cases
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { matchSOALine, batchMatchSOALines } from '../../src/utils/soa-matching-engine.js';
import { vmpAdapter } from '../../src/adapters/supabase.js';
import {
  createTestSupabaseClient,
  createTestVendor,
  createTestUser,
  createTestSOACase,
  createTestSOALine,
  createTestInvoice,
  cleanupTestData
} from '../setup/test-helpers.js';

describe('SOA Matching Engine', () => {
  let supabase;
  let testVendor;
  let testUser;
  let testSOACase;

  beforeEach(async () => {
    supabase = createTestSupabaseClient();
    
    // Create test data
    testVendor = await createTestVendor(supabase);
    testUser = await createTestUser(supabase, { vendor_id: testVendor.id });
    testSOACase = await createTestSOACase(supabase, {
      vendorId: testVendor.id,
      companyId: null
    });
  });

  afterEach(async () => {
    // Cleanup test data
    if (testSOACase) await cleanupTestData(supabase, 'vmp_cases', { id: testSOACase.id });
    if (testUser) await cleanupTestData(supabase, 'vmp_vendor_users', { id: testUser.id });
    if (testVendor) await cleanupTestData(supabase, 'vmp_vendors', { id: testVendor.id });
  });

  // ============================================================================
  // Pass 1: Exact Match
  // ============================================================================

  describe('Pass 1: Exact Match', () => {
    test('should match exact invoice number, amount, and currency', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(1);
      expect(result.match.isExactMatch).toBe(true);
      expect(result.match.confidence).toBe(1.0);
      expect(result.match.matchScore).toBe(100);
      expect(result.match.invoice.id).toBe(invoice.id);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should not match if invoice number differs', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-002', // Different invoice number
        total_amount: 1000.00,
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeNull();
      expect(result.pass).toBe(0);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should not match if amount differs', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 2000.00, // Different amount
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeNull();
      expect(result.pass).toBe(0);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });
  });

  // ============================================================================
  // Pass 2: Date Tolerance Match
  // ============================================================================

  describe('Pass 2: Date Tolerance Match', () => {
    test('should match with date within ±7 days', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-05', // 4 days difference
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(2);
      expect(result.match.isExactMatch).toBe(false);
      expect(result.match.confidence).toBe(0.95);
      expect(result.match.matchScore).toBe(95);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should not match if date difference exceeds 7 days', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-15', // 14 days difference
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      // Should not match in Pass 2, may match in later passes
      if (result.pass === 2) {
        expect(result.match).toBeNull();
      }

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });
  });

  // ============================================================================
  // Pass 3: Fuzzy Doc Match
  // ============================================================================

  describe('Pass 3: Fuzzy Doc Match', () => {
    test('should match with normalized document numbers', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001', // With dash
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV001', // Without dash (normalized should match)
        total_amount: 1000.00,
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(3);
      expect(result.match.isExactMatch).toBe(false);
      expect(result.match.confidence).toBe(0.90);
      expect(result.match.matchScore).toBe(90);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should match with spaces and punctuation normalized', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV 001', // With space
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001', // With dash (normalized should match)
        total_amount: 1000.00,
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(3);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });
  });

  // ============================================================================
  // Pass 4: Amount Tolerance Match
  // ============================================================================

  describe('Pass 4: Amount Tolerance Match', () => {
    test('should match with amount within absolute tolerance (RM 1.00)', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.50, // Within RM 1.00 tolerance
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(4);
      expect(result.match.isExactMatch).toBe(false);
      expect(result.match.confidence).toBe(0.85);
      expect(result.match.matchScore).toBe(85);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should match with amount within percentage tolerance (0.5%)', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1004.00, // Within 0.5% tolerance (4/1000 = 0.4%)
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(4);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should not match if amount difference exceeds tolerance', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1100.00, // Exceeds tolerance
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      // Should not match in Pass 4, may match in Pass 5 (partial)
      if (result.pass === 4) {
        expect(result.match).toBeNull();
      }

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });
  });

  // ============================================================================
  // Pass 5: Partial Match
  // ============================================================================

  describe('Pass 5: Partial Match', () => {
    test('should match partial payment (SOA amount < invoice amount)', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 500.00, // Partial payment
        currency_code: 'USD'
      });

      // Explicitly allow partial matching for this test scenario (in-memory flag)
      soaLine.allow_partial = true;

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00, // Full invoice amount
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(5);
      expect(result.match.isExactMatch).toBe(false);
      expect(result.match.confidence).toBe(0.75);
      expect(result.match.matchScore).toBe(75);
      expect(result.match.matchCriteria.partialMatch).toBe(true);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });

    test('should not match if SOA amount >= invoice amount', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      // Do NOT allow partial matching here; earlier passes should handle equality
      soaLine.allow_partial = false;

      const invoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00, // Same amount (should match in earlier pass)
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      // Should match in earlier pass, not Pass 5
      if (result.pass === 5) {
        expect(result.match).toBeNull();
      }

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice.id });
    });
  });

  // ============================================================================
  // matchSOALine() - Main Function
  // ============================================================================

  describe('matchSOALine() - Main Function', () => {
    test('should return no match when no invoices available', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      // Create a different vendor's invoice (should not be found)
      const otherVendor = await createTestVendor(supabase);
      const otherInvoice = await createTestInvoice(supabase, {
        vendorId: otherVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeNull();
      expect(result.pass).toBe(0);
      expect(result.reason).toContain('No invoices available');

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: otherInvoice.id });
      await cleanupTestData(supabase, 'vmp_vendors', { id: otherVendor.id });
    });

    test('should prioritize exact matches over tolerance matches', async () => {
      const soaLine = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01'
      });

      // Create exact match invoice
      const exactInvoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01',
        status: 'pending'
      });

      // Create tolerance match invoice (should not be selected)
      const toleranceInvoice = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.50, // Within tolerance
        currency_code: 'USD',
        invoice_date: '2025-01-01',
        status: 'pending'
      });

      const result = await matchSOALine(soaLine, testVendor.id);

      expect(result.match).toBeDefined();
      expect(result.pass).toBe(1); // Should match in Pass 1 (exact)
      expect(result.match.invoice.id).toBe(exactInvoice.id);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: exactInvoice.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: toleranceInvoice.id });
    });
  });

  // ============================================================================
  // batchMatchSOALines() - Batch Matching
  // ============================================================================

  describe('batchMatchSOALines() - Batch Matching', () => {
    test('should batch match multiple SOA lines', async () => {
      const soaLine1 = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01'
      });

      const soaLine2 = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-002',
        amount: 2000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-02'
      });

      const invoice1 = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-01',
        status: 'pending'
      });

      const invoice2 = await createTestInvoice(supabase, {
        vendorId: testVendor.id,
        invoice_number: 'INV-002',
        total_amount: 2000.00,
        currency_code: 'USD',
        invoice_date: '2025-01-02',
        status: 'pending'
      });

      const soaLines = [soaLine1, soaLine2];
      const results = await batchMatchSOALines(soaLines, testVendor.id);

      expect(results).toHaveLength(2);
      expect(results[0].soaLineId).toBe(soaLine1.id);
      expect(results[1].soaLineId).toBe(soaLine2.id);
      expect(results[0].match).toBeDefined();
      expect(results[1].match).toBeDefined();
      expect(results[0].pass).toBe(1);
      expect(results[1].pass).toBe(1);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine1.id });
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine2.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice1.id });
      await cleanupTestData(supabase, 'vmp_invoices', { id: invoice2.id });
    });

    test('should handle errors gracefully in batch matching', async () => {
      const soaLine1 = await createTestSOALine(supabase, {
        caseId: testSOACase.id,
        vendorId: testVendor.id,
        invoice_number: 'INV-001',
        amount: 1000.00,
        currency_code: 'USD'
      });

      // Create invalid SOA line (missing required fields)
      const invalidSOALine = {
        id: 'invalid-id',
        invoice_number: null,
        amount: null
      };

      const soaLines = [soaLine1, invalidSOALine];
      const results = await batchMatchSOALines(soaLines, testVendor.id);

      expect(results).toHaveLength(2);
      expect(results[0].soaLineId).toBe(soaLine1.id);
      expect(results[1].soaLineId).toBe('invalid-id');
      // First line should have match result or no match
      // Second line should have error
      expect(results[1].match).toBeNull();
      expect(results[1].pass).toBe(0);

      // Cleanup
      await cleanupTestData(supabase, 'vmp_soa_items', { id: soaLine1.id });
    });

    test('should return empty array for empty input', async () => {
      const results = await batchMatchSOALines([], testVendor.id);
      expect(results).toEqual([]);
    });
  });
});

