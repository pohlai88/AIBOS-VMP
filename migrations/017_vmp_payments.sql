-- Migration: VMP Payments (Shadow Ledger - Payment Visibility)
-- Created: 2025-12-21
-- Description: Creates payment table for manual/hybrid mode payment tracking and remittance management
-- Supports: CSV Ingest, Manual Mode, Hybrid Mode (ERP + Manual), Remittance PDF storage
-- Purpose: Enable supplier payment visibility ("Adoption Carrot")

-- ============================================================================
-- PAYMENTS (Shadow Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    payment_ref TEXT NOT NULL, -- Payment reference number (e.g., "PAY-2024-001")
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency_code TEXT NOT NULL DEFAULT 'USD',
    invoice_num TEXT, -- Linked invoice number (for matching)
    invoice_id UUID REFERENCES vmp_invoices(id) ON DELETE SET NULL, -- Direct link to invoice
    source_system TEXT NOT NULL DEFAULT 'manual' CHECK (source_system IN ('erp', 'manual')),
    erp_ref_id TEXT, -- ERP system reference (if synced from ERP)
    remittance_url TEXT, -- URL to remittance PDF in storage bucket
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique constraint: same payment reference per vendor+company
    UNIQUE (vendor_id, company_id, payment_ref)
);

COMMENT ON TABLE vmp_payments IS 'Shadow Ledger: Payment records for manual/hybrid mode (CSV ingest or ERP sync). Supports remittance PDF storage.';
COMMENT ON COLUMN vmp_payments.source_system IS 'Data source: "erp" (synced from ERP) or "manual" (CSV upload)';
COMMENT ON COLUMN vmp_payments.payment_ref IS 'Payment reference number (e.g., "PAY-2024-001", "CHQ-12345")';
COMMENT ON COLUMN vmp_payments.company_id IS 'Legal entity (company) that made this payment';
COMMENT ON COLUMN vmp_payments.invoice_num IS 'Invoice number this payment applies to (for matching)';
COMMENT ON COLUMN vmp_payments.invoice_id IS 'Direct link to invoice record in vmp_invoices';
COMMENT ON COLUMN vmp_payments.remittance_url IS 'URL to remittance PDF in storage bucket (matched by filename)';

-- ============================================================================
-- UPDATE LINKED_PAYMENT_ID FOREIGN KEY
-- ============================================================================
-- Add foreign key reference to vmp_cases.linked_payment_id (created in Sprint 2)
ALTER TABLE vmp_cases
    DROP CONSTRAINT IF EXISTS vmp_cases_linked_payment_id_fkey,
    ADD CONSTRAINT vmp_cases_linked_payment_id_fkey 
        FOREIGN KEY (linked_payment_id) REFERENCES vmp_payments(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_vmp_payments_vendor_id ON vmp_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_payments_company_id ON vmp_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_payments_payment_ref ON vmp_payments(payment_ref);
CREATE INDEX IF NOT EXISTS idx_vmp_payments_payment_date ON vmp_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_vmp_payments_invoice_id ON vmp_payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_payments_invoice_num ON vmp_payments(invoice_num) WHERE invoice_num IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_payments_source_system ON vmp_payments(source_system);
CREATE INDEX IF NOT EXISTS idx_vmp_payments_created_at ON vmp_payments(created_at);

-- Composite index for vendor payment lookup
CREATE INDEX IF NOT EXISTS idx_vmp_payments_vendor_company_date ON vmp_payments(vendor_id, company_id, payment_date DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE vmp_payments IS 'Shadow Ledger: Maintains payment records for manual/hybrid mode. Supports CSV ingest, remittance PDF matching, and future ERP integration.';

