-- Migration: VMP Authentication (Vendor Users & Sessions)
-- Created: 2025-12-22
-- Description: Creates user authentication and session management tables

-- ============================================================================
-- VENDOR USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_vendor_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_vendor_users IS 'Vendor user accounts with authentication credentials';

-- ============================================================================
-- SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE vmp_sessions IS 'Active user sessions for authentication';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_vendor_id ON vmp_vendor_users(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_email ON vmp_vendor_users(email);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_is_active ON vmp_vendor_users(is_active);
CREATE INDEX IF NOT EXISTS idx_vmp_sessions_user_id ON vmp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_sessions_expires_at ON vmp_sessions(expires_at);

