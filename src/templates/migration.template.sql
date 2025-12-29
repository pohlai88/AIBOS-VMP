-- ============================================================================
-- TEMPLATE CONTRACT
-- ============================================================================
-- Type: Application
-- Category: Database Migration
-- Domain: {{Domain}} (finance | vendor | client | compliance | system)
-- Enforces: CRUD-S, RLS, Indexes, Constraints, Audit Columns
-- 
-- DO NOT MODIFY WITHOUT UPDATING:
-- - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
-- - docs/architecture/TEMPLATE_CONSTITUTION.md
-- - Version below
-- 
-- Version: 1.0.0
-- Last Updated: 2025-01-22
-- ============================================================================
-- 
-- Migration: Create {{TableName}} Table
-- Created: {{Date}}
-- Description: {{Description}}
-- Purpose: Stores {{EntityDescription}} with CRUD-S pattern and security
-- Domain: {{Domain}}
-- Related: [Link to issue, PR, or documentation]

-- ============================================================================
-- PREREQUISITES
-- ============================================================================
-- [ ] Previous migrations applied
-- [ ] Database backup completed
-- [ ] Tested on staging environment
-- [ ] RLS policies reviewed

-- ============================================================================
-- 1. TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.{{table_name}} (
  -- Primary Key
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Multi-Tenancy (Required)
  tenant_id UUID NOT NULL,
  
  -- Core Fields (Customize these)
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  
  -- Case Linkage (Evidence First - Optional but Recommended)
  -- If entity can be linked to a case, uncomment:
  -- case_id UUID REFERENCES nexus_cases(case_id),
  
  -- Add entity-specific fields here
  -- Example:
  -- amount NUMERIC NOT NULL,
  -- due_date DATE,
  -- description TEXT,
  
  -- CRUD-S (Soft Delete) Standard
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Audit Standard
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT {{table_name}}_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 2. INDEXES (Performance)
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_tenant_id 
ON public.{{table_name}}(tenant_id);

-- Status index (for filtering)
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_status 
ON public.{{table_name}}(status) 
WHERE deleted_at IS NULL;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_deleted_at 
ON public.{{table_name}}(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Created at index (for sorting)
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_created_at 
ON public.{{table_name}}(created_at DESC);

-- Case linkage index (if case_id column exists)
-- Uncomment if entity can be linked to cases:
-- CREATE INDEX IF NOT EXISTS idx_{{table_name}}_case_id 
-- ON public.{{table_name}}(case_id) 
-- WHERE case_id IS NOT NULL;

-- Partial index for uniqueness on active records only
-- Adjust fields based on your unique constraint requirements
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{table_name}}_unique_name 
ON public.{{table_name}}(tenant_id, name) 
WHERE deleted_at IS NULL;

-- Composite index for common queries (customize as needed)
-- CREATE INDEX IF NOT EXISTS idx_{{table_name}}_tenant_status 
-- ON public.{{table_name}}(tenant_id, status) 
-- WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.{{table_name}} ENABLE ROW LEVEL SECURITY;

-- Policy: View Active Records (Soft Delete Aware)
-- Standard users see only active records in their tenant
DROP POLICY IF EXISTS "users_view_active_{{table_name}}" ON public.{{table_name}};
CREATE POLICY "users_view_active_{{table_name}}"
ON public.{{table_name}} FOR SELECT
USING (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
  AND deleted_at IS NULL
);

-- Policy: Service Role (See All)
-- Service role can see all records including deleted (for system operations)
DROP POLICY IF EXISTS "service_role_view_all_{{table_name}}" ON public.{{table_name}};
CREATE POLICY "service_role_view_all_{{table_name}}"
ON public.{{table_name}} FOR SELECT
TO service_role
USING (true);

-- Policy: Insert
-- Users can create records in their tenant
DROP POLICY IF EXISTS "users_create_{{table_name}}" ON public.{{table_name}};
CREATE POLICY "users_create_{{table_name}}"
ON public.{{table_name}} FOR INSERT
WITH CHECK (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
);

-- Policy: Update Active Records (Soft Delete Aware)
-- Users can update only active records in their tenant
DROP POLICY IF EXISTS "users_update_active_{{table_name}}" ON public.{{table_name}};
CREATE POLICY "users_update_active_{{table_name}}"
ON public.{{table_name}} FOR UPDATE
USING (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
  AND deleted_at IS NULL
)
WITH CHECK (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
);

-- Policy: Soft Delete (Update deleted_at)
-- Users can soft delete records in their tenant
DROP POLICY IF EXISTS "users_soft_delete_{{table_name}}" ON public.{{table_name}};
CREATE POLICY "users_soft_delete_{{table_name}}"
ON public.{{table_name}} FOR UPDATE
USING (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
  AND deleted_at IS NULL
)
WITH CHECK (
  tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID
  AND deleted_at IS NOT NULL
);

-- ============================================================================
-- 4. TRIGGERS (Optional - for auto-updating updated_at)
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_{{table_name}}_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_{{table_name}}_updated_at ON public.{{table_name}};
CREATE TRIGGER tr_{{table_name}}_updated_at
BEFORE UPDATE ON public.{{table_name}}
FOR EACH ROW
EXECUTE FUNCTION update_{{table_name}}_updated_at();

-- ============================================================================
-- 5. CASCADE SOFT DELETE TRIGGER (If this table has children)
-- ============================================================================
-- Uncomment and customize if this table has child tables that should be
-- soft-deleted when parent is soft-deleted

-- CREATE OR REPLACE FUNCTION cascade_soft_delete_{{table_name}}_children()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
--     -- Soft delete children
--     UPDATE child_table
--     SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
--     WHERE parent_id = NEW.id AND deleted_at IS NULL;
--   ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
--     -- Restore children
--     UPDATE child_table
--     SET deleted_at = NULL, deleted_by = NULL
--     WHERE parent_id = NEW.id AND deleted_at IS NOT NULL;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- DROP TRIGGER IF EXISTS tr_cascade_{{table_name}}_delete ON public.{{table_name}};
-- CREATE TRIGGER tr_cascade_{{table_name}}_delete
-- AFTER UPDATE ON public.{{table_name}}
-- FOR EACH ROW
-- WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
-- EXECUTE FUNCTION cascade_soft_delete_{{table_name}}_children();

-- ============================================================================
-- 6. COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.{{table_name}} IS '{{Description}} - Stores {{EntityDescription}} with CRUD-S pattern';
COMMENT ON COLUMN public.{{table_name}}.id IS 'Primary key (UUID)';
COMMENT ON COLUMN public.{{table_name}}.tenant_id IS 'Multi-tenancy isolation';
COMMENT ON COLUMN public.{{table_name}}.deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN public.{{table_name}}.deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN public.{{table_name}}.is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';
COMMENT ON COLUMN public.{{table_name}}.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.{{table_name}}.created_by IS 'User ID who created the record';
COMMENT ON COLUMN public.{{table_name}}.updated_at IS 'Record last update timestamp (auto-updated via trigger)';
COMMENT ON COLUMN public.{{table_name}}.updated_by IS 'User ID who last updated the record';

-- ============================================================================
-- 7. VERIFICATION (Optional - for manual testing)
-- ============================================================================

-- Uncomment to verify migration
-- SELECT COUNT(*) FROM public.{{table_name}};
-- SELECT * FROM public.{{table_name}} LIMIT 1;
-- SELECT * FROM pg_policies WHERE tablename = '{{table_name}}';

-- ============================================================================
-- ROLLBACK (Optional - for complex migrations)
-- ============================================================================
-- If this migration needs to be rolled back, document the rollback steps here
-- 
-- Example:
-- DROP TRIGGER IF EXISTS tr_{{table_name}}_updated_at ON public.{{table_name}};
-- DROP FUNCTION IF EXISTS update_{{table_name}}_updated_at();
-- DROP POLICY IF EXISTS "users_view_active_{{table_name}}" ON public.{{table_name}};
-- DROP POLICY IF EXISTS "service_role_view_all_{{table_name}}" ON public.{{table_name}};
-- DROP POLICY IF EXISTS "users_create_{{table_name}}" ON public.{{table_name}};
-- DROP POLICY IF EXISTS "users_update_active_{{table_name}}" ON public.{{table_name}};
-- DROP POLICY IF EXISTS "users_soft_delete_{{table_name}}" ON public.{{table_name}};
-- DROP INDEX IF EXISTS idx_{{table_name}}_tenant_id;
-- DROP INDEX IF EXISTS idx_{{table_name}}_status;
-- DROP INDEX IF EXISTS idx_{{table_name}}_deleted_at;
-- DROP INDEX IF EXISTS idx_{{table_name}}_created_at;
-- DROP INDEX IF EXISTS idx_{{table_name}}_unique_name;
-- DROP TABLE IF EXISTS public.{{table_name}} CASCADE;

