import { describe, test, expect } from 'vitest';
import {
  getChecklistStepsForCaseType,
  ensureChecklistSteps,
} from '../../src/utils/checklist-rules.js';

describe('Checklist Rules Engine', () => {
  // ============================================================================
  // getChecklistStepsForCaseType
  // ============================================================================

  describe('getChecklistStepsForCaseType', () => {
    test('should return steps for invoice case type', () => {
      const steps = getChecklistStepsForCaseType('invoice');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(3);

      expect(steps[0]).toHaveProperty('label');
      expect(steps[0]).toHaveProperty('required_evidence_type');
      expect(steps[0]).toHaveProperty('description');

      expect(steps[0].label).toBe('Upload Invoice PDF');
      expect(steps[0].required_evidence_type).toBe('invoice_pdf');

      expect(steps[1].label).toBe('Confirm PO Number');
      expect(steps[1].required_evidence_type).toBe('po_number');

      expect(steps[2].label).toBe('Upload Signed GRN');
      expect(steps[2].required_evidence_type).toBe('grn');
    });

    test('should return steps for payment case type', () => {
      const steps = getChecklistStepsForCaseType('payment');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(2);

      expect(steps[0].label).toBe('Upload Remittance Advice');
      expect(steps[0].required_evidence_type).toBe('remittance');

      expect(steps[1].label).toBe('Upload Bank Statement');
      expect(steps[1].required_evidence_type).toBe('bank_statement');
    });

    test('should return steps for onboarding case type', () => {
      const steps = getChecklistStepsForCaseType('onboarding');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(3);

      expect(steps[0].label).toBe('Company Registration Certificate');
      expect(steps[0].required_evidence_type).toBe('company_registration');

      expect(steps[1].label).toBe('Bank Letter / Account Details');
      expect(steps[1].required_evidence_type).toBe('bank_letter');

      expect(steps[2].label).toBe('Tax ID / VAT Certificate');
      expect(steps[2].required_evidence_type).toBe('tax_id');
    });

    test('should return steps for SOA case type', () => {
      const steps = getChecklistStepsForCaseType('soa');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(2);

      expect(steps[0].label).toBe('Upload SOA Document');
      expect(steps[0].required_evidence_type).toBe('soa_document');

      expect(steps[1].label).toBe('Reconciliation Report');
      expect(steps[1].required_evidence_type).toBe('reconciliation');
    });

    test('should return default steps for general case type', () => {
      const steps = getChecklistStepsForCaseType('general');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);

      expect(steps[0].label).toBe('Supporting Documentation');
      expect(steps[0].required_evidence_type).toBe('misc');
    });

    test('should return default steps for unknown case type', () => {
      const steps = getChecklistStepsForCaseType('unknown_type');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);
      expect(steps[0].label).toBe('Supporting Documentation');
    });

    test('should return default steps for null case type', () => {
      const steps = getChecklistStepsForCaseType(null);

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);
      expect(steps[0].label).toBe('Supporting Documentation');
    });

    test('should return default steps for undefined case type', () => {
      const steps = getChecklistStepsForCaseType(undefined);

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);
      expect(steps[0].label).toBe('Supporting Documentation');
    });

    test('should return default steps for empty string case type', () => {
      const steps = getChecklistStepsForCaseType('');

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);
      expect(steps[0].label).toBe('Supporting Documentation');
    });

    test('all steps should have required properties', () => {
      const caseTypes = ['invoice', 'payment', 'onboarding', 'soa', 'general'];

      caseTypes.forEach(caseType => {
        const steps = getChecklistStepsForCaseType(caseType);

        steps.forEach(step => {
          expect(step).toHaveProperty('label');
          expect(step).toHaveProperty('required_evidence_type');
          expect(step).toHaveProperty('description');

          expect(typeof step.label).toBe('string');
          expect(step.label.length).toBeGreaterThan(0);

          expect(typeof step.required_evidence_type).toBe('string');
          expect(step.required_evidence_type.length).toBeGreaterThan(0);

          expect(typeof step.description).toBe('string');
        });
      });
    });
  });

  // ============================================================================
  // ensureChecklistSteps
  // ============================================================================

  describe('ensureChecklistSteps', () => {
    test('should return step definitions', async () => {
      const steps = await ensureChecklistSteps('case-123', 'invoice', () => {});

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(3);
      expect(steps[0].label).toBe('Upload Invoice PDF');
    });

    test('should work with different case types', async () => {
      const invoiceSteps = await ensureChecklistSteps('case-123', 'invoice', () => {});
      const paymentSteps = await ensureChecklistSteps('case-123', 'payment', () => {});

      expect(invoiceSteps.length).toBe(3);
      expect(paymentSteps.length).toBe(2);
      expect(invoiceSteps[0].label).not.toBe(paymentSteps[0].label);
    });

    test('should return default steps for unknown case type', async () => {
      const steps = await ensureChecklistSteps('case-123', 'unknown', () => {});

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBe(1);
      expect(steps[0].label).toBe('Supporting Documentation');
    });
  });
});
