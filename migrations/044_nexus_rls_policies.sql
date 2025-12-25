-- Migration 044: Nexus Row-Level Security Policies
-- RLS policies for all nexus_* tables
-- Philosophy: Tenant isolation enforced at database level

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
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

-- ============================================================================
-- HELPER FUNCTION: Get current user's tenant IDs from JWT
-- ============================================================================
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

-- ============================================================================
-- NEXUS_TENANTS POLICIES
-- ============================================================================
-- Users can only see their own tenant
CREATE POLICY tenant_isolation ON nexus_tenants
    FOR ALL
    USING (tenant_id = current_user_tenant_id());

-- Service role bypass
CREATE POLICY tenant_service_bypass ON nexus_tenants
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_TENANT_RELATIONSHIPS POLICIES
-- ============================================================================
-- Users can see relationships where their tenant is either client or vendor
CREATE POLICY relationship_isolation ON nexus_tenant_relationships
    FOR SELECT
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );

-- Users can create relationships where they are the client (inviting vendors)
CREATE POLICY relationship_create ON nexus_tenant_relationships
    FOR INSERT
    WITH CHECK (client_id = current_user_client_id());

-- Users can update relationships they are part of
CREATE POLICY relationship_update ON nexus_tenant_relationships
    FOR UPDATE
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );

-- Service role bypass
CREATE POLICY relationship_service_bypass ON nexus_tenant_relationships
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_RELATIONSHIP_INVITES POLICIES
-- ============================================================================
-- Inviters can see their own invites
CREATE POLICY invite_issuer ON nexus_relationship_invites
    FOR SELECT
    USING (inviting_tenant_id = current_user_tenant_id());

-- Anyone can view pending invite by token (for acceptance flow)
CREATE POLICY invite_by_token ON nexus_relationship_invites
    FOR SELECT
    USING (status = 'pending');

-- Inviters can create invites
CREATE POLICY invite_create ON nexus_relationship_invites
    FOR INSERT
    WITH CHECK (inviting_tenant_id = current_user_tenant_id());

-- Service role bypass
CREATE POLICY invite_service_bypass ON nexus_relationship_invites
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_USERS POLICIES
-- ============================================================================
-- Users can only see users in their tenant
CREATE POLICY user_tenant_isolation ON nexus_users
    FOR SELECT
    USING (tenant_id = current_user_tenant_id());

-- Users can update their own profile
CREATE POLICY user_self_update ON nexus_users
    FOR UPDATE
    USING (user_id = current_user_id());

-- Tenant admins can manage users (simplified - actual role check in application)
CREATE POLICY user_admin_manage ON nexus_users
    FOR ALL
    USING (tenant_id = current_user_tenant_id());

-- Service role bypass
CREATE POLICY user_service_bypass ON nexus_users
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_SESSIONS POLICIES
-- ============================================================================
-- Users can only see their own sessions
CREATE POLICY session_user_isolation ON nexus_sessions
    FOR ALL
    USING (user_id = current_user_id());

-- Service role bypass
CREATE POLICY session_service_bypass ON nexus_sessions
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_CASES POLICIES
-- ============================================================================
-- Users can see cases where their tenant is client or vendor
CREATE POLICY case_party_access ON nexus_cases
    FOR SELECT
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );

-- Clients can create cases
CREATE POLICY case_client_create ON nexus_cases
    FOR INSERT
    WITH CHECK (client_id = current_user_client_id());

-- Both parties can update cases they're part of
CREATE POLICY case_party_update ON nexus_cases
    FOR UPDATE
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );

-- Service role bypass
CREATE POLICY case_service_bypass ON nexus_cases
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_CASE_MESSAGES POLICIES
-- ============================================================================
-- Users can see messages in cases they have access to
CREATE POLICY message_case_access ON nexus_case_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_messages.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

-- Users can send messages to cases they have access to
CREATE POLICY message_create ON nexus_case_messages
    FOR INSERT
    WITH CHECK (
        sender_tenant_id = current_user_tenant_id() AND
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_messages.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

-- Service role bypass
CREATE POLICY message_service_bypass ON nexus_case_messages
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_CASE_EVIDENCE POLICIES
-- ============================================================================
-- Users can see evidence in cases they have access to
CREATE POLICY evidence_case_access ON nexus_case_evidence
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_evidence.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

-- Users can upload evidence to cases they have access to
CREATE POLICY evidence_create ON nexus_case_evidence
    FOR INSERT
    WITH CHECK (
        uploader_tenant_id = current_user_tenant_id() AND
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_evidence.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

-- Service role bypass
CREATE POLICY evidence_service_bypass ON nexus_case_evidence
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_CASE_CHECKLIST POLICIES
-- ============================================================================
CREATE POLICY checklist_case_access ON nexus_case_checklist
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_checklist.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

CREATE POLICY checklist_service_bypass ON nexus_case_checklist
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_CASE_ACTIVITY POLICIES
-- ============================================================================
CREATE POLICY activity_case_access ON nexus_case_activity
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases c
            WHERE c.case_id = nexus_case_activity.case_id
            AND (c.client_id = current_user_client_id() OR c.vendor_id = current_user_vendor_id())
        )
    );

CREATE POLICY activity_service_bypass ON nexus_case_activity
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_INVOICES POLICIES
-- ============================================================================
-- Vendors can see invoices they sent, clients can see invoices they received
CREATE POLICY invoice_party_access ON nexus_invoices
    FOR SELECT
    USING (
        vendor_id = current_user_vendor_id() OR
        client_id = current_user_client_id()
    );

-- Vendors can create invoices
CREATE POLICY invoice_vendor_create ON nexus_invoices
    FOR INSERT
    WITH CHECK (vendor_id = current_user_vendor_id());

-- Both parties can update (different permissions enforced in application)
CREATE POLICY invoice_party_update ON nexus_invoices
    FOR UPDATE
    USING (
        vendor_id = current_user_vendor_id() OR
        client_id = current_user_client_id()
    );

CREATE POLICY invoice_service_bypass ON nexus_invoices
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_PAYMENTS POLICIES
-- ============================================================================
-- Payers and payees can see payments
CREATE POLICY payment_party_access ON nexus_payments
    FOR SELECT
    USING (
        from_id = current_user_client_id() OR
        to_id = current_user_vendor_id()
    );

-- Clients (payers) can create payments
CREATE POLICY payment_client_create ON nexus_payments
    FOR INSERT
    WITH CHECK (from_id = current_user_client_id());

-- Both parties can update (different permissions enforced in application)
CREATE POLICY payment_party_update ON nexus_payments
    FOR UPDATE
    USING (
        from_id = current_user_client_id() OR
        to_id = current_user_vendor_id()
    );

CREATE POLICY payment_service_bypass ON nexus_payments
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_PAYMENT_SCHEDULE POLICIES
-- ============================================================================
CREATE POLICY schedule_party_access ON nexus_payment_schedule
    FOR ALL
    USING (
        from_id = current_user_client_id() OR
        to_id = current_user_vendor_id()
    );

CREATE POLICY schedule_service_bypass ON nexus_payment_schedule
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_PAYMENT_ACTIVITY POLICIES
-- ============================================================================
CREATE POLICY pay_activity_access ON nexus_payment_activity
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM nexus_payments p
            WHERE p.payment_id = nexus_payment_activity.payment_id
            AND (p.from_id = current_user_client_id() OR p.to_id = current_user_vendor_id())
        )
    );

CREATE POLICY pay_activity_service_bypass ON nexus_payment_activity
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_NOTIFICATIONS POLICIES
-- ============================================================================
-- Users can only see their own notifications
CREATE POLICY notification_user_access ON nexus_notifications
    FOR SELECT
    USING (user_id = current_user_id());

-- Users can update their own notifications (mark read)
CREATE POLICY notification_user_update ON nexus_notifications
    FOR UPDATE
    USING (user_id = current_user_id());

CREATE POLICY notification_service_bypass ON nexus_notifications
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_NOTIFICATION_CONFIG POLICIES
-- ============================================================================
-- Tenant admins can manage config (role check in application)
CREATE POLICY notif_config_tenant ON nexus_notification_config
    FOR ALL
    USING (tenant_id = current_user_tenant_id());

CREATE POLICY notif_config_service_bypass ON nexus_notification_config
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_USER_NOTIFICATION_PREFS POLICIES
-- ============================================================================
-- Users can only manage their own preferences
CREATE POLICY user_prefs_self ON nexus_user_notification_prefs
    FOR ALL
    USING (user_id = current_user_id());

CREATE POLICY user_prefs_service_bypass ON nexus_user_notification_prefs
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_NOTIFICATION_QUEUE POLICIES
-- ============================================================================
-- Queue is service-only
CREATE POLICY queue_service_only ON nexus_notification_queue
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- NEXUS_PUSH_SUBSCRIPTIONS POLICIES
-- ============================================================================
-- Users can only manage their own subscriptions
CREATE POLICY push_sub_self ON nexus_push_subscriptions
    FOR ALL
    USING (user_id = current_user_id());

CREATE POLICY push_sub_service_bypass ON nexus_push_subscriptions
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION current_user_tenant_id IS 'Returns the current user tenant_id from JWT or session.';
COMMENT ON FUNCTION current_user_id IS 'Returns the current user_id from JWT or session.';
COMMENT ON FUNCTION current_user_client_id IS 'Returns the current user tenant_client_id (TC-*) from JWT or session.';
COMMENT ON FUNCTION current_user_vendor_id IS 'Returns the current user tenant_vendor_id (TV-*) from JWT or session.';
