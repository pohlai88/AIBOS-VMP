-- Migration: VMP Emergency Pay Override
-- Created: 2025-12-22
-- Description: Creates emergency pay override functionality with approval workflow and audit logging
-- Purpose: Allow controlled override of evidence-first doctrine in emergency situations

-- ============================================================================
-- EMERGENCY PAY OVERRIDE REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_emergency_pay_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vmp_payments(id) ON DELETE CASCADE,
    case_id UUID REFERENCES vmp_cases(id) ON DELETE SET NULL, -- Optional: link to related case
    requested_by_user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL, -- Justification for override
    urgency_level TEXT NOT NULL CHECK (urgency_level IN ('high', 'critical', 'emergency')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT, -- If rejected, reason for rejection
    metadata JSONB, -- Additional context (e.g., business impact, stakeholder notifications)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_emergency_pay_overrides IS 'Emergency pay override requests with approval workflow. Allows controlled override of evidence-first doctrine.';
COMMENT ON COLUMN vmp_emergency_pay_overrides.urgency_level IS 'Urgency: high (business impact), critical (operational risk), emergency (immediate threat)';
COMMENT ON COLUMN vmp_emergency_pay_overrides.status IS 'Request status: pending (awaiting approval), approved (override granted), rejected (denied), cancelled (withdrawn)';
COMMENT ON COLUMN vmp_emergency_pay_overrides.metadata IS 'Additional context: business impact, stakeholder notifications, escalation path';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_payment_id ON vmp_emergency_pay_overrides(payment_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_case_id ON vmp_emergency_pay_overrides(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_requested_by ON vmp_emergency_pay_overrides(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_status ON vmp_emergency_pay_overrides(status);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_urgency ON vmp_emergency_pay_overrides(urgency_level);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_created_at ON vmp_emergency_pay_overrides(created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER vmp_emergency_pay_overrides_updated_at
    BEFORE UPDATE ON vmp_emergency_pay_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

