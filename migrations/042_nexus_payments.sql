-- Migration 042: Nexus Payments Schema
-- Payments with explicit client/vendor ID references (from/to)
--
-- ID Convention:
--   PAY-XXXXXXXX  = Payment ID
--   INV-XXXXXXXX  = Invoice ID
--   from_id       = TC-XXXXXXXX (payer = client)
--   to_id         = TV-XXXXXXXX (payee = vendor)

-- ============================================================================
-- NEXUS_INVOICES: Invoices from vendor to client
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invoice identifier
    invoice_id          TEXT UNIQUE NOT NULL,       -- INV-XXXXXXXX

    -- Parties (vendor invoices client)
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX (who sends invoice)
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX (who receives invoice)
    relationship_id     UUID,                       -- Reference to nexus_tenant_relationships

    -- Invoice details
    invoice_number      TEXT,                       -- External invoice number
    invoice_date        DATE NOT NULL,
    due_date            DATE NOT NULL,

    -- Amounts
    subtotal            DECIMAL(15, 2) NOT NULL,
    tax_amount          DECIMAL(15, 2) DEFAULT 0,
    discount_amount     DECIMAL(15, 2) DEFAULT 0,
    total_amount        DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',

    -- Payment tracking
    amount_paid         DECIMAL(15, 2) DEFAULT 0,
    amount_outstanding  DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,

    -- Status
    status              TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'disputed', 'cancelled', 'written_off'
    )),

    -- Reference
    purchase_order      TEXT,
    contract_ref        TEXT,
    case_id             TEXT,                       -- CASE-XXXXXXXX if linked to dispute

    -- Description
    description         TEXT,
    notes               TEXT,

    -- Line items (stored as JSONB)
    line_items          JSONB DEFAULT '[]',

    -- Payment terms
    payment_terms       TEXT,                       -- NET30, NET60, etc.

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_invoices_invoice_id ON nexus_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_vendor ON nexus_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_client ON nexus_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_status ON nexus_invoices(status);
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_due_date ON nexus_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_nexus_invoices_overdue ON nexus_invoices(due_date, status) WHERE status NOT IN ('paid', 'cancelled', 'written_off');

-- ============================================================================
-- NEXUS_PAYMENTS: Payments from client to vendor
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Payment identifier
    payment_id          TEXT UNIQUE NOT NULL,       -- PAY-XXXXXXXX

    -- Parties (client pays vendor)
    from_id             TEXT NOT NULL,              -- TC-XXXXXXXX (payer = client)
    to_id               TEXT NOT NULL,              -- TV-XXXXXXXX (payee = vendor)
    relationship_id     UUID,                       -- Reference to nexus_tenant_relationships

    -- Invoice reference
    invoice_id          TEXT,                       -- INV-XXXXXXXX

    -- Payment details
    amount              DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',

    -- Status (PHASE 1 PRIORITY: Realtime notifications)
    status              TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed'
    )),

    -- Payment method
    payment_method      TEXT CHECK (payment_method IN (
        'bank_transfer', 'credit_card', 'check', 'cash', 'wire', 'ach', 'other'
    )),
    payment_reference   TEXT,                       -- External reference (bank ref, check #)

    -- Timing
    payment_date        DATE,
    scheduled_date      DATE,

    -- Bank details (encrypted in metadata)
    bank_account_last4  TEXT,

    -- Reconciliation
    reconciled          BOOLEAN DEFAULT false,
    reconciled_at       TIMESTAMPTZ,
    reconciled_by       TEXT,                       -- USR-XXXXXXXX

    -- Notes
    description         TEXT,
    notes               TEXT,

    -- Case reference if disputed
    case_id             TEXT,                       -- CASE-XXXXXXXX

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_payments_payment_id ON nexus_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_from ON nexus_payments(from_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_to ON nexus_payments(to_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_invoice ON nexus_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_status ON nexus_payments(status);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_date ON nexus_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_pending ON nexus_payments(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- NEXUS_PAYMENT_SCHEDULE: Scheduled/recurring payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_payment_schedule (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Schedule identifier
    schedule_id         TEXT UNIQUE NOT NULL,       -- SCH-XXXXXXXX

    -- Parties
    from_id             TEXT NOT NULL,              -- TC-XXXXXXXX (payer)
    to_id               TEXT NOT NULL,              -- TV-XXXXXXXX (payee)

    -- Schedule details
    amount              DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    frequency           TEXT CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),

    -- Timing
    start_date          DATE NOT NULL,
    end_date            DATE,
    next_payment_date   DATE,

    -- Status
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Reference
    description         TEXT,
    invoice_id          TEXT,                       -- Template invoice

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_schedule_from ON nexus_payment_schedule(from_id);
CREATE INDEX IF NOT EXISTS idx_nexus_schedule_to ON nexus_payment_schedule(to_id);
CREATE INDEX IF NOT EXISTS idx_nexus_schedule_next ON nexus_payment_schedule(next_payment_date) WHERE status = 'active';

-- ============================================================================
-- NEXUS_PAYMENT_ACTIVITY: Payment audit trail (for realtime notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_payment_activity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Activity identifier
    activity_id         TEXT UNIQUE NOT NULL,       -- PYA-XXXXXXXX

    -- Payment reference
    payment_id          TEXT NOT NULL,              -- PAY-XXXXXXXX

    -- Actor
    actor_user_id       TEXT,                       -- USR-XXXXXXXX
    actor_tenant_id     TEXT,                       -- TNT-XXXXXXXX

    -- Activity type (PRIORITY FOR REALTIME)
    activity_type       TEXT NOT NULL CHECK (activity_type IN (
        'created', 'submitted', 'approved', 'processing', 'completed', 'failed',
        'cancelled', 'refunded', 'disputed', 'reconciled', 'reminder_sent', 'overdue'
    )),

    -- Activity data
    title               TEXT NOT NULL,
    description         TEXT,
    old_status          TEXT,
    new_status          TEXT,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_payment ON nexus_payment_activity(payment_id);
CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_type ON nexus_payment_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_created ON nexus_payment_activity(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER nexus_invoices_updated_at
    BEFORE UPDATE ON nexus_invoices
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_payments_updated_at
    BEFORE UPDATE ON nexus_payments
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_schedule_updated_at
    BEFORE UPDATE ON nexus_payment_schedule
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

-- ============================================================================
-- PAYMENT STATUS CHANGE TRIGGER (For realtime notifications)
-- ============================================================================
CREATE OR REPLACE FUNCTION nexus_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO nexus_payment_activity (
            activity_id,
            payment_id,
            activity_type,
            title,
            old_status,
            new_status,
            created_at
        ) VALUES (
            'PYA-' || upper(substring(md5(random()::text) from 1 for 8)),
            NEW.payment_id,
            CASE NEW.status
                WHEN 'completed' THEN 'completed'
                WHEN 'failed' THEN 'failed'
                WHEN 'processing' THEN 'processing'
                WHEN 'disputed' THEN 'disputed'
                WHEN 'cancelled' THEN 'cancelled'
                WHEN 'refunded' THEN 'refunded'
                ELSE 'created'
            END,
            'Payment ' || NEW.payment_id || ' status changed to ' || NEW.status,
            OLD.status,
            NEW.status,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nexus_payments_status_change
    AFTER UPDATE ON nexus_payments
    FOR EACH ROW EXECUTE FUNCTION nexus_payment_status_change();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Payments with party names (for dashboard)
CREATE OR REPLACE VIEW nexus_payments_summary AS
SELECT
    p.*,
    payer.name as payer_name,
    payee.name as payee_name,
    i.invoice_number,
    i.total_amount as invoice_amount
FROM nexus_payments p
LEFT JOIN nexus_tenants payer ON payer.tenant_client_id = p.from_id
LEFT JOIN nexus_tenants payee ON payee.tenant_vendor_id = p.to_id
LEFT JOIN nexus_invoices i ON i.invoice_id = p.invoice_id;

-- View: Outstanding invoices
CREATE OR REPLACE VIEW nexus_invoices_outstanding AS
SELECT
    i.*,
    v.name as vendor_name,
    c.name as client_name,
    CASE
        WHEN i.due_date < CURRENT_DATE AND i.status NOT IN ('paid', 'cancelled') THEN true
        ELSE false
    END as is_overdue,
    CURRENT_DATE - i.due_date as days_overdue
FROM nexus_invoices i
LEFT JOIN nexus_tenants v ON v.tenant_vendor_id = i.vendor_id
LEFT JOIN nexus_tenants c ON c.tenant_client_id = i.client_id
WHERE i.amount_outstanding > 0
  AND i.status NOT IN ('cancelled', 'written_off');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE nexus_invoices IS 'Invoices from vendor (TV-*) to client (TC-*).';
COMMENT ON TABLE nexus_payments IS 'Payments from client (TC-*) to vendor (TV-*). Status changes trigger realtime notifications.';
COMMENT ON TABLE nexus_payment_schedule IS 'Scheduled/recurring payment definitions.';
COMMENT ON TABLE nexus_payment_activity IS 'Payment audit trail for realtime notifications.';
