-- Migration: Soft Delete RLS Policies
-- Created: 2025-01-22
-- Description: Creates RLS policies to automatically hide soft-deleted records
-- Purpose: Enforce "invisible deletion" at database level

-- ============================================================================
-- 1. NEXUS CORE TABLES
-- ============================================================================

-- nexus_tenants
ALTER TABLE nexus_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_tenants_select_active" ON nexus_tenants;
CREATE POLICY "nexus_tenants_select_active" 
ON nexus_tenants FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_tenants_select_service_role" ON nexus_tenants;
CREATE POLICY "nexus_tenants_select_service_role" 
ON nexus_tenants FOR SELECT 
TO service_role
USING (true);

-- nexus_users
ALTER TABLE nexus_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_users_select_active" ON nexus_users;
CREATE POLICY "nexus_users_select_active" 
ON nexus_users FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_users_select_service_role" ON nexus_users;
CREATE POLICY "nexus_users_select_service_role" 
ON nexus_users FOR SELECT 
TO service_role
USING (true);

-- nexus_cases
ALTER TABLE nexus_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_cases_select_active" ON nexus_cases;
CREATE POLICY "nexus_cases_select_active" 
ON nexus_cases FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_cases_select_service_role" ON nexus_cases;
CREATE POLICY "nexus_cases_select_service_role" 
ON nexus_cases FOR SELECT 
TO service_role
USING (true);

-- nexus_invoices
ALTER TABLE nexus_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_invoices_select_active" ON nexus_invoices;
CREATE POLICY "nexus_invoices_select_active" 
ON nexus_invoices FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_invoices_select_service_role" ON nexus_invoices;
CREATE POLICY "nexus_invoices_select_service_role" 
ON nexus_invoices FOR SELECT 
TO service_role
USING (true);

-- nexus_payments
ALTER TABLE nexus_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_payments_select_active" ON nexus_payments;
CREATE POLICY "nexus_payments_select_active" 
ON nexus_payments FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_payments_select_service_role" ON nexus_payments;
CREATE POLICY "nexus_payments_select_service_role" 
ON nexus_payments FOR SELECT 
TO service_role
USING (true);

-- ============================================================================
-- 2. VMP CORE TABLES
-- ============================================================================

-- vmp_vendors
ALTER TABLE vmp_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_vendors_select_active" ON vmp_vendors;
CREATE POLICY "vmp_vendors_select_active" 
ON vmp_vendors FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_vendors_select_service_role" ON vmp_vendors;
CREATE POLICY "vmp_vendors_select_service_role" 
ON vmp_vendors FOR SELECT 
TO service_role
USING (true);

-- vmp_companies
ALTER TABLE vmp_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_companies_select_active" ON vmp_companies;
CREATE POLICY "vmp_companies_select_active" 
ON vmp_companies FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_companies_select_service_role" ON vmp_companies;
CREATE POLICY "vmp_companies_select_service_role" 
ON vmp_companies FOR SELECT 
TO service_role
USING (true);

-- vmp_cases
ALTER TABLE vmp_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_cases_select_active" ON vmp_cases;
CREATE POLICY "vmp_cases_select_active" 
ON vmp_cases FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_cases_select_service_role" ON vmp_cases;
CREATE POLICY "vmp_cases_select_service_role" 
ON vmp_cases FOR SELECT 
TO service_role
USING (true);

-- vmp_invoices
ALTER TABLE vmp_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_invoices_select_active" ON vmp_invoices;
CREATE POLICY "vmp_invoices_select_active" 
ON vmp_invoices FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_invoices_select_service_role" ON vmp_invoices;
CREATE POLICY "vmp_invoices_select_service_role" 
ON vmp_invoices FOR SELECT 
TO service_role
USING (true);

-- vmp_payments
ALTER TABLE vmp_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_payments_select_active" ON vmp_payments;
CREATE POLICY "vmp_payments_select_active" 
ON vmp_payments FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_payments_select_service_role" ON vmp_payments;
CREATE POLICY "vmp_payments_select_service_role" 
ON vmp_payments FOR SELECT 
TO service_role
USING (true);

-- ============================================================================
-- 3. SUPPORTING ENTITIES
-- ============================================================================

-- nexus_case_messages
ALTER TABLE nexus_case_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_case_messages_select_active" ON nexus_case_messages;
CREATE POLICY "nexus_case_messages_select_active" 
ON nexus_case_messages FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_case_messages_select_service_role" ON nexus_case_messages;
CREATE POLICY "nexus_case_messages_select_service_role" 
ON nexus_case_messages FOR SELECT 
TO service_role
USING (true);

-- nexus_case_checklist
ALTER TABLE nexus_case_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nexus_case_checklist_select_active" ON nexus_case_checklist;
CREATE POLICY "nexus_case_checklist_select_active" 
ON nexus_case_checklist FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "nexus_case_checklist_select_service_role" ON nexus_case_checklist;
CREATE POLICY "nexus_case_checklist_select_service_role" 
ON nexus_case_checklist FOR SELECT 
TO service_role
USING (true);

-- vmp_evidence
ALTER TABLE vmp_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_evidence_select_active" ON vmp_evidence;
CREATE POLICY "vmp_evidence_select_active" 
ON vmp_evidence FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_evidence_select_service_role" ON vmp_evidence;
CREATE POLICY "vmp_evidence_select_service_role" 
ON vmp_evidence FOR SELECT 
TO service_role
USING (true);

-- vmp_messages
ALTER TABLE vmp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_messages_select_active" ON vmp_messages;
CREATE POLICY "vmp_messages_select_active" 
ON vmp_messages FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_messages_select_service_role" ON vmp_messages;
CREATE POLICY "vmp_messages_select_service_role" 
ON vmp_messages FOR SELECT 
TO service_role
USING (true);

-- vmp_checklist_steps
ALTER TABLE vmp_checklist_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_checklist_steps_select_active" ON vmp_checklist_steps;
CREATE POLICY "vmp_checklist_steps_select_active" 
ON vmp_checklist_steps FOR SELECT 
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vmp_checklist_steps_select_service_role" ON vmp_checklist_steps;
CREATE POLICY "vmp_checklist_steps_select_service_role" 
ON vmp_checklist_steps FOR SELECT 
TO service_role
USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "nexus_tenants_select_active" ON nexus_tenants IS 
    'Standard users see active tenants only (deleted_at IS NULL)';
COMMENT ON POLICY "nexus_tenants_select_service_role" ON nexus_tenants IS 
    'Service role can see all tenants including deleted (for system operations)';

