-- Migration: VMP Updated At Trigger
-- Created: 2025-12-22
-- Description: Creates trigger function to automatically update updated_at timestamp

-- ============================================================================
-- TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- APPLY TRIGGER TO CASES
-- ============================================================================
DROP TRIGGER IF EXISTS update_vmp_cases_updated_at ON vmp_cases;
CREATE TRIGGER update_vmp_cases_updated_at
    BEFORE UPDATE ON vmp_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

