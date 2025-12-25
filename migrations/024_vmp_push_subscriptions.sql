-- Migration 024: Push Notification Subscriptions (Sprint 12.3)
-- Creates table for storing push notification subscriptions

CREATE TABLE IF NOT EXISTS vmp_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Ensure one subscription per user/endpoint combination
    UNIQUE(user_id, endpoint)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON vmp_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_vendor_id ON vmp_push_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON vmp_push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON vmp_push_subscriptions(endpoint);

-- Add updated_at trigger
CREATE TRIGGER update_vmp_push_subscriptions_updated_at
    BEFORE UPDATE ON vmp_push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE vmp_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own subscriptions
CREATE POLICY push_subscriptions_user_policy ON vmp_push_subscriptions
    FOR ALL
    USING (user_id = auth.uid()::text::uuid OR user_id IN (
        SELECT id FROM vmp_vendor_users WHERE id = auth.uid()::text::uuid
    ));

-- RLS Policy: Service role can access all (for sending notifications)
CREATE POLICY push_subscriptions_service_policy ON vmp_push_subscriptions
    FOR ALL
    TO service_role
    USING (true);

COMMENT ON TABLE vmp_push_subscriptions IS 'Stores push notification subscriptions for users (Web Push API)';
COMMENT ON COLUMN vmp_push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN vmp_push_subscriptions.p256dh_key IS 'P256DH public key (base64)';
COMMENT ON COLUMN vmp_push_subscriptions.auth_key IS 'Auth secret (base64)';
COMMENT ON COLUMN vmp_push_subscriptions.expires_at IS 'Subscription expiration time (if provided by browser)';

