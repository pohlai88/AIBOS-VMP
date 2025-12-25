-- Migration: VMP Port Configuration (Sprint 9.3)
-- Created: 2025-12-22
-- Description: Creates port configuration table for email/WhatsApp webhook settings

-- ============================================================================
-- PORT CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_port_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    port_type TEXT NOT NULL CHECK (port_type IN ('email', 'whatsapp', 'slack')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    webhook_url TEXT, -- Webhook URL for this port (where to send webhooks)
    provider TEXT, -- Provider name (sendgrid, mailgun, whatsapp, twilio, etc.)
    configuration JSONB DEFAULT '{}'::jsonb, -- Provider-specific configuration
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (port_type)
);

COMMENT ON TABLE vmp_port_configuration IS 'Configuration for omnichannel ports (email, WhatsApp, Slack)';
COMMENT ON COLUMN vmp_port_configuration.port_type IS 'Type of port: email, whatsapp, slack';
COMMENT ON COLUMN vmp_port_configuration.is_enabled IS 'Whether this port is enabled';
COMMENT ON COLUMN vmp_port_configuration.webhook_url IS 'Webhook URL for receiving messages from this port';
COMMENT ON COLUMN vmp_port_configuration.provider IS 'Provider name (sendgrid, mailgun, whatsapp, twilio, etc.)';
COMMENT ON COLUMN vmp_port_configuration.configuration IS 'Provider-specific configuration (API keys, secrets, etc.)';

-- ============================================================================
-- PORT ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_port_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    port_type TEXT NOT NULL CHECK (port_type IN ('email', 'whatsapp', 'slack')),
    activity_type TEXT NOT NULL CHECK (activity_type IN ('webhook_received', 'message_processed', 'case_created', 'error', 'status_update')),
    message_id TEXT, -- External message ID (email message ID, WhatsApp message ID, etc.)
    case_id UUID REFERENCES vmp_cases(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vmp_vendors(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional activity metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_port_activity_log IS 'Activity log for port webhook events and processing';
COMMENT ON COLUMN vmp_port_activity_log.activity_type IS 'Type of activity: webhook_received, message_processed, case_created, error, status_update';
COMMENT ON COLUMN vmp_port_activity_log.message_id IS 'External message ID from the port provider';
COMMENT ON COLUMN vmp_port_activity_log.status IS 'Activity status: success, error, skipped';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_port_configuration_port_type ON vmp_port_configuration(port_type);
CREATE INDEX IF NOT EXISTS idx_vmp_port_activity_log_port_type ON vmp_port_activity_log(port_type);
CREATE INDEX IF NOT EXISTS idx_vmp_port_activity_log_created_at ON vmp_port_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vmp_port_activity_log_case_id ON vmp_port_activity_log(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_port_activity_log_vendor_id ON vmp_port_activity_log(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_port_activity_log_status ON vmp_port_activity_log(status);

-- ============================================================================
-- DEFAULT CONFIGURATIONS
-- ============================================================================
INSERT INTO vmp_port_configuration (port_type, is_enabled, provider, configuration)
VALUES 
    ('email', false, 'generic', '{}'::jsonb),
    ('whatsapp', false, 'whatsapp', '{}'::jsonb)
ON CONFLICT (port_type) DO NOTHING;

