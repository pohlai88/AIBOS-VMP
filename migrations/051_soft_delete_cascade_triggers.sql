-- Migration: Soft Delete Cascade Triggers
-- Created: 2025-01-22
-- Description: Creates PostgreSQL triggers for cascading soft deletes
-- Purpose: When parent is soft-deleted, children are automatically soft-deleted

-- ============================================================================
-- PRINCIPLE: Cascading Soft Deletes
-- ============================================================================
-- In an ERP, if you delete an Invoice, you MUST delete InvoiceItems.
-- Leaving orphan items corrupts reports. Use PostgreSQL triggers for reliability.
-- ============================================================================

-- ============================================================================
-- 1. GENERIC CASCADE FUNCTION (Reusable Pattern)
-- ============================================================================

CREATE OR REPLACE FUNCTION cascade_soft_delete_children()
RETURNS TRIGGER AS $$
DECLARE
    child_table_name TEXT;
    parent_id_column TEXT;
BEGIN
    -- Get table and column names from trigger metadata
    child_table_name := TG_ARGV[0];
    parent_id_column := TG_ARGV[1];
    
    -- If the parent is being soft deleted...
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- ...Soft delete its children too
        EXECUTE format(
            'UPDATE %I SET deleted_at = $1, deleted_by = $2 WHERE %I = $3 AND deleted_at IS NULL',
            child_table_name,
            parent_id_column
        ) USING NEW.deleted_at, NEW.deleted_by, NEW.id;
    
    -- If the parent is being RESTORED...
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        -- ...Restore its children
        EXECUTE format(
            'UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE %I = $1 AND deleted_at IS NOT NULL',
            child_table_name,
            parent_id_column
        ) USING NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. CASE CASCADE (Case → Messages, Evidence, Checklist)
-- ============================================================================

-- Case → Messages
CREATE OR REPLACE FUNCTION cascade_soft_delete_case_messages()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE nexus_case_messages
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.case_id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE nexus_case_messages
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.case_id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_case_messages ON nexus_cases;
CREATE TRIGGER tr_cascade_case_messages
AFTER UPDATE ON nexus_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_case_messages();

-- Case → Evidence
CREATE OR REPLACE FUNCTION cascade_soft_delete_case_evidence()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE nexus_case_evidence
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.case_id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE nexus_case_evidence
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.case_id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_case_evidence ON nexus_cases;
CREATE TRIGGER tr_cascade_case_evidence
AFTER UPDATE ON nexus_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_case_evidence();

-- Case → Checklist
CREATE OR REPLACE FUNCTION cascade_soft_delete_case_checklist()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE nexus_case_checklist
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.case_id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE nexus_case_checklist
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.case_id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_case_checklist ON nexus_cases;
CREATE TRIGGER tr_cascade_case_checklist
AFTER UPDATE ON nexus_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_case_checklist();

-- ============================================================================
-- 3. VMP CASE CASCADE (vmp_cases → Messages, Evidence, Checklist)
-- ============================================================================

-- VMP Case → Messages
CREATE OR REPLACE FUNCTION cascade_soft_delete_vmp_case_messages()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE vmp_messages
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE vmp_messages
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_vmp_case_messages ON vmp_cases;
CREATE TRIGGER tr_cascade_vmp_case_messages
AFTER UPDATE ON vmp_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_vmp_case_messages();

-- VMP Case → Evidence
CREATE OR REPLACE FUNCTION cascade_soft_delete_vmp_case_evidence()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE vmp_evidence
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE vmp_evidence
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_vmp_case_evidence ON vmp_cases;
CREATE TRIGGER tr_cascade_vmp_case_evidence
AFTER UPDATE ON vmp_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_vmp_case_evidence();

-- VMP Case → Checklist Steps
CREATE OR REPLACE FUNCTION cascade_soft_delete_vmp_case_checklist()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        UPDATE vmp_checklist_steps
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE case_id = NEW.id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        UPDATE vmp_checklist_steps
        SET deleted_at = NULL, deleted_by = NULL
        WHERE case_id = NEW.id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_vmp_case_checklist ON vmp_cases;
CREATE TRIGGER tr_cascade_vmp_case_checklist
AFTER UPDATE ON vmp_cases
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_vmp_case_checklist();

-- ============================================================================
-- 4. INVOICE CASCADE (Invoice → Line Items - if you have invoice_items table)
-- ============================================================================
-- Uncomment and adjust if you have invoice_items or similar child tables

-- CREATE OR REPLACE FUNCTION cascade_soft_delete_invoice_items()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
--         UPDATE invoice_items
--         SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
--         WHERE invoice_id = NEW.id AND deleted_at IS NULL;
--     ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
--         UPDATE invoice_items
--         SET deleted_at = NULL, deleted_by = NULL
--         WHERE invoice_id = NEW.id AND deleted_at IS NOT NULL;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- DROP TRIGGER IF EXISTS tr_cascade_invoice_items ON nexus_invoices;
-- CREATE TRIGGER tr_cascade_invoice_items
-- AFTER UPDATE ON nexus_invoices
-- FOR EACH ROW
-- WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
-- EXECUTE FUNCTION cascade_soft_delete_invoice_items();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cascade_soft_delete_case_messages() IS 
    'Cascades soft delete/restore from nexus_cases to nexus_case_messages';
COMMENT ON FUNCTION cascade_soft_delete_case_evidence() IS 
    'Cascades soft delete/restore from nexus_cases to nexus_case_evidence';
COMMENT ON FUNCTION cascade_soft_delete_case_checklist() IS 
    'Cascades soft delete/restore from nexus_cases to nexus_case_checklist';

-- ============================================================================
-- NOTE: Add cascade triggers for other parent-child relationships as needed
-- ============================================================================
-- Pattern:
-- 1. Create function for specific relationship
-- 2. Create trigger on parent table
-- 3. Use WHEN clause to only fire on delete/restore changes

