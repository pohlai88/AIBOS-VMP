-- Migration: VMP Evidence & Messages
-- Created: 2025-12-22
-- Description: Creates evidence storage and messaging tables

-- ============================================================================
-- EVIDENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    checklist_step_id UUID REFERENCES vmp_checklist_steps(id) ON DELETE SET NULL,
    uploader_type TEXT NOT NULL CHECK (uploader_type IN ('vendor', 'internal')),
    evidence_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (case_id, evidence_type, version)
);

COMMENT ON TABLE vmp_evidence IS 'Evidence files uploaded for cases - versioned, checksummed, immutable';

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    channel_source TEXT NOT NULL DEFAULT 'portal' CHECK (channel_source IN ('portal', 'whatsapp', 'email', 'slack')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('vendor', 'internal', 'ai')),
    sender_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_messages IS 'Messages/threads for case communication - supports multi-channel (portal, WhatsApp, email, Slack)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_case_id ON vmp_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_checklist_step_id ON vmp_evidence(checklist_step_id);
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_evidence_type ON vmp_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_status ON vmp_evidence(status);
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_created_at ON vmp_evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_vmp_messages_case_id ON vmp_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_messages_sender_user_id ON vmp_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_messages_channel_source ON vmp_messages(channel_source);
CREATE INDEX IF NOT EXISTS idx_vmp_messages_created_at ON vmp_messages(created_at);

