-- Migration: VMP SOA Tables (Forensic Reconciliation Foundation)
-- Created: 2025-12-22
-- Description: Creates database schema for SOA (Statement of Account) mapping and reconciliation
-- Purpose: Enable probabilistic reconciliation, deterministic tie-back, and discrepancy forensics
-- Phase: Foundation layer (prepares database for VMP-07 implementation)

-- ============================================================================
-- SOA ITEMS (Extracted Line Items from SOA Documents)
-- ============================================================================
-- Stores individual line items extracted from SOA documents via AI parsing
-- Each item represents a transaction on the Statement of Account
CREATE TABLE IF NOT EXISTS vmp_soa_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    
    -- SOA Line Item Details (extracted from document)
    line_number INTEGER, -- Line number in the SOA document
    invoice_number TEXT, -- Invoice number from SOA line item
    invoice_date DATE, -- Invoice date from SOA line item
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0), -- Amount from SOA line item
    currency_code TEXT NOT NULL DEFAULT 'USD',
    description TEXT, -- Description/notes from SOA line item
    reference_number TEXT, -- Payment reference or other reference from SOA
    
    -- Extraction Metadata
    extraction_method TEXT NOT NULL DEFAULT 'ai_parse' CHECK (extraction_method IN ('ai_parse', 'manual', 'csv_import')),
    extraction_confidence DECIMAL(5, 4) CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1), -- AI confidence score (0-1)
    raw_text TEXT, -- Original text extracted from SOA document (for audit)
    metadata JSONB, -- Additional extracted fields (e.g., tax amount, discount, etc.)
    
    -- Status
    status TEXT NOT NULL DEFAULT 'extracted' CHECK (status IN ('extracted', 'matched', 'discrepancy', 'resolved', 'ignored')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure unique line items per case (by line number or invoice number)
    CONSTRAINT unique_soa_item_per_case UNIQUE (case_id, line_number, invoice_number)
);

COMMENT ON TABLE vmp_soa_items IS 'Extracted line items from SOA documents. Each item represents a transaction on the Statement of Account.';
COMMENT ON COLUMN vmp_soa_items.case_id IS 'SOA case this item belongs to (case_type = ''soa'')';
COMMENT ON COLUMN vmp_soa_items.extraction_method IS 'How this item was extracted: ai_parse (AI extraction), manual (manual entry), csv_import (CSV import)';
COMMENT ON COLUMN vmp_soa_items.extraction_confidence IS 'AI confidence score for extraction accuracy (0.0 = low confidence, 1.0 = high confidence)';
COMMENT ON COLUMN vmp_soa_items.status IS 'Item status: extracted (newly extracted), matched (matched to invoice), discrepancy (exception found), resolved (discrepancy resolved), ignored (manually ignored)';
COMMENT ON COLUMN vmp_soa_items.raw_text IS 'Original text extracted from SOA document (preserved for forensic audit)';

-- ============================================================================
-- SOA MATCHES (Probabilistic Reconciliation & Deterministic Tie-back)
-- ============================================================================
-- Stores matches between SOA items and invoices
-- Supports both probabilistic (fuzzy) and deterministic (exact) matching
CREATE TABLE IF NOT EXISTS vmp_soa_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soa_item_id UUID NOT NULL REFERENCES vmp_soa_items(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES vmp_invoices(id) ON DELETE CASCADE,
    
    -- Match Type
    match_type TEXT NOT NULL CHECK (match_type IN ('deterministic', 'probabilistic')),
    
    -- Deterministic Match (Exact 1-to-1)
    -- Used when: invoice_number + amount + date all match exactly
    is_exact_match BOOLEAN NOT NULL DEFAULT false,
    
    -- Probabilistic Match (Fuzzy Matching)
    -- Used when: partial matches with confidence scoring
    match_confidence DECIMAL(5, 4) NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 1), -- Match confidence (0-1)
    match_score INTEGER, -- Composite match score (0-100)
    match_criteria JSONB, -- Which fields matched (e.g., {"invoice_number": true, "amount": true, "date": false})
    
    -- Amount Reconciliation
    soa_amount DECIMAL(15, 2) NOT NULL, -- Amount from SOA item
    invoice_amount DECIMAL(15, 2) NOT NULL, -- Amount from invoice
    amount_difference DECIMAL(15, 2) GENERATED ALWAYS AS (invoice_amount - soa_amount) STORED, -- Calculated difference
    amount_match_percentage DECIMAL(5, 2), -- Percentage match (100% = exact, <100% = discrepancy)
    
    -- Date Reconciliation
    soa_date DATE, -- Date from SOA item
    invoice_date DATE NOT NULL, -- Date from invoice
    date_difference_days INTEGER GENERATED ALWAYS AS (EXTRACT(DAY FROM (invoice_date - soa_date))) STORED, -- Days difference
    
    -- Match Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'discrepancy')),
    confirmed_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    rejection_reason TEXT, -- If rejected, reason for rejection
    
    -- Audit
    matched_by TEXT NOT NULL DEFAULT 'system' CHECK (matched_by IN ('system', 'manual', 'ai')),
    matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB, -- Additional match metadata (e.g., algorithm version, matching rules used)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one match per SOA item (can be updated/replaced)
    CONSTRAINT unique_match_per_soa_item UNIQUE (soa_item_id)
);

COMMENT ON TABLE vmp_soa_matches IS 'Matches between SOA items and invoices. Supports deterministic tie-back (exact matches) and probabilistic reconciliation (fuzzy matches).';
COMMENT ON COLUMN vmp_soa_matches.match_type IS 'Match type: deterministic (exact 1-to-1 match), probabilistic (fuzzy match with confidence)';
COMMENT ON COLUMN vmp_soa_matches.is_exact_match IS 'True if this is a deterministic tie-back (all fields match exactly)';
COMMENT ON COLUMN vmp_soa_matches.match_confidence IS 'Confidence score for probabilistic reconciliation (0.0 = low confidence, 1.0 = high confidence)';
COMMENT ON COLUMN vmp_soa_matches.match_criteria IS 'JSON object indicating which fields matched: {"invoice_number": true, "amount": true, "date": false}';
COMMENT ON COLUMN vmp_soa_matches.amount_difference IS 'Calculated difference: invoice_amount - soa_amount (positive = invoice higher, negative = SOA higher)';
COMMENT ON COLUMN vmp_soa_matches.status IS 'Match status: pending (awaiting confirmation), confirmed (user confirmed match), rejected (user rejected match), discrepancy (exception found)';
COMMENT ON COLUMN vmp_soa_matches.matched_by IS 'Who/what created this match: system (auto-match), manual (user created), ai (AI-assisted)';

-- ============================================================================
-- SOA DISCREPANCIES (Discrepancy Forensics)
-- ============================================================================
-- Stores exceptions and discrepancies found during SOA reconciliation
-- Used for forensic analysis and resolution tracking
CREATE TABLE IF NOT EXISTS vmp_soa_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    soa_item_id UUID REFERENCES vmp_soa_items(id) ON DELETE SET NULL, -- Optional: link to specific SOA item
    match_id UUID REFERENCES vmp_soa_matches(id) ON DELETE SET NULL, -- Optional: link to match that caused discrepancy
    invoice_id UUID REFERENCES vmp_invoices(id) ON DELETE SET NULL, -- Optional: link to invoice involved
    
    -- Discrepancy Type
    discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
        'amount_mismatch', -- Amount doesn't match
        'date_mismatch', -- Date doesn't match
        'invoice_not_found', -- Invoice not found in system
        'duplicate_invoice', -- Multiple invoices match same SOA item
        'missing_soa_item', -- Invoice exists but no SOA item
        'currency_mismatch', -- Currency doesn't match
        'other' -- Other discrepancy
    )),
    
    -- Discrepancy Details
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL, -- Human-readable description of discrepancy
    expected_value TEXT, -- Expected value (for comparison)
    actual_value TEXT, -- Actual value (for comparison)
    difference_amount DECIMAL(15, 2), -- Amount difference (if applicable)
    difference_percentage DECIMAL(5, 2), -- Percentage difference (if applicable)
    
    -- Resolution
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'waived', 'escalated')),
    resolution_notes TEXT, -- Resolution explanation
    resolved_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_action TEXT CHECK (resolution_action IN ('corrected', 'waived', 'escalated', 'ignored')),
    
    -- Forensic Metadata
    detected_by TEXT NOT NULL DEFAULT 'system' CHECK (detected_by IN ('system', 'manual', 'ai')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB, -- Additional discrepancy metadata (e.g., detection algorithm, context)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_soa_discrepancies IS 'Discrepancy forensics: Exceptions and discrepancies found during SOA reconciliation. Tracks resolution workflow and audit trail.';
COMMENT ON COLUMN vmp_soa_discrepancies.discrepancy_type IS 'Type of discrepancy: amount_mismatch, date_mismatch, invoice_not_found, duplicate_invoice, missing_soa_item, currency_mismatch, other';
COMMENT ON COLUMN vmp_soa_discrepancies.severity IS 'Discrepancy severity: low (minor), medium (standard), high (significant), critical (blocking)';
COMMENT ON COLUMN vmp_soa_discrepancies.status IS 'Resolution status: open (new), investigating (under review), resolved (fixed), waived (accepted), escalated (needs attention)';
COMMENT ON COLUMN vmp_soa_discrepancies.resolution_action IS 'Action taken: corrected (data fixed), waived (accepted as-is), escalated (sent to management), ignored (dismissed)';
COMMENT ON COLUMN vmp_soa_discrepancies.detected_by IS 'Who/what detected this discrepancy: system (auto-detection), manual (user reported), ai (AI detection)';

-- ============================================================================
-- SOA ACKNOWLEDGEMENTS (Reconciliation Confirmation)
-- ============================================================================
-- Stores acknowledgements for reconciled SOA statements
-- Tracks who acknowledged, when, and audit trail
CREATE TABLE IF NOT EXISTS vmp_soa_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    
    -- Acknowledgement Details
    acknowledgement_type TEXT NOT NULL DEFAULT 'full' CHECK (acknowledgement_type IN ('full', 'partial', 'with_exceptions')),
    total_items INTEGER NOT NULL, -- Total SOA items
    matched_items INTEGER NOT NULL DEFAULT 0, -- Items successfully matched
    discrepancy_items INTEGER NOT NULL DEFAULT 0, -- Items with discrepancies
    unmatched_items INTEGER NOT NULL DEFAULT 0, -- Items not matched
    
    -- Reconciliation Summary
    total_amount DECIMAL(15, 2) NOT NULL, -- Total SOA amount
    matched_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Amount successfully matched
    discrepancy_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Amount with discrepancies
    unmatched_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Amount not matched
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'rejected', 'cancelled')),
    acknowledged_by_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    acknowledgement_notes TEXT, -- Notes from user acknowledging
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one acknowledgement per case (can be updated)
    CONSTRAINT unique_acknowledgement_per_case UNIQUE (case_id)
);

COMMENT ON TABLE vmp_soa_acknowledgements IS 'SOA reconciliation acknowledgements. Tracks who acknowledged the reconciled statement and provides audit trail.';
COMMENT ON COLUMN vmp_soa_acknowledgements.acknowledgement_type IS 'Type: full (all items matched), partial (some items matched), with_exceptions (discrepancies present)';
COMMENT ON COLUMN vmp_soa_acknowledgements.status IS 'Status: pending (awaiting acknowledgement), acknowledged (confirmed), rejected (rejected by user), cancelled (cancelled)';

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- SOA Items Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_case_id ON vmp_soa_items(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_vendor_id ON vmp_soa_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_company_id ON vmp_soa_items(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_status ON vmp_soa_items(status);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_invoice_number ON vmp_soa_items(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_invoice_date ON vmp_soa_items(invoice_date) WHERE invoice_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_extraction_method ON vmp_soa_items(extraction_method);
-- Composite index for case status lookup
CREATE INDEX IF NOT EXISTS idx_vmp_soa_items_case_status ON vmp_soa_items(case_id, status);

-- SOA Matches Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_soa_item_id ON vmp_soa_matches(soa_item_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_invoice_id ON vmp_soa_matches(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_match_type ON vmp_soa_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_status ON vmp_soa_matches(status);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_is_exact_match ON vmp_soa_matches(is_exact_match) WHERE is_exact_match = true;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_confidence ON vmp_soa_matches(match_confidence) WHERE match_type = 'probabilistic';
-- Composite index for match lookup
CREATE INDEX IF NOT EXISTS idx_vmp_soa_matches_item_status ON vmp_soa_matches(soa_item_id, status);

-- SOA Discrepancies Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_case_id ON vmp_soa_discrepancies(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_soa_item_id ON vmp_soa_discrepancies(soa_item_id) WHERE soa_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_match_id ON vmp_soa_discrepancies(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_invoice_id ON vmp_soa_discrepancies(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_type ON vmp_soa_discrepancies(discrepancy_type);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_status ON vmp_soa_discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_severity ON vmp_soa_discrepancies(severity);
-- Composite index for case discrepancy lookup
CREATE INDEX IF NOT EXISTS idx_vmp_soa_discrepancies_case_status ON vmp_soa_discrepancies(case_id, status);

-- SOA Acknowledgements Indexes
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_case_id ON vmp_soa_acknowledgements(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_vendor_id ON vmp_soa_acknowledgements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_company_id ON vmp_soa_acknowledgements(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_status ON vmp_soa_acknowledgements(status);
CREATE INDEX IF NOT EXISTS idx_vmp_soa_acknowledgements_acknowledged_at ON vmp_soa_acknowledgements(acknowledged_at) WHERE acknowledged_at IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
-- Auto-update updated_at timestamp on row updates

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

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE vmp_soa_items IS 'Forensic Foundation: Extracted line items from SOA documents. Prepared for AI parsing and reconciliation workflows.';
COMMENT ON TABLE vmp_soa_matches IS 'Reconciliation Engine: Probabilistic reconciliation and deterministic tie-back between SOA items and invoices.';
COMMENT ON TABLE vmp_soa_discrepancies IS 'Discrepancy Forensics: Exception tracking and resolution workflow for SOA reconciliation discrepancies.';
COMMENT ON TABLE vmp_soa_acknowledgements IS 'Reconciliation Confirmation: Acknowledgement tracking and audit trail for reconciled SOA statements.';



