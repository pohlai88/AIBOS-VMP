-- 048_nexus_invoice_decisions.sql
-- MVP Patch: Client invoice approve / dispute + audit fields
-- NOTE: nexus_invoices.status currently uses a CHECK constraint. We extend it to include 'approved'.

BEGIN;

-- 1) Extend status CHECK to include 'approved'
-- Drop and recreate the constraint with the new status value
ALTER TABLE nexus_invoices DROP CONSTRAINT IF EXISTS nexus_invoices_status_check;

ALTER TABLE nexus_invoices
  ADD CONSTRAINT nexus_invoices_status_check
  CHECK (status IN (
    'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'disputed', 'cancelled', 'written_off', 'approved'
  ));

-- 2) Add decision audit columns (idempotent)
ALTER TABLE nexus_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE nexus_invoices ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE nexus_invoices ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE nexus_invoices ADD COLUMN IF NOT EXISTS disputed_by TEXT;

-- 3) Index for quick lookup of approved/disputed invoices
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_approved ON nexus_invoices(approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_disputed ON nexus_invoices(disputed_at) WHERE disputed_at IS NOT NULL;

COMMIT;
