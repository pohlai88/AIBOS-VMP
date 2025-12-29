-- ============================================================================
-- NEXUS MIGRATION PRE-VALIDATION SCRIPT
-- Run this BEFORE executing migrations 040-044
-- ============================================================================

-- 1. CHECK FOR CONFLICTING TABLES
SELECT table_name, 'EXISTS - WILL CONFLICT' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'nexus_%'
ORDER BY table_name;

-- 2. CHECK FOR CONFLICTING FUNCTIONS
SELECT routine_name, 'EXISTS - WILL CONFLICT' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'current_user_tenant_id',
    'current_user_id',
    'current_user_client_id',
    'current_user_vendor_id'
);

-- 3. CHECK FOR EXISTING VMP TABLES (legacy)
SELECT table_name, 'LEGACY VMP TABLE' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'vmp_%'
ORDER BY table_name;

-- 4. CHECK POSTGRES EXTENSIONS REQUIRED
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
         THEN '✅ pgcrypto installed'
         ELSE '❌ pgcrypto MISSING - run: CREATE EXTENSION IF NOT EXISTS pgcrypto'
    END as pgcrypto_status;

-- 5. CHECK UUID GENERATION
SELECT
    CASE WHEN pg_typeof(gen_random_uuid()) = 'uuid'::regtype
         THEN '✅ gen_random_uuid() works'
         ELSE '❌ gen_random_uuid() NOT AVAILABLE'
    END as uuid_status;

-- 6. CHECK SERVICE ROLE EXISTS
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         THEN '✅ service_role exists'
         ELSE '⚠️ service_role may not exist (Supabase creates it)'
    END as service_role_status;

-- 7. STORAGE BUCKET CHECK (for evidence uploads)
SELECT id, name, public, 'EXISTING BUCKET' as status
FROM storage.buckets
WHERE name IN ('case-evidence', 'nexus-evidence', 'evidence')
LIMIT 5;

-- 8. ESTIMATE ROW COUNTS FOR DATA MIGRATION (if any)
-- (Will return 0 for new tables)
SELECT 'vmp_cases' as table_name, COUNT(*) as row_count FROM vmp_cases
UNION ALL
SELECT 'vmp_payments', COUNT(*) FROM vmp_payments
UNION ALL
SELECT 'vmp_vendors', COUNT(*) FROM vmp_vendors
UNION ALL
SELECT 'vmp_companies', COUNT(*) FROM vmp_companies;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT '=== PRE-MIGRATION VALIDATION COMPLETE ===' as message;
SELECT 'Review results above. If nexus_* tables exist, migrations will fail.' as warning;
SELECT 'Safe to proceed if no nexus_* tables found.' as next_step;
