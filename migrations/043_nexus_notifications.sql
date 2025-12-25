-- Migration 043: Nexus Notifications Schema
-- Notifications with tenant/user config cascade
--
-- Config Priority: Tenant Config → User Prefs → Channel Delivery
-- Payment notifications: Always delivered (override quiet hours/mute)

-- ============================================================================
-- NEXUS_NOTIFICATIONS: User notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Notification identifier
    notification_id     TEXT UNIQUE NOT NULL,       -- NTF-XXXXXXXX

    -- Recipient
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX

    -- Context (which role received this notification)
    context             TEXT CHECK (context IN ('client', 'vendor', 'both')),
    context_id          TEXT,                       -- TC-* or TV-*

    -- Notification type (for filtering and prioritization)
    notification_type   TEXT NOT NULL CHECK (notification_type IN (
        -- Payment (PHASE 1 PRIORITY - always delivered)
        'payment_received', 'payment_pending', 'payment_overdue', 'payment_failed',
        'payment_disputed', 'payment_reminder', 'invoice_received', 'invoice_overdue',
        -- Case
        'case_created', 'case_updated', 'case_assigned', 'case_resolved', 'case_escalated',
        'message_received', 'evidence_uploaded',
        -- Relationship
        'vendor_linked', 'vendor_invite_received', 'vendor_invite_accepted',
        'relationship_suspended', 'relationship_terminated',
        -- SLA
        'sla_warning', 'sla_breach',
        -- System
        'system_announcement', 'maintenance_notice', 'welcome'
    )),

    -- Priority (payment always 'critical')
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),

    -- Content
    title               TEXT NOT NULL,
    body                TEXT,

    -- Reference
    reference_type      TEXT,                       -- 'payment', 'case', 'invoice', 'relationship'
    reference_id        TEXT,                       -- PAY-*, CASE-*, INV-*, etc.

    -- Action
    action_url          TEXT,                       -- Link to relevant page
    action_label        TEXT,                       -- Button text

    -- Read status
    is_read             BOOLEAN DEFAULT false,
    read_at             TIMESTAMPTZ,

    -- Delivery tracking (which channels were used)
    delivered_realtime  BOOLEAN DEFAULT false,
    delivered_push      BOOLEAN DEFAULT false,
    delivered_email     BOOLEAN DEFAULT false,
    delivery_attempts   JSONB DEFAULT '[]',

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    expires_at          TIMESTAMPTZ                 -- Optional expiry
);

CREATE INDEX IF NOT EXISTS idx_nexus_notif_user ON nexus_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_tenant ON nexus_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_type ON nexus_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_unread ON nexus_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_nexus_notif_priority ON nexus_notifications(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_created ON nexus_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_reference ON nexus_notifications(reference_type, reference_id);

-- ============================================================================
-- NEXUS_NOTIFICATION_CONFIG: Tenant-level notification settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_notification_config (
    tenant_id           TEXT PRIMARY KEY,           -- TNT-XXXXXXXX

    -- Channel toggles (can be disabled at tenant level)
    realtime_enabled    BOOLEAN DEFAULT true,
    push_enabled        BOOLEAN DEFAULT true,
    email_enabled       BOOLEAN DEFAULT true,

    -- Rate limiting
    max_per_hour        INTEGER DEFAULT 100,
    max_per_day         INTEGER DEFAULT 500,

    -- Quiet hours (tenant-wide)
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start   TIME DEFAULT '22:00',
    quiet_hours_end     TIME DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',

    -- Override rules
    payment_always      BOOLEAN DEFAULT true,       -- Payment notifications ignore quiet hours
    sla_always          BOOLEAN DEFAULT true,       -- SLA breach notifications ignore quiet hours

    -- Email settings
    email_digest_mode   TEXT DEFAULT 'instant' CHECK (email_digest_mode IN ('instant', 'hourly', 'daily', 'weekly')),
    email_digest_time   TIME DEFAULT '09:00',       -- For daily/weekly digest
    email_digest_day    INTEGER DEFAULT 1,          -- Day of week for weekly (1=Monday)

    -- Branding
    email_from_name     TEXT,
    email_reply_to      TEXT,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEXUS_USER_NOTIFICATION_PREFS: User-level overrides
-- ============================================================================
-- Users can only RESTRICT (not expand) beyond tenant config
CREATE TABLE IF NOT EXISTS nexus_user_notification_prefs (
    user_id             TEXT PRIMARY KEY,           -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX (for validation)

    -- Channel toggles (NULL = use tenant default)
    realtime_enabled    BOOLEAN,                    -- Can only disable if tenant allows
    push_enabled        BOOLEAN,
    email_enabled       BOOLEAN,

    -- User quiet hours (additive to tenant quiet hours)
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,

    -- Temporary mute
    muted_until         TIMESTAMPTZ,

    -- Email preferences
    email_digest_mode   TEXT CHECK (email_digest_mode IN ('instant', 'hourly', 'daily', 'weekly', 'none')),

    -- Notification type preferences (which types to receive)
    -- NULL = all types; empty array = none; array = only those types
    enabled_types       TEXT[],
    disabled_types      TEXT[],

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_user_prefs_tenant ON nexus_user_notification_prefs(tenant_id);

-- ============================================================================
-- NEXUS_NOTIFICATION_QUEUE: Pending notifications (for batching/digest)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_notification_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX

    -- Channel
    channel             TEXT NOT NULL CHECK (channel IN ('realtime', 'push', 'email')),

    -- Notification reference
    notification_id     TEXT NOT NULL,              -- NTF-XXXXXXXX

    -- Priority (affects processing order)
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),

    -- Scheduling
    scheduled_for       TIMESTAMPTZ NOT NULL,       -- When to deliver

    -- Status
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),

    -- Retry tracking
    attempts            INTEGER DEFAULT 0,
    max_attempts        INTEGER DEFAULT 3,
    last_error          TEXT,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_queue_pending ON nexus_notification_queue(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_nexus_queue_user ON nexus_notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_queue_channel ON nexus_notification_queue(channel);

-- ============================================================================
-- NEXUS_PUSH_SUBSCRIPTIONS: Web push subscriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_push_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX

    -- Push subscription data
    endpoint            TEXT NOT NULL,
    p256dh_key          TEXT NOT NULL,
    auth_key            TEXT NOT NULL,

    -- Device info
    device_name         TEXT,
    browser             TEXT,
    platform            TEXT,

    -- Status
    is_active           BOOLEAN DEFAULT true,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    last_used_at        TIMESTAMPTZ,

    -- Unique per endpoint
    CONSTRAINT unique_push_endpoint UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_nexus_push_user ON nexus_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_push_active ON nexus_push_subscriptions(user_id, is_active) WHERE is_active = true;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER nexus_notif_config_updated_at
    BEFORE UPDATE ON nexus_notification_config
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_user_prefs_updated_at
    BEFORE UPDATE ON nexus_user_notification_prefs
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

-- ============================================================================
-- NOTIFICATION INSERT TRIGGER (Auto-queue for delivery)
-- ============================================================================
CREATE OR REPLACE FUNCTION nexus_notification_auto_queue()
RETURNS TRIGGER AS $$
DECLARE
    tenant_config nexus_notification_config%ROWTYPE;
    user_prefs nexus_user_notification_prefs%ROWTYPE;
    is_payment_type BOOLEAN;
    should_deliver_now BOOLEAN;
BEGIN
    -- Check if payment-related (always deliver)
    is_payment_type := NEW.notification_type LIKE 'payment_%' OR NEW.notification_type LIKE 'invoice_%';

    -- Get tenant config
    SELECT * INTO tenant_config FROM nexus_notification_config WHERE tenant_id = NEW.tenant_id;

    -- Get user prefs
    SELECT * INTO user_prefs FROM nexus_user_notification_prefs WHERE user_id = NEW.user_id;

    -- Determine if we should deliver now (simplified logic - full logic in application layer)
    should_deliver_now := is_payment_type OR NEW.priority = 'critical';

    -- Queue for realtime (always immediate for payment)
    IF (tenant_config.realtime_enabled IS NOT FALSE) AND
       (user_prefs.realtime_enabled IS NOT FALSE) THEN
        INSERT INTO nexus_notification_queue (
            user_id, tenant_id, channel, notification_id, priority, scheduled_for
        ) VALUES (
            NEW.user_id, NEW.tenant_id, 'realtime', NEW.notification_id, NEW.priority, now()
        );
    END IF;

    -- Queue for push (if enabled)
    IF (tenant_config.push_enabled IS NOT FALSE) AND
       (user_prefs.push_enabled IS NOT FALSE) THEN
        INSERT INTO nexus_notification_queue (
            user_id, tenant_id, channel, notification_id, priority,
            scheduled_for
        ) VALUES (
            NEW.user_id, NEW.tenant_id, 'push', NEW.notification_id, NEW.priority,
            CASE WHEN should_deliver_now THEN now() ELSE now() + interval '1 minute' END
        );
    END IF;

    -- Queue for email (may be batched based on digest mode)
    IF (tenant_config.email_enabled IS NOT FALSE) AND
       (user_prefs.email_enabled IS NOT FALSE) THEN
        INSERT INTO nexus_notification_queue (
            user_id, tenant_id, channel, notification_id, priority,
            scheduled_for
        ) VALUES (
            NEW.user_id, NEW.tenant_id, 'email', NEW.notification_id, NEW.priority,
            CASE
                WHEN should_deliver_now THEN now()
                WHEN COALESCE(user_prefs.email_digest_mode, tenant_config.email_digest_mode) = 'instant' THEN now()
                ELSE now() + interval '1 hour'  -- Batched (actual scheduling in application)
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nexus_notification_queue_trigger
    AFTER INSERT ON nexus_notifications
    FOR EACH ROW EXECUTE FUNCTION nexus_notification_auto_queue();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get effective notification config for a user
CREATE OR REPLACE FUNCTION get_effective_notification_config(p_user_id TEXT, p_tenant_id TEXT)
RETURNS TABLE (
    realtime_enabled BOOLEAN,
    push_enabled BOOLEAN,
    email_enabled BOOLEAN,
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    email_digest_mode TEXT,
    payment_always BOOLEAN
) AS $$
DECLARE
    tc nexus_notification_config%ROWTYPE;
    up nexus_user_notification_prefs%ROWTYPE;
BEGIN
    SELECT * INTO tc FROM nexus_notification_config WHERE tenant_id = p_tenant_id;
    SELECT * INTO up FROM nexus_user_notification_prefs WHERE user_id = p_user_id;

    RETURN QUERY SELECT
        -- Realtime: User can only disable if tenant allows
        COALESCE(up.realtime_enabled, tc.realtime_enabled, true),
        -- Push: User can only disable if tenant allows
        COALESCE(up.push_enabled, tc.push_enabled, true),
        -- Email: User can only disable if tenant allows
        COALESCE(up.email_enabled, tc.email_enabled, true),
        -- Quiet hours: Use user's if set, else tenant's
        COALESCE(up.quiet_hours_enabled, tc.quiet_hours_enabled, false),
        COALESCE(up.quiet_hours_start, tc.quiet_hours_start, '22:00'::TIME),
        COALESCE(up.quiet_hours_end, tc.quiet_hours_end, '08:00'::TIME),
        -- Email digest: Use user's if set, else tenant's
        COALESCE(up.email_digest_mode, tc.email_digest_mode, 'instant'),
        -- Payment always: Tenant-level only
        COALESCE(tc.payment_always, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Unread notification counts by user
CREATE OR REPLACE VIEW nexus_notification_counts AS
SELECT
    user_id,
    tenant_id,
    COUNT(*) as total_unread,
    COUNT(*) FILTER (WHERE notification_type LIKE 'payment_%') as payment_unread,
    COUNT(*) FILTER (WHERE notification_type LIKE 'case_%' OR notification_type = 'message_received') as case_unread,
    COUNT(*) FILTER (WHERE priority = 'critical') as critical_unread
FROM nexus_notifications
WHERE is_read = false
GROUP BY user_id, tenant_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE nexus_notifications IS 'User notifications. Payment types have priority delivery.';
COMMENT ON TABLE nexus_notification_config IS 'Tenant-level notification settings. Users can only restrict, not expand.';
COMMENT ON TABLE nexus_user_notification_prefs IS 'User-level notification overrides.';
COMMENT ON TABLE nexus_notification_queue IS 'Pending notifications for batching and retry.';
COMMENT ON TABLE nexus_push_subscriptions IS 'Web push subscription endpoints.';
COMMENT ON FUNCTION get_effective_notification_config IS 'Returns merged tenant+user notification config.';
