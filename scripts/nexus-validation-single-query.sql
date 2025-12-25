-- ============================================================================
-- NEXUS COMPREHENSIVE PRE-MIGRATION VALIDATION
-- Single query for Supabase SQL Editor / MCP
-- Project: vrawceruzokxitybkufk
-- ============================================================================

-- Run this query to validate before running migrations 040-045

WITH validation_results AS (
    -- 1. Check for conflicting nexus_* tables
    SELECT
        '1_CONFLICT_CHECK' as check_type,
        'nexus_tables' as category,
        COALESCE(
            (SELECT string_agg(table_name, ', ')
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name LIKE 'nexus_%'),
            'NONE - Safe to proceed'
        ) as result,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'nexus_%'
        ) THEN '❌ CONFLICT' ELSE '✅ CLEAR' END as status

    UNION ALL

    -- 2. Check for conflicting functions
    SELECT
        '2_FUNCTION_CHECK',
        'rls_functions',
        COALESCE(
            (SELECT string_agg(routine_name, ', ')
             FROM information_schema.routines
             WHERE routine_schema = 'public'
             AND routine_name IN ('current_user_tenant_id', 'current_user_id', 'current_user_client_id', 'current_user_vendor_id')),
            'NONE - Safe to proceed'
        ),
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name IN ('current_user_tenant_id', 'current_user_id', 'current_user_client_id', 'current_user_vendor_id')
        ) THEN '⚠️ EXISTS (will be replaced)' ELSE '✅ CLEAR' END

    UNION ALL

    -- 3. Check legacy VMP tables
    SELECT
        '3_LEGACY_CHECK',
        'vmp_tables',
        COALESCE(
            (SELECT string_agg(table_name, ', ')
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name LIKE 'vmp_%'),
            'NONE'
        ),
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'vmp_%'
        ) THEN 'ℹ️ Legacy exists (keep for now)' ELSE '✅ No legacy' END

    UNION ALL

    -- 4. Check pgcrypto extension
    SELECT
        '4_EXTENSION_CHECK',
        'pgcrypto',
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
             THEN 'pgcrypto installed'
             ELSE 'pgcrypto NOT installed'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
             THEN '✅ OK' ELSE '❌ REQUIRED' END

    UNION ALL

    -- 5. Check service_role exists
    SELECT
        '5_ROLE_CHECK',
        'service_role',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
             THEN 'service_role exists'
             ELSE 'service_role missing'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
             THEN '✅ OK' ELSE '⚠️ Check Supabase setup' END

    UNION ALL

    -- 6. Check authenticated role exists
    SELECT
        '6_ROLE_CHECK',
        'authenticated',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN 'authenticated role exists'
             ELSE 'authenticated role missing'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN '✅ OK' ELSE '⚠️ Check Supabase setup' END

    UNION ALL

    -- 7. Check realtime publication exists
    SELECT
        '7_REALTIME_CHECK',
        'supabase_realtime',
        CASE WHEN EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
             THEN 'supabase_realtime publication exists'
             ELSE 'supabase_realtime missing'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
             THEN '✅ OK' ELSE '⚠️ Realtime may not work' END

    UNION ALL

    -- 8. Check storage schema exists
    SELECT
        '8_STORAGE_CHECK',
        'storage_schema',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage')
             THEN 'storage schema exists'
             ELSE 'storage schema missing'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage')
             THEN '✅ OK' ELSE '⚠️ Storage may not work' END

    UNION ALL

    -- 9. Database size check
    SELECT
        '9_SIZE_CHECK',
        'database_size',
        pg_size_pretty(pg_database_size(current_database())),
        '✅ INFO'

    UNION ALL

    -- 10. Postgres version
    SELECT
        '10_VERSION_CHECK',
        'postgres_version',
        version(),
        '✅ INFO'
)
SELECT * FROM validation_results ORDER BY check_type;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If all checks show ✅, you can safely run migrations 040-045
-- If any show ❌, address those issues first
-- ⚠️ warnings are informational - usually OK to proceed
