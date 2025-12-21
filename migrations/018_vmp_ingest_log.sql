-- Migration: VMP Ingest Log
-- Created: 2025-12-22
-- Description: Creates ingest log table for tracking CSV uploads and enabling rollback

-- ============================================================================
-- INGEST LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_ingest_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingest_type TEXT NOT NULL CHECK (ingest_type IN ('invoice', 'payment', 'remittance')),
    filename TEXT NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT CHECK (scope_type IN ('group', 'company')),
    scope_id UUID,
    uploaded_by UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE vmp_ingest_log IS 'Log of CSV uploads for data ingest operations';
COMMENT ON COLUMN vmp_ingest_log.ingest_type IS 'Type of ingest: invoice, payment, or remittance';
COMMENT ON COLUMN vmp_ingest_log.filename IS 'Original filename of uploaded CSV';
COMMENT ON COLUMN vmp_ingest_log.records_count IS 'Number of records processed';
COMMENT ON COLUMN vmp_ingest_log.scope_type IS 'Scope type: group or company';
COMMENT ON COLUMN vmp_ingest_log.scope_id IS 'ID of group or company (depending on scope_type)';
COMMENT ON COLUMN vmp_ingest_log.uploaded_by IS 'User who uploaded the file';
COMMENT ON COLUMN vmp_ingest_log.metadata IS 'Additional metadata (e.g., vendor_id, company_id, errors, failures)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_ingest_type ON vmp_ingest_log(ingest_type);
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_scope_type ON vmp_ingest_log(scope_type);
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_scope_id ON vmp_ingest_log(scope_id);
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_uploaded_by ON vmp_ingest_log(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_created_at ON vmp_ingest_log(created_at DESC);

-- ============================================================================
-- COMPOSITE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_ingest_log_scope ON vmp_ingest_log(scope_type, scope_id);

