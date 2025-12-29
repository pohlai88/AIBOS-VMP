-- Migration: Soft Delete Partial Indexes
-- Created: 2025-01-22
-- Description: Creates partial indexes for unique constraints to work with soft delete
-- Purpose: Allow re-using unique values (e.g., email) after soft delete

-- ============================================================================
-- PRINCIPLE: Partial Indexes for Unique Constraints
-- ============================================================================
-- Problem: If you soft delete "john@example.com", the row stays in DB.
--         Creating new "john@example.com" fails due to unique constraint.
-- Solution: Partial indexes enforce uniqueness ONLY on active records.
-- ============================================================================

-- ============================================================================
-- 1. NEXUS CORE TABLES
-- ============================================================================

-- nexus_users: Email uniqueness (only active users)
DROP INDEX IF EXISTS idx_nexus_users_email;
CREATE UNIQUE INDEX idx_nexus_users_email_active 
ON nexus_users(email) 
WHERE deleted_at IS NULL;

-- nexus_users: user_id uniqueness (only active users)
DROP INDEX IF EXISTS idx_nexus_users_user_id;
CREATE UNIQUE INDEX idx_nexus_users_user_id_active 
ON nexus_users(user_id) 
WHERE deleted_at IS NULL;

-- nexus_tenants: tenant_id uniqueness (only active tenants)
DROP INDEX IF EXISTS idx_nexus_tenants_tenant_id;
CREATE UNIQUE INDEX idx_nexus_tenants_tenant_id_active 
ON nexus_tenants(tenant_id) 
WHERE deleted_at IS NULL;

-- nexus_tenants: tenant_client_id uniqueness (only active tenants)
DROP INDEX IF EXISTS idx_nexus_tenants_tenant_client_id;
CREATE UNIQUE INDEX idx_nexus_tenants_tenant_client_id_active 
ON nexus_tenants(tenant_client_id) 
WHERE deleted_at IS NULL;

-- nexus_tenants: tenant_vendor_id uniqueness (only active tenants)
DROP INDEX IF EXISTS idx_nexus_tenants_tenant_vendor_id;
CREATE UNIQUE INDEX idx_nexus_tenants_tenant_vendor_id_active 
ON nexus_tenants(tenant_vendor_id) 
WHERE deleted_at IS NULL;

-- nexus_cases: case_id uniqueness (only active cases)
DROP INDEX IF EXISTS idx_nexus_cases_case_id;
CREATE UNIQUE INDEX idx_nexus_cases_case_id_active 
ON nexus_cases(case_id) 
WHERE deleted_at IS NULL;

-- nexus_invoices: invoice_id uniqueness (only active invoices)
DROP INDEX IF EXISTS idx_nexus_invoices_invoice_id;
CREATE UNIQUE INDEX idx_nexus_invoices_invoice_id_active 
ON nexus_invoices(invoice_id) 
WHERE deleted_at IS NULL;

-- nexus_payments: payment_id uniqueness (only active payments)
DROP INDEX IF EXISTS idx_nexus_payments_payment_id;
CREATE UNIQUE INDEX idx_nexus_payments_payment_id_active 
ON nexus_payments(payment_id) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. VMP CORE TABLES
-- ============================================================================

-- vmp_vendor_users: Email uniqueness (only active users)
DROP INDEX IF EXISTS idx_vmp_vendor_users_email;
CREATE UNIQUE INDEX idx_vmp_vendor_users_email_active 
ON vmp_vendor_users(email) 
WHERE deleted_at IS NULL;

-- vmp_companies: Composite uniqueness (tenant_id + name) - only active
-- Note: Adjust based on your actual unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_vmp_companies_tenant_name_active 
ON vmp_companies(tenant_id, name) 
WHERE deleted_at IS NULL;

-- vmp_vendors: Composite uniqueness (tenant_id + name) - only active
CREATE UNIQUE INDEX IF NOT EXISTS idx_vmp_vendors_tenant_name_active 
ON vmp_vendors(tenant_id, name) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. SUPPORTING ENTITIES
-- ============================================================================

-- nexus_case_messages: message_id uniqueness (only active messages)
DROP INDEX IF EXISTS idx_nexus_case_messages_message_id;
CREATE UNIQUE INDEX idx_nexus_case_messages_message_id_active 
ON nexus_case_messages(message_id) 
WHERE deleted_at IS NULL;

-- nexus_case_checklist: item_id uniqueness (only active items)
DROP INDEX IF EXISTS idx_nexus_case_checklist_item_id;
CREATE UNIQUE INDEX idx_nexus_case_checklist_item_id_active 
ON nexus_case_checklist(item_id) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_nexus_users_email_active IS 
    'Enforces email uniqueness only for active users (deleted_at IS NULL). Allows re-using email after soft delete.';
COMMENT ON INDEX idx_nexus_tenants_tenant_id_active IS 
    'Enforces tenant_id uniqueness only for active tenants (deleted_at IS NULL).';
COMMENT ON INDEX idx_vmp_vendor_users_email_active IS 
    'Enforces email uniqueness only for active vendor users (deleted_at IS NULL).';

-- ============================================================================
-- NOTE: Add partial indexes for any other unique constraints in your schema
-- ============================================================================
-- Pattern:
-- CREATE UNIQUE INDEX idx_table_name_field_active 
-- ON table_name(field) 
-- WHERE deleted_at IS NULL;

