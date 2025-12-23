-- Migration 027: SLA Analytics Performance Indexes
-- Adds indexes to optimize SLA metrics queries

-- Index for cases query (date range + scope filtering)
CREATE INDEX IF NOT EXISTS idx_vmp_cases_sla_analytics 
ON vmp_cases(tenant_id, created_at DESC, status, case_type)
WHERE status IN ('open', 'pending', 'resolved', 'closed');

-- Index for messages query (first message per case for response time)
CREATE INDEX IF NOT EXISTS idx_vmp_messages_first_per_case
ON vmp_messages(case_id, created_at ASC)
WHERE sender_type != 'system';

-- Composite index for team/company filtering
CREATE INDEX IF NOT EXISTS idx_vmp_cases_scope_filtering
ON vmp_cases(tenant_id, owner_team, company_id, created_at DESC);

-- Index for SLA due date queries
CREATE INDEX IF NOT EXISTS idx_vmp_cases_sla_due_at
ON vmp_cases(tenant_id, sla_due_at)
WHERE sla_due_at IS NOT NULL;

-- Index for case type breakdown
CREATE INDEX IF NOT EXISTS idx_vmp_cases_type_breakdown
ON vmp_cases(tenant_id, case_type, created_at DESC);

-- Index for message response time calculation
CREATE INDEX IF NOT EXISTS idx_vmp_messages_response_time
ON vmp_messages(case_id, created_at, sender_type)
WHERE sender_type IN ('vendor', 'internal', 'ai');

-- Comments
COMMENT ON INDEX idx_vmp_cases_sla_analytics IS 'Optimizes SLA analytics case queries by date range and scope';
COMMENT ON INDEX idx_vmp_messages_first_per_case IS 'Optimizes first message lookup for response time calculation';
COMMENT ON INDEX idx_vmp_cases_scope_filtering IS 'Optimizes team/company scope filtering';
COMMENT ON INDEX idx_vmp_cases_sla_due_at IS 'Optimizes SLA due date queries';
COMMENT ON INDEX idx_vmp_cases_type_breakdown IS 'Optimizes case type breakdown queries';
COMMENT ON INDEX idx_vmp_messages_response_time IS 'Optimizes response time calculation queries';

