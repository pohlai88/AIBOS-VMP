-- Migration: Production RLS policies for Nexus Realtime
-- Created: 2025-12-27
-- Purpose: Replace USING(true) with proper tenant/user scoping
-- Prerequisite: JWT app_metadata must contain nexus_user_id and nexus_tenant_id

-- ============================================================================
-- HELPER FUNCTIONS (call these in policies for cleaner SQL)
-- ============================================================================

-- Helper: current Nexus user id (USR-*)
-- Returns NULL if not present (which naturally denies access)
CREATE OR REPLACE FUNCTION public.jwt_nexus_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'nexus_user_id'
$$;

-- Helper: current Nexus tenant id (TNT-*)
CREATE OR REPLACE FUNCTION public.jwt_nexus_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'nexus_tenant_id'
$$;

-- ============================================================================
-- NEXUS_NOTIFICATIONS (user_id = recipient USR-*, tenant_id = TNT-*)
-- ============================================================================

-- Drop the permissive policy
DROP POLICY IF EXISTS notification_realtime_select ON public.nexus_notifications;

-- SELECT: User can see notifications targeted to them (or tenant broadcasts)
CREATE POLICY nexus_notifications_select
ON public.nexus_notifications
FOR SELECT
TO authenticated
USING (
  tenant_id = public.jwt_nexus_tenant_id()
  AND (
    user_id = public.jwt_nexus_user_id()
    OR user_id IS NULL  -- tenant-wide broadcast
  )
);

-- UPDATE: User can mark their notifications as read
CREATE POLICY nexus_notifications_mark_read
ON public.nexus_notifications
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.jwt_nexus_tenant_id()
  AND (
    user_id = public.jwt_nexus_user_id()
    OR user_id IS NULL
  )
)
WITH CHECK (
  tenant_id = public.jwt_nexus_tenant_id()
  AND (
    user_id = public.jwt_nexus_user_id()
    OR user_id IS NULL
  )
);

-- ============================================================================
-- NEXUS_CASES (client_id, vendor_id = TC-*/TV-* tenant IDs)
-- ============================================================================

-- SELECT: User can see cases where their tenant is client or vendor
CREATE POLICY nexus_cases_select
ON public.nexus_cases
FOR SELECT
TO authenticated
USING (
  client_id = public.jwt_nexus_tenant_id()
  OR vendor_id = public.jwt_nexus_tenant_id()
);

-- ============================================================================
-- NEXUS_CASE_MESSAGES (uses EXISTS to check parent case access)
-- ============================================================================

-- SELECT: User can see messages for cases they have access to
CREATE POLICY nexus_case_messages_select
ON public.nexus_case_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nexus_cases c
    WHERE c.case_id = nexus_case_messages.case_id
      AND (
        c.client_id = public.jwt_nexus_tenant_id()
        OR c.vendor_id = public.jwt_nexus_tenant_id()
      )
  )
);

-- INSERT: User can send messages to cases they have access to
CREATE POLICY nexus_case_messages_insert
ON public.nexus_case_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = public.jwt_nexus_user_id()
  AND sender_tenant_id = public.jwt_nexus_tenant_id()
  AND EXISTS (
    SELECT 1
    FROM public.nexus_cases c
    WHERE c.case_id = nexus_case_messages.case_id
      AND (
        c.client_id = public.jwt_nexus_tenant_id()
        OR c.vendor_id = public.jwt_nexus_tenant_id()
      )
  )
);

-- ============================================================================
-- NEXUS_PAYMENTS (from_id, to_id = tenant IDs TC-*/TV-*)
-- ============================================================================

-- SELECT: User can see payments where their tenant is payer or payee
CREATE POLICY nexus_payments_select
ON public.nexus_payments
FOR SELECT
TO authenticated
USING (
  from_id = public.jwt_nexus_tenant_id()
  OR to_id = public.jwt_nexus_tenant_id()
);

-- ============================================================================
-- NEXUS_TENANT_RELATIONSHIPS (client_id, vendor_id = tenant IDs)
-- ============================================================================

-- SELECT: User can see relationships involving their tenant
CREATE POLICY nexus_tenant_relationships_select
ON public.nexus_tenant_relationships
FOR SELECT
TO authenticated
USING (
  client_id = public.jwt_nexus_tenant_id()
  OR vendor_id = public.jwt_nexus_tenant_id()
);

-- ============================================================================
-- PERFORMANCE INDEXES (if not already present)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nexus_notifications_user_tenant 
  ON public.nexus_notifications(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_nexus_case_messages_case_id 
  ON public.nexus_case_messages(case_id);

CREATE INDEX IF NOT EXISTS idx_nexus_cases_client_id 
  ON public.nexus_cases(client_id);

CREATE INDEX IF NOT EXISTS idx_nexus_cases_vendor_id 
  ON public.nexus_cases(vendor_id);

CREATE INDEX IF NOT EXISTS idx_nexus_payments_from_to 
  ON public.nexus_payments(from_id, to_id);

CREATE INDEX IF NOT EXISTS idx_nexus_tenant_relationships_client_vendor 
  ON public.nexus_tenant_relationships(client_id, vendor_id);

-- ============================================================================
-- VERIFICATION QUERIES (run as authenticated user, NOT service_role)
-- ============================================================================
-- These should return quickly without error when app_metadata is set correctly:
--
-- SELECT count(*) FROM public.nexus_notifications;
-- SELECT count(*) FROM public.nexus_case_messages;
-- SELECT count(*) FROM public.nexus_payments;
-- SELECT count(*) FROM public.nexus_tenant_relationships;
--
-- If any return 0 unexpectedly, check:
-- 1. JWT app_metadata contains nexus_user_id and nexus_tenant_id
-- 2. Tenant ID matches data (e.g., TNT-ALPH0001)
-- 3. User ID matches data (e.g., USR-ALIC0001)
