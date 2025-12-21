-- Migration: VMP Invites
-- Created: 2025-12-22
-- Description: Creates vendor invitation system

-- ============================================================================
-- INVITES
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_invites IS 'Vendor invitation tokens for onboarding. Multi-company scope is managed through vmp_vendor_company_links (one invite can grant access to multiple companies)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_invites_vendor_id ON vmp_invites(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_invites_token ON vmp_invites(token);
CREATE INDEX IF NOT EXISTS idx_vmp_invites_email ON vmp_invites(email);
CREATE INDEX IF NOT EXISTS idx_vmp_invites_expires_at ON vmp_invites(expires_at);

