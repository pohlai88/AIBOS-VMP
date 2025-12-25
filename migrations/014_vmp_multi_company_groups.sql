-- Migration: VMP Multi-Company Groups (Hierarchical Tenant Model)
-- Created: 2025-12-21
-- Description: Adds Group layer for "Director View" across multiple legal entities
-- Supports: One Vendor Master → Many Companies → Grouped for monitoring

-- ============================================================================
-- GROUPS (The "Alias" Layer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Global Retail Group", "Retail Division"
    code TEXT NOT NULL, -- Internal Alias Code (e.g., "RETAIL-GROUP")
    director_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    director_name TEXT, -- e.g., "John Smith"
    director_title TEXT, -- e.g., "Director, Retail Division"
    director_phone TEXT, -- Emergency contact phone (revealed on Break Glass)
    director_email TEXT, -- Emergency contact email (revealed on Break Glass)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

COMMENT ON TABLE vmp_groups IS 'Logical grouping of companies for "Director View" - allows monitoring across multiple legal entities';
COMMENT ON COLUMN vmp_groups.code IS 'Internal alias code for programmatic reference (e.g., "RETAIL-GROUP", "HOLDINGS")';
COMMENT ON COLUMN vmp_groups.director_user_id IS 'Internal user assigned as Group Director (for Break Glass Protocol)';
COMMENT ON COLUMN vmp_groups.director_name IS 'Director display name (e.g., "John Smith")';
COMMENT ON COLUMN vmp_groups.director_title IS 'Director title/role (e.g., "Director, Retail Division")';
COMMENT ON COLUMN vmp_groups.director_phone IS 'Emergency contact phone - revealed only on Level 3 escalation (Break Glass)';
COMMENT ON COLUMN vmp_groups.director_email IS 'Emergency contact email - revealed only on Level 3 escalation (Break Glass)';

-- ============================================================================
-- UPDATE COMPANIES: Add Group Link & Legal Entity Fields
-- ============================================================================
ALTER TABLE vmp_companies
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES vmp_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS legal_name TEXT,
    ADD COLUMN IF NOT EXISTS tax_id TEXT,
    ADD COLUMN IF NOT EXISTS country_code TEXT,
    ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD';

-- Update existing companies: set legal_name = name if not set
UPDATE vmp_companies SET legal_name = name WHERE legal_name IS NULL;

-- Make legal_name NOT NULL after backfill
ALTER TABLE vmp_companies
    ALTER COLUMN legal_name SET NOT NULL;

COMMENT ON COLUMN vmp_companies.group_id IS 'Links company to logical group for "Director View" filtering';
COMMENT ON COLUMN vmp_companies.legal_name IS 'Official registered legal name (e.g., "Alpha Trading Pte Ltd")';
COMMENT ON COLUMN vmp_companies.tax_id IS 'Tax identification number (UEN, VAT, etc.)';
COMMENT ON COLUMN vmp_companies.country_code IS 'ISO country code (e.g., "SG", "MY") - determines checklist rules';
COMMENT ON COLUMN vmp_companies.currency_code IS 'Default currency for invoices/payments (ISO 4217)';

-- ============================================================================
-- UPDATE CASES: Add Group ID (Denormalized for Fast Director View)
-- ============================================================================
ALTER TABLE vmp_cases
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES vmp_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN vmp_cases.group_id IS 'Denormalized group_id for fast "Director View" filtering (avoids JOINs)';

-- Backfill group_id from company relationship
UPDATE vmp_cases c
SET group_id = co.group_id
FROM vmp_companies co
WHERE c.company_id = co.id AND c.group_id IS NULL;

-- ============================================================================
-- UPDATE VENDOR-COMPANY LINKS: Add ERP Vendor Code
-- ============================================================================
ALTER TABLE vmp_vendor_company_links
    ADD COLUMN IF NOT EXISTS erp_vendor_code TEXT;

COMMENT ON COLUMN vmp_vendor_company_links.erp_vendor_code IS 'ERP-specific vendor code (e.g., "V001" in Company A, "999" in Company B)';

-- ============================================================================
-- UPDATE INTERNAL USERS: Add RBAC Scoping
-- ============================================================================
ALTER TABLE vmp_vendor_users
    ADD COLUMN IF NOT EXISTS scope_group_id UUID REFERENCES vmp_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scope_company_id UUID REFERENCES vmp_companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN vmp_vendor_users.scope_group_id IS 'Director View: User can see all companies in this group';
COMMENT ON COLUMN vmp_vendor_users.scope_company_id IS 'Manager View: User can see only this company';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_groups_tenant_id ON vmp_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_groups_code ON vmp_groups(code);
CREATE INDEX IF NOT EXISTS idx_vmp_companies_group_id ON vmp_companies(group_id);
CREATE INDEX IF NOT EXISTS idx_vmp_companies_country_code ON vmp_companies(country_code);
CREATE INDEX IF NOT EXISTS idx_vmp_cases_group_id ON vmp_cases(group_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_scope_group_id ON vmp_vendor_users(scope_group_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_scope_company_id ON vmp_vendor_users(scope_company_id);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================
-- Director View: Get all cases in a group
CREATE INDEX IF NOT EXISTS idx_vmp_cases_group_status ON vmp_cases(group_id, status) WHERE group_id IS NOT NULL;

-- Manager View: Get cases for specific company
CREATE INDEX IF NOT EXISTS idx_vmp_cases_company_status ON vmp_cases(company_id, status);

-- ============================================================================
-- BREAK GLASS AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_break_glass_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES vmp_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES vmp_vendor_users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES vmp_groups(id) ON DELETE SET NULL,
    director_user_id UUID REFERENCES vmp_vendor_users(id) ON DELETE SET NULL,
    director_name TEXT,
    director_contact TEXT, -- Phone or email (masked in queries, revealed on break glass)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_break_glass_events IS 'Audit log for Break Glass Protocol - tracks when Level 3 escalation reveals Director contact details';

CREATE INDEX IF NOT EXISTS idx_vmp_break_glass_events_case_id ON vmp_break_glass_events(case_id);
CREATE INDEX IF NOT EXISTS idx_vmp_break_glass_events_user_id ON vmp_break_glass_events(user_id);
CREATE INDEX IF NOT EXISTS idx_vmp_break_glass_events_created_at ON vmp_break_glass_events(created_at);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================
-- Ensure scope_group_id and scope_company_id are mutually exclusive for internal users
-- (A user should have either group scope OR company scope, not both)
-- Note: This is enforced at application level, not DB level (allows flexibility)

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE vmp_groups IS 'Hierarchical tenant model: Tenant → Group (Alias) → Company (Legal Entity). Groups enable "Director View" across multiple companies.';

