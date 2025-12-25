-- Migration 040: Nexus Tenant Core Schema
-- Creates the new tenant-centric structure with explicit IDs
-- Philosophy: Everyone is a Tenant. Role is contextual (TC-* = client, TV-* = vendor)
--
-- ID Convention:
--   TNT-XXXXXXXX  = Tenant Master ID (profile, settings)
--   TC-XXXXXXXX   = Tenant-as-Client ID (when facing down to vendors)
--   TV-XXXXXXXX   = Tenant-as-Vendor ID (when facing up to clients)

-- ============================================================================
-- NEXUS_TENANTS: Master tenant table with explicit sub-IDs
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Explicit prefixed IDs (all generated at onboarding)
    tenant_id           TEXT UNIQUE NOT NULL,       -- TNT-XXXXXXXX (Master)
    tenant_client_id    TEXT UNIQUE NOT NULL,       -- TC-XXXXXXXX (Client context)
    tenant_vendor_id    TEXT UNIQUE NOT NULL,       -- TV-XXXXXXXX (Vendor context)

    -- Profile
    name                TEXT NOT NULL,
    display_name        TEXT,
    email               TEXT,
    phone               TEXT,
    address             TEXT,

    -- Status
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
    onboarding_status   TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'active', 'completed')),

    -- Metadata
    settings            JSONB DEFAULT '{}',
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookup by any ID type
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_tenant_id ON nexus_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_client_id ON nexus_tenants(tenant_client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_vendor_id ON nexus_tenants(tenant_vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_status ON nexus_tenants(status);

-- ============================================================================
-- NEXUS_TENANT_RELATIONSHIPS: Binary relationships using explicit sub-IDs
-- ============================================================================
-- Reading: client_id (TC-*) is CLIENT OF vendor_id (TV-*)
--          vendor_id (TV-*) SERVES client_id (TC-*)
CREATE TABLE IF NOT EXISTS nexus_tenant_relationships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationship parties (use explicit sub-IDs)
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX (the client in this relationship)
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX (the vendor in this relationship)

    -- Relationship metadata
    relationship_type   TEXT DEFAULT 'client_vendor' CHECK (relationship_type IN ('client_vendor', 'partner', 'affiliate')),
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'terminated')),

    -- Invitation tracking
    invited_by          UUID,                       -- User who created the relationship
    invite_token        TEXT,                       -- Token used for invite acceptance
    invite_accepted_at  TIMESTAMPTZ,

    -- Contract/agreement reference
    contract_ref        TEXT,
    effective_from      DATE,
    effective_to        DATE,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT unique_relationship UNIQUE (client_id, vendor_id),
    CONSTRAINT no_self_relationship CHECK (client_id != vendor_id)
);

-- Indexes for relationship queries
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_client ON nexus_tenant_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_vendor ON nexus_tenant_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_status ON nexus_tenant_relationships(status);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_invite_token ON nexus_tenant_relationships(invite_token) WHERE invite_token IS NOT NULL;

-- ============================================================================
-- NEXUS_RELATIONSHIP_INVITES: Pending invitations (before acceptance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_relationship_invites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invite token
    token               TEXT UNIQUE NOT NULL,

    -- Inviting party (the client inviting a vendor)
    inviting_tenant_id  TEXT NOT NULL,              -- TNT-XXXXXXXX of inviter
    inviting_client_id  TEXT NOT NULL,              -- TC-XXXXXXXX (client context)

    -- Invitee details
    invitee_email       TEXT NOT NULL,
    invitee_name        TEXT,

    -- Status
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

    -- Timestamps
    expires_at          TIMESTAMPTZ NOT NULL,
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),

    -- Who accepted (filled on acceptance)
    accepted_by_tenant_id TEXT,                     -- TNT-XXXXXXXX of acceptor
    accepted_by_vendor_id TEXT                      -- TV-XXXXXXXX (vendor context of acceptor)
);

CREATE INDEX IF NOT EXISTS idx_nexus_invites_token ON nexus_relationship_invites(token);
CREATE INDEX IF NOT EXISTS idx_nexus_invites_email ON nexus_relationship_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_nexus_invites_status ON nexus_relationship_invites(status);

-- ============================================================================
-- NEXUS_USERS: Users belong to a tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User identifiers
    user_id             TEXT UNIQUE NOT NULL,       -- USR-XXXXXXXX

    -- Tenant association
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX (which tenant this user belongs to)

    -- Auth
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT,

    -- Profile
    display_name        TEXT,
    first_name          TEXT,
    last_name           TEXT,
    phone               TEXT,
    avatar_url          TEXT,

    -- Role within tenant
    role                TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    -- Status
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
    email_verified      BOOLEAN DEFAULT false,

    -- Preferences
    preferences         JSONB DEFAULT '{}',

    -- Timestamps
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_users_user_id ON nexus_users(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_users_tenant_id ON nexus_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_users_email ON nexus_users(email);
CREATE INDEX IF NOT EXISTS idx_nexus_users_status ON nexus_users(status);

-- ============================================================================
-- NEXUS_SESSIONS: User sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_sessions (
    id                  TEXT PRIMARY KEY,           -- Session ID
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX

    -- Active context (which "hat" the user is wearing)
    active_context      TEXT,                       -- 'client' | 'vendor'
    active_context_id   TEXT,                       -- TC-* or TV-* depending on context
    active_counterparty TEXT,                       -- The other party's tenant_id in current context

    -- Session data
    data                JSONB DEFAULT '{}',

    -- Timestamps
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    last_active_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_sessions_user_id ON nexus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_tenant_id ON nexus_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_expires ON nexus_sessions(expires_at);

-- ============================================================================
-- ID GENERATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_nexus_id(prefix TEXT, name TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_code TEXT;
    random_suffix TEXT;
BEGIN
    -- Generate a random alphanumeric suffix
    random_suffix := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- If name provided, try to create a meaningful code
    IF name IS NOT NULL AND length(trim(name)) > 0 THEN
        -- Take first 4 chars of name, uppercase, alphanumeric only
        base_code := upper(regexp_replace(substring(trim(name) from 1 for 4), '[^A-Za-z0-9]', '', 'g'));
        -- Pad if needed
        IF length(base_code) < 4 THEN
            base_code := base_code || substring(random_suffix from 1 for (4 - length(base_code)));
        END IF;
        RETURN prefix || '-' || base_code || substring(random_suffix from 1 for 4);
    ELSE
        RETURN prefix || '-' || random_suffix;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_nexus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nexus_tenants_updated_at
    BEFORE UPDATE ON nexus_tenants
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_relationships_updated_at
    BEFORE UPDATE ON nexus_tenant_relationships
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_users_updated_at
    BEFORE UPDATE ON nexus_users
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Get tenant with all contexts
CREATE OR REPLACE VIEW nexus_tenant_contexts AS
SELECT
    t.id,
    t.tenant_id,
    t.tenant_client_id,
    t.tenant_vendor_id,
    t.name,
    t.status,
    -- Count relationships as client (I have vendors)
    (SELECT COUNT(*) FROM nexus_tenant_relationships r
     WHERE r.client_id = t.tenant_client_id AND r.status = 'active') as vendor_count,
    -- Count relationships as vendor (I serve clients)
    (SELECT COUNT(*) FROM nexus_tenant_relationships r
     WHERE r.vendor_id = t.tenant_vendor_id AND r.status = 'active') as client_count,
    -- Has multiple contexts?
    (SELECT COUNT(*) > 0 FROM nexus_tenant_relationships r
     WHERE r.client_id = t.tenant_client_id AND r.status = 'active')
    AND
    (SELECT COUNT(*) > 0 FROM nexus_tenant_relationships r
     WHERE r.vendor_id = t.tenant_vendor_id AND r.status = 'active') as has_dual_context
FROM nexus_tenants t;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE nexus_tenants IS 'Master tenant table. Every entity is a tenant with client (TC-) and vendor (TV-) sub-IDs.';
COMMENT ON TABLE nexus_tenant_relationships IS 'Binary relationships: client_id (TC-*) is CLIENT OF vendor_id (TV-*).';
COMMENT ON TABLE nexus_relationship_invites IS 'Pending invitations for vendor onboarding.';
COMMENT ON TABLE nexus_users IS 'Users belong to a tenant. Use tenant_id (TNT-*) for association.';
COMMENT ON TABLE nexus_sessions IS 'User sessions with active context tracking.';
COMMENT ON FUNCTION generate_nexus_id IS 'Generates prefixed IDs: TNT-, TC-, TV-, USR-, etc.';
