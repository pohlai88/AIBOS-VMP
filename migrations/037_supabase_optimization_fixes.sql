-- Migration: Supabase Database Optimization & Security Fixes
-- Created: 2025-01-22
-- Description: Fixes all errors and warnings identified by Supabase advisors
-- Based on: Supabase MCP advisor audit results

-- ============================================================================
-- CRITICAL SECURITY FIXES (ERROR LEVEL)
-- ============================================================================

-- 1. Enable RLS on session table (CRITICAL ERROR)
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for session table (service role only for now)
DROP POLICY IF EXISTS "Service role has full access to sessions" ON public.session;
CREATE POLICY "Service role has full access to sessions"
    ON public.session FOR ALL
    USING ((SELECT auth.role()) = 'service_role');

COMMENT ON POLICY "Service role has full access to sessions" ON public.session IS 
    'Service role bypass for session management. Consider tenant-based policies in production.';

-- ============================================================================
-- PERFORMANCE FIXES: RLS Policy Optimization (WARN LEVEL)
-- ============================================================================
-- Fix RLS policies that re-evaluate auth functions for each row
-- Replace auth.role() with (SELECT auth.role()) for better performance

-- Fix policies that use auth.role() directly (should use SELECT pattern)
-- Note: Policies already using (SELECT auth.role()) are optimized

-- mdm_approval: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to approval" ON public.mdm_approval;

-- mdm_business_rule: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to business_rule" ON public.mdm_business_rule;

-- mdm_composite_kpi: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to composite_kpi" ON public.mdm_composite_kpi;

-- mdm_entity_catalog: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to entity_catalog" ON public.mdm_entity_catalog;

-- mdm_global_metadata: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to global_metadata" ON public.mdm_global_metadata;

-- mdm_glossary_term: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to glossary_term" ON public.mdm_glossary_term;

-- mdm_kpi_component: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to kpi_component" ON public.mdm_kpi_component;

-- mdm_kpi_definition: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to kpi_definition" ON public.mdm_kpi_definition;

-- mdm_lineage_edge: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to lineage_edge" ON public.mdm_lineage_edge;

-- mdm_lineage_node: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to lineage_node" ON public.mdm_lineage_node;

-- mdm_metadata_mapping: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to metadata_mapping" ON public.mdm_metadata_mapping;

-- mdm_profile: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to profile" ON public.mdm_profile;

-- mdm_standard_pack: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to standard_pack" ON public.mdm_standard_pack;

-- mdm_tag: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to tag" ON public.mdm_tag;

-- mdm_tag_assignment: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to tag_assignment" ON public.mdm_tag_assignment;

-- mdm_usage_log: Remove duplicate policy
DROP POLICY IF EXISTS "Service role has full access to usage_log" ON public.mdm_usage_log;

-- Fix policies that use auth.role() without SELECT (optimize for performance)
-- These policies need to be updated to use (SELECT auth.role()) pattern

-- mdm_approval: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to approvals" ON public.mdm_approval;
CREATE POLICY "Service role has full access to approvals"
    ON public.mdm_approval FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_business_rule: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to business rules" ON public.mdm_business_rule;
CREATE POLICY "Service role has full access to business rules"
    ON public.mdm_business_rule FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_composite_kpi: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to composite KPIs" ON public.mdm_composite_kpi;
CREATE POLICY "Service role has full access to composite KPIs"
    ON public.mdm_composite_kpi FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_entity_catalog: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to entity catalog" ON public.mdm_entity_catalog;
CREATE POLICY "Service role has full access to entity catalog"
    ON public.mdm_entity_catalog FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_global_metadata: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to global metadata" ON public.mdm_global_metadata;
CREATE POLICY "Service role has full access to global metadata"
    ON public.mdm_global_metadata FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_glossary_term: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to glossary terms" ON public.mdm_glossary_term;
CREATE POLICY "Service role has full access to glossary terms"
    ON public.mdm_glossary_term FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_kpi_component: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to KPI components" ON public.mdm_kpi_component;
CREATE POLICY "Service role has full access to KPI components"
    ON public.mdm_kpi_component FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_kpi_definition: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to KPI definitions" ON public.mdm_kpi_definition;
CREATE POLICY "Service role has full access to KPI definitions"
    ON public.mdm_kpi_definition FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_lineage_edge: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to lineage edges" ON public.mdm_lineage_edge;
CREATE POLICY "Service role has full access to lineage edges"
    ON public.mdm_lineage_edge FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_lineage_node: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to lineage nodes" ON public.mdm_lineage_node;
CREATE POLICY "Service role has full access to lineage nodes"
    ON public.mdm_lineage_node FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_metadata_mapping: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to metadata mapping" ON public.mdm_metadata_mapping;
CREATE POLICY "Service role has full access to metadata mapping"
    ON public.mdm_metadata_mapping FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_profile: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to profiles" ON public.mdm_profile;
CREATE POLICY "Service role has full access to profiles"
    ON public.mdm_profile FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_standard_pack: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to standard packs" ON public.mdm_standard_pack;
CREATE POLICY "Service role has full access to standard packs"
    ON public.mdm_standard_pack FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_tag: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to tags" ON public.mdm_tag;
CREATE POLICY "Service role has full access to tags"
    ON public.mdm_tag FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_tag_assignment: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to tag assignments" ON public.mdm_tag_assignment;
CREATE POLICY "Service role has full access to tag assignments"
    ON public.mdm_tag_assignment FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- mdm_usage_log: Update remaining policy to use SELECT pattern
DROP POLICY IF EXISTS "Service role has full access to usage logs" ON public.mdm_usage_log;
CREATE POLICY "Service role has full access to usage logs"
    ON public.mdm_usage_log FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Fix policies that use auth.uid() - optimize with SELECT pattern
-- Note: Many policies already use subqueries, but we need to ensure they use SELECT pattern

-- tenants: Fix policy to use SELECT pattern
DROP POLICY IF EXISTS "Authenticated users can view active tenants" ON public.tenants;
CREATE POLICY "Authenticated users can view active tenants"
    ON public.tenants FOR SELECT
    USING (status = 'active' AND (SELECT auth.role()) = 'authenticated');

-- users: Fix policies to use SELECT pattern for auth.uid()
DROP POLICY IF EXISTS "users_view_own_record" ON public.users;
CREATE POLICY "users_view_own_record"
    ON public.users FOR SELECT
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "users_update_own_record" ON public.users;
CREATE POLICY "users_update_own_record"
    ON public.users FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- notifications: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
CREATE POLICY "users_view_own_notifications"
    ON public.notifications FOR SELECT
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
CREATE POLICY "users_update_own_notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
CREATE POLICY "users_delete_own_notifications"
    ON public.notifications FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- messages: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_messages" ON public.messages;
CREATE POLICY "users_view_tenant_messages"
    ON public.messages FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_update_tenant_messages" ON public.messages;
CREATE POLICY "users_update_tenant_messages"
    ON public.messages FOR UPDATE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND sender_id = (SELECT auth.uid())
    )
    WITH CHECK (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND sender_id = (SELECT auth.uid())
    );

DROP POLICY IF EXISTS "users_delete_tenant_messages" ON public.messages;
CREATE POLICY "users_delete_tenant_messages"
    ON public.messages FOR DELETE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND sender_id = (SELECT auth.uid())
    );

-- message_threads: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_threads" ON public.message_threads;
CREATE POLICY "users_view_tenant_threads"
    ON public.message_threads FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_update_tenant_threads" ON public.message_threads;
CREATE POLICY "users_update_tenant_threads"
    ON public.message_threads FOR UPDATE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ))
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_delete_tenant_threads" ON public.message_threads;
CREATE POLICY "users_delete_tenant_threads"
    ON public.message_threads FOR DELETE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

-- documents: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_documents" ON public.documents;
CREATE POLICY "users_view_tenant_documents"
    ON public.documents FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_view_org_documents" ON public.documents;
CREATE POLICY "users_view_org_documents"
    ON public.documents FOR SELECT
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND organization_id IN (
            SELECT users.organization_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "users_insert_tenant_documents" ON public.documents;
CREATE POLICY "users_insert_tenant_documents"
    ON public.documents FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_update_tenant_documents" ON public.documents;
CREATE POLICY "users_update_tenant_documents"
    ON public.documents FOR UPDATE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ))
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_delete_tenant_documents" ON public.documents;
CREATE POLICY "users_delete_tenant_documents"
    ON public.documents FOR DELETE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_full_access_documents" ON public.documents;
CREATE POLICY "admins_full_access_documents"
    ON public.documents FOR UPDATE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = documents.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    )
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_delete_documents" ON public.documents;
CREATE POLICY "admins_delete_documents"
    ON public.documents FOR DELETE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = documents.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    );

-- payments: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_payments" ON public.payments;
CREATE POLICY "users_view_tenant_payments"
    ON public.payments FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_view_org_payments" ON public.payments;
CREATE POLICY "users_view_org_payments"
    ON public.payments FOR SELECT
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND organization_id IN (
            SELECT users.organization_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "users_update_tenant_payments" ON public.payments;
CREATE POLICY "users_update_tenant_payments"
    ON public.payments FOR UPDATE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ))
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_delete_tenant_payments" ON public.payments;
CREATE POLICY "users_delete_tenant_payments"
    ON public.payments FOR DELETE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_full_access_payments" ON public.payments;
CREATE POLICY "admins_full_access_payments"
    ON public.payments FOR UPDATE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = payments.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    )
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_delete_payments" ON public.payments;
CREATE POLICY "admins_delete_payments"
    ON public.payments FOR DELETE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = payments.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    );

-- statements: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_statements" ON public.statements;
CREATE POLICY "users_view_tenant_statements"
    ON public.statements FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_view_org_statements" ON public.statements;
CREATE POLICY "users_view_org_statements"
    ON public.statements FOR SELECT
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND organization_id IN (
            SELECT users.organization_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "users_update_tenant_statements" ON public.statements;
CREATE POLICY "users_update_tenant_statements"
    ON public.statements FOR UPDATE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ))
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_delete_tenant_statements" ON public.statements;
CREATE POLICY "users_delete_tenant_statements"
    ON public.statements FOR DELETE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_full_access_statements" ON public.statements;
CREATE POLICY "admins_full_access_statements"
    ON public.statements FOR UPDATE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = statements.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    )
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "admins_delete_statements" ON public.statements;
CREATE POLICY "admins_delete_statements"
    ON public.statements FOR DELETE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = statements.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    );

-- organizations: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_organizations" ON public.organizations;
CREATE POLICY "users_view_tenant_organizations"
    ON public.organizations FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_update_tenant_organizations" ON public.organizations;
CREATE POLICY "users_update_tenant_organizations"
    ON public.organizations FOR UPDATE
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ))
    WITH CHECK (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "users_delete_tenant_organizations" ON public.organizations;
CREATE POLICY "users_delete_tenant_organizations"
    ON public.organizations FOR DELETE
    USING (
        tenant_id IN (
            SELECT users.tenant_id
            FROM users
            WHERE users.id = (SELECT auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = (SELECT auth.uid())
                AND u.tenant_id = organizations.tenant_id
                AND u.role = ANY (ARRAY['admin', 'super_admin'])
        )
    );

-- document_embeddings: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_embeddings" ON public.document_embeddings;
CREATE POLICY "users_view_tenant_embeddings"
    ON public.document_embeddings FOR SELECT
    USING (tenant_id IN (
        SELECT users.tenant_id
        FROM users
        WHERE users.id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "service_role_manage_embeddings" ON public.document_embeddings;
CREATE POLICY "service_role_manage_embeddings"
    ON public.document_embeddings FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- company_groups: Fix policies to use SELECT pattern
DROP POLICY IF EXISTS "Company admins can manage company groups" ON public.company_groups;
CREATE POLICY "Company admins can manage company groups"
    ON public.company_groups FOR ALL
    USING (tenant_id IN (
        SELECT DISTINCT mdm_global_metadata.tenant_id
        FROM mdm_global_metadata
        WHERE mdm_global_metadata.created_by = (SELECT auth.uid())::text
        LIMIT 1
    ));

DROP POLICY IF EXISTS "Service role has full access to company groups" ON public.company_groups;
CREATE POLICY "Service role has full access to company groups"
    ON public.company_groups FOR ALL
    USING ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Users can view company groups in their tenant" ON public.company_groups;
CREATE POLICY "Users can view company groups in their tenant"
    ON public.company_groups FOR SELECT
    USING (
        tenant_id IN (
            SELECT DISTINCT mdm_global_metadata.tenant_id
            FROM mdm_global_metadata
            WHERE mdm_global_metadata.created_by = (SELECT auth.uid())::text
            LIMIT 1
        )
        OR EXISTS (
            SELECT 1
            FROM mdm_global_metadata
            WHERE mdm_global_metadata.tenant_id = company_groups.tenant_id
                AND mdm_global_metadata.created_by = (SELECT auth.uid())::text
        )
    );

-- tenants: Fix remaining policies
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant"
    ON public.tenants FOR SELECT
    USING (
        id IN (
            SELECT DISTINCT mdm_global_metadata.tenant_id
            FROM mdm_global_metadata
            WHERE mdm_global_metadata.created_by = (SELECT auth.uid())::text
            LIMIT 1
        )
        OR EXISTS (
            SELECT 1
            FROM mdm_global_metadata
            WHERE mdm_global_metadata.tenant_id = tenants.id
                AND mdm_global_metadata.created_by = (SELECT auth.uid())::text
        )
    );

DROP POLICY IF EXISTS "Service role has full access to tenants" ON public.tenants;
CREATE POLICY "Service role has full access to tenants"
    ON public.tenants FOR ALL
    USING ((SELECT auth.role()) = 'service_role');

-- users: Fix service role policy
DROP POLICY IF EXISTS "service_role_full_access" ON public.users;
CREATE POLICY "service_role_full_access"
    ON public.users FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- audit_events: Fix policy to use SELECT pattern
DROP POLICY IF EXISTS "users_view_tenant_audit_events" ON public.audit_events;
CREATE POLICY "users_view_tenant_audit_events"
    ON public.audit_events FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = (SELECT auth.uid())
            AND (
                (audit_events.table_name = ANY (ARRAY['documents', 'payments', 'statements', 'messages', 'message_threads', 'users', 'organizations'])
                    AND EXISTS (
                        SELECT 1
                        FROM information_schema.columns c
                        WHERE c.table_schema = 'public'
                            AND c.table_name = audit_events.table_name
                            AND c.column_name = 'tenant_id'
                    ))
                OR (audit_events.table_name = 'notifications'
                    AND (audit_events.new_values->>'user_id')::uuid = u.id)
            )
    ));

-- ============================================================================
-- PERFORMANCE FIXES: Add Indexes for Unindexed Foreign Keys (INFO LEVEL)
-- ============================================================================

-- Add indexes for foreign keys that don't have covering indexes
-- This improves query performance for foreign key lookups

CREATE INDEX IF NOT EXISTS idx_message_threads_vendor_id 
    ON public.message_threads(vendor_id);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_organization_id 
    ON public.messages(recipient_organization_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_organization_id 
    ON public.messages(sender_organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id 
    ON public.organizations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
    ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_vendor_id 
    ON public.payments(vendor_id);

CREATE INDEX IF NOT EXISTS idx_statements_vendor_id 
    ON public.statements(vendor_id);

CREATE INDEX IF NOT EXISTS idx_users_organization_id 
    ON public.users(organization_id);

CREATE INDEX IF NOT EXISTS idx_vmp_break_glass_events_director_user_id 
    ON public.vmp_break_glass_events(director_user_id);

CREATE INDEX IF NOT EXISTS idx_vmp_break_glass_events_group_id 
    ON public.vmp_break_glass_events(group_id);

CREATE INDEX IF NOT EXISTS idx_vmp_groups_director_user_id 
    ON public.vmp_groups(director_user_id);

CREATE INDEX IF NOT EXISTS idx_company_groups_created_by 
    ON public.company_groups(created_by);

CREATE INDEX IF NOT EXISTS idx_tenants_created_by 
    ON public.tenants(created_by);

CREATE INDEX IF NOT EXISTS idx_vmp_vendor_company_links_company_id 
    ON public.vmp_vendor_company_links(company_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_message_threads_vendor_id IS 
    'Index for foreign key message_threads_vendor_id_fkey - improves join performance';

COMMENT ON INDEX idx_messages_recipient_organization_id IS 
    'Index for foreign key messages_recipient_organization_id_fkey - improves join performance';

COMMENT ON INDEX idx_messages_sender_organization_id IS 
    'Index for foreign key messages_sender_organization_id_fkey - improves join performance';

COMMENT ON INDEX idx_organizations_tenant_id IS 
    'Index for foreign key organizations_tenant_id_fkey - improves join performance';

COMMENT ON INDEX idx_payments_invoice_id IS 
    'Index for foreign key payments_invoice_id_fkey - improves join performance';

COMMENT ON INDEX idx_payments_vendor_id IS 
    'Index for foreign key payments_vendor_id_fkey - improves join performance';

COMMENT ON INDEX idx_statements_vendor_id IS 
    'Index for foreign key statements_vendor_id_fkey - improves join performance';

COMMENT ON INDEX idx_users_organization_id IS 
    'Index for foreign key users_organization_id_fkey - improves join performance';

COMMENT ON INDEX idx_vmp_break_glass_events_director_user_id IS 
    'Index for foreign key vmp_break_glass_events_director_user_id_fkey - improves join performance';

COMMENT ON INDEX idx_vmp_break_glass_events_group_id IS 
    'Index for foreign key vmp_break_glass_events_group_id_fkey - improves join performance';

COMMENT ON INDEX idx_vmp_groups_director_user_id IS 
    'Index for foreign key vmp_groups_director_user_id_fkey - improves join performance';

COMMENT ON INDEX idx_company_groups_created_by IS 
    'Index for foreign key company_groups_created_by_fkey - improves join performance';

COMMENT ON INDEX idx_tenants_created_by IS 
    'Index for foreign key tenants_created_by_fkey - improves join performance';

COMMENT ON INDEX idx_vmp_vendor_company_links_company_id IS 
    'Index for foreign key vmp_vendor_company_links_company_id_fkey - improves join performance';

-- ============================================================================
-- MANUAL STEPS REQUIRED (Cannot be automated via migration)
-- ============================================================================

-- 1. Move pg_net extension to extensions schema:
--    ALTER EXTENSION pg_net SET SCHEMA extensions;
--    (Requires superuser access - run via Supabase Dashboard SQL Editor)

-- 2. Enable leaked password protection:
--    Go to Supabase Dashboard > Authentication > Settings > Password Security
--    Enable "Leaked Password Protection"
--    (Requires dashboard access - cannot be automated)

-- 3. Review unused indexes:
--    The advisor identified many unused indexes. Consider removing them after
--    monitoring query patterns for 30 days to ensure they're truly unused.
--    Use: DROP INDEX IF EXISTS index_name;

