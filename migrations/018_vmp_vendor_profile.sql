-- Migration: VMP Vendor Profile (Supplier Self-Service)
-- Created: 2025-12-22
-- Description: Adds profile fields to vmp_vendors for supplier self-service portal
-- Purpose: Enable suppliers to view and manage their profile data (address, contact, compliance, bank details)
-- Philosophy: Read-only by default (from ERP/Ingest), gated updates via Change Request Cases

-- ============================================================================
-- ADD PROFILE FIELDS TO VMP_VENDORS
-- ============================================================================
ALTER TABLE vmp_vendors
    -- Address & Contact Information
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    
    -- Compliance Information
    ADD COLUMN IF NOT EXISTS tax_id TEXT, -- Tax identification number (VAT, GST, etc.)
    ADD COLUMN IF NOT EXISTS reg_number TEXT, -- Company registration number
    
    -- Bank Details (for payment processing)
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS account_number TEXT, -- Note: In production, consider encryption/masking
    ADD COLUMN IF NOT EXISTS swift_code TEXT, -- SWIFT/BIC code for international transfers
    ADD COLUMN IF NOT EXISTS bank_address TEXT, -- Bank branch address (optional)
    ADD COLUMN IF NOT EXISTS account_holder_name TEXT, -- Account holder name (may differ from vendor name)
    
    -- Metadata
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN vmp_vendors.address IS 'Vendor physical address (read-only by default, updates via Change Request Case)';
COMMENT ON COLUMN vmp_vendors.phone IS 'Primary contact phone number';
COMMENT ON COLUMN vmp_vendors.website IS 'Vendor website URL';
COMMENT ON COLUMN vmp_vendors.tax_id IS 'Tax identification number (VAT, GST, UEN, etc.) - read-only by default';
COMMENT ON COLUMN vmp_vendors.reg_number IS 'Company registration number - read-only by default';
COMMENT ON COLUMN vmp_vendors.bank_name IS 'Bank name for payment processing (gated updates via Change Request Case)';
COMMENT ON COLUMN vmp_vendors.account_number IS 'Bank account number (consider encryption/masking in production)';
COMMENT ON COLUMN vmp_vendors.swift_code IS 'SWIFT/BIC code for international bank transfers';
COMMENT ON COLUMN vmp_vendors.bank_address IS 'Bank branch address (optional)';
COMMENT ON COLUMN vmp_vendors.account_holder_name IS 'Account holder name (may differ from vendor name)';
COMMENT ON COLUMN vmp_vendors.updated_at IS 'Last update timestamp (auto-updated via trigger)';

COMMENT ON TABLE vmp_vendors IS 'Vendor master data with profile information. Critical fields (bank details, tax_id) are read-only by default and require Change Request Cases for updates.';

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Index for tax_id lookups (common compliance query)
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_tax_id ON vmp_vendors(tax_id) WHERE tax_id IS NOT NULL;

-- Index for reg_number lookups
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_reg_number ON vmp_vendors(reg_number) WHERE reg_number IS NOT NULL;

-- ============================================================================
-- UPDATE TRIGGER (if not already exists)
-- ============================================================================
-- Note: Migration 006 should have created the updated_at trigger function
-- This is just a reminder that updated_at will auto-update

