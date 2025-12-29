-- ============================================================================
-- NEXUS DATA INTEGRITY & RELATIONSHIP VALIDATION
-- Run this to verify referential integrity after data is inserted
-- ============================================================================

-- ============================================================================
-- 1. ORPHANED RECORDS CHECK
-- ============================================================================
SELECT '=== ORPHANED RECORDS CHECK ===' as section;

-- Users without valid tenant
SELECT 'nexus_users' as table_name, 'orphaned (no tenant)' as issue, COUNT(*) as count
FROM nexus_users u
WHERE NOT EXISTS (SELECT 1 FROM nexus_tenants t WHERE t.tenant_id = u.tenant_id)
UNION ALL

-- Sessions without valid user
SELECT 'nexus_sessions', 'orphaned (no user)', COUNT(*)
FROM nexus_sessions s
WHERE NOT EXISTS (SELECT 1 FROM nexus_users u WHERE u.user_id = s.user_id)
UNION ALL

-- Cases with invalid client_id
SELECT 'nexus_cases', 'invalid client_id', COUNT(*)
FROM nexus_cases c
WHERE NOT EXISTS (SELECT 1 FROM nexus_tenants t WHERE t.tenant_client_id = c.client_id)
UNION ALL

-- Cases with invalid vendor_id
SELECT 'nexus_cases', 'invalid vendor_id', COUNT(*)
FROM nexus_cases c
WHERE NOT EXISTS (SELECT 1 FROM nexus_tenants t WHERE t.tenant_vendor_id = c.vendor_id)
UNION ALL

-- Messages without valid case
SELECT 'nexus_case_messages', 'orphaned (no case)', COUNT(*)
FROM nexus_case_messages m
WHERE NOT EXISTS (SELECT 1 FROM nexus_cases c WHERE c.case_id = m.case_id)
UNION ALL

-- Payments with invalid from_id
SELECT 'nexus_payments', 'invalid from_id', COUNT(*)
FROM nexus_payments p
WHERE NOT EXISTS (SELECT 1 FROM nexus_tenants t WHERE t.tenant_client_id = p.from_id)
UNION ALL

-- Payments with invalid to_id
SELECT 'nexus_payments', 'invalid to_id', COUNT(*)
FROM nexus_payments p
WHERE NOT EXISTS (SELECT 1 FROM nexus_tenants t WHERE t.tenant_vendor_id = p.to_id)
UNION ALL

-- Notifications without valid user
SELECT 'nexus_notifications', 'orphaned (no user)', COUNT(*)
FROM nexus_notifications n
WHERE NOT EXISTS (SELECT 1 FROM nexus_users u WHERE u.user_id = n.user_id);

-- ============================================================================
-- 2. ID FORMAT VALIDATION
-- ============================================================================
SELECT '=== ID FORMAT VALIDATION ===' as section;

-- Check tenant_id format (TNT-XXXXXXXX)
SELECT 'nexus_tenants.tenant_id' as field, 'invalid format' as issue, COUNT(*) as count
FROM nexus_tenants WHERE tenant_id !~ '^TNT-[A-Z0-9]{4,}$'
UNION ALL

-- Check tenant_client_id format (TC-XXXXXXXX)
SELECT 'nexus_tenants.tenant_client_id', 'invalid format', COUNT(*)
FROM nexus_tenants WHERE tenant_client_id !~ '^TC-[A-Z0-9]{4,}$'
UNION ALL

-- Check tenant_vendor_id format (TV-XXXXXXXX)
SELECT 'nexus_tenants.tenant_vendor_id', 'invalid format', COUNT(*)
FROM nexus_tenants WHERE tenant_vendor_id !~ '^TV-[A-Z0-9]{4,}$'
UNION ALL

-- Check user_id format (USR-XXXXXXXX)
SELECT 'nexus_users.user_id', 'invalid format', COUNT(*)
FROM nexus_users WHERE user_id !~ '^USR-[A-Z0-9]{4,}$'
UNION ALL

-- Check case_id format (CASE-XXXXXXXX)
SELECT 'nexus_cases.case_id', 'invalid format', COUNT(*)
FROM nexus_cases WHERE case_id !~ '^CASE-[A-Z0-9]{4,}$'
UNION ALL

-- Check payment_id format (PAY-XXXXXXXX)
SELECT 'nexus_payments.payment_id', 'invalid format', COUNT(*)
FROM nexus_payments WHERE payment_id !~ '^PAY-[A-Z0-9]{4,}$'
UNION ALL

-- Check notification_id format (NTF-XXXXXXXX)
SELECT 'nexus_notifications.notification_id', 'invalid format', COUNT(*)
FROM nexus_notifications WHERE notification_id !~ '^NTF-[A-Z0-9]{4,}$';

-- ============================================================================
-- 3. RELATIONSHIP CONSISTENCY CHECK
-- ============================================================================
SELECT '=== RELATIONSHIP CONSISTENCY CHECK ===' as section;

-- Relationships where client and vendor are from same tenant (self-relationship)
SELECT 'self_relationship' as issue, COUNT(*) as count
FROM nexus_tenant_relationships r
JOIN nexus_tenants tc ON tc.tenant_client_id = r.client_id
JOIN nexus_tenants tv ON tv.tenant_vendor_id = r.vendor_id
WHERE tc.tenant_id = tv.tenant_id
UNION ALL

-- Cases between tenants without active relationship
SELECT 'case_no_relationship', COUNT(*)
FROM nexus_cases c
WHERE NOT EXISTS (
    SELECT 1 FROM nexus_tenant_relationships r
    WHERE r.client_id = c.client_id
    AND r.vendor_id = c.vendor_id
    AND r.status = 'active'
)
UNION ALL

-- Payments between tenants without active relationship
SELECT 'payment_no_relationship', COUNT(*)
FROM nexus_payments p
WHERE NOT EXISTS (
    SELECT 1 FROM nexus_tenant_relationships r
    WHERE r.client_id = p.from_id
    AND r.vendor_id = p.to_id
    AND r.status = 'active'
);

-- ============================================================================
-- 4. DUPLICATE CHECK
-- ============================================================================
SELECT '=== DUPLICATE CHECK ===' as section;

-- Duplicate tenant emails
SELECT 'nexus_tenants.email' as field, 'duplicates' as issue, COUNT(*) as count
FROM (
    SELECT email, COUNT(*) as cnt
    FROM nexus_tenants
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
) d
UNION ALL

-- Duplicate user emails (should be unique by constraint)
SELECT 'nexus_users.email', 'duplicates', COUNT(*)
FROM (
    SELECT email, COUNT(*) as cnt
    FROM nexus_users
    GROUP BY email
    HAVING COUNT(*) > 1
) d
UNION ALL

-- Duplicate relationship (same client-vendor pair)
SELECT 'nexus_tenant_relationships', 'duplicates', COUNT(*)
FROM (
    SELECT client_id, vendor_id, COUNT(*) as cnt
    FROM nexus_tenant_relationships
    GROUP BY client_id, vendor_id
    HAVING COUNT(*) > 1
) d;

-- ============================================================================
-- 5. STATUS CONSISTENCY CHECK
-- ============================================================================
SELECT '=== STATUS CONSISTENCY CHECK ===' as section;

-- Closed cases with pending payments
SELECT 'closed_case_pending_payment' as issue, COUNT(*) as count
FROM nexus_cases c
JOIN nexus_payments p ON p.case_id = c.case_id
WHERE c.status = 'closed' AND p.status = 'pending'
UNION ALL

-- Inactive tenants with active users
SELECT 'inactive_tenant_active_users', COUNT(*)
FROM nexus_tenants t
JOIN nexus_users u ON u.tenant_id = t.tenant_id
WHERE t.status != 'active' AND u.status = 'active'
UNION ALL

-- Expired sessions not cleaned up
SELECT 'expired_sessions', COUNT(*)
FROM nexus_sessions
WHERE expires_at < now();

-- ============================================================================
-- 6. TIMESTAMP SANITY CHECK
-- ============================================================================
SELECT '=== TIMESTAMP SANITY CHECK ===' as section;

-- Records with updated_at before created_at
SELECT 'nexus_tenants' as table_name, 'updated < created' as issue, COUNT(*) as count
FROM nexus_tenants WHERE updated_at < created_at
UNION ALL
SELECT 'nexus_users', 'updated < created', COUNT(*)
FROM nexus_users WHERE updated_at < created_at
UNION ALL
SELECT 'nexus_cases', 'updated < created', COUNT(*)
FROM nexus_cases WHERE updated_at < created_at
UNION ALL

-- Future timestamps (data integrity issue)
SELECT 'nexus_cases', 'future created_at', COUNT(*)
FROM nexus_cases WHERE created_at > now() + interval '1 minute';

-- ============================================================================
-- 7. SUMMARY STATISTICS
-- ============================================================================
SELECT '=== DATA STATISTICS ===' as section;

SELECT
    'nexus_tenants' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE status = 'active') as active_rows
FROM nexus_tenants
UNION ALL
SELECT 'nexus_users', COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
FROM nexus_users
UNION ALL
SELECT 'nexus_tenant_relationships', COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
FROM nexus_tenant_relationships
UNION ALL
SELECT 'nexus_cases', COUNT(*), COUNT(*) FILTER (WHERE status NOT IN ('closed', 'cancelled'))
FROM nexus_cases
UNION ALL
SELECT 'nexus_payments', COUNT(*), COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled'))
FROM nexus_payments
UNION ALL
SELECT 'nexus_notifications', COUNT(*), COUNT(*) FILTER (WHERE is_read = false)
FROM nexus_notifications;

-- ============================================================================
-- VALIDATION COMPLETE
-- ============================================================================
SELECT '=== DATA INTEGRITY CHECK COMPLETE ===' as section;
SELECT 'Review any rows with count > 0 above for potential issues' as note;
