-- Migration: VMP Decision Log
-- Created: 2025-12-22
-- Description: Creates decision log table for tracking case decisions (VMP-03-05)

-- ============================================================================
-- DECISION LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL CHECK (decision_type IN ('verify', 'reject', 'reassign', 'status_update', 'escalate', 'approve', 'close')),
    who TEXT NOT NULL,
    what TEXT NOT NULL,
    why TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_decision_log IS 'Log of decisions made on cases - tracks who/what/why for audit trail (VMP-03-05)';
COMMENT ON COLUMN vmp_decision_log.decision_type IS 'Type of decision: verify, reject, reassign, status_update, escalate, approve, close';
COMMENT ON COLUMN vmp_decision_log.who IS 'Who made the decision (user name/ID)';
COMMENT ON COLUMN vmp_decision_log.what IS 'What decision was made (action description)';
COMMENT ON COLUMN vmp_decision_log.why IS 'Why the decision was made (reason/justification)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_decision_log_case_id ON vmp_decision_log(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_decision_log_decision_type ON vmp_decision_log(decision_type);
CREATE INDEX IF NOT EXISTS idx_vmp_decision_log_created_at ON vmp_decision_log(created_at DESC);

