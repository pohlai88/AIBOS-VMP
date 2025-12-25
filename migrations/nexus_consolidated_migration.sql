-- ============================================================================
-- NEXUS SCHEMA - CONSOLIDATED MIGRATION
-- Version: 1.0
-- Date: 2025-12-25
-- Project: vrawceruzokxitybkufk
--
-- This is a consolidated, optimized version of migrations 040-045
-- Run this single file in Supabase SQL Editor for a clean setup
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- SECTION 1: CORE TENANT TABLES (from 040)
-- ============================================================================

-- 1.1 NEXUS_TENANTS: Master tenant table with explicit sub-IDs
CREATE TABLE IF NOT EXISTS nexus_tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           TEXT UNIQUE NOT NULL,       -- TNT-XXXXXXXX
    tenant_client_id    TEXT UNIQUE NOT NULL,       -- TC-XXXXXXXX
    tenant_vendor_id    TEXT UNIQUE NOT NULL,       -- TV-XXXXXXXX
    name                TEXT NOT NULL,
    display_name        TEXT,
    email               TEXT,
    phone               TEXT,
    address             TEXT,
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
    onboarding_status   TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'active', 'completed')),
    settings            JSONB DEFAULT '{}',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_tenants_tenant_id ON nexus_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_client_id ON nexus_tenants(tenant_client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_vendor_id ON nexus_tenants(tenant_vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_tenants_status ON nexus_tenants(status);

-- 1.2 NEXUS_TENANT_RELATIONSHIPS: Binary relationships using explicit sub-IDs
CREATE TABLE IF NOT EXISTS nexus_tenant_relationships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX
    relationship_type   TEXT DEFAULT 'client_vendor' CHECK (relationship_type IN ('client_vendor', 'partner', 'affiliate')),
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'terminated')),
    invited_by          UUID,
    invite_token        TEXT,
    invite_accepted_at  TIMESTAMPTZ,
    contract_ref        TEXT,
    effective_from      DATE,
    effective_to        DATE,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_relationship UNIQUE (client_id, vendor_id),
    CONSTRAINT no_self_relationship CHECK (client_id != vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_nexus_relationships_client ON nexus_tenant_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_vendor ON nexus_tenant_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_status ON nexus_tenant_relationships(status);
CREATE INDEX IF NOT EXISTS idx_nexus_relationships_bidirectional ON nexus_tenant_relationships(client_id, vendor_id, status);

-- 1.3 NEXUS_RELATIONSHIP_INVITES: Pending invitations
CREATE TABLE IF NOT EXISTS nexus_relationship_invites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token               TEXT UNIQUE NOT NULL,
    inviting_tenant_id  TEXT NOT NULL,              -- TNT-XXXXXXXX
    inviting_client_id  TEXT NOT NULL,              -- TC-XXXXXXXX
    invitee_email       TEXT NOT NULL,
    invitee_name        TEXT,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at          TIMESTAMPTZ NOT NULL,
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    accepted_by_tenant_id TEXT,
    accepted_by_vendor_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_nexus_invites_token ON nexus_relationship_invites(token);
CREATE INDEX IF NOT EXISTS idx_nexus_invites_email ON nexus_relationship_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_nexus_invites_status ON nexus_relationship_invites(status);

-- 1.4 NEXUS_USERS: Users belong to a tenant
CREATE TABLE IF NOT EXISTS nexus_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT UNIQUE NOT NULL,       -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT,
    display_name        TEXT,
    first_name          TEXT,
    last_name           TEXT,
    phone               TEXT,
    avatar_url          TEXT,
    role                TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'archived')),
    email_verified      BOOLEAN DEFAULT false,
    preferences         JSONB DEFAULT '{}',
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_users_user_id ON nexus_users(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_users_tenant_id ON nexus_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_users_email ON nexus_users(email);
CREATE INDEX IF NOT EXISTS idx_nexus_users_status ON nexus_users(status);

-- 1.5 NEXUS_SESSIONS: User sessions
CREATE TABLE IF NOT EXISTS nexus_sessions (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX
    active_context      TEXT,                       -- 'client' | 'vendor'
    active_context_id   TEXT,                       -- TC-* or TV-*
    active_counterparty TEXT,
    data                JSONB DEFAULT '{}',
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    last_active_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_sessions_user_id ON nexus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_tenant_id ON nexus_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_expires ON nexus_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_cleanup ON nexus_sessions(expires_at) WHERE expires_at < now();

-- ============================================================================
-- SECTION 2: CASES TABLES (from 041)
-- ============================================================================

-- 2.1 NEXUS_CASES
CREATE TABLE IF NOT EXISTS nexus_cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             TEXT UNIQUE NOT NULL,       -- CASE-XXXXXXXX
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX
    relationship_id     UUID,
    subject             TEXT NOT NULL,
    description         TEXT,
    case_type           TEXT DEFAULT 'general' CHECK (case_type IN (
        'general', 'dispute', 'payment', 'delivery', 'quality', 'contract', 'compliance', 'other'
    )),
    status              TEXT DEFAULT 'open' CHECK (status IN (
        'draft', 'open', 'in_progress', 'pending_client', 'pending_vendor',
        'escalated', 'resolved', 'closed', 'cancelled'
    )),
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to         TEXT,
    assigned_at         TIMESTAMPTZ,
    sla_due_at          TIMESTAMPTZ,
    sla_breached        BOOLEAN DEFAULT false,
    sla_breach_at       TIMESTAMPTZ,
    resolution          TEXT,
    resolved_at         TIMESTAMPTZ,
    resolved_by         TEXT,
    invoice_ref         TEXT,
    payment_ref         TEXT,
    amount_disputed     DECIMAL(15, 2),
    currency            TEXT DEFAULT 'USD',
    tags                TEXT[] DEFAULT '{}',
    category            TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    closed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_cases_case_id ON nexus_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_client_id ON nexus_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_vendor_id ON nexus_cases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_status ON nexus_cases(status);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_priority ON nexus_cases(priority);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_assigned_to ON nexus_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_created ON nexus_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_cases_status_priority ON nexus_cases(status, priority, created_at DESC) WHERE status NOT IN ('closed', 'cancelled');

-- 2.2 NEXUS_CASE_MESSAGES
CREATE TABLE IF NOT EXISTS nexus_case_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          TEXT UNIQUE NOT NULL,       -- MSG-XXXXXXXX
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX
    sender_user_id      TEXT NOT NULL,              -- USR-XXXXXXXX
    sender_tenant_id    TEXT NOT NULL,              -- TNT-XXXXXXXX
    sender_context      TEXT NOT NULL CHECK (sender_context IN ('client', 'vendor')),
    sender_context_id   TEXT NOT NULL,              -- TC-* or TV-*
    body                TEXT NOT NULL,
    body_html           TEXT,
    message_type        TEXT DEFAULT 'message' CHECK (message_type IN (
        'message', 'note', 'system', 'status_change', 'escalation', 'resolution'
    )),
    attachments         TEXT[] DEFAULT '{}',
    is_read             BOOLEAN DEFAULT false,
    read_at             TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    edited_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_messages_case_id ON nexus_case_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_sender ON nexus_case_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_created ON nexus_case_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_messages_unread ON nexus_case_messages(case_id, is_read) WHERE is_read = false;

-- 2.3 NEXUS_CASE_EVIDENCE
CREATE TABLE IF NOT EXISTS nexus_case_evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id         TEXT UNIQUE NOT NULL,       -- EVD-XXXXXXXX
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX
    uploader_user_id    TEXT NOT NULL,              -- USR-XXXXXXXX
    uploader_tenant_id  TEXT NOT NULL,              -- TNT-XXXXXXXX
    uploader_context    TEXT NOT NULL CHECK (uploader_context IN ('client', 'vendor')),
    filename            TEXT NOT NULL,
    original_filename   TEXT NOT NULL,
    file_type           TEXT NOT NULL,
    file_size           BIGINT NOT NULL,
    file_extension      TEXT,
    storage_path        TEXT NOT NULL,
    storage_bucket      TEXT DEFAULT 'nexus-evidence',
    checksum            TEXT,
    verified            BOOLEAN DEFAULT false,
    verified_at         TIMESTAMPTZ,
    verified_by         TEXT,
    title               TEXT,
    description         TEXT,
    evidence_type       TEXT DEFAULT 'document' CHECK (evidence_type IN (
        'document', 'image', 'invoice', 'receipt', 'contract', 'correspondence', 'other'
    )),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_evidence_case_id ON nexus_case_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_uploader ON nexus_case_evidence(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_evidence_type ON nexus_case_evidence(evidence_type);

-- 2.4 NEXUS_CASE_CHECKLIST
CREATE TABLE IF NOT EXISTS nexus_case_checklist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id             TEXT UNIQUE NOT NULL,       -- CHK-XXXXXXXX
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX
    title               TEXT NOT NULL,
    description         TEXT,
    sort_order          INTEGER DEFAULT 0,
    is_completed        BOOLEAN DEFAULT false,
    completed_at        TIMESTAMPTZ,
    completed_by        TEXT,
    assignee_context    TEXT CHECK (assignee_context IN ('client', 'vendor')),
    due_date            DATE,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_checklist_case_id ON nexus_case_checklist(case_id);

-- 2.5 NEXUS_CASE_ACTIVITY
CREATE TABLE IF NOT EXISTS nexus_case_activity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id         TEXT UNIQUE NOT NULL,       -- ACT-XXXXXXXX
    case_id             TEXT NOT NULL,              -- CASE-XXXXXXXX
    actor_user_id       TEXT,
    actor_tenant_id     TEXT,
    actor_context       TEXT CHECK (actor_context IN ('client', 'vendor', 'system')),
    activity_type       TEXT NOT NULL CHECK (activity_type IN (
        'created', 'updated', 'status_changed', 'assigned', 'unassigned',
        'message_sent', 'evidence_uploaded', 'evidence_deleted',
        'checklist_completed', 'escalated', 'resolved', 'closed', 'reopened',
        'sla_warning', 'sla_breach', 'payment_linked', 'comment'
    )),
    title               TEXT NOT NULL,
    description         TEXT,
    old_value           TEXT,
    new_value           TEXT,
    reference_type      TEXT,
    reference_id        TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_activity_case_id ON nexus_case_activity(case_id);
CREATE INDEX IF NOT EXISTS idx_nexus_activity_type ON nexus_case_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_nexus_activity_created ON nexus_case_activity(created_at DESC);

-- ============================================================================
-- SECTION 3: PAYMENTS TABLES (from 042)
-- ============================================================================

-- 3.1 NEXUS_INVOICES
CREATE TABLE IF NOT EXISTS nexus_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          TEXT UNIQUE NOT NULL,       -- INV-XXXXXXXX
    vendor_id           TEXT NOT NULL,              -- TV-XXXXXXXX
    client_id           TEXT NOT NULL,              -- TC-XXXXXXXX
    relationship_id     UUID,
    invoice_number      TEXT,
    invoice_date        DATE NOT NULL,
    due_date            DATE NOT NULL,
    subtotal            DECIMAL(15, 2) NOT NULL,
    tax_amount          DECIMAL(15, 2) DEFAULT 0,
    discount_amount     DECIMAL(15, 2) DEFAULT 0,
    total_amount        DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    amount_paid         DECIMAL(15, 2) DEFAULT 0,
    amount_outstanding  DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    status              TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'disputed', 'cancelled', 'written_off'
    )),
    purchase_order      TEXT,
    contract_ref        TEXT,
    case_id             TEXT,
    description         TEXT,
    notes               TEXT,
    line_items          JSONB DEFAULT '[]',
    payment_terms       TEXT,
    metadata            JSONB DEFAULT '{}',
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

-- 3.2 NEXUS_PAYMENTS
CREATE TABLE IF NOT EXISTS nexus_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          TEXT UNIQUE NOT NULL,       -- PAY-XXXXXXXX
    from_id             TEXT NOT NULL,              -- TC-XXXXXXXX (payer)
    to_id               TEXT NOT NULL,              -- TV-XXXXXXXX (payee)
    relationship_id     UUID,
    invoice_id          TEXT,                       -- INV-XXXXXXXX
    amount              DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    status              TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed'
    )),
    payment_method      TEXT CHECK (payment_method IN (
        'bank_transfer', 'credit_card', 'check', 'cash', 'wire', 'ach', 'other'
    )),
    payment_reference   TEXT,
    payment_date        DATE,
    scheduled_date      DATE,
    bank_account_last4  TEXT,
    reconciled          BOOLEAN DEFAULT false,
    reconciled_at       TIMESTAMPTZ,
    reconciled_by       TEXT,
    description         TEXT,
    notes               TEXT,
    case_id             TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_payments_payment_id ON nexus_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_from ON nexus_payments(from_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_to ON nexus_payments(to_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_invoice ON nexus_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_status ON nexus_payments(status);
CREATE INDEX IF NOT EXISTS idx_nexus_payments_status_date ON nexus_payments(status, payment_date, created_at DESC);

-- 3.3 NEXUS_PAYMENT_SCHEDULE
CREATE TABLE IF NOT EXISTS nexus_payment_schedule (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id         TEXT UNIQUE NOT NULL,       -- SCH-XXXXXXXX
    from_id             TEXT NOT NULL,              -- TC-XXXXXXXX
    to_id               TEXT NOT NULL,              -- TV-XXXXXXXX
    amount              DECIMAL(15, 2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    frequency           TEXT CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
    start_date          DATE NOT NULL,
    end_date            DATE,
    next_payment_date   DATE,
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    description         TEXT,
    invoice_id          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_schedule_from ON nexus_payment_schedule(from_id);
CREATE INDEX IF NOT EXISTS idx_nexus_schedule_to ON nexus_payment_schedule(to_id);

-- 3.4 NEXUS_PAYMENT_ACTIVITY
CREATE TABLE IF NOT EXISTS nexus_payment_activity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id         TEXT UNIQUE NOT NULL,       -- PYA-XXXXXXXX
    payment_id          TEXT NOT NULL,              -- PAY-XXXXXXXX
    actor_user_id       TEXT,
    actor_tenant_id     TEXT,
    activity_type       TEXT NOT NULL CHECK (activity_type IN (
        'created', 'submitted', 'approved', 'processing', 'completed', 'failed',
        'cancelled', 'refunded', 'disputed', 'reconciled', 'reminder_sent', 'overdue'
    )),
    title               TEXT NOT NULL,
    description         TEXT,
    old_status          TEXT,
    new_status          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_payment ON nexus_payment_activity(payment_id);
CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_type ON nexus_payment_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_nexus_pay_activity_created ON nexus_payment_activity(created_at DESC);

-- ============================================================================
-- SECTION 4: NOTIFICATIONS TABLES (from 043)
-- ============================================================================

-- 4.1 NEXUS_NOTIFICATIONS
CREATE TABLE IF NOT EXISTS nexus_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     TEXT UNIQUE NOT NULL,       -- NTF-XXXXXXXX
    user_id             TEXT NOT NULL,              -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX
    context             TEXT CHECK (context IN ('client', 'vendor', 'both')),
    context_id          TEXT,
    notification_type   TEXT NOT NULL CHECK (notification_type IN (
        'payment_received', 'payment_pending', 'payment_overdue', 'payment_failed',
        'payment_disputed', 'payment_reminder', 'invoice_received', 'invoice_overdue',
        'case_created', 'case_updated', 'case_assigned', 'case_resolved', 'case_escalated',
        'message_received', 'evidence_uploaded',
        'vendor_linked', 'vendor_invite_received', 'vendor_invite_accepted',
        'relationship_suspended', 'relationship_terminated',
        'sla_warning', 'sla_breach',
        'system_announcement', 'maintenance_notice', 'welcome'
    )),
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    title               TEXT NOT NULL,
    body                TEXT,
    reference_type      TEXT,
    reference_id        TEXT,
    action_url          TEXT,
    action_label        TEXT,
    is_read             BOOLEAN DEFAULT false,
    read_at             TIMESTAMPTZ,
    delivered_realtime  BOOLEAN DEFAULT false,
    delivered_push      BOOLEAN DEFAULT false,
    delivered_email     BOOLEAN DEFAULT false,
    delivery_attempts   JSONB DEFAULT '[]',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    expires_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_notif_user ON nexus_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_tenant ON nexus_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_type ON nexus_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_unread ON nexus_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_nexus_notif_priority ON nexus_notifications(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_notifications_unread_priority ON nexus_notifications(user_id, priority, created_at DESC) WHERE is_read = false;

-- 4.2 NEXUS_NOTIFICATION_CONFIG
CREATE TABLE IF NOT EXISTS nexus_notification_config (
    tenant_id           TEXT PRIMARY KEY,           -- TNT-XXXXXXXX
    realtime_enabled    BOOLEAN DEFAULT true,
    push_enabled        BOOLEAN DEFAULT true,
    email_enabled       BOOLEAN DEFAULT true,
    max_per_hour        INTEGER DEFAULT 100,
    max_per_day         INTEGER DEFAULT 500,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start   TIME DEFAULT '22:00',
    quiet_hours_end     TIME DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    payment_always      BOOLEAN DEFAULT true,
    sla_always          BOOLEAN DEFAULT true,
    email_digest_mode   TEXT DEFAULT 'instant' CHECK (email_digest_mode IN ('instant', 'hourly', 'daily', 'weekly')),
    email_digest_time   TIME DEFAULT '09:00',
    email_digest_day    INTEGER DEFAULT 1,
    email_from_name     TEXT,
    email_reply_to      TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 4.3 NEXUS_USER_NOTIFICATION_PREFS
CREATE TABLE IF NOT EXISTS nexus_user_notification_prefs (
    user_id             TEXT PRIMARY KEY,           -- USR-XXXXXXXX
    tenant_id           TEXT NOT NULL,              -- TNT-XXXXXXXX
    realtime_enabled    BOOLEAN,
    push_enabled        BOOLEAN,
    email_enabled       BOOLEAN,
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,
    muted_until         TIMESTAMPTZ,
    email_digest_mode   TEXT CHECK (email_digest_mode IN ('instant', 'hourly', 'daily', 'weekly', 'none')),
    enabled_types       TEXT[],
    disabled_types      TEXT[],
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_user_prefs_tenant ON nexus_user_notification_prefs(tenant_id);

-- 4.4 NEXUS_NOTIFICATION_QUEUE
CREATE TABLE IF NOT EXISTS nexus_notification_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL,
    tenant_id           TEXT NOT NULL,
    channel             TEXT NOT NULL CHECK (channel IN ('realtime', 'push', 'email')),
    notification_id     TEXT NOT NULL,
    priority            TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    scheduled_for       TIMESTAMPTZ NOT NULL,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts            INTEGER DEFAULT 0,
    max_attempts        INTEGER DEFAULT 3,
    last_error          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_queue_pending ON nexus_notification_queue(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_nexus_queue_user ON nexus_notification_queue(user_id);

-- 4.5 NEXUS_PUSH_SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS nexus_push_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL,
    tenant_id           TEXT NOT NULL,
    endpoint            TEXT NOT NULL,
    p256dh_key          TEXT NOT NULL,
    auth_key            TEXT NOT NULL,
    device_name         TEXT,
    browser             TEXT,
    platform            TEXT,
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now(),
    last_used_at        TIMESTAMPTZ,
    CONSTRAINT unique_push_endpoint UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_nexus_push_user ON nexus_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_push_active ON nexus_push_subscriptions(user_id, is_active) WHERE is_active = true;

-- ============================================================================
-- SECTION 5: AUDIT LOG (from 045)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    actor_user_id TEXT,
    actor_tenant_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_audit_table ON nexus_audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_audit_record ON nexus_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_nexus_audit_actor ON nexus_audit_log(actor_user_id);

-- ============================================================================
-- SECTION 6: FUNCTIONS
-- ============================================================================

-- 6.1 ID Generation
CREATE OR REPLACE FUNCTION generate_nexus_id(prefix TEXT, name TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_code TEXT;
    random_suffix TEXT;
BEGIN
    random_suffix := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    IF name IS NOT NULL AND length(trim(name)) > 0 THEN
        base_code := upper(regexp_replace(substring(trim(name) from 1 for 4), '[^A-Za-z0-9]', '', 'g'));
        IF length(base_code) < 4 THEN
            base_code := base_code || substring(random_suffix from 1 for (4 - length(base_code)));
        END IF;
        RETURN prefix || '-' || base_code || substring(random_suffix from 1 for 4);
    ELSE
        RETURN prefix || '-' || random_suffix;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6.2 Updated At Trigger
CREATE OR REPLACE FUNCTION update_nexus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.3 RLS Helper Functions
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'tenant_id',
        current_setting('app.tenant_id', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'user_id',
        current_setting('app.user_id', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_client_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'tenant_client_id',
        current_setting('app.tenant_client_id', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_vendor_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'tenant_vendor_id',
        current_setting('app.tenant_vendor_id', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 Payment Status Trigger
CREATE OR REPLACE FUNCTION nexus_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO nexus_payment_activity (
            activity_id, payment_id, activity_type, title, old_status, new_status, created_at
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

-- 6.5 Audit Log Function
CREATE OR REPLACE FUNCTION write_nexus_audit_log(
    p_table_name TEXT,
    p_record_id TEXT,
    p_action TEXT,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_actor_user_id TEXT DEFAULT NULL,
    p_actor_tenant_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO nexus_audit_log (
        table_name, record_id, action, old_data, new_data,
        actor_user_id, actor_tenant_id, created_at
    ) VALUES (
        p_table_name, p_record_id, p_action, p_old_data, p_new_data,
        p_actor_user_id, p_actor_tenant_id, now()
    );
END;
$$ LANGUAGE plpgsql;

-- 6.6 Helper Functions
CREATE OR REPLACE FUNCTION validate_nexus_id(id TEXT, expected_prefix TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN id ~ ('^' || expected_prefix || '-[A-Z0-9]{4,}$');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_tenant_by_any_id(p_id TEXT)
RETURNS nexus_tenants AS $$
DECLARE
    result nexus_tenants%ROWTYPE;
BEGIN
    SELECT * INTO result FROM nexus_tenants
    WHERE tenant_id = p_id OR tenant_client_id = p_id OR tenant_vendor_id = p_id;
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 7: TRIGGERS
-- ============================================================================

-- Drop existing triggers first (idempotent)
DROP TRIGGER IF EXISTS nexus_tenants_updated_at ON nexus_tenants;
DROP TRIGGER IF EXISTS nexus_relationships_updated_at ON nexus_tenant_relationships;
DROP TRIGGER IF EXISTS nexus_users_updated_at ON nexus_users;
DROP TRIGGER IF EXISTS nexus_cases_updated_at ON nexus_cases;
DROP TRIGGER IF EXISTS nexus_checklist_updated_at ON nexus_case_checklist;
DROP TRIGGER IF EXISTS nexus_invoices_updated_at ON nexus_invoices;
DROP TRIGGER IF EXISTS nexus_payments_updated_at ON nexus_payments;
DROP TRIGGER IF EXISTS nexus_schedule_updated_at ON nexus_payment_schedule;
DROP TRIGGER IF EXISTS nexus_notif_config_updated_at ON nexus_notification_config;
DROP TRIGGER IF EXISTS nexus_user_prefs_updated_at ON nexus_user_notification_prefs;
DROP TRIGGER IF EXISTS nexus_payments_status_change ON nexus_payments;

-- Create triggers
CREATE TRIGGER nexus_tenants_updated_at BEFORE UPDATE ON nexus_tenants FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_relationships_updated_at BEFORE UPDATE ON nexus_tenant_relationships FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_users_updated_at BEFORE UPDATE ON nexus_users FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_cases_updated_at BEFORE UPDATE ON nexus_cases FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_checklist_updated_at BEFORE UPDATE ON nexus_case_checklist FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_invoices_updated_at BEFORE UPDATE ON nexus_invoices FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_payments_updated_at BEFORE UPDATE ON nexus_payments FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_schedule_updated_at BEFORE UPDATE ON nexus_payment_schedule FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_notif_config_updated_at BEFORE UPDATE ON nexus_notification_config FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_user_prefs_updated_at BEFORE UPDATE ON nexus_user_notification_prefs FOR EACH ROW EXECUTE FUNCTION update_nexus_updated_at();
CREATE TRIGGER nexus_payments_status_change AFTER UPDATE ON nexus_payments FOR EACH ROW EXECUTE FUNCTION nexus_payment_status_change();

-- Commit transaction
COMMIT;

-- ============================================================================
-- SECTION 8: RLS POLICIES (run separately after tables created)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE nexus_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_tenant_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_relationship_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_case_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_case_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_payment_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_user_notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (allows backend to access all data)
CREATE POLICY tenant_service_bypass ON nexus_tenants FOR ALL TO service_role USING (true);
CREATE POLICY relationship_service_bypass ON nexus_tenant_relationships FOR ALL TO service_role USING (true);
CREATE POLICY invite_service_bypass ON nexus_relationship_invites FOR ALL TO service_role USING (true);
CREATE POLICY user_service_bypass ON nexus_users FOR ALL TO service_role USING (true);
CREATE POLICY session_service_bypass ON nexus_sessions FOR ALL TO service_role USING (true);
CREATE POLICY case_service_bypass ON nexus_cases FOR ALL TO service_role USING (true);
CREATE POLICY message_service_bypass ON nexus_case_messages FOR ALL TO service_role USING (true);
CREATE POLICY evidence_service_bypass ON nexus_case_evidence FOR ALL TO service_role USING (true);
CREATE POLICY checklist_service_bypass ON nexus_case_checklist FOR ALL TO service_role USING (true);
CREATE POLICY activity_service_bypass ON nexus_case_activity FOR ALL TO service_role USING (true);
CREATE POLICY invoice_service_bypass ON nexus_invoices FOR ALL TO service_role USING (true);
CREATE POLICY payment_service_bypass ON nexus_payments FOR ALL TO service_role USING (true);
CREATE POLICY schedule_service_bypass ON nexus_payment_schedule FOR ALL TO service_role USING (true);
CREATE POLICY pay_activity_service_bypass ON nexus_payment_activity FOR ALL TO service_role USING (true);
CREATE POLICY notification_service_bypass ON nexus_notifications FOR ALL TO service_role USING (true);
CREATE POLICY notif_config_service_bypass ON nexus_notification_config FOR ALL TO service_role USING (true);
CREATE POLICY user_prefs_service_bypass ON nexus_user_notification_prefs FOR ALL TO service_role USING (true);
CREATE POLICY queue_service_bypass ON nexus_notification_queue FOR ALL TO service_role USING (true);
CREATE POLICY push_sub_service_bypass ON nexus_push_subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY audit_service_bypass ON nexus_audit_log FOR ALL TO service_role USING (true);

-- ============================================================================
-- DONE
-- ============================================================================
SELECT 'NEXUS SCHEMA MIGRATION COMPLETE' as status;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'nexus_%';
