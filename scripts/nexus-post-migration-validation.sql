-- ============================================================================
-- NEXUS POST-MIGRATION VALIDATION SCRIPT
-- Run this AFTER executing migrations 040-045
-- ============================================================================

-- ============================================================================
-- 1. TABLE EXISTENCE CHECK
-- ============================================================================
SELECT '=== TABLE EXISTENCE CHECK ===' as section;

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'nexus_tenants',
        'nexus_tenant_relationships',
        'nexus_relationship_invites',
        'nexus_users',
        'nexus_sessions',
        'nexus_cases',
        'nexus_case_messages',
        'nexus_case_evidence',
        'nexus_case_checklist',
        'nexus_case_activity',
        'nexus_invoices',
        'nexus_payments',
        'nexus_payment_schedule',
        'nexus_payment_activity',
        'nexus_notifications',
        'nexus_notification_config',
        'nexus_user_notification_prefs',
        'nexus_notification_queue',
        'nexus_push_subscriptions',
        'nexus_audit_log'
    ]) as table_name
)
SELECT
    e.table_name,
    CASE
        WHEN t.table_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM expected_tables e
LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = e.table_name
ORDER BY e.table_name;

-- ============================================================================
-- 2. RLS ENABLED CHECK
-- ============================================================================
SELECT '=== RLS ENABLED CHECK ===' as section;

SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'nexus_%'
ORDER BY tablename;

-- ============================================================================
-- 3. INDEX COUNT CHECK
-- ============================================================================
SELECT '=== INDEX COUNT BY TABLE ===' as section;

SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'nexus_%'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 4. FUNCTION CHECK
-- ============================================================================
SELECT '=== FUNCTION CHECK ===' as section;

WITH expected_functions AS (
    SELECT unnest(ARRAY[
        'current_user_tenant_id',
        'current_user_id',
        'current_user_client_id',
        'current_user_vendor_id',
        'generate_nexus_id',
        'update_nexus_updated_at',
        'nexus_payment_status_change',
        'nexus_notification_auto_queue',
        'get_effective_notification_config',
        'refresh_nexus_dashboard_stats',
        'nexus_audit_log',
        'validate_nexus_id',
        'tenant_exists',
        'user_exists',
        'get_tenant_by_any_id',
        'get_relationship',
        'has_active_relationship'
    ]) as function_name
)
SELECT
    e.function_name,
    CASE
        WHEN r.routine_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM expected_functions e
LEFT JOIN information_schema.routines r
    ON r.routine_schema = 'public' AND r.routine_name = e.function_name
ORDER BY e.function_name;

-- ============================================================================
-- 5. TRIGGER CHECK
-- ============================================================================
SELECT '=== TRIGGER CHECK ===' as section;

SELECT
    event_object_table as table_name,
    trigger_name,
    action_timing || ' ' || event_manipulation as trigger_type
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table LIKE 'nexus_%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 6. VIEW CHECK
-- ============================================================================
SELECT '=== VIEW CHECK ===' as section;

SELECT
    table_name as view_name,
    CASE
        WHEN table_type = 'VIEW' THEN '✅ VIEW'
        WHEN table_type = 'BASE TABLE' THEN '✅ MATERIALIZED'
        ELSE table_type
    END as type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'nexus_%'
AND table_name IN (
    'nexus_tenant_contexts',
    'nexus_cases_with_unread',
    'nexus_payments_summary',
    'nexus_invoices_outstanding',
    'nexus_notification_counts',
    'nexus_dashboard_stats'
)
ORDER BY table_name;

-- ============================================================================
-- 7. POLICY COUNT CHECK
-- ============================================================================
SELECT '=== RLS POLICY COUNT ===' as section;

SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename LIKE 'nexus_%'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 8. STORAGE BUCKET CHECK
-- ============================================================================
SELECT '=== STORAGE BUCKET CHECK ===' as section;

SELECT
    id,
    name,
    public,
    file_size_limit,
    CASE WHEN id IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM storage.buckets
WHERE name = 'nexus-evidence';

-- ============================================================================
-- 9. REALTIME PUBLICATION CHECK
-- ============================================================================
SELECT '=== REALTIME PUBLICATION CHECK ===' as section;

SELECT
    schemaname || '.' || tablename as table_name,
    '✅ REALTIME ENABLED' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'nexus_%';

-- ============================================================================
-- 10. CONSTRAINT VALIDATION
-- ============================================================================
SELECT '=== CHECK CONSTRAINT VALIDATION ===' as section;

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name LIKE 'nexus_%'
AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- VALIDATION SUMMARY
-- ============================================================================
SELECT '=== VALIDATION COMPLETE ===' as section;

SELECT
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'nexus_%') as total_tables,
    (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename LIKE 'nexus_%') as total_indexes,
    (SELECT COUNT(*) FROM information_schema.routines
     WHERE routine_schema = 'public' AND routine_name LIKE '%nexus%' OR routine_name LIKE 'current_user_%') as total_functions,
    (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename LIKE 'nexus_%') as total_policies;
