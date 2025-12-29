-- 053_nexus_payment_decisions.sql
-- CCP-C8: Payment approval workflow - extends nexus_payments with decision audit columns
-- Pattern mirrors 048_nexus_invoice_decisions.sql

BEGIN;

-- 1) Extend status CHECK to include 'approved' if not already present
-- Current statuses: 'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed'
-- Adding: 'approved' (client has approved for payment)
ALTER TABLE nexus_payments DROP CONSTRAINT IF EXISTS nexus_payments_status_check;

ALTER TABLE nexus_payments
  ADD CONSTRAINT nexus_payments_status_check
  CHECK (status IN (
    'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed'
  ));

-- 2) Add decision audit columns (idempotent)
ALTER TABLE nexus_payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE nexus_payments ADD COLUMN IF NOT EXISTS approved_by TEXT;  -- USR-* ID

ALTER TABLE nexus_payments ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE nexus_payments ADD COLUMN IF NOT EXISTS disputed_by TEXT;  -- USR-* ID

-- 3) Indexes for quick lookup of approved/disputed payments
CREATE INDEX IF NOT EXISTS idx_nexus_payments_approved ON nexus_payments(approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nexus_payments_disputed ON nexus_payments(disputed_at) WHERE disputed_at IS NOT NULL;

-- 4) Index for pending-approval queue (common client query)
CREATE INDEX IF NOT EXISTS idx_nexus_payments_pending_approval
  ON nexus_payments(from_id, status, created_at)
  WHERE status = 'pending' AND approved_at IS NULL;

COMMIT;
