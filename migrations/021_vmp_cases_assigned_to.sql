-- Migration: VMP Cases Assigned To
-- Created: 2025-12-22
-- Description: Adds assigned_to_user_id field to vmp_cases

-- ============================================================================
-- ADD ASSIGNED TO FIELD
-- ============================================================================
ALTER TABLE vmp_cases
    ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN vmp_cases.assigned_to_user_id IS 'User ID of the internal staff member assigned to handle this case';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_cases_assigned_to_user_id ON vmp_cases(assigned_to_user_id);

