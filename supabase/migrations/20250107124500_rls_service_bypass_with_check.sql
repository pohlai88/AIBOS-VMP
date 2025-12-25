-- Migration: Fix RLS policies for service_role bypass
-- Problem: Policies had `WITH CHECK (null)` which blocks INSERT/UPDATE
-- Solution: Recreate with `WITH CHECK (true)` for full service_role access
-- Applied manually via Supabase MCP on 2025-01-07

-- ============================================================================
-- DEBUG FUNCTION (for troubleshooting RLS context)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debug_auth_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'auth_role', current_setting('request.jwt.claims', true)::jsonb->>'role',
    'auth_uid', auth.uid()::text,
    'jwt', current_setting('request.jwt.claims', true)::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.debug_auth_context() IS 'Debug: Returns current auth context for RLS troubleshooting';

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES (with proper WITH CHECK)
-- ============================================================================

-- Drop old policies that may have NULL WITH CHECK
DROP POLICY IF EXISTS "user_service_bypass" ON nexus_users;
DROP POLICY IF EXISTS "session_service_bypass" ON nexus_sessions;
DROP POLICY IF EXISTS "tenant_service_bypass" ON nexus_tenants;

-- Recreate with explicit WITH CHECK (true)
CREATE POLICY "user_service_bypass"
  ON nexus_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "session_service_bypass"
  ON nexus_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "tenant_service_bypass"
  ON nexus_tenants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SESSION POLICIES FOR ANON/AUTHENTICATED
-- ============================================================================

-- Allow anon role to manage sessions (for login flow before user is authenticated)
DROP POLICY IF EXISTS "session_anon_insert" ON nexus_sessions;
DROP POLICY IF EXISTS "session_anon_manage" ON nexus_sessions;
DROP POLICY IF EXISTS "session_auth_manage" ON nexus_sessions;

CREATE POLICY "session_anon_manage"
  ON nexus_sessions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "session_auth_manage"
  ON nexus_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TENANT READ POLICY FOR AUTHENTICATED USERS
-- ============================================================================

DROP POLICY IF EXISTS "tenant_member_read" ON nexus_tenants;

CREATE POLICY "tenant_member_read"
  ON nexus_tenants
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.jwt_nexus_tenant_id());
