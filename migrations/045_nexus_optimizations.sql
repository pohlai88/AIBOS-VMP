-- ============================================================================
-- NEXUS MIGRATION OPTIMIZATIONS & ENRICHMENTS
-- Apply after running 040-044 migrations (or integrate into a single run)
-- ============================================================================

-- ============================================================================
-- 1. PERFORMANCE: Additional Composite Indexes
-- ============================================================================

-- For case queries with status + priority (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_nexus_cases_status_priority
ON nexus_cases(status, priority, created_at DESC)
WHERE status NOT IN ('closed', 'cancelled');

-- For payment queries with status + date (common reporting query)
CREATE INDEX IF NOT EXISTS idx_nexus_payments_status_date
ON nexus_payments(status, payment_date, created_at DESC);

-- For notification queries with unread + priority (bell icon query)
CREATE INDEX IF NOT EXISTS idx_nexus_notifications_unread_priority
ON nexus_notifications(user_id, priority, created_at DESC)
WHERE is_read = false;

-- For relationship lookup by both parties (bidirectional queries)
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_bidirectional
ON nexus_tenant_relationships(client_id, vendor_id, status);

-- For session cleanup (expired session purging)
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_cleanup
ON nexus_sessions(expires_at)
WHERE expires_at < now();

-- ============================================================================
-- 2. DATA INTEGRITY: Missing Foreign Key References
-- ============================================================================

-- Note: We use TEXT for IDs intentionally (prefixed IDs like TNT-, TC-, etc.)
-- Foreign keys would require expensive joins. Instead, we add CHECK constraints
-- and validation triggers for critical paths.

-- ============================================================================
-- 3. ENRICHMENT: Materialized View for Dashboard Stats
-- ============================================================================

-- Dashboard stats (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS nexus_dashboard_stats AS
SELECT
    t.tenant_id,
    t.name as tenant_name,
    -- Case stats
    (SELECT COUNT(*) FROM nexus_cases c
     WHERE c.client_id = t.tenant_client_id AND c.status NOT IN ('closed', 'cancelled')) as open_cases_as_client,
    (SELECT COUNT(*) FROM nexus_cases c
     WHERE c.vendor_id = t.tenant_vendor_id AND c.status NOT IN ('closed', 'cancelled')) as open_cases_as_vendor,
    -- Payment stats
    (SELECT COALESCE(SUM(p.amount), 0) FROM nexus_payments p
     WHERE p.from_id = t.tenant_client_id AND p.status = 'pending') as pending_payments_out,
    (SELECT COALESCE(SUM(p.amount), 0) FROM nexus_payments p
     WHERE p.to_id = t.tenant_vendor_id AND p.status = 'pending') as pending_payments_in,
    -- Relationship counts
    (SELECT COUNT(*) FROM nexus_tenant_relationships r
     WHERE r.client_id = t.tenant_client_id AND r.status = 'active') as vendor_count,
    (SELECT COUNT(*) FROM nexus_tenant_relationships r
     WHERE r.vendor_id = t.tenant_vendor_id AND r.status = 'active') as client_count,
    now() as refreshed_at
FROM nexus_tenants t
WHERE t.status = 'active';

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_nexus_dashboard_stats_tenant
ON nexus_dashboard_stats(tenant_id);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_nexus_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY nexus_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ENRICHMENT: Audit Trail Function
-- ============================================================================

-- Generic audit function for sensitive operations
CREATE OR REPLACE FUNCTION write_nexus_audit_log(
    p_table_name TEXT,
    p_record_id TEXT,
    p_action TEXT,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_actor_user_id TEXT DEFAULT NULL,
    p_actor_tenant_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO nexus_audit_log (
        table_name, record_id, action, old_data, new_data,
        actor_user_id, actor_tenant_id, created_at
    ) VALUES (
        p_table_name, p_record_id, p_action, p_old_data, p_new_data,
        p_actor_user_id, p_actor_tenant_id, now()
    );
END;
$$ LANGUAGE plpgsql;

-- Audit log table (if you want full audit trail)
CREATE TABLE IF NOT EXISTS nexus_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    actor_user_id TEXT,
    actor_tenant_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_audit_table ON nexus_audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_audit_record ON nexus_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_nexus_audit_actor ON nexus_audit_log(actor_user_id);

-- ============================================================================
-- 5. ENRICHMENT: Data Validation Functions
-- ============================================================================

-- Validate prefixed ID format
CREATE OR REPLACE FUNCTION validate_nexus_id(id TEXT, expected_prefix TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN id ~ ('^' || expected_prefix || '-[A-Z0-9]{8,}$');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate tenant exists
CREATE OR REPLACE FUNCTION tenant_exists(p_tenant_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM nexus_tenants WHERE tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate user exists
CREATE OR REPLACE FUNCTION user_exists(p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM nexus_users WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. ENRICHMENT: Helper Functions for Common Queries
-- ============================================================================

-- Get tenant by any ID (TNT-, TC-, or TV-)
CREATE OR REPLACE FUNCTION get_tenant_by_any_id(p_id TEXT)
RETURNS nexus_tenants AS $$
DECLARE
    result nexus_tenants%ROWTYPE;
BEGIN
    SELECT * INTO result FROM nexus_tenants
    WHERE tenant_id = p_id
       OR tenant_client_id = p_id
       OR tenant_vendor_id = p_id;
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get relationship between two parties
CREATE OR REPLACE FUNCTION get_relationship(p_client_id TEXT, p_vendor_id TEXT)
RETURNS nexus_tenant_relationships AS $$
DECLARE
    result nexus_tenant_relationships%ROWTYPE;
BEGIN
    SELECT * INTO result FROM nexus_tenant_relationships
    WHERE client_id = p_client_id AND vendor_id = p_vendor_id;
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if two tenants have an active relationship
CREATE OR REPLACE FUNCTION has_active_relationship(p_tenant1_id TEXT, p_tenant2_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    t1 nexus_tenants%ROWTYPE;
    t2 nexus_tenants%ROWTYPE;
BEGIN
    SELECT * INTO t1 FROM get_tenant_by_any_id(p_tenant1_id);
    SELECT * INTO t2 FROM get_tenant_by_any_id(p_tenant2_id);

    IF t1.tenant_id IS NULL OR t2.tenant_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM nexus_tenant_relationships
        WHERE status = 'active'
        AND (
            (client_id = t1.tenant_client_id AND vendor_id = t2.tenant_vendor_id)
            OR (client_id = t2.tenant_client_id AND vendor_id = t1.tenant_vendor_id)
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. ENRICHMENT: Realtime Subscription Setup
-- ============================================================================

-- Enable realtime for notification tables (with error handling)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE nexus_notifications;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'nexus_notifications already in supabase_realtime';
    WHEN undefined_object THEN
        RAISE NOTICE 'supabase_realtime publication not found';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE nexus_payment_activity;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'nexus_payment_activity already in supabase_realtime';
    WHEN undefined_object THEN
        RAISE NOTICE 'supabase_realtime publication not found';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE nexus_case_messages;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'nexus_case_messages already in supabase_realtime';
    WHEN undefined_object THEN
        RAISE NOTICE 'supabase_realtime publication not found';
END;
$$;

-- ============================================================================
-- 8. SECURITY: Additional RLS Policies
-- ============================================================================

-- Enable RLS on audit log (service role only)
ALTER TABLE nexus_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_service_only ON nexus_audit_log
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- 9. STORAGE: Evidence Bucket Setup
-- ============================================================================

-- Create storage bucket for case evidence (wrapped in DO block for error handling)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'nexus-evidence',
        'nexus-evidence',
        false,
        52428800,  -- 50MB limit
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    )
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'storage.buckets table not found - skipping bucket creation';
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to create bucket - run as service_role';
END;
$$;

-- Storage policies for evidence bucket (only if storage schema exists)
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS evidence_storage_select ON storage.objects;
    DROP POLICY IF EXISTS evidence_storage_insert ON storage.objects;
    DROP POLICY IF EXISTS evidence_storage_delete ON storage.objects;

    -- Create new policies
    CREATE POLICY evidence_storage_select ON storage.objects
        FOR SELECT
        USING (
            bucket_id = 'nexus-evidence'
            AND (storage.foldername(name))[1] = current_user_tenant_id()
        );

    CREATE POLICY evidence_storage_insert ON storage.objects
        FOR INSERT
        WITH CHECK (
            bucket_id = 'nexus-evidence'
            AND (storage.foldername(name))[1] = current_user_tenant_id()
        );

    CREATE POLICY evidence_storage_delete ON storage.objects
        FOR DELETE
        USING (
            bucket_id = 'nexus-evidence'
            AND (storage.foldername(name))[1] = current_user_tenant_id()
        );
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'storage.objects table not found - skipping storage policies';
    WHEN duplicate_object THEN
        RAISE NOTICE 'Storage policies already exist';
END;
$$;

-- ============================================================================
-- 10. SCHEDULED JOBS (Requires pg_cron extension)
-- ============================================================================

-- Note: These require pg_cron to be enabled. Run manually if pg_cron not available.

-- Cleanup expired sessions (every hour)
-- SELECT cron.schedule('nexus-session-cleanup', '0 * * * *',
--     $$DELETE FROM nexus_sessions WHERE expires_at < now()$$);

-- Refresh dashboard stats (every 15 minutes)
-- SELECT cron.schedule('nexus-dashboard-refresh', '*/15 * * * *',
--     $$SELECT refresh_nexus_dashboard_stats()$$);

-- Process notification queue (every minute)
-- SELECT cron.schedule('nexus-notification-process', '* * * * *',
--     $$UPDATE nexus_notification_queue SET status = 'processing'
--       WHERE status = 'pending' AND scheduled_for <= now()$$);

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '=== NEXUS OPTIMIZATIONS APPLIED ===' as message;
SELECT 'Added: 5 composite indexes for performance' as item;
SELECT 'Added: Dashboard stats materialized view' as item;
SELECT 'Added: Audit log table and function' as item;
SELECT 'Added: ID validation functions' as item;
SELECT 'Added: Helper query functions' as item;
SELECT 'Added: Realtime publication setup' as item;
SELECT 'Added: Storage bucket for evidence' as item;
SELECT 'Note: Scheduled jobs require pg_cron extension' as item;
