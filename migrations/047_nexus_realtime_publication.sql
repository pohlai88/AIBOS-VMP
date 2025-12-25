-- ============================================================================
-- NEXUS REALTIME PUBLICATION
-- Migration: 047_nexus_realtime_publication.sql
-- Created: 2025-12-26
-- Purpose: Enable Supabase Realtime for live updates
-- ============================================================================

-- 1. VERIFY PRE-REQUISITES
-- Ensure tables exist before attempting to alter them
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nexus_case_messages') THEN
        RAISE EXCEPTION 'Table nexus_case_messages does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nexus_payments') THEN
        RAISE EXCEPTION 'Table nexus_payments does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nexus_notifications') THEN
        RAISE EXCEPTION 'Table nexus_notifications does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nexus_tenant_relationships') THEN
        RAISE EXCEPTION 'Table nexus_tenant_relationships does not exist';
    END IF;
    RAISE NOTICE 'All required tables exist ✓';
END $$;

-- 2. ENABLE REALTIME PUBLICATION
-- Drop from publication first to ensure clean state if re-running
DO $$
BEGIN
    -- Attempt to drop tables from publication (ignore if not present)
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS nexus_case_messages;
    EXCEPTION WHEN undefined_object THEN
        -- Publication may not exist yet, that's fine
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS nexus_payments;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS nexus_notifications;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS nexus_tenant_relationships;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

-- Add tables to the supabase_realtime publication
-- Note: This publication is created by Supabase automatically
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_case_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_tenant_relationships;

-- 3. SET REPLICA IDENTITY
-- Required for UPDATE/DELETE events to include old row data
-- FULL means the entire row is included in the change payload
ALTER TABLE nexus_case_messages REPLICA IDENTITY FULL;
ALTER TABLE nexus_payments REPLICA IDENTITY FULL;
ALTER TABLE nexus_notifications REPLICA IDENTITY FULL;
ALTER TABLE nexus_tenant_relationships REPLICA IDENTITY FULL;

-- 4. CREATE VERIFICATION VIEW
-- Helper view to check publication status easily
CREATE OR REPLACE VIEW nexus_realtime_status AS
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

-- 5. GRANT ACCESS TO VIEW
GRANT SELECT ON nexus_realtime_status TO authenticated;
GRANT SELECT ON nexus_realtime_status TO anon;

-- ============================================================================
-- VERIFICATION QUERY (run manually to confirm)
-- ============================================================================
-- SELECT * FROM nexus_realtime_status;
-- Expected: 4 rows (one per table)
--
-- To check replica identity:
-- SELECT relname, relreplident
-- FROM pg_class
-- WHERE relname IN ('nexus_case_messages', 'nexus_payments', 'nexus_notifications', 'nexus_tenant_relationships');
-- Expected: relreplident = 'f' (FULL) for all tables
-- ============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Realtime publication enabled for 4 tables';
    RAISE NOTICE '   - nexus_case_messages';
    RAISE NOTICE '   - nexus_payments';
    RAISE NOTICE '   - nexus_notifications';
    RAISE NOTICE '   - nexus_tenant_relationships';
END $$;
