-- Migration: VMP Access Requests
-- Created: 2025-01-22
-- Description: Stores vendor access requests from the sign-up form
-- Purpose: Enable administrators to review and process vendor access requests

-- ============================================================================
-- CREATE VMP_ACCESS_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    customer_company TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'invited')),
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_access_requests_email ON vmp_access_requests(email);
CREATE INDEX IF NOT EXISTS idx_vmp_access_requests_status ON vmp_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_vmp_access_requests_created_at ON vmp_access_requests(created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE vmp_access_requests IS 'Vendor access requests from the public sign-up form. Administrators review and approve/reject these requests.';
COMMENT ON COLUMN vmp_access_requests.email IS 'Email address of the requester (becomes invitation target if approved)';
COMMENT ON COLUMN vmp_access_requests.name IS 'Name of the requester';
COMMENT ON COLUMN vmp_access_requests.company IS 'Vendor company name';
COMMENT ON COLUMN vmp_access_requests.customer_company IS 'Customer company name (if provided)';
COMMENT ON COLUMN vmp_access_requests.message IS 'Optional message from requester';
COMMENT ON COLUMN vmp_access_requests.status IS 'Request status: pending, approved, rejected, or invited (invite sent)';
COMMENT ON COLUMN vmp_access_requests.reviewed_by_user_id IS 'Internal user who reviewed the request';
COMMENT ON COLUMN vmp_access_requests.reviewed_at IS 'Timestamp when request was reviewed';
COMMENT ON COLUMN vmp_access_requests.review_notes IS 'Administrator notes about the review decision';

