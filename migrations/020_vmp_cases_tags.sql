-- Migration: VMP Cases Tags
-- Created: 2025-12-22
-- Description: Adds tags JSONB field to vmp_cases for categorization

-- ============================================================================
-- ADD TAGS FIELD
-- ============================================================================
ALTER TABLE vmp_cases
    ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN vmp_cases.tags IS 'Array of tag strings for case categorization (e.g., ["urgent", "compliance", "payment"])';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_cases_tags ON vmp_cases USING GIN (tags);

COMMENT ON INDEX idx_vmp_cases_tags IS 'GIN index for efficient JSONB tag queries';

