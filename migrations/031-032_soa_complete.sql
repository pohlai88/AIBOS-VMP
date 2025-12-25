-- ============================================================================
-- SOA Reconciliation Complete Migration (031 + 032)
-- ============================================================================
-- Combines: 031_vmp_soa_tables.sql + 032_vmp_debit_notes.sql
-- Apply via Supabase Dashboard SQL Editor
-- ============================================================================

-- Migration: VMP SOA Tables (Forensic Reconciliation Foundation)
-- Created: 2025-12-22
-- Description: Creates database schema for SOA (Statement of Account) mapping and reconciliation

-- ============================================================================
-- SOA ITEMS (Extracted Line Items from SOA Documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_soa_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    
    -- SOA Line Item Details (extracted from document)
    line_number INTEGER,
    invoice_number TEXT,
    invoice_date DATE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency_code TEXT NOT NULL DEFAULT 'USD',
    description TEXT,
    reference_number TEXT,
    
    -- Extraction Metadata
    extraction_method TEXT NOT NULL DEFAULT 'ai_parse' CHECK (extraction_method IN ('ai_parse', 'manual', 'csv_import')),
    extraction_confidence DECIMAL(5, 4) CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    raw_text TEXT,
    metadata JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'extracted' CHECK (status IN ('extracted', 'matched', 'discrepancy', 'resolved', 'ignored')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_soa_item_per_case UNIQUE (case_id, line_number, invoice_number)
);

COMMENT ON TABLE vmp_soa_items IS 'Extracted line items from SOA documents. Each item represents a transaction on the Statement of Account.';

-- ============================================================================
-- SOA MATCHES (Matches between SOA Items and Invoices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_soa_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soa_item_id UUID NOT NULL REFERENCES vmp_soa_items(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES vmp_invoices(id) ON DELETE CASCADE,
    
    -- Match Details
    match_type TEXT NOT NULL CHECK (match_type IN ('deterministic', 'probabilistic')),
    is_exact_match BOOLEAN NOT NULL DEFAULT false,
    match_confidence DECIMAL(5, 4) CHECK (match_confidence >= 0 AND match_confidence <= 1),
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    match_criteria JSONB, -- Which fields matched (invoice_number, amount, date, etc.)
    
    -- Amounts
    soa_amount DECIMAL(15, 2) NOT NULL,
    invoice_amount DECIMAL(15, 2) NOT NULL,
    amount_difference DECIMAL(15, 2),
    
    -- Dates
    soa_date DATE,
    invoice_date DATE,
    date_difference_days INTEGER,
    
    -- Matching Metadata
    matched_by TEXT NOT NULL DEFAULT 'system' CHECK (matched_by IN ('system', 'manual', 'ai_assisted')),
    matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'disputed')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_soa_matches IS 'Matches between SOA line items and invoices. Tracks deterministic and probabilistic matches.';

-- ============================================================================
-- SOA DISCREPANCIES (Exceptions and Discrepancies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_soa_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    soa_item_id UUID REFERENCES vmp_soa_items(id) ON DELETE SET NULL,
    match_id UUID REFERENCES vmp_soa_matches(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES vmp_invoices(id) ON DELETE SET NULL,
    
    -- Discrepancy Details
    discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
        'amount_mismatch',
        'date_mismatch',
        'missing_invoice',
        'duplicate_payment',
        'currency_mismatch',
        'tax_mismatch',
        'other'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    
    -- Values
    expected_value TEXT,
    actual_value TEXT,
    difference_amount DECIMAL(15, 2),
    
    -- Resolution
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
    resolution_action TEXT CHECK (resolution_action IN ('corrected', 'accepted', 'rejected', 'waived')),
    resolution_notes TEXT,
    resolved_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    
    -- Detection
    detected_by TEXT NOT NULL DEFAULT 'system' CHECK (detected_by IN ('system', 'manual', 'ai')),
    metadata JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_soa_discrepancies IS 'Exceptions and discrepancies found during SOA reconciliation. Tracks issues that require investigation or resolution.';

-- ============================================================================
-- SOA ACKNOWLEDGEMENTS (Reconciliation Sign-offs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_soa_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL UNIQUE REFERENCES vmp_cases(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID REFERENCES vmp_companies(id) ON DELETE SET NULL,
    
    -- Acknowledgement Details
    acknowledgement_type TEXT NOT NULL CHECK (acknowledgement_type IN ('full', 'partial', 'with_exceptions')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'rejected', 'cancelled')),
    
    -- Sign-off
    acknowledged_by_user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ,
    notes TEXT,
    
    -- Summary
    total_items INTEGER,
    matched_items INTEGER,
    unmatched_items INTEGER,
    discrepancy_count INTEGER,
    net_variance DECIMAL(15, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_acknowledgement_per_case UNIQUE (case_id)
);

COMMENT ON TABLE vmp_soa_acknowledgements IS 'SOA reconciliation acknowledgements. Tracks who acknowledged the reconciled statement and provides audit trail.';

-- ============================================================================
-- DEBIT NOTES (Native SOA Reconciliation Outcome)
-- ============================================================================
-- Migration: VMP Debit Notes (SOA Reconciliation Native Outcome)
-- Created: 2025-01-21

CREATE TABLE IF NOT EXISTS vmp_debit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID REFERENCES vmp_companies(id) ON DELETE SET NULL,
    
    -- SOA Linkage
    soa_statement_id UUID REFERENCES vmp_cases(id) ON DELETE SET NULL,
    soa_issue_id UUID REFERENCES vmp_soa_discrepancies(id) ON DELETE SET NULL,
    
    -- DN Details
    dn_no VARCHAR(50) UNIQUE,
    dn_date DATE NOT NULL DEFAULT CURRENT_DATE,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    
    -- Reason Code
    reason_code TEXT NOT NULL CHECK (reason_code IN (
        'OVERPAYMENT',
        'PRICE_VARIANCE',
        'WHT',
        'CLAIM'
    )),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'POSTED', 'VOID')),
    
    -- Approval Workflow
    approved_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    posted_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ,
    
    -- Notes
    notes TEXT,
    void_reason TEXT,
    
    -- AP Ledger Integration
    ledger_entry_id UUID,
    ledger_posted_at TIMESTAMPTZ,
    
    -- Audit
    created_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_debit_notes IS 'SOA Reconciliation Native Outcome: Debit Notes generated from variances. Controlled output, not ad-hoc accounting.';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- SOA Items Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_case_id ON vmp_soa_items(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_vendor_id ON vmp_soa_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_status ON vmp_soa_items(status);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_invoice_number ON vmp_soa_items(invoice_number) WHERE invoice_number IS NOT NULL;

-- SOA Matches Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_soa_item_id ON vmp_soa_matches(soa_item_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_invoice_id ON vmp_soa_matches(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_status ON vmp_soa_matches(status);

-- SOA Discrepancies Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_case_id ON vmp_soa_discrepancies(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_status ON vmp_soa_discrepancies(status);

-- SOA Acknowledgements Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_case_id ON vmp_soa_acknowledgements(case_id);

-- Debit Notes Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_vendor_id ON vmp_debit_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_soa_statement_id ON vmp_debit_notes(soa_statement_id) WHERE soa_statement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_debit_notes_status ON vmp_debit_notes(status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated At Trigger (uses existing function)
CREATE TRIGGER update_vmp_soa_items_updated_at
    BEFORE UPDATE ON vmp_soa_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vmp_soa_matches_updated_at
    BEFORE UPDATE ON vmp_soa_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vmp_soa_discrepancies_updated_at
    BEFORE UPDATE ON vmp_soa_discrepancies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vmp_soa_acknowledgements_updated_at
    BEFORE UPDATE ON vmp_soa_acknowledgements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vmp_debit_notes_updated_at
    BEFORE UPDATE ON vmp_debit_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETE
-- ============================================================================

