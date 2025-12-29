-- ============================================================================
-- Migration 052: Supabase Security & Performance Fixes
-- Created: 2025-12-26
-- Purpose: Fix critical security and performance issues identified by Supabase advisors
-- ============================================================================

-- ============================================================================
-- CRITICAL SECURITY FIXES (ERROR LEVEL)
-- ============================================================================

-- 1. Remove SECURITY DEFINER from views (security risk)
-- Views should not run with elevated privileges

-- Fix nexus_realtime_status view
DROP VIEW IF EXISTS nexus_realtime_status CASCADE;
CREATE VIEW nexus_realtime_status AS
SELECT
    pubname,
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN (
    'nexus_case_messages',
    'nexus_payments',
    'nexus_notifications',
    'nexus_tenant_relationships'
  );

-- Re-grant permissions
GRANT SELECT ON nexus_realtime_status TO authenticated;
GRANT SELECT ON nexus_realtime_status TO anon;

COMMENT ON VIEW nexus_realtime_status IS 'Helper view to check realtime publication status. No SECURITY DEFINER.';

-- Fix nexus_notification_counts view
DROP VIEW IF EXISTS nexus_notification_counts CASCADE;
CREATE VIEW nexus_notification_counts AS
SELECT
    user_id,
    tenant_id,
    COUNT(*) as total_unread,
    COUNT(*) FILTER (WHERE notification_type LIKE 'payment_%') as payment_unread,
    COUNT(*) FILTER (WHERE notification_type LIKE 'case_%' OR notification_type = 'message_received') as case_unread,
    COUNT(*) FILTER (WHERE priority = 'critical') as critical_unread
FROM nexus_notifications
WHERE is_read = false
GROUP BY user_id, tenant_id;

-- Grant permissions
GRANT SELECT ON nexus_notification_counts TO authenticated;
GRANT SELECT ON nexus_notification_counts TO anon;

COMMENT ON VIEW nexus_notification_counts IS 'Unread notification counts by user. No SECURITY DEFINER.';

-- 2. Enable RLS on nexus_document_requests (CRITICAL: currently unprotected)
ALTER TABLE nexus_document_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nexus_document_requests
-- Users can view requests where they are the client or vendor
CREATE POLICY "Users can view document requests for their tenant"
  ON nexus_document_requests
  FOR SELECT
  TO authenticated, anon
  USING (
    client_id = (SELECT jwt_nexus_tenant_client_id())
    OR vendor_id = (SELECT jwt_nexus_tenant_vendor_id())
  );

-- Users can create requests as clients
CREATE POLICY "Users can create document requests as clients"
  ON nexus_document_requests
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    client_id = (SELECT jwt_nexus_tenant_client_id())
  );

-- Users can update requests where they are the vendor (to upload/respond)
CREATE POLICY "Users can update document requests as vendors"
  ON nexus_document_requests
  FOR UPDATE
  TO authenticated, anon
  USING (
    vendor_id = (SELECT jwt_nexus_tenant_vendor_id())
  )
  WITH CHECK (
    vendor_id = (SELECT jwt_nexus_tenant_vendor_id())
  );

-- Service role bypass (for backend operations)
CREATE POLICY "Service role has full access to document requests"
  ON nexus_document_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE nexus_document_requests IS 'C10: Structured document exchange between client and vendor. RLS enabled for security.';

-- ============================================================================
-- SECURITY FIXES (WARN LEVEL)
-- ============================================================================

-- 3. Fix function search_path (prevent search_path injection attacks)
-- Set search_path explicitly for all functions

-- Fix update_nexus_updated_at
CREATE OR REPLACE FUNCTION update_nexus_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix jwt_nexus_tenant_id
CREATE OR REPLACE FUNCTION jwt_nexus_tenant_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'nexus_tenant_id');
END;
$$;

-- Fix jwt_nexus_user_id
CREATE OR REPLACE FUNCTION jwt_nexus_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'nexus_user_id');
END;
$$;

-- Fix generate_nexus_id
CREATE OR REPLACE FUNCTION generate_nexus_id(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  timestamp_part TEXT;
  random_part TEXT;
BEGIN
  timestamp_part := to_char(now(), 'YYYYMMDDHH24MISS');
  random_part := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  RETURN prefix || '-' || timestamp_part || '-' || random_part;
END;
$$;

-- Fix debug_auth_context
CREATE OR REPLACE FUNCTION debug_auth_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'auth_role', current_setting('request.jwt.claims', true)::jsonb->>'role',
    'auth_uid', auth.uid()::text,
    'jwt', current_setting('request.jwt.claims', true)::jsonb
  );
END;
$$;

-- Fix jwt_nexus_tenant_client_id
CREATE OR REPLACE FUNCTION jwt_nexus_tenant_client_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'nexus_tenant_client_id');
END;
$$;

-- Fix jwt_nexus_tenant_vendor_id
CREATE OR REPLACE FUNCTION jwt_nexus_tenant_vendor_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'nexus_tenant_vendor_id');
END;
$$;

-- Fix validate_nexus_id (keep original parameter name)
CREATE OR REPLACE FUNCTION validate_nexus_id(id TEXT, expected_prefix TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN id IS NOT NULL 
    AND id LIKE expected_prefix || '-%'
    AND length(id) >= length(expected_prefix) + 20; -- Minimum length check
END;
$$;

-- Fix trigger_set_updated_at (generic trigger function)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PERFORMANCE FIXES
-- ============================================================================

-- 4. Add missing foreign key index
CREATE INDEX IF NOT EXISTS idx_nexus_relationship_invites_tenant_id 
  ON nexus_relationship_invites(inviting_tenant_id);

COMMENT ON INDEX idx_nexus_relationship_invites_tenant_id IS 
  'Index for foreign key fk_relationship_invites_tenant to improve query performance';

-- 5. Remove duplicate indexes
DROP INDEX IF EXISTS idx_nexus_messages_case_id; -- Keep idx_nexus_case_messages_case_id
DROP INDEX IF EXISTS idx_vmp_cases_status_created; -- Keep idx_vmp_cases_status_created_at

-- ============================================================================
-- RLS POLICY PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Fix RLS policies that re-evaluate auth functions for each row
-- Wrap auth function calls in (SELECT ...) to evaluate once per query

-- Note: This requires checking each policy individually. The advisors identified
-- many policies that need this fix. For now, we'll document the pattern and
-- fix a few critical ones. Full fix would require reviewing all policies.

-- Example pattern for fixing RLS policies:
-- OLD: USING (auth.uid() = user_id)
-- NEW: USING ((SELECT auth.uid()) = user_id)

-- Fix critical policies that are likely to be hit frequently:

-- vmp_cases: Internal users can delete cases
DO $$
BEGIN
  -- Drop and recreate with optimized version
  DROP POLICY IF EXISTS "Internal users can delete cases in their tenant" ON vmp_cases;
  
  CREATE POLICY "Internal users can delete cases in their tenant"
    ON vmp_cases
    FOR DELETE
    TO authenticated, anon
    USING (
      tenant_id IN (
        SELECT tenant_id 
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
END $$;

-- vmp_messages: Users can update their own messages
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own messages" ON vmp_messages;
  
  CREATE POLICY "Users can update their own messages"
    ON vmp_messages
    FOR UPDATE
    TO authenticated, anon
    USING (
      sender_user_id IN (
        SELECT vu.id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
      )
    )
    WITH CHECK (
      sender_user_id IN (
        SELECT vu.id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
      )
    );
END $$;

-- vmp_messages: Internal users can delete messages
DO $$
BEGIN
  DROP POLICY IF EXISTS "Internal users can delete messages" ON vmp_messages;
  
  CREATE POLICY "Internal users can delete messages"
    ON vmp_messages
    FOR DELETE
    TO authenticated, anon
    USING (
      EXISTS (
        SELECT 1
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
END $$;

-- vmp_evidence: Internal users can delete evidence
DO $$
BEGIN
  DROP POLICY IF EXISTS "Internal users can delete evidence" ON vmp_evidence;
  
  CREATE POLICY "Internal users can delete evidence"
    ON vmp_evidence
    FOR DELETE
    TO authenticated, anon
    USING (
      EXISTS (
        SELECT 1
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
END $$;

-- vmp_vendor_users: Users can view vendor users in their vendor
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view vendor users in their vendor" ON vmp_vendor_users;
  
  CREATE POLICY "Users can view vendor users in their vendor"
    ON vmp_vendor_users
    FOR SELECT
    TO authenticated, anon
    USING (
      vendor_id IN (
        SELECT vu.vendor_id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
      )
      OR is_super_admin = true
    );
END $$;

-- vmp_sessions: Users can manage their own sessions
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their own sessions" ON vmp_sessions;
  
  CREATE POLICY "Users can manage their own sessions"
    ON vmp_sessions
    FOR ALL
    TO authenticated, anon
    USING (
      user_id IN (
        SELECT vu.id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
      )
    )
    WITH CHECK (
      user_id IN (
        SELECT vu.id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
      )
    );
END $$;

-- vmp_invites: Internal users policies (3 policies)
DO $$
BEGIN
  -- Create invites
  DROP POLICY IF EXISTS "Internal users can create invites for their vendor" ON vmp_invites;
  CREATE POLICY "Internal users can create invites for their vendor"
    ON vmp_invites
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
      vendor_id IN (
        SELECT vu.vendor_id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
  
  -- Update invites
  DROP POLICY IF EXISTS "Internal users can update invites for their vendor" ON vmp_invites;
  CREATE POLICY "Internal users can update invites for their vendor"
    ON vmp_invites
    FOR UPDATE
    TO authenticated, anon
    USING (
      vendor_id IN (
        SELECT vu.vendor_id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    )
    WITH CHECK (
      vendor_id IN (
        SELECT vu.vendor_id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
  
  -- Delete invites
  DROP POLICY IF EXISTS "Internal users can delete invites for their vendor" ON vmp_invites;
  CREATE POLICY "Internal users can delete invites for their vendor"
    ON vmp_invites
    FOR DELETE
    TO authenticated, anon
    USING (
      vendor_id IN (
        SELECT vu.vendor_id
        FROM vmp_vendor_users vu
        JOIN vmp_auth_user_mapping aum ON vu.id = aum.vmp_user_id
        WHERE aum.auth_user_id = (SELECT auth.uid())
          AND vu.is_internal = true
      )
    );
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Security fixes applied:';
  RAISE NOTICE '   - Removed SECURITY DEFINER from views';
  RAISE NOTICE '   - Enabled RLS on nexus_document_requests';
  RAISE NOTICE '   - Fixed function search_path for 9 functions';
  RAISE NOTICE '✅ Performance fixes applied:';
  RAISE NOTICE '   - Added missing foreign key index';
  RAISE NOTICE '   - Removed duplicate indexes';
  RAISE NOTICE '   - Optimized RLS policies (wrapped auth functions in SELECT)';
END $$;

