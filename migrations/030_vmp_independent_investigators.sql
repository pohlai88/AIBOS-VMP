-- Migration: Independent Investigator Track Support
-- Created: 2025-12-22
-- Description: Enables individual users to sign up and use platform without organization approval
-- Adds user_tier support and makes vendor_id nullable for independent users

-- ============================================================================
-- USER TIER SUPPORT
-- ============================================================================

-- Add user_tier column to vmp_vendor_users
ALTER TABLE vmp_vendor_users 
ADD COLUMN IF NOT EXISTS user_tier TEXT DEFAULT 'institutional' 
CHECK (user_tier IN ('institutional', 'independent'));

COMMENT ON COLUMN vmp_vendor_users.user_tier IS 'User access tier: institutional (requires vendor/org) or independent (no org required)';

-- Make vendor_id nullable (for independent users)
ALTER TABLE vmp_vendor_users 
ALTER COLUMN vendor_id DROP NOT NULL;

-- Add constraint: independent users must have null vendor_id, institutional must have vendor_id
ALTER TABLE vmp_vendor_users 
ADD CONSTRAINT check_independent_no_vendor 
CHECK (
  (user_tier = 'independent' AND vendor_id IS NULL) OR
  (user_tier = 'institutional' AND vendor_id IS NOT NULL)
);

COMMENT ON CONSTRAINT check_independent_no_vendor ON vmp_vendor_users IS 'Enforces: independent users cannot have vendor_id, institutional users must have vendor_id';

-- ============================================================================
-- DEFAULT INDEPENDENT TENANT
-- ============================================================================

-- Create default "Independent Investigators" tenant for system-level operations
-- This tenant is used for independent users who don't belong to an organization
INSERT INTO vmp_tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Independent Investigators')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE vmp_tenants IS 'Updated: Includes default tenant for independent investigators';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_tier ON vmp_vendor_users(user_tier);

-- Partial index for independent users (vendor_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_vendor_id_null ON vmp_vendor_users(vendor_id) WHERE vendor_id IS NULL;

-- Composite index for tier + email lookups
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_tier_email ON vmp_vendor_users(user_tier, email);

-- ============================================================================
-- UPDATE EXISTING RECORDS
-- ============================================================================

-- Set all existing users to 'institutional' tier (default)
UPDATE vmp_vendor_users 
SET user_tier = 'institutional' 
WHERE user_tier IS NULL;

-- ============================================================================
-- VALIDATION QUERIES (for testing)
-- ============================================================================

-- Verify constraint: Should return 0 rows (no independent users with vendor_id)
-- SELECT * FROM vmp_vendor_users WHERE user_tier = 'independent' AND vendor_id IS NOT NULL;

-- Verify constraint: Should return 0 rows (no institutional users without vendor_id)
-- SELECT * FROM vmp_vendor_users WHERE user_tier = 'institutional' AND vendor_id IS NULL;
