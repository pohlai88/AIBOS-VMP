-- Migration: VMP Password Reset Tokens
-- Created: 2025-12-22
-- Description: Creates password reset token system for self-service password reset

-- ============================================================================
-- PASSWORD RESET TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_password_reset_tokens IS 'Password reset tokens for self-service password reset. Tokens expire after 1 hour and can only be used once.';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_password_reset_tokens_user_id ON vmp_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_password_reset_tokens_token ON vmp_password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_vmp_password_reset_tokens_expires_at ON vmp_password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_vmp_password_reset_tokens_used_at ON vmp_password_reset_tokens(used_at) WHERE used_at IS NULL;



