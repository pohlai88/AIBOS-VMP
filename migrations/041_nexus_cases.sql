-- Migration 041: Nexus Cases Schema
-- Cases with explicit client/vendor ID references
--
-- ID Convention:
--   CASE-XXXXXXXX = Case ID
--   client_id = TC-XXXXXXXX (who raised the case)
--   vendor_id = TV-XXXXXXXX (who serves the case)

-- ============================================================================
-- NEXUS_CASES: Cases use explicit sub-IDs for relationship context
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Case identifier
    case_id             TEXT UNIQUE NOT NULL,       -- CASE-XXXXXXXX

    -- Relationship context (who is client, who is vendor)
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX (raised by)
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX (served by)
    relationship_id     UUID,                       -- Reference to nexus_tenant_relationships

    -- Case details
    subject             TEXT NOT NULL,
    description         TEXT,
    case_type           TEXT DEFAULT 'general' CHECK (case_type IN (
        'general', 'dispute', 'payment', 'delivery', 'quality', 'contract', 'compliance', 'other'
    )),

    -- Status
    status              TEXT DEFAULT 'open' CHECK (status IN (
        'draft', 'open', 'in_progress', 'pending_client', 'pending_vendor',
        'escalated', 'resolved', 'closed', 'cancelled'
    )),
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Assignment
    assigned_to         TEXT,                       -- USR-XXXXXXXX (user handling the case)
    assigned_at         TIMESTAMPTZ,

    -- SLA tracking
    sla_due_at          TIMESTAMPTZ,
    sla_breached        BOOLEAN DEFAULT false,
    sla_breach_at       TIMESTAMPTZ,

    -- Resolution
    resolution          TEXT,
    resolved_at         TIMESTAMPTZ,
    resolved_by         TEXT,                       -- USR-XXXXXXXX

    -- Financial reference (if applicable)
    invoice_ref         TEXT,
    payment_ref         TEXT,
    amount_disputed     DECIMAL(15, 2),
    currency            TEXT DEFAULT 'USD',

    -- Tags and categorization
    tags                TEXT[] DEFAULT '{}',
    category            TEXT,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    closed_at           TIMESTAMPTZ
);

-- Indexes for case queries
CREATE INDEX IF NOT EXISTS idx_nexus_cases_case_id ON nexus_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_client_id ON nexus_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_vendor_id ON nexus_cases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_status ON nexus_cases(status);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_priority ON nexus_cases(priority);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_assigned_to ON nexus_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_sla_due ON nexus_cases(sla_due_at) WHERE status NOT IN ('closed', 'cancelled', 'resolved');
CREATE INDEX IF NOT EXISTS idx_nexus_cases_created ON nexus_cases(created_at DESC);

-- ============================================================================
-- NEXUS_CASE_MESSAGES: Thread messages within a case
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_case_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message identifier
    message_id          TEXT UNIQUE NOT NULL,       -- MSG-XXXXXXXX

    -- Case reference
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX

    -- Sender context
    sender_user_id      TEXT NOT NULL,              -- USR-XXXXXXXX
    sender_tenant_id    TEXT NOT NULL,              -- TNT-XXXXXXXX
    sender_context      TEXT NOT NULL CHECK (sender_context IN ('client', 'vendor')),
    sender_context_id   TEXT NOT NULL,              -- TC-* or TV-* depending on context

    -- Message content
    body                TEXT NOT NULL,
    body_html           TEXT,                       -- Rich text version

    -- Message type
    message_type        TEXT DEFAULT 'message' CHECK (message_type IN (
        'message', 'note', 'system', 'status_change', 'escalation', 'resolution'
    )),

    -- Attachments (stored as JSON array of evidence IDs)
    attachments         TEXT[] DEFAULT '{}',

    -- Read tracking
    is_read             BOOLEAN DEFAULT false,
    read_at             TIMESTAMPTZ,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    edited_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_messages_case_id ON nexus_case_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_sender ON nexus_case_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_tenant ON nexus_case_messages(sender_tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_created ON nexus_case_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_unread ON nexus_case_messages(case_id, is_read) WHERE is_read = false;

-- ============================================================================
-- NEXUS_CASE_EVIDENCE: Files/documents attached to cases
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_case_evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Evidence identifier
    evidence_id         TEXT UNIQUE NOT NULL,       -- EVD-XXXXXXXX

    -- Case reference
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX

    -- Uploader context
    uploader_user_id    TEXT NOT NULL,              -- USR-XXXXXXXX
    uploader_tenant_id  TEXT NOT NULL,              -- TNT-XXXXXXXX
    uploader_context    TEXT NOT NULL CHECK (uploader_context IN ('client', 'vendor')),

    -- File details
    filename            TEXT NOT NULL,
    original_filename   TEXT NOT NULL,
    file_type           TEXT NOT NULL,              -- MIME type
    file_size           BIGINT NOT NULL,            -- bytes
    file_extension      TEXT,

    -- Storage
    storage_path        TEXT NOT NULL,              -- Path in Supabase storage
    storage_bucket      TEXT DEFAULT 'evidence',

    -- Verification
    checksum            TEXT,                       -- SHA256
    verified            BOOLEAN DEFAULT false,
    verified_at         TIMESTAMPTZ,
    verified_by         TEXT,                       -- USR-XXXXXXXX

    -- Description
    title               TEXT,
    description         TEXT,

    -- Categorization
    evidence_type       TEXT DEFAULT 'document' CHECK (evidence_type IN (
        'document', 'image', 'invoice', 'receipt', 'contract', 'correspondence', 'other'
    )),

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ                 -- Soft delete
);

CREATE INDEX IF NOT EXISTS idx_nexus_evidence_case_id ON nexus_case_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_uploader ON nexus_case_evidence(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_type ON nexus_case_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_created ON nexus_case_evidence(created_at DESC);

-- ============================================================================
-- NEXUS_CASE_CHECKLIST: Checklist items for case workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_case_checklist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Checklist item identifier
    item_id             TEXT UNIQUE NOT NULL,       -- CHK-XXXXXXXX

    -- Case reference
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX

    -- Item details
    title               TEXT NOT NULL,
    description         TEXT,
    sort_order          INTEGER DEFAULT 0,

    -- Completion
    is_completed        BOOLEAN DEFAULT false,
    completed_at        TIMESTAMPTZ,
    completed_by        TEXT,                       -- USR-XXXXXXXX

    -- Assignment
    assignee_context    TEXT CHECK (assignee_context IN ('client', 'vendor')),
    due_date            DATE,

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_checklist_case_id ON nexus_case_checklist(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_checklist_completed ON nexus_case_checklist(case_id, is_completed);

-- ============================================================================
-- NEXUS_CASE_ACTIVITY: Activity log for case audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS nexus_case_activity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Activity identifier
    activity_id         TEXT UNIQUE NOT NULL,       -- ACT-XXXXXXXX

    -- Case reference
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX

    -- Actor
    actor_user_id       TEXT,                       -- USR-XXXXXXXX (null for system)
    actor_tenant_id     TEXT,                       -- TNT-XXXXXXXX
    actor_context       TEXT CHECK (actor_context IN ('client', 'vendor', 'system')),

    -- Activity details
    activity_type       TEXT NOT NULL CHECK (activity_type IN (
        'created', 'updated', 'status_changed', 'assigned', 'unassigned',
        'message_sent', 'evidence_uploaded', 'evidence_deleted',
        'checklist_completed', 'escalated', 'resolved', 'closed', 'reopened',
        'sla_warning', 'sla_breach', 'payment_linked', 'comment'
    )),

    -- Activity data
    title               TEXT NOT NULL,
    description         TEXT,
    old_value           TEXT,
    new_value           TEXT,

    -- References
    reference_type      TEXT,                       -- 'message', 'evidence', 'payment', etc.
    reference_id        TEXT,                       -- The referenced item's ID

    -- Metadata
    metadata            JSONB DEFAULT '{}',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_activity_case_id ON nexus_case_activity(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_activity_actor ON nexus_case_activity(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_activity_type ON nexus_case_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_nexus_activity_created ON nexus_case_activity(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER nexus_cases_updated_at
    BEFORE UPDATE ON nexus_cases
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

CREATE TRIGGER nexus_checklist_updated_at
    BEFORE UPDATE ON nexus_case_checklist
    FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Cases with unread message counts
CREATE OR REPLACE VIEW nexus_cases_with_unread AS
SELECT
    c.*,
    (SELECT COUNT(*) FROM nexus_case_messages m
     WHERE m.case_id = c.case_id AND m.is_read = false) as unread_count,
    (SELECT MAX(created_at) FROM nexus_case_messages m
     WHERE m.case_id = c.case_id) as last_message_at
FROM nexus_cases c;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE nexus_cases IS 'Cases with explicit client_id (TC-*) and vendor_id (TV-*) references.';
COMMENT ON TABLE nexus_case_messages IS 'Thread messages within a case. sender_context indicates client/vendor role.';
COMMENT ON TABLE nexus_case_evidence IS 'Evidence files attached to cases.';
COMMENT ON TABLE nexus_case_checklist IS 'Checklist items for case workflow tracking.';
COMMENT ON TABLE nexus_case_activity IS 'Audit trail of all case activities.';
