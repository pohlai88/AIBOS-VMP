-- ============================================================================
-- VMP DATABASE OPTIMIZATIONS
-- Migration: 046_vmp_database_optimizations
-- Applied: 2025-12-25 via Supabase MCP
-- ============================================================================
--
-- FIXES APPLIED:
-- 1. ✅ RLS enabled on 6 SOA tables (SECURITY CRITICAL)
-- 2. ✅ 12 tables now have updated_at columns
-- 3. ✅ 30+ new indexes for FK columns (PERFORMANCE)
-- 4. ✅ 12 auto-update triggers installed
-- 5. ✅ Composite indexes for common dashboard queries
--
-- ISSUES IDENTIFIED & FIXED:
-- - vmp_soa_items: RLS was DISABLED → NOW ENABLED
-- - vmp_soa_acknowledgements: RLS was DISABLED → NOW ENABLED
-- - vmp_debit_notes: RLS was DISABLED → NOW ENABLED
-- - vmp_soa_matches: RLS was DISABLED → NOW ENABLED
-- - vmp_soa_discrepancies: RLS was DISABLED → NOW ENABLED
-- - vmp_emergency_pay_overrides: RLS was DISABLED → NOW ENABLED
--
-- TABLES MISSING updated_at (FIXED):
-- - vmp_sessions, vmp_evidence, vmp_checklist_steps
-- - vmp_messages, vmp_password_reset_tokens, vmp_break_glass_events
-- - vmp_auth_user_mapping, vmp_tenants, vmp_vendor_users
-- - vmp_invites, vmp_companies, vmp_vendor_company_links
--
-- UNINDEXED FOREIGN KEYS (FIXED):
-- - 4 on vmp_soa_items
-- - 4 on vmp_soa_acknowledgements
-- - 8 on vmp_debit_notes
-- - 6 on vmp_soa_discrepancies
-- - 3 on vmp_soa_matches
-- - 5 on vmp_emergency_pay_overrides
--
-- ============================================================================

-- This migration was applied via Supabase MCP on 2025-12-25
-- Migration name in Supabase: vmp_database_optimizations_v2

-- ============================================================================
-- 1. ENABLE RLS ON ALL VMP SOA TABLES (CRITICAL SECURITY FIX)
-- ============================================================================

ALTER TABLE vmp_soa_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_soa_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_soa_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_soa_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vmp_emergency_pay_overrides ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ADD MISSING UPDATED_AT COLUMNS
-- ============================================================================

ALTER TABLE vmp_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_evidence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_checklist_steps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_password_reset_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_break_glass_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_auth_user_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_vendor_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vmp_vendor_company_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- 3. ADD MISSING INDEXES FOR FOREIGN KEYS (PERFORMANCE FIX)
-- ============================================================================

-- SOA Items indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_company_id ON vmp_soa_items(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_vendor_id ON vmp_soa_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_case_id ON vmp_soa_items(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_status ON vmp_soa_items(status);

-- SOA Acknowledgements indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_acknowledged_by ON vmp_soa_acknowledgements(acknowledged_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_company_id ON vmp_soa_acknowledgements(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_vendor_id ON vmp_soa_acknowledgements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_case_id ON vmp_soa_acknowledgements(case_id);

-- Debit Notes indexes
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_approved_by ON vmp_debit_notes(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_company_id ON vmp_debit_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_created_by ON vmp_debit_notes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_posted_by ON vmp_debit_notes(posted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_soa_issue_id ON vmp_debit_notes(soa_issue_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_tenant_id ON vmp_debit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_vendor_id ON vmp_debit_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_status ON vmp_debit_notes(status);

-- SOA Discrepancies indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_invoice_id ON vmp_soa_discrepancies(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_match_id ON vmp_soa_discrepancies(match_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_resolved_by ON vmp_soa_discrepancies(resolved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_soa_item_id ON vmp_soa_discrepancies(soa_item_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_case_id ON vmp_soa_discrepancies(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_status ON vmp_soa_discrepancies(status);

-- SOA Matches indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_soa_item_id ON vmp_soa_matches(soa_item_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_invoice_id ON vmp_soa_matches(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_status ON vmp_soa_matches(status);

-- Emergency Pay Overrides indexes
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_approved_by ON vmp_emergency_pay_overrides(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_requested_by ON vmp_emergency_pay_overrides(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_payment_id ON vmp_emergency_pay_overrides(payment_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_case_id ON vmp_emergency_pay_overrides(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_emergency_pay_overrides_status ON vmp_emergency_pay_overrides(status);

-- ============================================================================
-- 4. ADD RLS POLICIES FOR SOA TABLES
-- ============================================================================

DROP POLICY IF EXISTS soa_items_service_role ON vmp_soa_items;
CREATE POLICY soa_items_service_role ON vmp_soa_items
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS soa_acknowledgements_service_role ON vmp_soa_acknowledgements;
CREATE POLICY soa_acknowledgements_service_role ON vmp_soa_acknowledgements
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS debit_notes_service_role ON vmp_debit_notes;
CREATE POLICY debit_notes_service_role ON vmp_debit_notes
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS soa_matches_service_role ON vmp_soa_matches;
CREATE POLICY soa_matches_service_role ON vmp_soa_matches
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS soa_discrepancies_service_role ON vmp_soa_discrepancies;
CREATE POLICY soa_discrepancies_service_role ON vmp_soa_discrepancies
    FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS emergency_pay_overrides_service_role ON vmp_emergency_pay_overrides;
CREATE POLICY emergency_pay_overrides_service_role ON vmp_emergency_pay_overrides
    FOR ALL TO service_role USING (true);

-- ============================================================================
-- 5. COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vmp_cases_status_created
ON vmp_cases(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vmp_payments_vendor_status
ON vmp_payments(vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vmp_invoices_vendor_status
ON vmp_invoices(vendor_id, status, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_vmp_sessions_expires
ON vmp_sessions(expires_at);

-- ============================================================================
-- 6. CREATE UPDATED_AT TRIGGER FUNCTION AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$
DECLARE
    tbl TEXT;
    trigger_name TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'vmp_sessions', 'vmp_evidence', 'vmp_checklist_steps',
            'vmp_messages', 'vmp_password_reset_tokens', 'vmp_break_glass_events',
            'vmp_auth_user_mapping', 'vmp_tenants', 'vmp_vendor_users',
            'vmp_invites', 'vmp_companies', 'vmp_vendor_company_links'
        ])
    LOOP
        trigger_name := 'set_' || tbl || '_updated_at';
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, tbl);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            trigger_name, tbl
        );
    END LOOP;
END;
$$;
