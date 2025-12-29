-- Migration: Add Soft Delete Base Columns to Core Tables
-- Created: 2025-01-22
-- Description: Implements CRUD-S pattern foundation - adds deleted_at, deleted_by, is_archived to core business entities
-- Purpose: Enable soft delete for ERP compliance and audit requirements

-- ============================================================================
-- 1. CORE BUSINESS ENTITIES (High Priority)
-- ============================================================================

-- Nexus Core Tables
ALTER TABLE nexus_tenants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE nexus_users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE nexus_cases
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE nexus_invoices
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE nexus_payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- VMP Core Tables
ALTER TABLE vmp_vendors
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_companies
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_cases
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_invoices
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. SUPPORTING ENTITIES (Medium Priority)
-- ============================================================================

ALTER TABLE nexus_case_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE nexus_case_checklist
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_evidence
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE vmp_checklist_steps
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 3. COMMENTS
-- ============================================================================

COMMENT ON COLUMN nexus_tenants.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN nexus_tenants.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN nexus_tenants.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN nexus_users.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN nexus_users.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN nexus_users.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN nexus_cases.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN nexus_cases.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN nexus_cases.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN nexus_invoices.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN nexus_invoices.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN nexus_invoices.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN nexus_payments.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN nexus_payments.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN nexus_payments.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN vmp_vendors.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN vmp_vendors.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN vmp_vendors.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN vmp_companies.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN vmp_companies.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN vmp_companies.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN vmp_cases.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN vmp_cases.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN vmp_cases.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN vmp_invoices.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN vmp_invoices.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN vmp_invoices.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

COMMENT ON COLUMN vmp_payments.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN vmp_payments.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN vmp_payments.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';

-- ============================================================================
-- NOTE: RLS Policies and Partial Indexes will be added in separate migrations
-- ============================================================================
-- See: migrations/049_soft_delete_rls_policies.sql
-- See: migrations/050_soft_delete_partial_indexes.sql
-- See: migrations/051_soft_delete_cascade_triggers.sql

