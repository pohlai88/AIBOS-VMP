-- Migration: VMP Function Security
-- Created: 2025-12-22
-- Description: Fixes function search_path security issue

-- ============================================================================
-- FIX UPDATE_UPDATED_AT_COLUMN FUNCTION
-- ============================================================================

-- Drop and recreate with secure search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Re-apply trigger to vmp_cases
DROP TRIGGER IF EXISTS update_vmp_cases_updated_at ON vmp_cases;
CREATE TRIGGER update_vmp_cases_updated_at
    BEFORE UPDATE ON vmp_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_updated_at_column() IS 
    'Securely updates updated_at timestamp. Uses SET search_path to prevent search_path injection.';

