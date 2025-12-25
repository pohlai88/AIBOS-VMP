-- Migration: VMP Cases Contract Type
-- Created: 2025-12-22
-- Description: Adds 'contract' to case_type CHECK constraint

-- ============================================================================
-- UPDATE CASE TYPE CONSTRAINT
-- ============================================================================
-- Drop existing constraint
ALTER TABLE vmp_cases
    DROP CONSTRAINT IF EXISTS vmp_cases_case_type_check;

-- Add new constraint with 'contract' type
ALTER TABLE vmp_cases
    ADD CONSTRAINT vmp_cases_case_type_check 
    CHECK (case_type IN ('onboarding', 'invoice', 'payment', 'soa', 'general', 'contract'));

COMMENT ON CONSTRAINT vmp_cases_case_type_check ON vmp_cases IS 'Case type constraint including contract type';

