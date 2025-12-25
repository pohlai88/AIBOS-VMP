-- Migration: VMP Row Level Security (RLS)
-- Created: 2025-12-22
-- Description: Enables RLS on all VMP tables with service role bypass policies
-- 
-- IMPORTANT: This migration enables RLS but uses service role bypass for now.
-- In production, replace with proper tenant-based policies.

-- ============================================================================
-- ENABLE RLS ON ALL VMP TABLES
-- ============================================================================

ALTER TABLE vmp_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_vendor_company_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_vendor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_checklist_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES (Temporary - for development)
-- ============================================================================
-- NOTE: These policies allow service role to bypass RLS.
-- In production, replace with proper tenant-based policies.

-- vmp_tenants
DROP POLICY IF EXISTS "Service role has full access to tenants" ON vmp_tenants;
CREATE POLICY "Service role has full access to tenants"
    ON vmp_tenants FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_companies
DROP POLICY IF EXISTS "Service role has full access to companies" ON vmp_companies;
CREATE POLICY "Service role has full access to companies"
    ON vmp_companies FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_vendors
DROP POLICY IF EXISTS "Service role has full access to vendors" ON vmp_vendors;
CREATE POLICY "Service role has full access to vendors"
    ON vmp_vendors FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_vendor_company_links
DROP POLICY IF EXISTS "Service role has full access to vendor company links" ON vmp_vendor_company_links;
CREATE POLICY "Service role has full access to vendor company links"
    ON vmp_vendor_company_links FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_vendor_users
DROP POLICY IF EXISTS "Service role has full access to vendor users" ON vmp_vendor_users;
CREATE POLICY "Service role has full access to vendor users"
    ON vmp_vendor_users FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_sessions
DROP POLICY IF EXISTS "Service role has full access to sessions" ON vmp_sessions;
CREATE POLICY "Service role has full access to sessions"
    ON vmp_sessions FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_cases
DROP POLICY IF EXISTS "Service role has full access to cases" ON vmp_cases;
CREATE POLICY "Service role has full access to cases"
    ON vmp_cases FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_checklist_steps
DROP POLICY IF EXISTS "Service role has full access to checklist steps" ON vmp_checklist_steps;
CREATE POLICY "Service role has full access to checklist steps"
    ON vmp_checklist_steps FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_evidence
DROP POLICY IF EXISTS "Service role has full access to evidence" ON vmp_evidence;
CREATE POLICY "Service role has full access to evidence"
    ON vmp_evidence FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_messages
DROP POLICY IF EXISTS "Service role has full access to messages" ON vmp_messages;
CREATE POLICY "Service role has full access to messages"
    ON vmp_messages FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- vmp_invites
DROP POLICY IF EXISTS "Service role has full access to invites" ON vmp_invites;
CREATE POLICY "Service role has full access to invites"
    ON vmp_invites FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Service role has full access to tenants" ON vmp_tenants IS 
    'Temporary policy for development. Replace with tenant-based policies in production.';

COMMENT ON POLICY "Service role has full access to cases" ON vmp_cases IS 
    'Temporary policy for development. Replace with tenant-based policies in production.';

