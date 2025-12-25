-- Migration: Add RLS policy for realtime notifications
-- Phase 12 validation revealed that realtime subscriptions require
-- authenticated/anon users to SELECT from nexus_notifications
-- The existing service_role bypass is not sufficient for browser WebSocket connections

-- Add SELECT policy for authenticated and anon users
-- This allows the Supabase Realtime broadcast to work through RLS
CREATE POLICY IF NOT EXISTS notification_realtime_select
  ON nexus_notifications
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Note: This is a permissive SELECT policy. Consider restricting to:
-- USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id')
-- once JWT claims include the Nexus user_id (USR-* format)
