-- Migration: VMP Notifications
-- Created: 2025-12-22
-- Description: Creates notification table for future email/portal notifications

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES vmp_cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('evidence_submitted', 'evidence_verified', 'evidence_rejected', 'case_escalated', 'case_status_changed', 'message_received', 'sla_breach', 'sla_warning')),
    title TEXT NOT NULL,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_notifications IS 'User notifications for case updates, evidence status changes, and SLA alerts';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_notifications_case_id ON vmp_notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_notifications_user_id ON vmp_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_notifications_is_read ON vmp_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_vmp_notifications_created_at ON vmp_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_vmp_notifications_user_unread ON vmp_notifications(user_id, is_read) WHERE is_read = false;

