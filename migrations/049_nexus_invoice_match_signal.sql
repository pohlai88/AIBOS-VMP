-- ============================================================================
-- MIGRATION 049: Invoice Match Signal (C8.2 Matching Pilot)
-- ============================================================================
-- Purpose: Add match signal fields for read-only matching pilot
-- Feature-flagged via FEATURE_MATCHING_PILOT env var
-- ============================================================================

-- Add match signal columns to nexus_invoices
ALTER TABLE nexus_invoices
ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS match_score NUMERIC,
ADD COLUMN IF NOT EXISTS match_reason TEXT,
ADD COLUMN IF NOT EXISTS match_updated_at TIMESTAMPTZ;

-- Add CHECK constraint for match_status values
ALTER TABLE nexus_invoices
ADD CONSTRAINT nexus_invoices_match_status_check
CHECK (match_status IS NULL OR match_status IN ('matched', 'needs_review', 'mismatch', 'unknown'));

-- Index for filtering by match_status (useful for inbox views)
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_match_status
ON nexus_invoices (client_id, match_status)
WHERE match_status IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN nexus_invoices.match_status IS 'Pilot match signal: matched|needs_review|mismatch|unknown';
COMMENT ON COLUMN nexus_invoices.match_score IS 'Match confidence score 0-100 (nullable)';
COMMENT ON COLUMN nexus_invoices.match_reason IS 'Human-readable reason for match status';
COMMENT ON COLUMN nexus_invoices.match_updated_at IS 'When match signal was last computed';
