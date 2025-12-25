-- ============================================================================
-- MIGRATION 099: Remove Legacy VMP Tables
-- ============================================================================
-- Date: 2025-12-27
-- Phase: 13 - Legacy Removal
-- Purpose: Drop all vmp_* tables after successful Nexus migration
--
-- PREREQUISITES:
--   ✅ CCP-10 PASSED: Nexus fully operational with realtime
--   ✅ All Nexus tables (nexus_*) deployed and seeded
--   ✅ All users migrated to Nexus portal
--
-- WARNING: This migration is IRREVERSIBLE. Back up data before execution.
-- ============================================================================

-- Transaction for atomicity
BEGIN;

-- ============================================================================
-- STEP 1: Drop dependent tables first (child tables with foreign keys)
-- ============================================================================

-- Case-related child tables
DROP TABLE IF EXISTS vmp_checklist_steps CASCADE;
DROP TABLE IF EXISTS vmp_evidence CASCADE;
DROP TABLE IF EXISTS vmp_messages CASCADE;

-- SOA-related tables (Statement of Account)
DROP TABLE IF EXISTS vmp_soa_acknowledgements CASCADE;
DROP TABLE IF EXISTS vmp_soa_discrepancies CASCADE;
DROP TABLE IF EXISTS vmp_soa_matches CASCADE;
DROP TABLE IF EXISTS vmp_soa_items CASCADE;

-- Payment-related tables
DROP TABLE IF EXISTS vmp_payments CASCADE;
DROP TABLE IF EXISTS vmp_emergency_pay_overrides CASCADE;
DROP TABLE IF EXISTS vmp_debit_notes CASCADE;

-- Invoice and reference tables
DROP TABLE IF EXISTS vmp_invoices CASCADE;
DROP TABLE IF EXISTS vmp_grn_refs CASCADE;
DROP TABLE IF EXISTS vmp_po_refs CASCADE;

-- Auth and session tables
DROP TABLE IF EXISTS vmp_sessions CASCADE;
DROP TABLE IF EXISTS vmp_password_reset_tokens CASCADE;
DROP TABLE IF EXISTS vmp_auth_user_mapping CASCADE;
DROP TABLE IF EXISTS vmp_invites CASCADE;
DROP TABLE IF EXISTS vmp_access_requests CASCADE;
DROP TABLE IF EXISTS vmp_break_glass_events CASCADE;

-- ============================================================================
-- STEP 2: Drop junction/link tables
-- ============================================================================

DROP TABLE IF EXISTS vmp_vendor_company_links CASCADE;
DROP TABLE IF EXISTS vmp_groups CASCADE;

-- ============================================================================
-- STEP 3: Drop core entity tables (parent tables)
-- ============================================================================

DROP TABLE IF EXISTS vmp_cases CASCADE;
DROP TABLE IF EXISTS vmp_vendor_users CASCADE;
DROP TABLE IF EXISTS vmp_vendors CASCADE;
DROP TABLE IF EXISTS vmp_companies CASCADE;
DROP TABLE IF EXISTS vmp_tenants CASCADE;

-- ============================================================================
-- STEP 4: Clean up any orphaned types/enums specific to VMP
-- ============================================================================

-- Drop VMP-specific enums if they exist (check before dropping)
DO $$
BEGIN
    -- Only drop types that are NOT used by nexus_* tables
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vmp_case_status') THEN
        DROP TYPE vmp_case_status CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vmp_payment_status') THEN
        DROP TYPE vmp_payment_status CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vmp_user_role') THEN
        DROP TYPE vmp_user_role CASCADE;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Clean up storage buckets (if VMP-specific ones exist)
-- ============================================================================

-- Note: Storage bucket cleanup should be done via Supabase Dashboard
-- or Storage API, not via SQL migration

-- ============================================================================
-- STEP 6: Verification query (run after migration)
-- ============================================================================

-- This should return 0 rows after successful migration:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'vmp_%';

COMMIT;

-- ============================================================================
-- POST-MIGRATION CHECKLIST
-- ============================================================================
-- [ ] Verify no vmp_* tables remain: SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'vmp_%';
-- [ ] Verify nexus_* tables intact: SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'nexus_%';
-- [ ] Test Nexus login: alice@alpha.com / Demo123!
-- [ ] Remove legacy code from server.js
-- [ ] Delete legacy adapter: src/adapters/supabase.js
-- [ ] Delete legacy routes: src/routes/client.js, src/routes/vendor.js
-- [ ] Delete legacy templates: src/views/pages/* (except marketing)
-- [ ] Delete legacy tests: tests/server*.test.js, tests/utils/soa-*.test.js
-- ============================================================================
