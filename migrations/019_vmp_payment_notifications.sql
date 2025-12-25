-- Migration: VMP Payment Notifications (Sprint 7.4)
-- Created: 2025-12-22
-- Description: Adds payment_received notification type and payment_id field to notifications

-- ============================================================================
-- ADD PAYMENT NOTIFICATION TYPE
-- ============================================================================
-- Drop and recreate the check constraint to include payment_received
ALTER TABLE vmp_notifications
    DROP CONSTRAINT IF EXISTS vmp_notifications_notification_type_check;

ALTER TABLE vmp_notifications
    ADD CONSTRAINT vmp_notifications_notification_type_check
    CHECK (notification_type IN (
        'evidence_submitted', 
        'evidence_verified', 
        'evidence_rejected', 
        'case_escalated', 
        'case_status_changed', 
        'message_received', 
        'sla_breach', 
        'sla_warning',
        'payment_received'
    ));

-- ============================================================================
-- ADD PAYMENT_ID FIELD (Optional link to payment)
-- ============================================================================
ALTER TABLE vmp_notifications
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES vmp_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vmp_notifications_payment_id ON vmp_notifications(payment_id) WHERE payment_id IS NOT NULL;

COMMENT ON COLUMN vmp_notifications.payment_id IS 'Optional link to payment record for payment_received notifications';

