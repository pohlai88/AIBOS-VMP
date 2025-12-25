-- Migration: VMP Debit Notes (SOA Reconciliation Native Outcome)
-- Created: 2025-01-21
-- Description: Creates database schema for Debit Notes (DN) as native SOA reconciliation outcome
-- Purpose: Enable controlled DN generation from SOA variances (overpayment, pricing variance, WHT, claims)

-- ============================================================================
-- DEBIT NOTES (Native SOA Reconciliation Outcome)
-- ============================================================================
-- Stores Debit Notes generated from SOA reconciliation variances
-- DN is not manual accounting - it is a reconciliation resolution
CREATE TABLE IF NOT EXISTS vmp_debit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID REFERENCES vmp_companies(id) ON DELETE SET NULL,
    
    -- SOA Linkage
    soa_statement_id UUID REFERENCES vmp_cases(id) ON DELETE SET NULL, -- SOA case (case_type = 'soa')
    soa_issue_id UUID REFERENCES vmp_soa_discrepancies(id) ON DELETE SET NULL, -- Linked SOA issue
    
    -- DN Details
    dn_no VARCHAR(50) UNIQUE, -- Debit Note number (e.g., DN-2025-001)
    dn_date DATE NOT NULL DEFAULT CURRENT_DATE,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    
    -- Reason Code (DN Trigger Scenarios)
    reason_code TEXT NOT NULL CHECK (reason_code IN (
        'OVERPAYMENT',      -- Overpayment confirmed
        'PRICE_VARIANCE',   -- Pricing variance accepted
        'WHT',              -- WHT mismatch acknowledged
        'CLAIM'             -- General claim/chargeback
    )),
    
    -- Status (State Machine: DRAFT → APPROVED → POSTED)
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'POSTED', 'VOID')),
    
    -- Approval Workflow
    approved_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    posted_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ,
    
    -- Notes & Justification
    notes TEXT, -- Internal justification (audit trail)
    void_reason TEXT, -- Reason for voiding (if status = VOID)
    
    -- AP Ledger Integration
    ledger_entry_id UUID, -- Reference to AP ledger entry (if posted)
    ledger_posted_at TIMESTAMPTZ, -- When posted to ledger
    
    -- Audit
    created_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_debit_notes IS 'Debit Notes generated from SOA reconciliation variances. DN is a native outcome, not manual accounting.';
COMMENT ON COLUMN vmp_debit_notes.soa_statement_id IS 'SOA case this DN is linked to (case_type = ''soa'')';
COMMENT ON COLUMN vmp_debit_notes.soa_issue_id IS 'SOA issue/discrepancy that triggered this DN';
COMMENT ON COLUMN vmp_debit_notes.reason_code IS 'DN trigger scenario: OVERPAYMENT, PRICE_VARIANCE, WHT, CLAIM';
COMMENT ON COLUMN vmp_debit_notes.status IS 'State machine: DRAFT → APPROVED → POSTED (or DRAFT → VOID)';
COMMENT ON COLUMN vmp_debit_notes.ledger_entry_id IS 'Reference to AP ledger entry when posted';

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_vendor_id ON vmp_debit_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_soa_statement_id ON vmp_debit_notes(soa_statement_id) WHERE soa_statement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_soa_issue_id ON vmp_debit_notes(soa_issue_id) WHERE soa_issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_status ON vmp_debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_reason_code ON vmp_debit_notes(reason_code);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_dn_no ON vmp_debit_notes(dn_no) WHERE dn_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_created_at ON vmp_debit_notes(created_at);

-- Composite index for SOA reconciliation lookup
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_soa_status ON vmp_debit_notes(soa_statement_id, status) WHERE soa_statement_id IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_vmp_debit_notes_updated_at
    BEFORE UPDATE ON vmp_debit_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE vmp_debit_notes IS 'SOA Reconciliation Native Outcome: Debit Notes generated from variances. Controlled output, not ad-hoc accounting.';

