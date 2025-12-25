-- Migration 025: Notification Preferences (Sprint 7.4)
-- Adds notification preferences and phone number to vendor users

-- ============================================================================
-- ADD PHONE NUMBER COLUMN
-- ============================================================================
ALTER TABLE vmp_vendor_users
    ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN vmp_vendor_users.phone IS 'Phone number for SMS notifications';

-- ============================================================================
-- ADD NOTIFICATION PREFERENCES COLUMN
-- ============================================================================
ALTER TABLE vmp_vendor_users
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}'::jsonb;

COMMENT ON COLUMN vmp_vendor_users.notification_preferences IS 'User notification preferences: {email: boolean, sms: boolean, push: boolean}';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_phone ON vmp_vendor_users(phone) WHERE phone IS NOT NULL;

-- ============================================================================
-- UPDATE EXISTING USERS
-- ============================================================================
-- Set default preferences for existing users who don't have them
UPDATE vmp_vendor_users
SET notification_preferences = '{"email": true, "sms": false, "push": true}'::jsonb
WHERE notification_preferences IS NULL;

