-- ============================================================================
-- MIGRATION 050: Invoice Decision Notification Types (C8.3)
-- ============================================================================
-- Purpose: Extend notification_type CHECK to include invoice decision events
-- ============================================================================

-- Drop and recreate the notification_type CHECK constraint with new types
ALTER TABLE nexus_notifications
DROP CONSTRAINT IF EXISTS nexus_notifications_notification_type_check;

ALTER TABLE nexus_notifications
ADD CONSTRAINT nexus_notifications_notification_type_check
CHECK (notification_type IN (
  -- Payment events
  'payment_received', 'payment_pending', 'payment_overdue', 'payment_failed',
  'payment_disputed', 'payment_reminder',
  -- Invoice events (extended for C8.3)
  'invoice_received', 'invoice_overdue', 'invoice_approved', 'invoice_disputed',
  -- Case events
  'case_created', 'case_updated', 'case_assigned', 'case_resolved', 'case_escalated',
  -- Collaboration events
  'message_received', 'evidence_uploaded',
  -- Relationship events
  'vendor_linked', 'vendor_invite_received', 'vendor_invite_accepted',
  'relationship_suspended', 'relationship_terminated',
  -- SLA events
  'sla_warning', 'sla_breach',
  -- System events
  'system_announcement', 'maintenance_notice', 'welcome'
));

-- Add indexes for client/vendor context lookups (if not exist)
CREATE INDEX IF NOT EXISTS idx_nexus_notif_context
ON nexus_notifications (context, context_id, created_at DESC)
WHERE context IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN nexus_notifications.notification_type IS 'Event type - extended with invoice_approved, invoice_disputed for C8.3';
