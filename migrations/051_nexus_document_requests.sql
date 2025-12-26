-- ============================================================================
-- Migration 051: Nexus Document Requests
-- C10: Document Request Flow
-- ============================================================================
-- Enables structured client → vendor document exchange
-- Tied to invoices, cases, or payments with full audit trail
-- ============================================================================

-- Document Requests Table
CREATE TABLE IF NOT EXISTS nexus_document_requests (
  request_id TEXT PRIMARY KEY,

  -- Parties
  client_id TEXT NOT NULL,      -- TC-* (requester)
  vendor_id TEXT NOT NULL,      -- TV-* (responder)

  -- Entity link (what is this request for?)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'case', 'payment')),
  entity_id TEXT NOT NULL,

  -- Request details
  document_type TEXT NOT NULL CHECK (document_type IN (
    'po',           -- Purchase Order
    'grn',          -- Goods Received Note
    'dn',           -- Debit Note
    'cn',           -- Credit Note
    'invoice_copy', -- Copy of Invoice
    'contract',     -- Contract / Agreement
    'pod',          -- Proof of Delivery
    'soa',          -- Statement of Account
    'other'         -- Other (freeform)
  )),
  message TEXT,                 -- Client's request message

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',    -- Client has requested
    'uploaded',     -- Vendor has uploaded
    'rejected',     -- Client rejected the upload (needs re-upload)
    'accepted',     -- Client accepted the document
    'cancelled'     -- Client cancelled the request
  )),

  -- Audit: creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,     -- USR-* who created

  -- Audit: response
  responded_at TIMESTAMPTZ,
  responded_by TEXT,            -- USR-* who uploaded

  -- File reference (populated on upload)
  file_path TEXT,               -- Storage path: /documents/{request_id}/{filename}
  file_name TEXT,               -- Original filename
  file_size_bytes INTEGER,
  file_mime_type TEXT,

  -- Review (populated on accept/reject)
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_notes TEXT
);

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================

-- Client inbox: my outgoing requests
CREATE INDEX idx_doc_requests_client
  ON nexus_document_requests (client_id, created_at DESC);

-- Vendor inbox: incoming requests to fulfill
CREATE INDEX idx_doc_requests_vendor
  ON nexus_document_requests (vendor_id, status, created_at DESC);

-- Entity lookup: find requests for a specific invoice/case/payment
CREATE INDEX idx_doc_requests_entity
  ON nexus_document_requests (entity_type, entity_id);

-- Status filter
CREATE INDEX idx_doc_requests_status
  ON nexus_document_requests (status, created_at DESC);

-- ============================================================================
-- Add notification types for document flow
-- ============================================================================

-- Extend notification_type constraint (if not already extended)
DO $$
BEGIN
  -- Drop and recreate constraint to include new types
  ALTER TABLE nexus_notifications
    DROP CONSTRAINT IF EXISTS nexus_notifications_notification_type_check;

  ALTER TABLE nexus_notifications
    ADD CONSTRAINT nexus_notifications_notification_type_check
    CHECK (notification_type IN (
      'case_assigned',
      'case_updated',
      'case_escalated',
      'message_received',
      'payment_received',
      'payment_pending',
      'system_announcement',
      'invoice_approved',
      'invoice_disputed',
      'document_requested',
      'document_uploaded',
      'document_accepted',
      'document_rejected'
    ));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Constraint update skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE nexus_document_requests IS 'C10: Structured document exchange between client and vendor';
COMMENT ON COLUMN nexus_document_requests.entity_type IS 'What entity this document relates to: invoice, case, or payment';
COMMENT ON COLUMN nexus_document_requests.document_type IS 'Type of document being requested: PO, GRN, DN, CN, etc.';
COMMENT ON COLUMN nexus_document_requests.status IS 'Workflow: requested → uploaded → accepted/rejected, or cancelled';
