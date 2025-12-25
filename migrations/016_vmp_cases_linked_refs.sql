-- Migration: VMP Cases Linked References
-- Created: 2025-12-21
-- Description: Adds linked reference fields to vmp_cases for invoice/PO/GRN/payment linking
-- Purpose: Enable case-to-transaction linking for transparency and traceability

-- ============================================================================
-- ADD LINKED REFERENCE FIELDS TO CASES
-- ============================================================================
ALTER TABLE vmp_cases
    ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES vmp_invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linked_po_id UUID REFERENCES vmp_po_refs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linked_grn_id UUID REFERENCES vmp_grn_refs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linked_payment_id UUID; -- Will reference vmp_payments in Sprint 4

COMMENT ON COLUMN vmp_cases.linked_invoice_id IS 'Links case to invoice in Shadow Ledger (for invoice cases)';
COMMENT ON COLUMN vmp_cases.linked_po_id IS 'Links case to Purchase Order reference (for matching issues)';
COMMENT ON COLUMN vmp_cases.linked_grn_id IS 'Links case to Goods Receipt Note reference (for matching issues)';
COMMENT ON COLUMN vmp_cases.linked_payment_id IS 'Links case to payment record (will reference vmp_payments in Sprint 4)';

-- ============================================================================
-- INDEXES FOR LINKED REFERENCES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_cases_linked_invoice_id ON vmp_cases(linked_invoice_id) WHERE linked_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_cases_linked_po_id ON vmp_cases(linked_po_id) WHERE linked_po_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_cases_linked_grn_id ON vmp_cases(linked_grn_id) WHERE linked_grn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_cases_linked_payment_id ON vmp_cases(linked_payment_id) WHERE linked_payment_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE vmp_cases IS 'Case management with linked references to invoices, POs, GRNs, and payments for full traceability';

