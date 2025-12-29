-- Migration: Add deleted_by to nexus_case_evidence
-- Created: 2025-01-22
-- Description: Completes CRUD-S pattern for evidence table by adding deleted_by audit column
-- Purpose: Make evidence deletion accountable (critical for dispute workflows)

-- ============================================================================
-- 1. ADD deleted_by COLUMN
-- ============================================================================

ALTER TABLE nexus_case_evidence
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- 2. COMMENTS
-- ============================================================================

COMMENT ON COLUMN nexus_case_evidence.deleted_by IS 'User ID who performed the soft delete (audit trail). Critical for dispute workflows.';

-- ============================================================================
-- 3. UPDATE REGISTRY
-- ============================================================================
-- After this migration, update src/adapters/nexus-adapter.js:
-- nexus_case_evidence: { idColumn: 'evidence_id', hasDeletedBy: true }

