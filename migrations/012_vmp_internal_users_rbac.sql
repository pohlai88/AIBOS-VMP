-- Migration: VMP Internal Users RBAC
-- Created: 2025-12-22
-- Description: Adds support for internal users (non-vendor) with RBAC

-- ============================================================================
-- ADD is_internal FIELD TO vmp_vendor_users
-- ============================================================================
ALTER TABLE vmp_vendor_users 
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vmp_vendor_users.is_internal IS 'If true, user is internal staff (AP/Procurement). If false, user is vendor user.';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_is_internal ON vmp_vendor_users(is_internal);

-- ============================================================================
-- UPDATE EXISTING USERS (all current users are vendors)
-- ============================================================================
UPDATE vmp_vendor_users SET is_internal = false WHERE is_internal IS NULL;

