-- Migration: Add RLS policy for realtime notifications
-- Phase 12 validation revealed that realtime subscriptions require
-- authenticated/anon users to SELECT from nexus_notifications
-- The existing service_role bypass is not sufficient for browser WebSocket connections

-- Add SELECT policy for authenticated and anon users
-- This allows the Supabase Realtime broadcast to work through RLS
-- Drop if exists, then create (PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS notification_realtime_select ON nexus_notifications;
CREATE POLICY notification_realtime_select
  ON nexus_notifications
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PRODUCTION TODO: Harden this policy before go-live                         │
-- │                                                                             │
-- │ Replace USING (true) with proper tenant/user scoping:                      │
-- │                                                                             │
-- │ Option A (JWT claims - requires auth config):                              │
-- │   USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id')│
-- │                                                                             │
-- │ Option B (tenant scoping via app_metadata):                                │
-- │   USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))       │
-- │                                                                             │
-- │ Note: Our user_id column uses USR-* format, NOT auth.uid() UUID.           │
-- │ Don't use auth.uid()::text unless you add a mapping.                       │
-- └─────────────────────────────────────────────────────────────────────────────┘
