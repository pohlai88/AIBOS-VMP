-- Migration: VMP Performance Indexes
-- Created: 2025-12-22
-- Description: Adds missing indexes on foreign keys and commonly queried columns for optimal performance

-- ============================================================================
-- FOREIGN KEY INDEXES (Critical for JOIN performance)
-- ============================================================================

-- vmp_cases foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_cases_tenant_id ON vmp_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_company_id ON vmp_cases(company_id);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_vendor_id ON vmp_cases(vendor_id);

-- vmp_checklist_steps foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_checklist_steps_case_id ON vmp_checklist_steps(case_id);

-- vmp_evidence foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_checklist_step_id ON vmp_evidence(checklist_step_id);

-- vmp_messages foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_messages_case_id ON vmp_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_messages_sender_user_id ON vmp_messages(sender_user_id);

-- vmp_sessions foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_sessions_user_id ON vmp_sessions(user_id);

-- vmp_vendor_users foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_vendor_id ON vmp_vendor_users(vendor_id);

-- vmp_vendors foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_tenant_id ON vmp_vendors(tenant_id);

-- vmp_invites foreign keys
CREATE INDEX IF NOT EXISTS idx_vmp_invites_vendor_id ON vmp_invites(vendor_id);

-- ============================================================================
-- QUERY OPTIMIZATION INDEXES (Common filter/sort columns)
-- ============================================================================

-- vmp_cases: status, created_at, sla_due_at (for inbox queries)
CREATE INDEX IF NOT EXISTS idx_vmp_cases_status ON vmp_cases(status);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_created_at ON vmp_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_sla_due_at ON vmp_cases(sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_cases_status_created_at ON vmp_cases(status, created_at DESC);

-- vmp_messages: created_at (for thread ordering)
CREATE INDEX IF NOT EXISTS idx_vmp_messages_created_at ON vmp_messages(created_at DESC);

-- vmp_sessions: expires_at (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_vmp_sessions_expires_at ON vmp_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- vmp_invites: expires_at, used_at (for validation queries)
CREATE INDEX IF NOT EXISTS idx_vmp_invites_expires_at ON vmp_invites(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vmp_invites_used_at ON vmp_invites(used_at) WHERE used_at IS NULL;

-- vmp_evidence: status (for filtering)
CREATE INDEX IF NOT EXISTS idx_vmp_evidence_status ON vmp_evidence(status);

-- ============================================================================
-- COMPOSITE INDEXES (Multi-column queries)
-- ============================================================================

-- vmp_cases: tenant + status (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_vmp_cases_tenant_status ON vmp_cases(tenant_id, status);

-- vmp_cases: vendor + status (vendor dashboard queries)
CREATE INDEX IF NOT EXISTS idx_vmp_cases_vendor_status ON vmp_cases(vendor_id, status);

-- vmp_messages: case + created_at (thread ordering)
CREATE INDEX IF NOT EXISTS idx_vmp_messages_case_created ON vmp_messages(case_id, created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_vmp_cases_tenant_id IS 'Foreign key index for tenant isolation queries';
COMMENT ON INDEX idx_vmp_cases_status_created_at IS 'Composite index for inbox filtering and sorting';
COMMENT ON INDEX idx_vmp_messages_case_created IS 'Composite index for thread message ordering';

