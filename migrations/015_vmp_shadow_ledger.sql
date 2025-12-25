-- Migration: VMP Shadow Ledger (Manual/Hybrid Mode Support)
-- Created: 2025-12-21
-- Description: Creates Shadow Ledger tables for manual invoice upload and 3-way matching
-- Supports: CSV Ingest, Manual Mode, Hybrid Mode (ERP + Manual)

-- ============================================================================
-- INVOICES (Shadow Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    invoice_num TEXT NOT NULL, -- Invoice number (e.g., "INV-2024-001")
    invoice_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency_code TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'paid', 'disputed', 'cancelled')),
    source_system TEXT NOT NULL DEFAULT 'manual' CHECK (source_system IN ('erp', 'manual')),
    erp_ref_id TEXT, -- ERP system reference (if synced from ERP)
    po_ref TEXT, -- Purchase Order reference (for matching)
    grn_ref TEXT, -- Goods Receipt Note reference (for matching)
    description TEXT,
    due_date DATE,
    paid_date DATE,
    paid_amount DECIMAL(15, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique constraint: same invoice number per vendor+company
    UNIQUE (vendor_id, company_id, invoice_num)
);

COMMENT ON TABLE vmp_invoices IS 'Shadow Ledger: Invoice records for manual/hybrid mode (CSV ingest or ERP sync)';
COMMENT ON COLUMN vmp_invoices.source_system IS 'Data source: "erp" (synced from ERP) or "manual" (CSV upload)';
COMMENT ON COLUMN vmp_invoices.status IS 'Invoice status: pending (awaiting matching), matched (3-way match complete), paid, disputed, cancelled';
COMMENT ON COLUMN vmp_invoices.company_id IS 'Legal entity (company) that issued/received this invoice';
COMMENT ON COLUMN vmp_invoices.po_ref IS 'Purchase Order reference for 3-way matching';
COMMENT ON COLUMN vmp_invoices.grn_ref IS 'Goods Receipt Note reference for 3-way matching';

-- ============================================================================
-- PO REFERENCES (Simplified for Matching)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_po_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL, -- PO number (e.g., "PO-2024-001")
    vendor_id UUID REFERENCES vmp_vendors(id) ON DELETE SET NULL,
    total_amount DECIMAL(15, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, po_number)
);

COMMENT ON TABLE vmp_po_refs IS 'Purchase Order references for 3-way matching (simplified structure)';
COMMENT ON COLUMN vmp_po_refs.company_id IS 'Company that issued the PO';

-- ============================================================================
-- GRN REFERENCES (Simplified for Matching)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_grn_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    grn_number TEXT NOT NULL, -- GRN number (e.g., "GRN-2024-001")
    po_number TEXT, -- Linked PO number
    vendor_id UUID REFERENCES vmp_vendors(id) ON DELETE SET NULL,
    total_amount DECIMAL(15, 2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, grn_number)
);

COMMENT ON TABLE vmp_grn_refs IS 'Goods Receipt Note references for 3-way matching (simplified structure)';
COMMENT ON COLUMN vmp_grn_refs.company_id IS 'Company that received the goods';
COMMENT ON COLUMN vmp_grn_refs.po_number IS 'Linked Purchase Order number';

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_vendor_id ON vmp_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_company_id ON vmp_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_status ON vmp_invoices(status);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_source_system ON vmp_invoices(source_system);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_invoice_num ON vmp_invoices(invoice_num);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_invoice_date ON vmp_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_created_at ON vmp_invoices(created_at);

-- Composite index for vendor invoice lookup
CREATE INDEX IF NOT EXISTS idx_vmp_invoices_vendor_company_status ON vmp_invoices(vendor_id, company_id, status);

-- PO ref indexes
CREATE INDEX IF NOT EXISTS idx_vmp_po_refs_company_id ON vmp_po_refs(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_po_refs_vendor_id ON vmp_po_refs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_po_refs_po_number ON vmp_po_refs(po_number);
CREATE INDEX IF NOT EXISTS idx_vmp_po_refs_status ON vmp_po_refs(status);

-- GRN ref indexes
CREATE INDEX IF NOT EXISTS idx_vmp_grn_refs_company_id ON vmp_grn_refs(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_grn_refs_vendor_id ON vmp_grn_refs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_grn_refs_grn_number ON vmp_grn_refs(grn_number);
CREATE INDEX IF NOT EXISTS idx_vmp_grn_refs_po_number ON vmp_grn_refs(po_number);
CREATE INDEX IF NOT EXISTS idx_vmp_grn_refs_status ON vmp_grn_refs(status);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Already defined in table creation above

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE vmp_invoices IS 'Shadow Ledger: Maintains invoice records for manual/hybrid mode. Supports CSV ingest and future ERP integration.';
COMMENT ON TABLE vmp_po_refs IS 'Purchase Order references for 3-way matching. Simplified structure for MVP.';
COMMENT ON TABLE vmp_grn_refs IS 'Goods Receipt Note references for 3-way matching. Simplified structure for MVP.';

