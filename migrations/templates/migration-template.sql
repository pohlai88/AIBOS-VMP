-- Migration: [Brief Description]
-- Created: YYYY-MM-DD
-- Description: [Detailed description of what this migration does]
-- Purpose: [Why this migration is needed - business/technical reason]
-- Related: [Link to related issues, PRs, or documentation]

-- ============================================================================
-- PREREQUISITES
-- ============================================================================
-- [ ] Previous migrations applied
-- [ ] Database backup completed
-- [ ] Tested on staging environment

-- ============================================================================
-- 1. [Section Name - e.g., CREATE TABLE]
-- ============================================================================

-- SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS table_name (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name TEXT NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ============================================================================
-- 2. [Section Name - e.g., CREATE INDEXES]
-- ============================================================================

-- Indexes for performance
-- Example:
-- CREATE INDEX IF NOT EXISTS idx_table_name_field ON table_name(field);

-- ============================================================================
-- 3. [Section Name - e.g., ENABLE RLS]
-- ============================================================================

-- Row Level Security
-- Example:
-- ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "policy_name" ON table_name FOR SELECT USING (tenant_id = auth.uid());

-- ============================================================================
-- 4. [Section Name - e.g., COMMENTS]
-- ============================================================================

-- Documentation comments
-- Example:
-- COMMENT ON TABLE table_name IS 'Description of table purpose';
-- COMMENT ON COLUMN table_name.field IS 'Description of field';

-- ============================================================================
-- 5. [Section Name - e.g., VERIFICATION]
-- ============================================================================

-- Verification queries (optional, for manual testing)
-- Example:
-- SELECT COUNT(*) FROM table_name;
-- SELECT * FROM table_name LIMIT 1;

-- ============================================================================
-- ROLLBACK (Optional - for complex migrations)
-- ============================================================================
-- If this migration needs to be rolled back, document the rollback steps here
-- Example:
-- DROP TABLE IF EXISTS table_name CASCADE;

