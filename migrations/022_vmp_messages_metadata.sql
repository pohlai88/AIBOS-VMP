-- Migration: VMP Messages Metadata
-- Created: 2025-12-22
-- Description: Adds metadata JSONB field to vmp_messages for channel-specific data

-- ============================================================================
-- ADD METADATA FIELD
-- ============================================================================
ALTER TABLE vmp_messages
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN vmp_messages.metadata IS 'Channel-specific metadata (e.g., WhatsApp message ID, email headers, Slack thread_ts)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_messages_metadata ON vmp_messages USING GIN (metadata);

COMMENT ON INDEX idx_vmp_messages_metadata IS 'GIN index for efficient JSONB metadata queries';

