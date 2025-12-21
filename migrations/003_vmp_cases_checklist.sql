-- Migration: VMP Cases & Checklist Steps
-- Created: 2025-12-22
-- Description: Creates case management and evidence checklist tables

-- ============================================================================
-- CASES
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    case_type TEXT NOT NULL CHECK (case_type IN ('onboarding', 'invoice', 'payment', 'soa', 'general')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked')),
    subject TEXT NOT NULL,
    owner_team TEXT NOT NULL DEFAULT 'procurement' CHECK (owner_team IN ('procurement', 'ap', 'finance')),
    sla_due_at TIMESTAMPTZ,
    escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0 AND escalation_level <= 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_cases IS 'Case management - tracks vendor interactions and evidence requirements';

-- ============================================================================
-- CHECKLIST STEPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_checklist_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    required_evidence_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'verified', 'rejected', 'waived')),
    waived_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_checklist_steps IS 'Evidence checklist steps for each case - enforces "evidence-first" doctrine';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_cases_tenant_id ON vmp_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_company_id ON vmp_cases(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_vendor_id ON vmp_cases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_status ON vmp_cases(status);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_case_type ON vmp_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_owner_team ON vmp_cases(owner_team);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_sla_due_at ON vmp_cases(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_created_at ON vmp_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_vmp_checklist_steps_case_id ON vmp_checklist_steps(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_checklist_steps_status ON vmp_checklist_steps(status);

