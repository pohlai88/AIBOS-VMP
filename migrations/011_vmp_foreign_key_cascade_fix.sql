-- Migration: VMP Foreign Key Cascade Fix
-- Created: 2025-12-22
-- Description: Updates foreign keys to use CASCADE where appropriate for data integrity

-- ============================================================================
-- FIX FOREIGN KEY CASCADE RULES
-- ============================================================================
-- Current state: vmp_cases foreign keys use NO ACTION
-- Desired state: Use CASCADE for proper data cleanup

-- Note: PostgreSQL doesn't support ALTER CONSTRAINT to change delete rule.
-- We need to drop and recreate the constraints.

-- vmp_cases: tenant_id, company_id, vendor_id should CASCADE
-- (If tenant/company/vendor is deleted, cases should be deleted too)

-- Drop existing constraints
ALTER TABLE vmp_cases DROP CONSTRAINT IF EXISTS vmp_cases_tenant_id_fkey;
ALTER TABLE vmp_cases DROP CONSTRAINT IF EXISTS vmp_cases_company_id_fkey;
ALTER TABLE vmp_cases DROP CONSTRAINT IF EXISTS vmp_cases_vendor_id_fkey;

-- Recreate with CASCADE
ALTER TABLE vmp_cases 
    ADD CONSTRAINT vmp_cases_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES vmp_tenants(id) ON DELETE CASCADE;

ALTER TABLE vmp_cases 
    ADD CONSTRAINT vmp_cases_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES vmp_companies(id) ON DELETE CASCADE;

ALTER TABLE vmp_cases 
    ADD CONSTRAINT vmp_cases_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES vmp_vendors(id) ON DELETE CASCADE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT vmp_cases_tenant_id_fkey ON vmp_cases IS 
    'Cascades delete: deleting tenant deletes all associated cases';
COMMENT ON CONSTRAINT vmp_cases_company_id_fkey ON vmp_cases IS 
    'Cascades delete: deleting company deletes all associated cases';
COMMENT ON CONSTRAINT vmp_cases_vendor_id_fkey ON vmp_cases IS 
    'Cascades delete: deleting vendor deletes all associated cases';

